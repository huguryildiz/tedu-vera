// src/admin/hooks/useManagePeriods.js
// ============================================================
// Manages period CRUD state, eval-lock state, and derived
// period selection values.
//
// Extracted from useSettingsCrud.js (Phase 6 — Settings
// CRUD Decomposition).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listPeriods,
  createPeriod,
  updatePeriod,
  duplicatePeriod,
  savePeriodCriteria,
  reorderPeriodCriteria,
  deletePeriod,
  setEvalLock,
  listPeriodCriteria,
  listPeriodOutcomes,
  cloneFramework,
  assignFrameworkToPeriod,
  freezePeriodSnapshot,
  setPeriodCriteriaName,
  updatePeriodOutcomeConfig,
} from "@/shared/api";
import { getActiveCriteria } from "@/shared/criteria/criteriaHelpers";
import { sortPeriodsByStartDateDesc } from "@/shared/periodSort";
import { pickDefaultPeriod } from "@/jury/shared/periodSelection";
import {
  APP_DATE_MIN_DATE,
  APP_DATE_MAX_DATE,
  isIsoDateWithinBounds,
} from "@/shared/dateBounds";
import {
  getCriteriaScratch,
  setCriteriaScratch,
  clearCriteriaScratch,
} from "@/shared/storage/adminStorage";
import { usePageRealtime } from "@/admin/shared/usePageRealtime";

const defaultSettings = { evalLockActive: false };

const PERIOD_MIN_DATE = APP_DATE_MIN_DATE;
const PERIOD_MAX_DATE = APP_DATE_MAX_DATE;

const isPeriodPosterDateInRange = (value) =>
  isIsoDateWithinBounds(value, { minDate: PERIOD_MIN_DATE, maxDate: PERIOD_MAX_DATE });

/**
 * useManagePeriods — period CRUD, eval-lock, and derived period selection.
 *
 * @param {object} opts
 * @param {string}   opts.organizationId
 * @param {string}   opts.selectedPeriodId     Controlled by AdminPanel (current view period).
 * @param {Function} opts.setMessage             Toast setter from SettingsPage.
 * @param {Function} opts.setLoading             Loading setter from SettingsPage.
 * @param {Function} opts.setPanelError          (panel, msg) → sets a panel-level error.
 * @param {Function} opts.clearPanelError        (panel) → clears a panel-level error.
 */
