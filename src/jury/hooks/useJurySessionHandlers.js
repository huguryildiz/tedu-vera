// src/jury/hooks/useJurySessionHandlers.js
// ============================================================
// Auth/session flow handlers extracted from useJuryHandlers.
//
// Handlers:
//   handleIdentitySubmit    — name + affiliation -> load periods
//   handlePeriodSelect      — period -> create/get juror, issue PIN
//   handlePinSubmit         — verify PIN, then call _loadPeriod
//   handlePinRevealContinue — auto-submit the revealed PIN
//   handleProgressContinue  — advance from progress_check step
//
// Internal:
//   _loadPeriod(period, overrideJurorId, _identityOverride, options)
//     Shared async function used by handlePinSubmit and
//     handlePeriodSelect. Intentionally NOT useCallback — including
//     it in any deps array causes infinite render loops. All reads use
//     stateRef.current for safe access outside the render cycle.
// ============================================================

import { useCallback } from "react";
import { getActiveCriteria } from "../../shared/criteriaHelpers";

import {
  listPeriods,
  listProjects,
  authenticateJuror,
  verifyJurorPin,
  getJurorEditState,
  verifyEntryToken,
} from "../../shared/api";
import {
  isAllFilled,
  makeEmptyTouched,
} from "../utils/scoreState";
import { buildScoreSnapshot } from "../utils/scoreSnapshot";
import { buildProgressCheck } from "../utils/progress";

