// src/admin/projects/ManageProjectsPanel.jsx

import { useEffect, useRef, useState } from "react";
import { MonitorCogIcon, CirclePlusIcon, UploadIcon } from "../../shared/Icons";
import ConfirmDialog from "../../shared/ConfirmDialog";
import AlertCard from "../../shared/AlertCard";
import { normalizeStudents, parseStudentInputList } from "./projectHelpers";
import ProjectForm from "./ProjectForm";
import ProjectImport from "./ProjectImport";
import ProjectsTable from "./ProjectsTable";

export default function ManageProjectsPanel({
  projects,
  periodName,
  currentPeriodId,
  semesterOptions = [],
  panelError = "",
  isDemoMode = false,
  isMobile,
  isOpen,
  onToggle,
  onDirtyChange,
  onImport,
  onAddGroup,
  onEditGroup,
  onDeleteProject,
  onRetry,
}) {
  const panelRef = useRef(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    group_no: "",
    title: "",
    members: [""],
    period_id: currentPeriodId || "",
  });
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ group_no: "", title: "", members: [""], periodId: null, _id: null, _updatedAt: null });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [guardError, setGuardError] = useState("");
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const isDirty =
    (showAdd && (form.group_no.trim() !== "" || form.title.trim() !== "" || form.members.some((s) => s.trim() !== ""))) ||
    showEdit;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    if (isOpen && isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    onToggle();
  };

  const normalizedAddStudents = normalizeStudents(form.members);
  const normalizedEditStudents = normalizeStudents(editForm.members);

  const canAddSubmit =
    String(form.group_no).trim() &&
    form.title.trim() &&
    String(normalizedAddStudents).trim() &&
    String(form.period_id || "").trim();
  const canEditSubmit =
    String(editForm.group_no).trim() &&
    editForm.title.trim() &&
    String(normalizedEditStudents).trim();

  // Detect external delete while edit modal is open and close it safely.
  useEffect(() => {
    if (!showEdit || !editForm._id) return;
    const stillExists = (projects || []).some((p) => p.id === editForm._id);
    if (!stillExists) {
      setShowEdit(false);
      setGuardError("This group was deleted elsewhere. Your edit session has been closed.");
    }
  }, [showEdit, projects, editForm._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddSubmit = async () => {
    const groupNoRaw = String(form.group_no).trim();
    const groupNo = Number(groupNoRaw);
    const isInteger = Number.isInteger(groupNo) && groupNoRaw !== "" && groupNo > 0;
    if (!isInteger) {
      setAddError("Group number must be a positive integer.");
      return;
    }
    if (groupNo > 999) {
      setAddError("Group number must be between 1 and 999.");
      return;
    }
    if (!form.period_id) {
      setAddError("Please select a period.");
      return;
    }
    const existingGroupNos = new Set(
      (projects || [])
        .map((p) => Number(p.group_no))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    if (form.period_id === currentPeriodId && Number.isFinite(groupNo) && existingGroupNos.has(groupNo)) {
      setAddError(`Group ${groupNo} already exists. Use 'Edit' to update.`);
      return;
    }
    setAddSaving(true);
    let res;
    try {
      res = await onAddGroup({
        group_no: groupNo,
        title: form.title.trim(),
        members: normalizedAddStudents,
        periodId: form.period_id,
      });
    } finally {
      setAddSaving(false);
    }
    if (res?.fieldErrors?.group_no) {
      setAddError(res.fieldErrors.group_no);
      return;
    }
    setShowAdd(false);
    if (res?.ok === false) return;
    setForm({
      group_no: "",
      title: "",
      members: [""],
      period_id: currentPeriodId || "",
    });
  };

  const handleEditSubmit = async () => {
    setEditSaving(true);
    setEditError("");
    // Stale-edit check: block save if the project was updated elsewhere while modal was open.
    if (editForm._id && editForm._updatedAt) {
      const currentVersion = (projects || []).find((proj) => proj.id === editForm._id);
      if (currentVersion && currentVersion.updated_at && currentVersion.updated_at !== editForm._updatedAt) {
        setEditSaving(false);
        setEditError("This group was updated elsewhere. Close and reopen to edit the latest version.");
        return;
      }
    }
    const res = await onEditGroup?.({
      group_no: Number(editForm.group_no),
      title: editForm.title.trim(),
      members: normalizedEditStudents,
      periodId: editForm.periodId,
    });
    setEditSaving(false);
    if (res?.ok === false) {
      setEditError(res.message || "Could not save changes. Please try again.");
    } else {
      setShowEdit(false);
    }
  };

  const handleEditProject = (p) => {
    setEditError("");
    setEditForm({
      group_no: p.group_no ?? "",
      title: p.title || "",
      members: parseStudentInputList(p.members || ""),
      periodId: p.period_id || null,
      _id: p.id || null,
      _updatedAt: p.updated_at || p.updatedAt || null,
    });
    setShowEdit(true);
  };

  const handleDeleteProject = (p, groupLabel) => {
    if (!p?.id) {
      setGuardError("Cannot delete this group right now. Refresh the page and try again.");
      return;
    }
    setGuardError("");
    onDeleteProject?.(p, groupLabel);
  };

  return (
    <div ref={panelRef} className="rounded-lg border bg-card text-card-foreground shadow-sm flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center gap-2.5">
        <span className="size-[18px] text-muted-foreground" aria-hidden="true"><MonitorCogIcon /></span>
        <span className="font-bold text-foreground">Group Settings</span>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground -mt-0.5 leading-relaxed">
          Manage groups, projects, and students for{" "}
          <span className="font-bold text-destructive animate-pulse">{periodName || "the selected"}</span>{" "}
          period.
        </p>
        {(panelError || guardError) && (
          <AlertCard variant="error">
            <span>{panelError || guardError}</span>
            {panelError && onRetry && (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                type="button"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
          </AlertCard>
        )}
        <p className="text-xs text-muted-foreground">
          Use the header to switch periods and view other groups.
        </p>
        <div className="flex gap-2.5 flex-wrap">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground shadow-sm"
            type="button"
            onClick={() => {
              setShowImport(true);
            }}
          >
            <span aria-hidden="true"><UploadIcon className="size-3.5" /></span>
            Import CSV
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
            type="button"
            onClick={() => {
              setAddError("");
              setForm((f) => ({ ...f, period_id: currentPeriodId || f.period_id || "" }));
              setShowAdd(true);
            }}
          >
            <span aria-hidden="true"><CirclePlusIcon className="size-3.5" /></span>
            Group
          </button>
        </div>

        <ProjectsTable
          projects={projects}
          periodName={periodName}
          isDemoMode={isDemoMode}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
        />

        {showAdd && (
          <ProjectForm
            form={form}
            setForm={setForm}
            error={addError}
            saving={addSaving}
            canSubmit={canAddSubmit}
            onSubmit={handleAddSubmit}
            onCancel={() => setShowAdd(false)}
            onClearError={() => setAddError("")}
            mode="add"
            isDemoMode={isDemoMode}
            semesterOptions={semesterOptions}
          />
        )}

        {showEdit && (
          <ProjectForm
            form={editForm}
            setForm={setEditForm}
            error={editError}
            saving={editSaving}
            canSubmit={canEditSubmit}
            onSubmit={handleEditSubmit}
            onCancel={() => { setShowEdit(false); setEditError(""); }}
            onClearError={() => setEditError("")}
            mode="edit"
            isDemoMode={isDemoMode}
          />
        )}

        <ProjectImport
          show={showImport}
          onClose={() => setShowImport(false)}
          onImport={onImport}
          periodName={periodName}
          projects={projects}
        />
      </div>

      <ConfirmDialog
        open={showUnsavedConfirm}
        onOpenChange={(open) => setShowUnsavedConfirm(open)}
        title="Unsaved Changes"
        body="You have unsaved changes. If you close the panel now, your changes will be lost."
        confirmLabel="Leave Anyway"
        cancelLabel="Keep Editing"
        tone="caution"
        onConfirm={() => {
          setShowUnsavedConfirm(false);
          onToggle();
        }}
      />
    </div>
  );
}
