// src/jury/hooks/useJurySessionHandlers.js
// ============================================================
// Auth/session flow handlers extracted from useJuryHandlers.
//
// Handlers:
//   handleIdentitySubmit    — name + dept -> load semesters
//   handleSemesterSelect    — semester -> create/get juror, issue PIN
//   handlePinSubmit         — verify PIN, then call _loadSemester
//   handlePinRevealContinue — auto-submit the revealed PIN
//   handleProgressContinue  — advance from progress_check step
//
// Internal:
//   _loadSemester(semester, overrideJurorId, _identityOverride, options)
//     Shared async function used by handlePinSubmit and
//     handleSemesterSelect. Intentionally NOT useCallback — including
//     it in any deps array causes infinite render loops. All reads use
//     stateRef.current for safe access outside the render cycle.
// ============================================================

import { useCallback } from "react";
import { getActiveCriteria } from "../../shared/criteriaHelpers";

import {
  listSemesters,
  listProjects,
  createOrGetJurorAndIssuePin,
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
  // ── Internal: load semester + projects ────────────────────
  // Shared by handlePinSubmit and handleSemesterSelect.
  // Kept as a plain async function (intentionally NOT useCallback):
  // including it in any deps array causes infinite render loops.
  const _loadSemester = async (semester, overrideJurorId, _identityOverride, options = {}) => {
    const jid = overrideJurorId || stateRef.current.jurorId;
    const { showProgressCheck = false, showEmptyProgress = false } = options;

    // Cancel any previous in-flight load and issue a fresh signal.
    loading.loadAbortRef.current?.abort();
    const ctrl = new AbortController();
    loading.loadAbortRef.current = ctrl;
    const { signal } = ctrl;

    loading.setLoadingState({ stage: "loading", message: "Loading projects…" });
    try {
      const projectList = await listProjects(semester.id, jid, signal);
      let editStateResult = null;
      try {
        const sessionToken = stateRef.current.jurorSessionToken;
        editStateResult = await getJurorEditState(semester.id, jid, sessionToken, signal);
      } catch (e) {
        if (e?.name === "AbortError") throw e; // propagate abort
      }

      loading.setSemesterId(semester.id);
      loading.setSemesterName(semester.semester_name);

      // Store the semester's criteria template so the eval UI renders dynamically.
      // `semester` comes from the listSemesters result which now includes criteria_template.
      const semTemplate = semester.criteria_template || [];
      if (!semester.criteria_template || semester.criteria_template.length === 0) {
        console.warn(
          `[_loadSemester] Semester "${semester.semester_name}" (${semester.id}) has no criteria_template — falling back to global CRITERIA from config.js`
        );
      }
      const mudekTemplate = semester.mudek_template || [];
      loading.setCriteriaTemplate(semTemplate);
      loading.setMudekTemplate(mudekTemplate);
      const semCriteria = getActiveCriteria(semTemplate);

      // Seed scores / comments from existing DB data
      const seedScores = Object.fromEntries(
        projectList.map((p) => [p.project_id, { ...p.scores }])
      );
      const seedComments = Object.fromEntries(
        projectList.map((p) => [p.project_id, p.comment || ""])
      );
      const seedTouched = makeEmptyTouched(projectList, semCriteria);
      // A project is "synced" if all criteria are filled
      const seedSynced = Object.fromEntries(
        projectList
          .filter((p) => isAllFilled(seedScores, p.project_id, semCriteria))
          .map((p) => [p.project_id, true])
      );

      // Strip to just the fields the UI needs
      const uiProjects = projectList.map((p) => ({
        project_id:         p.project_id,
        group_no:           p.group_no,
        project_title:      p.project_title,
        group_students:     p.group_students,
        final_submitted_at: p.final_submitted_at,
        updated_at:         p.updated_at,
      }));

      scoring.pendingScoresRef.current   = seedScores;
      scoring.pendingCommentsRef.current = seedComments;
      autosave.lastWrittenRef.current    = Object.fromEntries(
        projectList.map((p) => {
          const snapshot = buildScoreSnapshot(seedScores[p.project_id], seedComments[p.project_id], semCriteria);
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

  // ── Semester selection ─────────────────────────────────────
  const handleSemesterSelect = useCallback(
    async (semester) => {
      // semesterSelectLockRef: intentionally NOT reset on success — once the juror
      // advances past semester selection they cannot navigate back, so the lock is
      // permanent for the session. Reset only on error (to allow retry) or resetAll.
      if (loading.semesterSelectLockRef.current) return;
      if (!semester?.is_current) {
        identity.setAuthError("Only the current semester can be evaluated.");
        workflow.setStep("identity");
        return;
      }
      const name = identity.juryName.trim();
      const inst = identity.juryDept.trim();
      if (!name || !inst) {
        identity.setAuthError("Please enter your full name and institution / department.");
        workflow.setStep("identity");
        return;
      }
      loading.semesterSelectLockRef.current = true;
      identity.setAuthError("");
      loading.setSemesterId(semester.id);
      loading.setSemesterName(semester.semester_name);
      loading.setLoadingState({ stage: "loading", message: "Preparing access…" });
      try {
        const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
        const res = await createOrGetJurorAndIssuePin(semester.id, name, inst, DEMO_MODE);
        if (res?.juror_name) identity.setJuryName(res.juror_name);
        if (res?.juror_inst) identity.setJuryDept(res.juror_inst);
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
        loading.semesterSelectLockRef.current = false;
        loading.setLoadingState(null);
        if (String(e?.message || "").includes("semester_inactive")) {
          identity.setAuthError("This semester is no longer active. Please try again.");
        } else {
          identity.setAuthError("Could not start the evaluation. Please try again.");
        }
        workflow.setStep("identity");
      }
    },
    [identity.juryName, identity.juryDept]
  );

  // ── Identity submit ────────────────────────────────────────
  const handleIdentitySubmit = useCallback(async () => {
    const name = identity.juryName.trim();
    const inst = identity.juryDept.trim();
    if (!name || !inst) {
      identity.setAuthError("Please enter your full name and institution / department.");
      return;
    }
    identity.setAuthError("");
    loading.loadAbortRef.current?.abort();
    const ctrl = new AbortController();
    loading.loadAbortRef.current = ctrl;
    loading.setLoadingState({ stage: "loading", message: "Loading semesters…" });
    try {
      const semesterList = await listSemesters(ctrl.signal);
      const active = (semesterList || []).filter((s) => s.is_current);
      loading.setSemesters(active);
      // Demo mode: resolve correct semester via entry token (not just active[0])
      const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
      const DEMO_ENTRY_TOKEN = import.meta.env.VITE_DEMO_ENTRY_TOKEN || "";
      if (DEMO_MODE && DEMO_ENTRY_TOKEN) {
        const tokenRes = await verifyEntryToken(DEMO_ENTRY_TOKEN);
        if (ctrl.signal.aborted) return;
        const target = tokenRes?.ok && tokenRes?.semester_id
          ? active.find((s) => s.id === tokenRes.semester_id) || active[0]
          : active[0];
        if (target) {
          await handleSemesterSelect(target);
          return;
        }
      }
      if (active.length === 1) {
        await handleSemesterSelect(active[0]);
        return;
      }
      loading.setLoadingState(null);
      workflow.setStep("semester");
    } catch (e) {
      if (e?.name === "AbortError") return;
      loading.setLoadingState(null);
      identity.setAuthError("Could not load semesters. Please try again.");
    }
  // _loadSemester (via handleSemesterSelect) intentionally omitted from deps:
  // it is a plain async function and would cause an infinite loop if included.
  }, [identity.juryName, identity.juryDept]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PIN submit ─────────────────────────────────────────────
  const handlePinSubmit = useCallback(async (enteredPin) => {
    session.setPinError("");
    session.setPinErrorCode("");
    session.setPinLockedUntil("");
    loading.setLoadingState({ stage: "loading", message: "Verifying…" });
    try {
      const res = await verifyJurorPin(
        loading.semesterId, identity.juryName, identity.juryDept, enteredPin
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
        if (res?.error_code === "semester_inactive") {
          session.setPinErrorCode("semester_inactive");
          session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
          session.setPinError("This semester is no longer active. Please start a new evaluation.");
        } else if (res?.error_code === "not_found") {
          session.setPinErrorCode("not_found");
          session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
          session.setPinError("No juror found with this name and institution / department.");
        } else if (res?.error_code === "no_pin") {
          session.setPinErrorCode("no_pin");
          session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
          session.setPinError("No PIN found for this semester. Please start a new evaluation.");
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
      const nextInst = res.juror_inst || identity.juryDept;
      if (res.juror_name) identity.setJuryName(res.juror_name);
      if (res.juror_inst) identity.setJuryDept(res.juror_inst);
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
      // Resolve the full semester object (with criteria_template) from the loaded list.
      // Passing only { id, semester_name } loses criteria_template, causing effectiveCriteria to
      // fall back to hardcoded config CRITERIA and crash for custom-criteria semesters.
      const fullSemester =
        loading.semesters.find((s) => s.id === loading.semesterId)
        || { id: loading.semesterId, semester_name: loading.semesterName };
      await _loadSemester(
        fullSemester,
        jid,
        { name: nextName, inst: nextInst },
        { showProgressCheck: true, showEmptyProgress: false }
      );
    } catch (_) {
      loading.setLoadingState(null);
      session.setPinAttemptsLeft(session.MAX_PIN_ATTEMPTS);
      session.setPinErrorCode("network");
      session.setPinLockedUntil("");
      session.setPinError("Connection error. Please try again.");
    }
  // _loadSemester intentionally omitted — plain async function; inclusion
  // causes infinite render loops. The semesterId/Name deps already capture
  // the meaningful state changes that should re-trigger this handler.
  }, [loading.semesterId, loading.semesterName, identity.juryName, identity.juryDept]); // eslint-disable-line react-hooks/exhaustive-deps

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
    handleSemesterSelect,
    handlePinSubmit,
    handlePinRevealContinue,
    handleProgressContinue,
  };
}