export function useJurySessionHandlers({ identity, session, scoring, loading, workflow, editState, autosave, stateRef }) {
  // ── Internal: load period + projects ─────────────────────
  // Shared by handlePinSubmit and handlePeriodSelect.
  // Kept as a plain async function (intentionally NOT useCallback):
  // including it in any deps array causes infinite render loops.
  const _loadPeriod = async (period, overrideJurorId, _identityOverride, options = {}) => {
    const jid = overrideJurorId || stateRef.current.jurorId;
    const { showProgressCheck = false, showEmptyProgress = false } = options;

    // Cancel any previous in-flight load and issue a fresh signal.
    loading.loadAbortRef.current?.abort();
    const ctrl = new AbortController();
    loading.loadAbortRef.current = ctrl;
    const { signal } = ctrl;

    loading.setLoadingState({ stage: "loading", message: "Loading projects…" });
    try {
      const projectList = await listProjects(period.id, jid, signal);
      let editStateResult = null;
      try {
        const sessionToken = stateRef.current.jurorSessionToken;
        editStateResult = await getJurorEditState(period.id, jid, sessionToken, signal);
      } catch (e) {
        if (e?.name === "AbortError") throw e; // propagate abort
      }

      loading.setPeriodId(period.id);
      loading.setPeriodName(period.name);

      // Store the period's criteria config so the eval UI renders dynamically.
      // `period` comes from the listPeriods result which now includes criteria_config.
      const periodConfig = period.criteria_config || [];
      if (!period.criteria_config || period.criteria_config.length === 0) {
        console.warn(
          `[_loadPeriod] Period "${period.period_name}" (${period.id}) has no criteria_config — falling back to global CRITERIA from config.js`
        );
      }
      const outcomeConfig = period.outcome_config || [];
      loading.setCriteriaConfig(periodConfig);
      loading.setOutcomeConfig(outcomeConfig);
      const periodCriteria = getActiveCriteria(periodConfig);

      // Seed scores / comments from existing DB data
      const seedScores = Object.fromEntries(
        projectList.map((p) => [p.project_id, { ...p.scores }])
      );
      const seedComments = Object.fromEntries(
        projectList.map((p) => [p.project_id, p.comment || ""])
      );
      const seedTouched = makeEmptyTouched(projectList, periodCriteria);
      // A project is "synced" if all criteria are filled
      const seedSynced = Object.fromEntries(
        projectList
          .filter((p) => isAllFilled(seedScores, p.project_id, periodCriteria))
          .map((p) => [p.project_id, true])
      );

      // Strip to just the fields the UI needs
      const uiProjects = projectList.map((p) => ({
        project_id:         p.project_id,
        group_no:           p.group_no,
        title:              p.title,
        members:            p.members,
        final_submitted_at: p.final_submitted_at,
        updated_at:         p.updated_at,
      }));

      scoring.pendingScoresRef.current   = seedScores;
      scoring.pendingCommentsRef.current = seedComments;
      autosave.lastWrittenRef.current    = Object.fromEntries(
        projectList.map((p) => {
          const snapshot = buildScoreSnapshot(seedScores[p.project_id], seedComments[p.project_id], periodCriteria);
          return [p.project_id, { key: snapshot.key }];
        })
      );

      loading.setProjects(uiProjects);
      scoring.setScores(seedScores);
      scoring.setComments(seedComments);
      scoring.setTouched(seedTouched);
      scoring.setGroupSynced(seedSynced);
      workflow.setCurrent(0);
      workflow.doneFiredRef.current     = false;
      workflow.submitPendingRef.current = false;
      loading.setLoadingState(null);
      const canEdit = !!editStateResult?.edit_allowed;
      editState.setEditAllowed(canEdit);
      editState.setEditLockActive(!!editStateResult?.lock_active);

      const progressCheckData = buildProgressCheck(
        projectList,
        seedScores,
        { showProgressCheck, showEmptyProgress, canEdit }
      );
      const isFinalSubmitted = Boolean(
        projectList.find((p) => p.final_submitted_at)?.final_submitted_at
      );
      workflow.justLoadedRef.current = true;
      if (isFinalSubmitted) {
        scoring.setDoneScores({ ...seedScores });
        scoring.setDoneComments({ ...seedComments });
        editState.setEditMode(false);
        loading.setProgressCheck(null);
        workflow.setStep("done");
      } else {
        scoring.setDoneScores(null);
        scoring.setDoneComments(null);
        if (progressCheckData) {
          loading.setProgressCheck(progressCheckData);
          workflow.setStep("progress_check");
        } else {
          workflow.setStep("eval");
        }
      }
    } catch (e) {
      if (e?.name === "AbortError") return; // superseded by a newer load — ignore
      loading.setLoadingState(null);
      identity.setAuthError("Could not load projects. Please try again.");
      workflow.setStep("identity");
    }
  };

  // ── Period selection ──────────────────────────────────────
  const handlePeriodSelect = useCallback(
    async (period) => {
      // periodSelectLockRef: intentionally NOT reset on success — once the juror
      // advances past period selection they cannot navigate back, so the lock is
      // permanent for the session. Reset only on error (to allow retry) or resetAll.
      if (loading.periodSelectLockRef.current) return;
      if (!period?.is_current) {
        identity.setAuthError("Only the current period can be evaluated.");
        workflow.setStep("identity");
        return;
      }
      const name = identity.juryName.trim();
      const affiliation = identity.affiliation.trim();
      if (!name || !affiliation) {
        identity.setAuthError("Please enter your full name and affiliation.");
        workflow.setStep("identity");
        return;
      }
      loading.periodSelectLockRef.current = true;
      identity.setAuthError("");
      loading.setPeriodId(period.id);
      loading.setPeriodName(period.name);
      loading.setLoadingState({ stage: "loading", message: "Preparing access…" });
      try {
        const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
        const res = await authenticateJuror(period.id, name, affiliation, DEMO_MODE);
        if (res?.juror_name) identity.setJuryName(res.juror_name);
        if (res?.affiliation) identity.setAffiliation(res.affiliation);
        if (res?.needs_pin) {
          session.setIssuedPin("");
          session.setPinError("");
          const lockedUntil = res?.locked_until || "";
          const lockedDate  = lockedUntil ? new Date(lockedUntil) : null;
          const isLocked    = lockedDate && !Number.isNaN(lockedDate.getTime()) && lockedDate > new Date();
          if (isLocked) {
            session.setPinErrorCode("locked");
            session.setPinAttemptsLeft(0);
            session.setPinLockedUntil(lockedUntil);
          } else {
            session.setPinErrorCode("");
            session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
            session.setPinLockedUntil("");
          }
          loading.setLoadingState(null);
          workflow.setStep("pin");
          return;
        }
        session.setIssuedPin(res?.pin_plain_once || "");
        session.setPinError("");
        session.setPinErrorCode("");
        session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
        session.setPinLockedUntil("");
        loading.setLoadingState(null);
        workflow.setStep("pin_reveal");
      } catch (e) {
        loading.periodSelectLockRef.current = false;
        loading.setLoadingState(null);
        if (String(e?.message || "").includes("period_inactive")) {
          identity.setAuthError("This period is no longer active. Please try again.");
        } else {
          identity.setAuthError("Could not start the evaluation. Please try again.");
        }
        workflow.setStep("identity");
      }
    },
    [identity.juryName, identity.affiliation]
  );

  // ── Identity submit ────────────────────────────────────────
  const handleIdentitySubmit = useCallback(async () => {
    const name = identity.juryName.trim();
    const affiliation = identity.affiliation.trim();
    if (!name || !affiliation) {
      identity.setAuthError("Please enter your full name and affiliation.");
      return;
    }
    identity.setAuthError("");
    loading.loadAbortRef.current?.abort();
    const ctrl = new AbortController();
    loading.loadAbortRef.current = ctrl;
    loading.setLoadingState({ stage: "loading", message: "Loading periods…" });
    try {
      const periodList = await listPeriods(ctrl.signal);
      const active = (periodList || []).filter((p) => p.is_current);
      loading.setPeriods(active);
      // Demo mode: resolve correct period via entry token (not just active[0])
      const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
      const DEMO_ENTRY_TOKEN = import.meta.env.VITE_DEMO_ENTRY_TOKEN || "";
      if (DEMO_MODE && DEMO_ENTRY_TOKEN) {
        const tokenRes = await verifyEntryToken(DEMO_ENTRY_TOKEN);
        if (ctrl.signal.aborted) return;
        const target = tokenRes?.ok && tokenRes?.period_id
          ? active.find((p) => p.id === tokenRes.period_id) || active[0]
          : active[0];
        if (target) {
          await handlePeriodSelect(target);
          return;
        }
      }
      if (active.length === 1) {
        await handlePeriodSelect(active[0]);
        return;
      }
      loading.setLoadingState(null);
      workflow.setStep("period");
    } catch (e) {
      if (e?.name === "AbortError") return;
      loading.setLoadingState(null);
      identity.setAuthError("Could not load periods. Please try again.");
    }
  // _loadPeriod (via handlePeriodSelect) intentionally omitted from deps:
  // it is a plain async function and would cause an infinite loop if included.
  }, [identity.juryName, identity.affiliation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PIN submit ─────────────────────────────────────────────
  const handlePinSubmit = useCallback(async (enteredPin) => {
    session.setPinError("");
    session.setPinErrorCode("");
    session.setPinLockedUntil("");
    loading.setLoadingState({ stage: "loading", message: "Verifying…" });
    try {
      const res = await verifyJurorPin(
        loading.periodId, identity.juryName, identity.affiliation, enteredPin
      );
      if (!res?.ok) {
        loading.setLoadingState(null);
        const failedAttempts =
          typeof res?.failed_attempts === "number" ? res.failed_attempts : null;
        const lockedUntil = res?.locked_until || "";
        const lockedDate  = lockedUntil ? new Date(lockedUntil) : null;
        const isLocked    =
          res?.error_code === "locked"
          || (lockedDate && !Number.isNaN(lockedDate.getTime()) && lockedDate > new Date());
        if (res?.error_code === "period_inactive") {
          session.setPinErrorCode("period_inactive");
          session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
          session.setPinError("This period is no longer active. Please start a new evaluation.");
        } else if (res?.error_code === "not_found") {
          session.setPinErrorCode("not_found");
          session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
          session.setPinError("No juror found with this name and affiliation.");
        } else if (res?.error_code === "no_pin") {
          session.setPinErrorCode("no_pin");
          session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
          session.setPinError("No PIN found for this period. Please start a new evaluation.");
        } else if (isLocked) {
          session.setPinErrorCode("locked");
          session.setPinAttemptsLeft(0);
          session.setPinLockedUntil(lockedUntil);
          session.setPinError("locked");
        } else {
          session.setPinErrorCode("invalid");
          if (failedAttempts !== null) {
            session.setPinAttemptsLeft(Math.max(0, session.MAX_PIN_ATTEMPTS - failedAttempts));
          }
          session.setPinError("Incorrect PIN.");
        }
        return;
      }
      const jid          = res.juror_id;
      const sessionToken = String(res?.session_token || "").trim();
      if (!sessionToken) {
        loading.setLoadingState(null);
        session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
        session.setPinErrorCode("network");
        session.setPinLockedUntil("");
        session.setPinError("Session could not be established. Please try again.");
        return;
      }
      const nextName = res.juror_name || identity.juryName;
      const nextAffiliation = res.affiliation || identity.affiliation;
      if (res.juror_name) identity.setJuryName(res.juror_name);
      if (res.affiliation) identity.setAffiliation(res.affiliation);
      session.setJurorId(jid);
      session.setJurorSessionToken(sessionToken);
      if (res?.pin_plain_once) {
        session.setIssuedPin(res.pin_plain_once);
        session.setPinError("");
        session.setPinErrorCode("");
        session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
        session.setPinLockedUntil("");
        loading.setLoadingState(null);
        workflow.setStep("pin_reveal");
        return;
      }
      session.setIssuedPin("");
      session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
      session.setPinLockedUntil("");
      loading.setLoadingState(null);
      // Resolve the full period object (with criteria_config) from the loaded list.
      // Passing only { id, period_name } loses criteria_config, causing effectiveCriteria to
      // fall back to hardcoded config CRITERIA and crash for custom-criteria periods.
      const fullPeriod =
        loading.periods.find((p) => p.id === loading.periodId)
        || { id: loading.periodId, name: loading.periodName };
      await _loadPeriod(
        fullPeriod,
        jid,
        { name: nextName, affiliation: nextAffiliation },
        { showProgressCheck: true, showEmptyProgress: false }
      );
    } catch (_) {
      loading.setLoadingState(null);
      session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
      session.setPinErrorCode("network");
      session.setPinLockedUntil("");
      session.setPinError("Connection error. Please try again.");
    }
  // _loadPeriod intentionally omitted — plain async function; inclusion
  // causes infinite render loops. The periodId/Name deps already capture
  // the meaningful state changes that should re-trigger this handler.
  }, [loading.periodId, loading.periodName, identity.juryName, identity.affiliation]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinRevealContinue = useCallback(async () => {
    if (!session.issuedPin) return;
    await handlePinSubmit(session.issuedPin);
  }, [session.issuedPin, handlePinSubmit]);

  const handleProgressContinue = useCallback(() => {
    if (!loading.progressCheck?.nextStep) return;
    workflow.setStep(loading.progressCheck.nextStep);
    loading.setProgressCheck(null);
  }, [loading.progressCheck]);

  return {
    handleIdentitySubmit,
    handlePeriodSelect,
    handlePinSubmit,
    handlePinRevealContinue,
    handleProgressContinue,
  };
}
