// src/admin/pages/JurorsPage.jsx
// Standalone page for juror management, PIN resets, and edit-mode control.
// Initializes its own domain hooks directly (bypasses useSettingsCrud).

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/toast/useToast";
import { useManagePeriods } from "../hooks/useManagePeriods";
import { useManageProjects } from "../hooks/useManageProjects";
import { useManageJurors } from "../hooks/useManageJurors";
import { useDeleteConfirm, buildCountSummary } from "../hooks/useDeleteConfirm";
import { usePageRealtime } from "../hooks/usePageRealtime";
import ConfirmDialog from "../../shared/ConfirmDialog";
import PinResetDialog from "../settings/PinResetDialog";
import ManageJurorsPanel from "../ManageJurorsPanel";
import PageShell from "./PageShell";

export default function JurorsPage({
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

  // ── Period context ──
  const periods = useManagePeriods({
    organizationId,
    selectedSemesterId,
    setMessage,
    incLoading,
    decLoading,
    onCurrentSemesterChange,
    setPanelError: () => {},
    clearPanelError: () => {},
  });

  // Load periods on mount
  useEffect(() => {
    periods.loadPeriods().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.loadPeriods]);

  // ── Projects (needed for juror enrichment — total_projects count) ──
  const projectsHook = useManageProjects({
    organizationId,
    viewPeriodId: periods.viewPeriodId,
    viewPeriodLabel: periods.viewPeriodLabel,
    periodList: periods.periodList,
    setMessage: () => {},
    incLoading: () => {},
    decLoading: () => {},
    setPanelError: () => {},
    clearPanelError: () => {},
  });

  // ── Jurors ──
  const jurors = useManageJurors({
    organizationId,
    viewPeriodId: periods.viewPeriodId,
    viewPeriodLabel: periods.viewPeriodLabel,
    projects: projectsHook.projects,
    setMessage,
    incLoading,
    decLoading,
    setPanelError,
    clearPanelError,
    setEvalLockError: periods.setEvalLockError,
  });

  // Load projects + jurors when viewPeriodId changes
  useEffect(() => {
    if (!periods.viewPeriodId || !organizationId) return;
    incLoading();
    Promise.allSettled([
      projectsHook.loadProjects(periods.viewPeriodId),
      jurors.loadJurors(),
    ])
      .then((results) => {
        if (results[1].status === "rejected") {
          setPanelError("jurors", "Could not load jurors.");
        }
      })
      .finally(() => decLoading());

    // Deferred enrichment
    const enrichTimer = setTimeout(() => {
      jurors.enrichJurorScores().catch(() => {});
    }, 100);
    return () => clearTimeout(enrichTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.viewPeriodId, organizationId]);

  // ── Delete confirmation ──
  const deleteConfirm = useDeleteConfirm({
    organizationId,
    setMessage,
    clearAllPanelErrors: clearPanelError,
    onJurorDeleted: jurors.removeJuror,
    onSemesterDeleted: () => {},
    onProjectDeleted: () => {},
  });

  // ── Realtime ──
  usePageRealtime({
    organizationId,
    channelName: "jurors-page-live",
    subscriptions: [
      { table: "jurors", event: "*", onPayload: jurors.scheduleJurorRefresh },
      { table: "juror_semester_auth", event: "*", onPayload: jurors.scheduleJurorRefresh },
      { table: "scores", event: "*", onPayload: jurors.scheduleJurorRefresh },
    ],
    deps: [jurors.scheduleJurorRefresh],
  });

  return (
    <PageShell
      title="Jurors"
      description="Manage jury members and evaluation permissions"
    >
      <PinResetDialog
        pinResetTarget={jurors.pinResetTarget}
        resetPinInfo={jurors.resetPinInfo}
        pinResetLoading={jurors.pinResetLoading}
        pinCopied={jurors.pinCopied}
        viewPeriodLabel={periods.viewPeriodLabel}
        onCopyPin={jurors.handleCopyPin}
        onClose={jurors.closeResetPinDialog}
        onConfirmReset={jurors.confirmResetPin}
      />
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
              {deleteConfirm.deleteTarget.inst && (
                <span> ({deleteConfirm.deleteTarget.inst})</span>
              )}
              {" will be deleted. Are you sure?"}
            </>
          ) : ""
        }
        warning={buildCountSummary(deleteConfirm.deleteCounts) || "This action cannot be undone."}
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

      <ManageJurorsPanel
        jurors={jurors.jurors}
        periodList={periods.periodList}
        panelError={panelError}
        isDemoMode={isDemoMode}
        isMobile={false}
        isOpen={true}
        onToggle={() => {}}
        onDirtyChange={onDirtyChange}
        onImport={jurors.handleImportJurors}
        onAddJuror={jurors.handleAddJuror}
        onEditJuror={jurors.handleEditJuror}
        onResetPin={jurors.requestResetPin}
        onDeleteJuror={(j) =>
          deleteConfirm.handleRequestDelete({
            type: "juror",
            id: j?.jurorId || j?.juror_id,
            label: `Juror ${j?.juryName || j?.juror_name || ""}`.trim(),
            name: j?.juryName || j?.juror_name || "",
            inst: j?.affiliation || j?.affiliation || "",
          })
        }
        settings={periods.settings}
        currentSemesterId={periods.viewPeriodId}
        currentSemesterName={periods.viewPeriodLabel}
        onToggleEdit={jurors.handleToggleJurorEdit}
        onForceCloseEdit={jurors.handleForceCloseJurorEdit}
      />
    </PageShell>
  );
}
