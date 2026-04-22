// src/admin/hooks/useManageProjects.js
// ============================================================
// Manages project CRUD state and handlers.
//
// Extracted from useSettingsCrud.js (Phase 6 — Settings
// CRUD Decomposition).
// ============================================================

import { useCallback, useRef, useState } from "react";
import {
  adminListProjects,
  createProject,
  upsertProject,
  deleteProject,
} from "@/shared/api";
import { normalizeStudentNames } from "@/admin/utils/auditUtils";

// Convert member input (string or string[]) to JSONB array format {name, order}
function membersToJsonb(value) {
  let names = [];
  if (Array.isArray(value)) {
    names = value.map((s) => (typeof s === "object" ? s?.name || "" : s).trim()).filter(Boolean);
  } else {
    const normalized = normalizeStudentNames(value);
    names = normalized ? normalized.split(";").map((s) => s.trim()).filter(Boolean) : [];
  }
  return names.map((name, i) => ({ name, order: i + 1 }));
}

/**
 * useManageProjects — project CRUD for the viewed period.
 *
 * @param {object} opts
 * @param {string}   opts.organizationId
 * @param {string}   opts.viewPeriodId      Controlled by useManagePeriods.
 * @param {string}   opts.viewPeriodLabel   Human-readable label for toast messages.
 * @param {Array}    opts.periodList        Used for target period name lookup.
 * @param {Function} opts.setMessage        Toast setter from SettingsPage.
 * @param {Function} opts.setLoading        Loading setter from SettingsPage.
 * @param {Function} opts.setPanelError     (panel, msg) → sets a panel-level error.
 * @param {Function} opts.clearPanelError   (panel) → clears a panel-level error.
 */
