// src/admin/pages/SemestersPage.jsx
// Standalone page for period management including criteria and MÜDEK templates.
// Initializes its own domain hooks directly (bypasses useSettingsCrud).

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/toast/useToast";
import { useManagePeriods } from "../hooks/useManagePeriods";
import { useManageJurors } from "../hooks/useManageJurors";
import { useDeleteConfirm, buildCountSummary } from "../hooks/useDeleteConfirm";
import { usePageRealtime } from "../hooks/usePageRealtime";
import ConfirmDialog from "../../shared/ConfirmDialog";
import SemesterSettingsPanel from "../ManageSemesterPanel";
import PageShell from "./PageShell";

export default function SemestersPage({
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

  // ── Jurors (lightweight — only for isLockedFn check) ──
  const jurorsHook = useManageJurors({
    organizationId,
    viewPeriodId: periods.viewPeriodId,
    viewPeriodLabel: periods.viewPeriodLabel,
    projects: [],
    setMessage: () => {},
    incLoading: () => {},
    decLoading: () => {},
    setPanelError: () => {},
    clearPanelError: () => {},
    setEvalLockError: periods.setEvalLockError,
  });

  // Load jurors when viewPeriodId changes (for isLockedFn)
  useEffect(() => {
    if (!periods.viewPeriodId || !organizationId) return;
    jurorsHook.loadJurors().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.viewPeriodId, organizationId]);

  // isLockedFn: true when period is eval-locked or has submitted scores
  const isLockedFn = useCallback(
    (periodId) => {
      const period = periods.periodList.find((s) => s.id === periodId);
      if (period?.is_locked) return true;
      return (
        periodId === periods.viewPeriodId &&
        (jurorsHook.jurors || []).some((j) => j.finalSubmitted)
      );
    },
    [periods.periodList, periods.viewPeriodId, jurorsHook.jurors],
  );

  // ── Delete confirmation ──
  const deleteConfirm = useDeleteConfirm({
    organizationId,
    setMessage,
    clearAllPanelErrors: clearPanelError,
    onSemesterDeleted: periods.removePeriod,
    onProjectDeleted: () => {},
    onJurorDeleted: () => {},
  });

  // ── Realtime ──
  usePageRealtime({
    organizationId,
    channelName: "periods-page-live",
    subscriptions: [
      {
        table: "periods",
        event: "INSERT",
        onPayload: (payload) => {
          if (payload.new?.id && payload.new?.organization_id === organizationId) {
            periods.applyPeriodPatch(payload.new);
          }
        },
      },
      {
        table: "periods",
        event: "UPDATE",
        onPayload: (payload) => {
          if (payload.new?.id && payload.new?.organization_id === organizationId) {
            periods.applyPeriodPatch(payload.new);
            periods.notifyExternalPeriodUpdate(payload.new.id);
          }
        },
      },
      {
        table: "periods",
        event: "DELETE",
        onPayload: (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            periods.removePeriod(deletedId);
            periods.notifyExternalPeriodDelete(deletedId);
          }
        },
      },
    ],
    deps: [
      periods.applyPeriodPatch,
      periods.removePeriod,
      periods.notifyExternalPeriodUpdate,
      periods.notifyExternalPeriodDelete,
    ],
  });

  return (
    <PageShell
      title="Evaluation Periods"
      description="Manage evaluation periods, criteria, and MÜDEK outcomes"
    >
      <ConfirmDialog
        open={!!deleteConfirm.deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            deleteConfirm.setDeleteTarget(null);
            deleteConfirm.setDeleteCounts(null);
          }
        }}
        title="Delete Confirmation"
        body={
          deleteConfirm.deleteTarget ? (
            <>
              <strong>{deleteConfirm.deleteTarget.label || "Selected record"}</strong>
              {" will be deleted. Are you sure?"}
            </>
          ) : ""
        }
        warning="This will permanently delete all jurors, groups, and scores associated with this period. This action cannot be undone."
        typedConfirmation={deleteConfirm.deleteTarget?.typedConfirmation || undefined}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          if (isDemoMode) throw new Error("Demo mode: delete is disabled.");
          try {
            await deleteConfirm.handleConfirmDelete();
          } catch (e) {
            throw new Error(deleteConfirm.mapDeleteError(e));
          }
        }}
      />

      <SemesterSettingsPanel
        periods={periods.periodList}
        currentSemesterId={periods.currentPeriodId}
        currentSemesterName={periods.currentPeriodLabel}
        formatSemesterName={(n) => n || ""}
        panelError={panelError}
        isDemoMode={isDemoMode}
        isMobile={false}
        isOpen={true}
        onToggle={() => {}}
        onDirtyChange={onDirtyChange}
        onSetCurrent={periods.handleSetCurrentPeriod}
        onCreateSemester={periods.handleCreatePeriod}
        onUpdateSemester={periods.handleUpdatePeriod}
        onUpdateCriteriaTemplate={periods.handleUpdateCriteriaConfig}
        onUpdateMudekTemplate={periods.handleUpdateOutcomeConfig}
        isLockedFn={isLockedFn}
        externalUpdatedPeriodId={periods.externalUpdatedPeriodId}
        externalDeletedPeriodId={periods.externalDeletedPeriodId}
        onDeleteSemester={(s) => {
          if (s?.id === periods.currentPeriodId) {
            setPanelError("period", "Current period cannot be deleted. Select another period first.");
            return;
          }
          if (periods.periodList.length === 1) {
            setPanelError("period", "Cannot delete the only remaining period.");
            return;
          }
          if (!organizationId) {
            setPanelError("period", "Organization ID missing. Please re-login.");
            return;
          }
          deleteConfirm.handleRequestDelete({
            type: "period",
            id: s?.id,
            label: `Period ${(s?.period_name) || ""}`.trim(),
          });
        }}
      />
    </PageShell>
  );
}
