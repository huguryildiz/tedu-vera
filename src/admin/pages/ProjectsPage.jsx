// src/admin/pages/ProjectsPage.jsx
// Standalone page for project/group management.
// Initializes its own domain hooks directly (bypasses useSettingsCrud).

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/toast/useToast";
import { useManagePeriods } from "../hooks/useManagePeriods";
import { useManageProjects } from "../hooks/useManageProjects";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import { usePageRealtime } from "../hooks/usePageRealtime";
import { buildCountSummary } from "../hooks/useDeleteConfirm";
import ConfirmDialog from "../../shared/ConfirmDialog";
import ManageProjectsPanel from "../ManageProjectsPanel";
import PageShell from "./PageShell";

export default function ProjectsPage({
  organizationId,
  selectedSemesterId,
  isDemoMode = false,
  onDirtyChange,
  onCurrentSemesterChange,
}) {
  const _toast = useToast();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };

  const [panelError, setPanelErrorState] = useState("");
  const setPanelError = useCallback((panel, msg) => setPanelErrorState(msg || ""), []);
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

  // ── Projects ──
  const projects = useManageProjects({
    organizationId,
    viewPeriodId: periods.viewPeriodId,
    viewPeriodLabel: periods.viewPeriodLabel,
    periodList: periods.periodList,
    setMessage,
    incLoading,
    decLoading,
    setPanelError,
    clearPanelError,
  });

  // Load projects when viewPeriodId changes
  useEffect(() => {
    if (!periods.viewPeriodId || !organizationId) return;
    incLoading();
    projects
      .loadProjects(periods.viewPeriodId)
      .catch(() => setPanelError("projects", "Could not load groups."))
      .finally(() => decLoading());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.viewPeriodId, organizationId]);

  // ── Delete confirmation ──
  const deleteConfirm = useDeleteConfirm({
    organizationId,
    setMessage,
    clearAllPanelErrors: clearPanelError,
    onProjectDeleted: projects.removeProject,
    onSemesterDeleted: () => {},
    onJurorDeleted: () => {},
  });

  // ── Realtime ──
  usePageRealtime({
    organizationId,
    channelName: "projects-page-live",
    subscriptions: [
      {
        table: "projects",
        event: "INSERT",
        onPayload: (payload) => {
          if (payload.new?.period_id === periods.viewPeriodId) {
            projects.applyProjectPatch(payload.new);
          }
        },
      },
      {
        table: "projects",
        event: "UPDATE",
        onPayload: (payload) => {
          if (payload.new?.period_id === periods.viewPeriodId) {
            projects.applyProjectPatch(payload.new);
          }
        },
      },
      {
        table: "projects",
        event: "DELETE",
        onPayload: (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) projects.removeProject(deletedId);
        },
      },
    ],
    deps: [
      periods.viewPeriodId,
      projects.applyProjectPatch,
      projects.removeProject,
    ],
  });

  return (
    <PageShell
      title="Projects"
      description="Manage student groups and project assignments"
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

      <ManageProjectsPanel
        projects={projects.projects}
        periodName={periods.viewPeriodLabel}
        currentSemesterId={periods.viewPeriodId}
        semesterOptions={periods.periodList}
        panelError={panelError}
        isDemoMode={isDemoMode}
        isMobile={false}
        isOpen={true}
        onToggle={() => {}}
        onDirtyChange={onDirtyChange}
        onImport={projects.handleImportProjects}
        onAddGroup={projects.handleAddProject}
        onEditGroup={projects.handleEditProject}
        onRetry={() => projects.loadProjects(periods.viewPeriodId)}
        onDeleteProject={(p, groupLabel) =>
          deleteConfirm.handleRequestDelete({
            type: "project",
            id: p?.id,
            label: `Group ${groupLabel}`,
          })
        }
      />
    </PageShell>
  );
}