export function useManageProjects({
  organizationId,
  viewPeriodId,
  viewPeriodLabel,
  periodList,
  setMessage,
  incLoading,
  decLoading,
  setPanelError,
  clearPanelError,
}) {
  const [projects, setProjects] = useState([]);

  // ── Stable refs for values used inside callbacks ─────────
  const setPanelErrorRef = useRef(setPanelError);
  setPanelErrorRef.current = setPanelError;
  const viewPeriodIdRef = useRef(viewPeriodId);
  viewPeriodIdRef.current = viewPeriodId;

  // ── Patch / remove helpers ───────────────────────────────
  const applyProjectPatch = useCallback((patch) => {
    if (!patch) return;
    setProjects((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (p) =>
          (patch.id && p.id === patch.id) ||
          (patch.group_no != null &&
            patch.period_id &&
            p.group_no === patch.group_no &&
            p.period_id === patch.period_id)
      );
      const updated = {
        ...((idx >= 0 ? next[idx] : {}) || {}),
        ...patch,
        updated_at:
          patch.updated_at ||
          (idx >= 0 ? next[idx]?.updated_at : null) ||
          new Date().toISOString(),
      };
      if (idx >= 0) next[idx] = updated;
      else next.push(updated);
      return next;
    });
  }, []);

  const removeProject = useCallback((deletedId) => {
    if (!deletedId) return;
    setProjects((prev) => prev.filter((p) => p.id !== deletedId));
  }, []);

  // ── Load function (stable identity — uses refs) ──────────
  const loadProjects = useCallback(
    async (periodId) => {
      const pid = periodId || viewPeriodIdRef.current;
      if (!pid) return;
      try {
        const rows = await adminListProjects(pid);
        setProjects(rows || []);
      } catch (e) {
        const msg = e?.message || "Could not load groups. Check your session or refresh.";
        setPanelErrorRef.current("projects", msg);
      }
    },
    [] // stable identity — reads from refs
  );

  // ── Project CRUD handlers ────────────────────────────────
  const handleImportProjects = async (rows, { cancelRef } = {}) => {
    if (!viewPeriodId) {
      setPanelError("projects", "Select a period from the header before importing groups.");
      return { ok: false };
    }
    setMessage("");
    clearPanelError("projects");
    incLoading();
    try {
      const periodContext =
        viewPeriodLabel && viewPeriodLabel !== "—"
          ? viewPeriodLabel
          : "selected period";
      let imported = 0, failed = 0;
      for (const row of rows) {
        if (cancelRef?.current) {
          return { ok: false, cancelled: true };
        }
        const membersJsonb = membersToJsonb(row.members);
        try {
          await createProject(
            { ...row, members: membersJsonb, periodId: viewPeriodId }
          );
          imported += 1;
        } catch {
          failed += 1;
        }
      }
      await loadProjects(viewPeriodId);
      setMessage(`Projects imported for Period ${periodContext}`);
      return { ok: true, imported, skipped: 0, failed };
    } catch (e) {
      return {
        ok: false,
        formError: e?.message || "Could not import projects. Check the CSV format and try again.",
      };
    } finally {
      decLoading();
    }
  };

  const handleAddProject = async (row) => {
    const targetPeriodId = row?.periodId || viewPeriodId;
    if (!targetPeriodId) {
      setPanelError("projects", "Select a period before adding a group.");
      return { ok: false };
    }
    setMessage("");
    clearPanelError("projects");
    incLoading();
    try {
      const membersJsonb = membersToJsonb(row.members);
      const targetPeriodName =
        (periodList || []).find((s) => s.id === targetPeriodId)?.name || "";
      const res = await createProject(
        { ...row, members: membersJsonb, periodId: targetPeriodId }
      );
      if (!res?.id) {
        throw new Error("Could not create project. Please refresh and try again.");
      }
      if (targetPeriodId === viewPeriodId) {
        await loadProjects(targetPeriodId);
      }
      const assignedNo = res?.project_no;
      setMessage(
        targetPeriodName
          ? `Project P${assignedNo} created in Period ${targetPeriodName}`
          : `Project P${assignedNo} created`
      );
      return { ok: true };
    } catch (e) {
      const msg = e?.message || "Could not save project. Try again or check your session.";
      setPanelError("projects", msg);
      return { ok: false };
    } finally {
      decLoading();
    }
  };

  const handleEditProject = async (row) => {
    const targetPeriodId = row?.periodId || viewPeriodId;
    if (!targetPeriodId) return;
    setMessage("");
    clearPanelError("projects");
    incLoading();
    try {
      const membersJsonb = membersToJsonb(row.members);
      await upsertProject({
        ...row,
        members: membersJsonb,
        advisor_name: row.advisor ?? null,
        periodId: targetPeriodId,
      });
      if (targetPeriodId === viewPeriodId) {
        await loadProjects(targetPeriodId);
      }
      setMessage(`Project updated`);
      return { ok: true };
    } catch (e) {
      const msg = e?.message || "Could not update project. Try again or check your session.";
      return { ok: false, message: msg };
    } finally {
      decLoading();
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!projectId) return;
    setMessage("");
    clearPanelError("projects");
    incLoading();
    const project = projects.find((p) => p.id === projectId);
    try {
      await deleteProject(projectId);
      removeProject(projectId);
      setMessage(project?.group_no ? `Group ${project.group_no} deleted` : "Project deleted");
    } catch (e) {
      setPanelError("projects", e?.message || "Could not delete project. Try again.");
    } finally {
      decLoading();
    }
  };

  const handleDuplicateProject = async (project) => {
    if (!project || !viewPeriodId) return;
    setMessage("");
    clearPanelError("projects");
    incLoading();
    try {
      const res = await createProject({
        title: `${project.title} (Copy)`,
        members: Array.isArray(project.members) ? project.members : [],
        periodId: viewPeriodId,
      });
      if (!res?.id) throw new Error("Could not duplicate project.");
      await loadProjects(viewPeriodId);
      setMessage(`Project duplicated as P${res.project_no}`);
      return { ok: true };
    } catch (e) {
      setPanelError("projects", e?.message || "Could not duplicate project.");
      return { ok: false };
    } finally {
      decLoading();
    }
  };

  return {
    projects,
    applyProjectPatch,
    removeProject,
    loadProjects,
    handleImportProjects,
    handleAddProject,
    handleEditProject,
    handleDeleteProject,
    handleDuplicateProject,
  };
}
