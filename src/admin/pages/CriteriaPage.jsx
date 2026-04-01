// src/admin/pages/CriteriaPage.jsx
// Standalone page for evaluation criteria management.

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/toast/useToast";
import { useManagePeriods } from "../hooks/useManagePeriods";
import CriteriaManager from "../criteria/CriteriaManager";
import PageShell from "./PageShell";

export default function CriteriaPage({
  organizationId,
  selectedSemesterId,
  isDemoMode = false,
  onDirtyChange,
  onCurrentSemesterChange,
}) {
  const _toast = useToast();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };

  const [panelError, setPanelErrorState] = useState("");
  const setPanelError = useCallback((_panel, msg) => setPanelErrorState(msg || ""), []);
  const clearPanelError = useCallback(() => setPanelErrorState(""), []);

  const [loadingCount, setLoadingCount] = useState(0);
  const incLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
  const decLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);

  // ── Semesters ──
  const periods = useManagePeriods({
    organizationId,
    selectedSemesterId,
    setMessage,
    incLoading,
    decLoading,
    onCurrentSemesterChange,
    setPanelError,
    clearPanelError,
  });

  // Load periods on mount
  useEffect(() => {
    incLoading();
    periods
      .loadPeriods()
      .catch(() =>
        setPanelError("period", "Could not load periods. Try refreshing or check your connection.")
      )
      .finally(() => decLoading());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.loadPeriods]);

  // Get current period being edited
  const viewPeriod = periods.periodList.find((s) => s.id === periods.viewPeriodId);
  const isLocked = !!(viewPeriod?.is_locked) || (periods.periodList.some((s) => s.id === periods.viewPeriodId) && false); // Evaluation lock check

  const handleSave = async (newTemplate) => {
    if (!periods.viewPeriodId) {
      return { ok: false, error: "No period selected" };
    }
    try {
      incLoading();
      await periods.updateCriteriaTemplate(periods.viewPeriodId, newTemplate);
      setMessage("Criteria updated successfully");
      return { ok: true };
    } catch (err) {
      const msg = err?.message || "Failed to update criteria";
      setPanelError("criteria", msg);
      return { ok: false, error: msg };
    } finally {
      decLoading();
    }
  };

  return (
    <PageShell
      title="Evaluation Criteria"
      description="Define and customize evaluation criteria for this period"
    >
      {panelError && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {panelError}
        </div>
      )}
      {!periods.viewPeriodId ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Select an evaluation period to manage its criteria.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium">
              Period: <span className="text-foreground">{periods.viewPeriodLabel}</span>
            </p>
          </div>
          <CriteriaManager
            template={viewPeriod?.criteria_config || []}
            outcomeConfig={viewPeriod?.outcome_config || []}
            onSave={handleSave}
            disabled={loadingCount > 0}
            isLocked={isLocked}
          />
        </div>
      )}
    </PageShell>
  );
}