export function useManagePeriods({
  organizationId,
  selectedPeriodId,
  setMessage,
  incLoading,
  decLoading,
  setPanelError,
  clearPanelError,
  bgRefresh,
}) {
  const [periodList, setPeriodList] = useState([]);
  const [currentPeriodId, setCurrentPeriodId] = useState("");
  const [settings, setSettings] = useState(defaultSettings);

  // Tracks the ID of a period that was updated externally via Realtime while edit modal is open
  const [externalUpdatedPeriodId, setExternalUpdatedPeriodId] = useState(null);

  // Tracks the ID of a period that was deleted externally via Realtime while edit modal is open
  const [externalDeletedPeriodId, setExternalDeletedPeriodId] = useState(null);

  // Eval-lock dialog state (owned here because it is driven by period state)
  const [evalLockError, setEvalLockError] = useState("");
  const [evalLockConfirmOpen, setEvalLockConfirmOpen] = useState(false);
  const [evalLockConfirmNext, setEvalLockConfirmNext] = useState(false);
  const [evalLockConfirmLoading, setEvalLockConfirmLoading] = useState(false);

  // ── Derived period values ──────────────────────────────
  const currentPeriod = useMemo(
    () => periodList.find((s) => s.id === currentPeriodId) || null,
    [periodList, currentPeriodId]
  );
  const currentPeriodLabel = currentPeriod?.name || "—";

  const viewPeriodId = useMemo(() => {
    if (selectedPeriodId && periodList.some((s) => s.id === selectedPeriodId))
      return selectedPeriodId;
    return currentPeriodId || "";
  }, [selectedPeriodId, periodList, currentPeriodId]);

  const viewPeriod = useMemo(
    () => periodList.find((s) => s.id === viewPeriodId) || null,
    [periodList, viewPeriodId]
  );
  const viewPeriodLabel = viewPeriod?.name || "—";

  // ── Period criteria & outcomes (from DB snapshot tables) ──
  const [criteriaConfig, setCriteriaConfig] = useState([]);
  const [outcomeConfig, setOutcomeConfig] = useState([]);

  // ── Draft/commit state for criteria ──
  const [savedCriteria, setSavedCriteria] = useState([]);
  const [draftCriteria, setDraftCriteria] = useState([]);

  // ── Draft meta (period-scoped rename + clear-all intent) ──
  // `pendingCriteriaName` is undefined when no rename is queued; a string or
  // null reflects the pending value. `pendingClearAll` signals that the user
  // asked to wipe all criteria + criteria_name on the next save.
  const [pendingCriteriaName, setPendingCriteriaNameState] = useState(undefined);
  const [pendingClearAll, setPendingClearAll] = useState(false);

  // ── Pending import preview (sessionStorage-backed, survives navigation) ──
  // Mirrors usePeriodOutcomes's pendingFrameworkImport so the "Criteria ready
  // to apply" banner is restored when the user navigates away and back.
  const [pendingCriteriaPreviewKind, setPendingCriteriaPreviewKindState] = useState(null);
  const [pendingCriteriaPreviewSource, setPendingCriteriaPreviewSourceState] = useState(null);

  // Criteria reload — only when the period itself changes (not framework).
  // framework_id changes must NOT reset draftCriteria: the user may have an
  // unsaved draft (e.g. VERA Standard template applied via updateDraft) that
  // would be silently wiped if we re-fetched on every framework assignment.
  useEffect(() => {
    if (!viewPeriodId) {
      setCriteriaConfig([]);
      setSavedCriteria([]);
      setDraftCriteria([]);
      setPendingCriteriaNameState(undefined);
      setPendingClearAll(false);
      setPendingCriteriaPreviewKindState(null);
      setPendingCriteriaPreviewSourceState(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const criteriaRows = await listPeriodCriteria(viewPeriodId);
        if (!alive) return;
        const active = getActiveCriteria(criteriaRows);
        setCriteriaConfig(active);
        setSavedCriteria(active);
        // Restore unsaved draft from sessionStorage if it exists; otherwise
        // start with the DB snapshot as the draft.
        const scratch = getCriteriaScratch(viewPeriodId);
        if (scratch?.pendingClearAll) {
          setDraftCriteria([]);
          setPendingClearAll(true);
          setPendingCriteriaNameState(
            Object.prototype.hasOwnProperty.call(scratch, "pendingCriteriaName")
              ? scratch.pendingCriteriaName
              : undefined
          );
        } else {
          setDraftCriteria(scratch?.items ?? structuredClone(active));
          setPendingClearAll(false);
          setPendingCriteriaNameState(
            scratch && Object.prototype.hasOwnProperty.call(scratch, "pendingCriteriaName")
              ? scratch.pendingCriteriaName
              : undefined
          );
        }
        // Restore "ready to apply" banner state from scratch so navigation
        // away and back shows the banner again (OutcomesPage pattern).
        setPendingCriteriaPreviewKindState(scratch?.pendingCriteriaPreviewKind ?? null);
        setPendingCriteriaPreviewSourceState(scratch?.pendingCriteriaPreviewSource ?? null);
      } catch {
        if (alive) {
          setCriteriaConfig([]);
          setSavedCriteria([]);
          setDraftCriteria([]);
          setPendingCriteriaNameState(undefined);
          setPendingClearAll(false);
          setPendingCriteriaPreviewKindState(null);
          setPendingCriteriaPreviewSourceState(null);
        }
      }
    })();
    return () => { alive = false; };
  }, [viewPeriodId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync draft to sessionStorage so it survives page refresh / navigation.
  // Only clear the scratch once we have confirmed loaded data (savedCriteria
  // non-empty). On initial mount both states are [] — skipping the clear
  // prevents wiping the scratch before the async DB fetch runs.
  useEffect(() => {
    if (!viewPeriodId) return;
    const itemsDirty = JSON.stringify(draftCriteria) !== JSON.stringify(savedCriteria);
    const metaDirty = pendingCriteriaName !== undefined || pendingClearAll || pendingCriteriaPreviewKind !== null;
    if (itemsDirty || metaDirty) {
      const payload = { items: draftCriteria };
      if (pendingCriteriaName !== undefined) payload.pendingCriteriaName = pendingCriteriaName;
      if (pendingClearAll) payload.pendingClearAll = true;
      if (pendingCriteriaPreviewKind !== null) payload.pendingCriteriaPreviewKind = pendingCriteriaPreviewKind;
      if (pendingCriteriaPreviewSource !== null) payload.pendingCriteriaPreviewSource = pendingCriteriaPreviewSource;
      setCriteriaScratch(viewPeriodId, payload);
    } else if (savedCriteria.length > 0) {
      clearCriteriaScratch(viewPeriodId);
    }
  }, [draftCriteria, savedCriteria, pendingCriteriaName, pendingClearAll, pendingCriteriaPreviewKind, pendingCriteriaPreviewSource, viewPeriodId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outcomes reload — re-runs when period changes OR when a framework is
  // assigned (framework_id change means new outcomes are now available).
  useEffect(() => {
    if (!viewPeriodId) {
      setOutcomeConfig([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const outcomeRows = await listPeriodOutcomes(viewPeriodId);
        if (!alive) return;
        setOutcomeConfig(outcomeRows.map((o) => ({
          id: o.id,
          code: o.code,
          desc_en: o.label || o.description || "",
          desc_tr: o.description || "",
        })));
      } catch {
        if (alive) setOutcomeConfig([]);
      }
    })();
    return () => { alive = false; };
  }, [viewPeriodId, viewPeriod?.framework_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync settings when viewPeriod changes ──────────────
  useEffect(() => {
    setSettings({ evalLockActive: Boolean(viewPeriod?.is_locked) });
  }, [viewPeriod?.id, viewPeriod?.is_locked]);

  // ── Patch / remove helpers ───────────────────────────────
  const applyPeriodPatch = useCallback((patch) => {
    if (!patch?.id) return;
    setPeriodList((prev) => {
      const next = [...prev];
      const idx = next.findIndex((s) => s.id === patch.id);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          ...patch,
          updated_at: patch.updated_at || next[idx].updated_at || new Date().toISOString(),
        };
      } else {
        next.push({ ...patch, updated_at: patch.updated_at || new Date().toISOString() });
      }
      return sortPeriodsByStartDateDesc(next);
    });
  }, []);

  const removePeriod = useCallback((deletedId) => {
    if (!deletedId) return;
    setPeriodList((prev) => {
      const next = prev.filter((s) => s.id !== deletedId);
      setCurrentPeriodId((cur) => {
        if (cur !== deletedId) return cur;
        return pickDefaultPeriod(next)?.id || "";
      });
      return next;
    });
  }, []);

  // ── Load functions ───────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    if (!organizationId) {
      setPeriodList([]);
      setCurrentPeriodId("");
      return [];
    }
    const periods = await listPeriods(organizationId);
    setPeriodList(periods);
    setCurrentPeriodId(pickDefaultPeriod(periods)?.id || "");
    return periods;
  }, [organizationId]);

  const refreshPeriods = useCallback(async () => {
    if (!organizationId) return;
    const periods = await listPeriods(organizationId);
    setPeriodList(periods);
    if (!currentPeriodId || !periods.some((s) => s.id === currentPeriodId)) {
      setCurrentPeriodId(pickDefaultPeriod(periods)?.id || "");
    }
  }, [organizationId, currentPeriodId]);

  // ── Realtime subscription — periods table (tenant-scoped) ──
  // Debounced so bursts (multi-row imports, bulk updates) collapse.
  const periodRealtimeTimerRef = useRef(null);
  const onPeriodRealtime = useCallback(() => {
    if (periodRealtimeTimerRef.current) return;
    periodRealtimeTimerRef.current = setTimeout(() => {
      periodRealtimeTimerRef.current = null;
      refreshPeriods().catch(() => {});
      // Keep the central admin store in sync as well — the header's period
      // dropdown (sortedPeriods) is owned by useAdminData.
      bgRefresh?.current?.(["periods"]);
    }, 400);
  }, [refreshPeriods, bgRefresh]);
  useEffect(() => {
    return () => {
      if (periodRealtimeTimerRef.current) {
        clearTimeout(periodRealtimeTimerRef.current);
        periodRealtimeTimerRef.current = null;
      }
    };
  }, []);
  usePageRealtime({
    organizationId,
    channelName: "manage-periods-live",
    subscriptions: [
      {
        table: "periods",
        event: "*",
        filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
        onPayload: onPeriodRealtime,
      },
    ],
    deps: [onPeriodRealtime],
  });

  // ── Period CRUD handlers ───────────────────────────────
  const handleCreatePeriod = async (payload) => {
    setMessage("");
    clearPanelError("period");
    if (!organizationId) {
      setPanelError("period", "Organization context missing. Please re-login.");
      return { ok: false };
    }
    incLoading();
    try {
      const created = await createPeriod({ ...payload, organizationId });

      // If a framework was selected, clone it, assign to the new period, and
      // freeze the snapshot so period_outcomes + period_criterion_outcome_maps
      // are populated. This makes the Outcomes/Mapping editors work immediately
      // on the period without a second jury-flow trigger.
      let assignedFrameworkId = null;
      if (payload.frameworkId && created?.id) {
        try {
          const autoName = `${payload.name} Framework`;
          const { id: clonedId } = await cloneFramework(payload.frameworkId, autoName, organizationId);
          await assignFrameworkToPeriod(created.id, clonedId);
          assignedFrameworkId = clonedId;
          try {
            await freezePeriodSnapshot(created.id);
          } catch {
            // Non-fatal: jury flow will freeze lazily on first load.
          }
        } catch {
          // Non-fatal: period was created, framework assignment failed
          // User can assign from Outcomes page
        }
      }

      if (created?.id) {
        applyPeriodPatch({ ...created, ...(assignedFrameworkId ? { framework_id: assignedFrameworkId } : {}) });
      } else {
        applyPeriodPatch({
          id: `temp-${Date.now()}`,
          name: payload.name,
        });
        // Reconcile the temp entry with the real server state
        refreshPeriods();
      }
      const periodName = String(payload?.name || created?.name || "").trim();
      setMessage(periodName ? `Period ${periodName} created` : "Period created");
      return { ok: true, id: created?.id || null };
    } catch (e) {
      const msg = String(e?.message || "");
      const msgLower = msg.toLowerCase();
      if (
        msg.includes("period_name_exists") ||
        msgLower.includes("periods_name_ci_unique") || msgLower.includes("periods_organization_name_ci_unique") ||
        msgLower.includes("duplicate key value violates unique constraint")
      ) {
        return { ok: false, fieldErrors: { name: "Period name already exists." } };
      } else if (msg.includes("period_name_required")) {
        return { ok: false, fieldErrors: { name: "Period name is required." } };
      } else {
        setPanelError("period", "Failed to create period. Please try again.");
        return { ok: false };
      }
    } finally {
      decLoading();
    }
  };

  const handleUpdatePeriod = async (payload) => {
    setMessage("");
    clearPanelError("period");
    if (!organizationId) {
      setPanelError("period", "Organization context missing. Please re-login.");
      return { ok: false };
    }
    incLoading();
    try {
      await updatePeriod(payload);
      applyPeriodPatch({
        id: payload.id,
        name: payload.name,
        description: payload.description,
        start_date: payload.start_date,
        end_date: payload.end_date,
        ...(payload.criteria_config !== undefined ? { criteria_config: payload.criteria_config } : {}),
        ...(payload.outcome_config !== undefined ? { outcome_config: payload.outcome_config } : {}),
      });
      const periodName = String(payload?.name || "").trim();
      setMessage(periodName ? `Period ${periodName} updated` : "Period updated");
      return { ok: true };
    } catch (e) {
      const msg = String(e?.message || "");
      const msgLower = msg.toLowerCase();
      if (
        msg.includes("period_name_exists") ||
        msgLower.includes("periods_name_ci_unique") || msgLower.includes("periods_organization_name_ci_unique") ||
        msgLower.includes("duplicate key value violates unique constraint")
      ) {
        return { ok: false, fieldErrors: { name: "Period name already exists." } };
      } else if (msg.includes("period_name_required")) {
        return { ok: false, fieldErrors: { name: "Period name is required." } };
      } else {
        setPanelError("period", "Failed to update period. Please try again.");
        return { ok: false };
      }
    } finally {
      decLoading();
    }
  };

  // ── Criteria config update ──────────────────────────────────────────
  // Product rule: once scoring has started (is_locked), the config is fully
  // immutable. Reject updates here before the RPC to ensure the UI lock can't
  // be bypassed through browser devtools.
  const handleUpdateCriteriaConfig = async (periodId, config) => {
    clearPanelError("period");
    if (!organizationId) {
      setPanelError("period", "Organization context missing. Please re-login.");
      return { ok: false };
    }
    if (!periodId) {
      setPanelError("period", "No period selected. Please select a period to continue.");
      return { ok: false };
    }
    const period = periodList.find((s) => s.id === periodId);
    if (period?.is_locked) {
      return {
        ok: false,
        error: "This period's evaluation config is locked because scoring has already started.",
      };
    }
    incLoading();
    try {
      await savePeriodCriteria(periodId, config);
      // Re-fetch from DB to get canonical normalized shape
      const criteriaRows = await listPeriodCriteria(periodId);
      setCriteriaConfig(getActiveCriteria(criteriaRows));
      setMessage("Evaluation criteria updated.");
      return { ok: true };
    } catch (e) {
      const msg = String(e?.message || "");
      setPanelError("period", "Failed to update criteria config. Please try again.");
      return { ok: false, error: msg };
    } finally {
      decLoading();
    }
  };

  // ── Outcome config update ─────────────────────────────────────────────
  // Same is_locked guard as handleUpdateCriteriaConfig above.
  const handleUpdateOutcomeConfig = async (periodId, config) => {
    clearPanelError("period");
    if (!organizationId) {
      setPanelError("period", "Organization context missing. Please re-login.");
      return { ok: false };
    }
    if (!periodId) {
      setPanelError("period", "No period selected. Please select a period to continue.");
      return { ok: false };
    }
    const period = periodList.find((s) => s.id === periodId);
    if (period?.is_locked) {
      return {
        ok: false,
        error: "This period's evaluation config is locked because scoring has already started.",
      };
    }
    incLoading();
    try {
      await updatePeriodOutcomeConfig(periodId, config);
      applyPeriodPatch({ id: periodId, outcome_config: config });
      setMessage("Outcome mappings updated.");
      return { ok: true };
    } catch (e) {
      const msg = String(e?.message || "");
      setPanelError("period", "Failed to update outcome config. Please try again.");
      return { ok: false, error: msg };
    } finally {
      decLoading();
    }
  };

  // ── Draft/commit functions for criteria ────────────────────────────────
  const itemsDirty = useMemo(
    () => JSON.stringify(draftCriteria) !== JSON.stringify(savedCriteria),
    [draftCriteria, savedCriteria]
  );

  const isDraftDirty = useMemo(
    () => itemsDirty || pendingCriteriaName !== undefined || pendingClearAll,
    [itemsDirty, pendingCriteriaName, pendingClearAll]
  );

  const draftTotal = useMemo(
    () => draftCriteria.reduce((s, c) => s + (c.max || 0), 0),
    [draftCriteria]
  );

  // Save allowed when:
  //  - clearing all → always OK
  //  - only meta changes and no items → always OK (rename alone is valid even if period has no criteria yet)
  //  - items dirty → weights must total exactly 100
  const canSaveDraft = useMemo(() => {
    if (!isDraftDirty) return false;
    if (pendingClearAll) return true;
    if (!itemsDirty) return true; // meta-only change
    return draftTotal === 100;
  }, [isDraftDirty, pendingClearAll, itemsDirty, draftTotal]);

  // True when the draft differs from saved only by position (keys and content identical).
  // In this case we can use the lightweight reorder RPC instead of the full delete+insert RPC,
  // which is safe even when score_sheet_items exist for the period.
  const isOrderOnly = useMemo(() => {
    if (!itemsDirty || draftCriteria.length !== savedCriteria.length) return false;
    const sortByKey = (arr) => [...arr].sort((a, b) => a.key.localeCompare(b.key));
    return JSON.stringify(sortByKey(draftCriteria)) === JSON.stringify(sortByKey(savedCriteria));
  }, [itemsDirty, draftCriteria, savedCriteria]);

  const commitDraft = useCallback(async () => {
    if (!viewPeriodId || !canSaveDraft) return;
    incLoading();
    try {
      if (pendingClearAll) {
        // Destructive clear — wipe items + criteria_name.
        await savePeriodCriteria(viewPeriodId, []);
        await setPeriodCriteriaName(viewPeriodId, null);
        applyPeriodPatch({ id: viewPeriodId, criteria_name: null });
      } else {
        if (itemsDirty) {
          if (isOrderOnly) {
            await reorderPeriodCriteria(viewPeriodId, draftCriteria.map((c) => c.key));
          } else {
            await savePeriodCriteria(viewPeriodId, draftCriteria);
          }
        }
        if (pendingCriteriaName !== undefined) {
          await setPeriodCriteriaName(viewPeriodId, pendingCriteriaName);
          applyPeriodPatch({ id: viewPeriodId, criteria_name: pendingCriteriaName });
        }
      }
      const rows = await listPeriodCriteria(viewPeriodId);
      const fresh = getActiveCriteria(rows);
      setCriteriaConfig(fresh);
      setSavedCriteria(fresh);
      setDraftCriteria(structuredClone(fresh));
      setPendingCriteriaNameState(undefined);
      setPendingClearAll(false);
      clearCriteriaScratch(viewPeriodId);
      setPendingCriteriaPreviewKindState(null);
      setPendingCriteriaPreviewSourceState(null);
      setMessage("Criteria saved successfully.");
    } catch (e) {
      const raw = String(e?.message || e?.details || "");
      let msg = "Failed to save criteria. Please try again.";
      if (raw.includes("foreign key") && raw.includes("score_sheet_items")) {
        msg = "Cannot modify criteria while scores exist for this evaluation period. Lock the period first, or clear existing scores before making structural changes.";
      } else if (raw.includes("foreign key")) {
        msg = "Cannot save — other records depend on the current criteria structure.";
      } else if (raw.includes("duplicate key")) {
        msg = "A criterion with that label already exists. Use a unique name for each criterion.";
      } else if (raw.includes("permission") || raw.includes("denied") || raw.includes("RLS")) {
        msg = "You don't have permission to modify criteria for this period.";
      }
      setPanelError("period", msg);
      throw e;
    } finally {
      decLoading();
    }
  }, [viewPeriodId, canSaveDraft, isOrderOnly, itemsDirty, draftCriteria, pendingCriteriaName, pendingClearAll, applyPeriodPatch]);

  const discardDraft = useCallback(() => {
    clearCriteriaScratch(viewPeriodId);
    setDraftCriteria(structuredClone(savedCriteria));
    setPendingCriteriaNameState(undefined);
    setPendingClearAll(false);
    setPendingCriteriaPreviewKindState(null);
    setPendingCriteriaPreviewSourceState(null);
  }, [savedCriteria, viewPeriodId]);

  const updateDraft = useCallback((newDraft) => {
    setDraftCriteria(newDraft);
    // If user re-populates criteria after marking clear-all, cancel the clear.
    if (newDraft.length > 0) setPendingClearAll(false);
  }, []);

  // Set the pending import preview kind (and optional source label). Persisted
  // via the criteria scratch so the "Criteria ready to apply" banner survives
  // navigation (mirrors usePeriodOutcomes.setPendingFrameworkImport).
  const setPendingCriteriaPreview = useCallback((kind, sourceLabel = null) => {
    setPendingCriteriaPreviewKindState(kind);
    setPendingCriteriaPreviewSourceState(sourceLabel);
  }, []);

  // Queue a rename to be applied on the next commitDraft. Pass the new name,
  // or `null` to clear the criteria_name column. No RPC is fired here.
  // Setting a non-empty name cancels any pending clear-all — the user has
  // decided to re-initialize setup rather than wipe the period.
  const setPendingCriteriaName = useCallback((name) => {
    setPendingCriteriaNameState(name);
    if (name) setPendingClearAll(false);
  }, []);

  // Mark "clear all" intent — draft items are wiped locally; commit will run
  // the destructive RPCs. Any queued rename is dropped.
  const markClearAll = useCallback(() => {
    setPendingClearAll(true);
    setDraftCriteria([]);
    setPendingCriteriaNameState(undefined);
    setPendingCriteriaPreviewKindState(null);
    setPendingCriteriaPreviewSourceState(null);
  }, []);

  // Sync both savedCriteria and draftCriteria to the given value (e.g. after a
  // destructive clear that already persisted to DB — eliminates the dirty bar).
  const applySavedCriteria = useCallback((criteria) => {
    setSavedCriteria(criteria);
    setDraftCriteria(structuredClone(criteria));
    setPendingCriteriaNameState(undefined);
    setPendingClearAll(false);
    clearCriteriaScratch(viewPeriodId);
  }, [viewPeriodId]);

  // Re-fetch period_criteria rows (with mapping-joined outcomes) and rebaseline
  // the saved + draft state. Used after an out-of-band change to
  // period_criterion_outcome_maps (e.g. outcome mapping commit on this page,
  // framework reassignment on the OutcomesPage) so the Mapping column reflects
  // the fresh DB state without requiring a page remount.
  const reloadCriteria = useCallback(async () => {
    if (!viewPeriodId) return;
    try {
      const rows = await listPeriodCriteria(viewPeriodId);
      const fresh = getActiveCriteria(rows);
      setCriteriaConfig(fresh);
      setSavedCriteria(fresh);
      setDraftCriteria(structuredClone(fresh));
      clearCriteriaScratch(viewPeriodId);
    } catch {
      // Non-fatal: a page switch will re-fetch on mount.
    }
  }, [viewPeriodId]);

  const handleDuplicatePeriod = async (periodId) => {
    if (!periodId) return { ok: false };
    setMessage("");
    clearPanelError("period");
    const src = periodList.find((p) => p.id === periodId);
    incLoading();
    try {
      const newId = await duplicatePeriod(periodId);
      await refreshPeriods();
      const label = src?.name ? `"${src.name}"` : "period";
      setMessage(`Duplicated ${label} — new period ready to configure.`);
      return { ok: true, id: newId };
    } catch (e) {
      setPanelError("period", "Failed to duplicate period. Please try again.");
      return { ok: false };
    } finally {
      decLoading();
    }
  };

  const handleDeletePeriod = async (periodId) => {
    if (!periodId) return;
    setMessage("");
    clearPanelError("period");
    incLoading();
    const periodToDelete = periodList.find((p) => p.id === periodId);
    const deletedPeriodName = String(periodToDelete?.name || "").trim();
    try {
      await deletePeriod(periodId);
      removePeriod(periodId);
      setMessage(deletedPeriodName ? `Period "${deletedPeriodName}" deleted` : "Period deleted");
    } catch (e) {
      setPanelError("period", "Failed to delete period. Please try again.");
    } finally {
      decLoading();
    }
  };

  // ── Eval-lock handler ────────────────────────────────────
  const handleSaveSettings = async (next) => {
    if (!organizationId) {
      setEvalLockError("Organization context missing. Please re-login.");
      return;
    }
    if (!viewPeriodId) {
      setEvalLockError("Select a period from the header before changing lock settings.");
      return;
    }
    incLoading();
    setMessage("");
    setEvalLockError("");
    try {
      await setEvalLock(viewPeriodId, !!next.evalLockActive);
      applyPeriodPatch({ id: viewPeriodId, is_locked: !!next.evalLockActive });
      setSettings(next);
      const periodContext =
        viewPeriodLabel && viewPeriodLabel !== "—" ? viewPeriodLabel : "the selected";
      setMessage(
        next.evalLockActive
          ? `Scoring for ${periodContext} period is now closed.`
          : `Scoring for ${periodContext} period is now open.`
      );
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("period_not_found") || msg.includes("period_inactive")) {
        setEvalLockError("Selected period could not be found. Refresh and try again.");
      } else if (msg.includes("unauthorized")) {
        setEvalLockError("Session is invalid. Please re-login.");
      } else {
        setEvalLockError("Failed to save settings. Please try again.");
      }
    } finally {
      decLoading();
    }
  };

  return {
    periodList,
    currentPeriodId,
    settings,
    evalLockError,
    setEvalLockError,
    evalLockConfirmOpen,
    setEvalLockConfirmOpen,
    evalLockConfirmNext,
    setEvalLockConfirmNext,
    evalLockConfirmLoading,
    setEvalLockConfirmLoading,
    currentPeriod,
    currentPeriodLabel,
    viewPeriodId,
    viewPeriod,
    viewPeriodLabel,
    criteriaConfig,
    outcomeConfig,
    draftCriteria,
    savedCriteria,
    pendingCriteriaName,
    pendingClearAll,
    pendingCriteriaPreviewKind,
    pendingCriteriaPreviewSource,
    setPendingCriteriaPreview,
    isDraftDirty,
    draftTotal,
    canSaveDraft,
    commitDraft,
    discardDraft,
    updateDraft,
    setPendingCriteriaName,
    markClearAll,
    applySavedCriteria,
    reloadCriteria,
    applyPeriodPatch,
    removePeriod,
    loadPeriods,
    refreshPeriods,
    handleCreatePeriod,
    handleUpdatePeriod,
    handleDuplicatePeriod,
    handleUpdateCriteriaConfig,
    handleUpdateOutcomeConfig,
    handleDeletePeriod,
    updateCriteriaTemplate: handleUpdateCriteriaConfig,
    updateMudekTemplate: handleUpdateOutcomeConfig,
    handleSaveSettings,
    externalUpdatedPeriodId,
    notifyExternalPeriodUpdate: (id) => setExternalUpdatedPeriodId(id),
    externalDeletedPeriodId,
    notifyExternalPeriodDelete: (id) => setExternalDeletedPeriodId(id),
  };
}
