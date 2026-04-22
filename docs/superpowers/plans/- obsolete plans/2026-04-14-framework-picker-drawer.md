# Framework Picker Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented fw-context-bar chip + two inline buttons + FrameworkPickerModal with a single `FrameworkPickerDrawer` that consolidates all framework management (active framework actions, previous periods, platform templates, create blank).

**Architecture:** New `FrameworkPickerDrawer` component owns all framework CRUD state internally. `OutcomesPage` only manages `frameworkDrawerOpen` boolean and passes down the data it already has. The fw-chip in the context bar becomes a clickable trigger; both empty-state buttons also open the same drawer.

**Tech Stack:** React, lucide-react, `Drawer` + `ConfirmDialog` + `AsyncButtonContent` + `InlineError` from shared UI, API functions from `src/shared/api`.

---

## File Map

| File | Action |
|------|--------|
| `src/admin/drawers/FrameworkPickerDrawer.jsx` | **Create** — full drawer component |
| `src/styles/pages/outcomes.css` | **Modify** — append `.fpd-*` CSS classes |
| `src/admin/pages/OutcomesPage.jsx` | **Modify** — replace chip+buttons+modals with trigger+drawer |
| `src/admin/modals/FrameworkPickerModal.jsx` | **Delete** |

---

## Task 1: Create `FrameworkPickerDrawer.jsx`

**Files:**
- Create: `src/admin/drawers/FrameworkPickerDrawer.jsx`

- [ ] **Step 1: Write the file**

```jsx
// src/admin/drawers/FrameworkPickerDrawer.jsx
// Drawer: manage, clone, or switch accreditation frameworks for a period.
//
// Props:
//   open              — boolean
//   onClose           — () => void
//   frameworkId       — string | null  (currently active framework)
//   frameworkName     — string
//   frameworks        — array          (all org + global frameworks from useAdminContext)
//   organizationId    — string
//   selectedPeriodId  — string
//   outcomeCount      — number
//   directCount       — number
//   indirectCount     — number
//   unmappedCount     — number
//   onFrameworksChange — () => void   (triggers reload in parent)
//   hasMappings       — boolean       (true if current period has outcome-criterion maps)

import { useState } from "react";
import {
  Layers, Copy, Pencil, Trash2,
  PlusCircle, X, AlertCircle,
} from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import InlineError from "@/shared/ui/InlineError";
import { useToast } from "@/shared/hooks/useToast";
import {
  cloneFramework,
  assignFrameworkToPeriod,
  createFramework,
  updateFramework,
} from "@/shared/api";

export default function FrameworkPickerDrawer({
  open,
  onClose,
  frameworkId,
  frameworkName,
  frameworks = [],
  organizationId,
  selectedPeriodId,
  outcomeCount = 0,
  directCount = 0,
  indirectCount = 0,
  unmappedCount = 0,
  onFrameworksChange,
  hasMappings = false,
}) {
  const toast = useToast();

  // ── Clone active as new (library copy, period unchanged) ─────
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);

  // ── Rename active framework ──────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // ── Remove (unassign) framework from period ──────────────────
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  // ── Clone & use a previous/template framework ────────────────
  const [changeConfirmOpen, setChangeConfirmOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [changingFw, setChangingFw] = useState(false);

  // ── Create blank framework ────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Derived ──────────────────────────────────────────────────
  const orgFrameworks = frameworks.filter((f) => f.organization_id && f.id !== frameworkId);
  const platformFrameworks = frameworks.filter((f) => !f.organization_id);
  const isDupeName = (name) =>
    name.trim().length > 0 &&
    frameworks.some((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());

  // ── Handlers ─────────────────────────────────────────────────

  const handleCloneAsNew = async () => {
    if (!frameworkId || !cloneName.trim() || !organizationId) return;
    setCloning(true);
    try {
      await cloneFramework(frameworkId, cloneName.trim(), organizationId);
      toast.success("Framework cloned to library");
      setCloneOpen(false);
      setCloneName("");
      onFrameworksChange?.();
    } catch (e) {
      toast.error(e?.message || "Failed to clone");
    } finally {
      setCloning(false);
    }
  };

  const handleRename = async () => {
    if (!frameworkId || !renameName.trim()) return;
    setRenaming(true);
    try {
      await updateFramework(frameworkId, { name: renameName.trim() });
      toast.success("Framework renamed");
      setRenameOpen(false);
      setRenameName("");
      onFrameworksChange?.();
    } catch (e) {
      toast.error(e?.message || "Failed to rename");
    } finally {
      setRenaming(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedPeriodId) return;
    setRemoving(true);
    try {
      await assignFrameworkToPeriod(selectedPeriodId, null);
      toast.success("Framework unassigned from period");
      setRemoveConfirmOpen(false);
      onFrameworksChange?.();
      handleClose();
    } catch (e) {
      toast.error(e?.message || "Failed to remove");
    } finally {
      setRemoving(false);
    }
  };

  const handleCloneAndUse = (fw) => {
    setPendingTarget(fw);
    if (hasMappings) {
      setChangeConfirmOpen(true);
    } else {
      execCloneAndUse(fw);
    }
  };

  const execCloneAndUse = async (fw) => {
    const target = fw ?? pendingTarget;
    if (!target || !organizationId || !selectedPeriodId) return;
    setChangingFw(true);
    setChangeConfirmOpen(false);
    try {
      const autoName = `${target.name} — Copy`;
      const { id: clonedId } = await cloneFramework(target.id, autoName, organizationId);
      await assignFrameworkToPeriod(selectedPeriodId, clonedId);
      toast.success("Framework changed");
      setPendingTarget(null);
      onFrameworksChange?.();
      handleClose();
    } catch (e) {
      toast.error(e?.message || "Failed to change framework");
    } finally {
      setChangingFw(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim() || !organizationId) return;
    setCreating(true);
    try {
      const created = await createFramework({
        organization_id: organizationId,
        name: createName.trim(),
        description: createDesc.trim() || null,
      });
      if (selectedPeriodId && created?.id) {
        await assignFrameworkToPeriod(selectedPeriodId, created.id);
      }
      toast.success("Framework created");
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      onFrameworksChange?.();
      handleClose();
    } catch (e) {
      toast.error(e?.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setCloneOpen(false);
    setCloneName("");
    setRenameOpen(false);
    setRenameName("");
    setRemoveConfirmOpen(false);
    setChangeConfirmOpen(false);
    setPendingTarget(null);
    setCreateOpen(false);
    setCreateName("");
    setCreateDesc("");
    onClose();
  };

  return (
    <>
      <Drawer open={open} onClose={handleClose} id="fw-picker-drawer">
        {/* Header */}
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="fs-icon accent">
                <Layers size={17} strokeWidth={2} />
              </div>
              <div>
                <div className="fs-title">Programme Framework</div>
                <div className="fs-subtitle">Manage, clone, or switch accreditation frameworks</div>
              </div>
            </div>
            <button className="fs-close-btn" onClick={handleClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="fs-drawer-body">

          {/* ── Section 1: Active Framework ── */}
          {frameworkId && (
            <div className="fpd-section">
              <div className="fpd-section-label">Active Framework</div>
              <div className="fpd-active-card">
                <div className="fpd-active-card-top">
                  <div className="fpd-active-name">
                    <Layers size={14} strokeWidth={1.75} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    {frameworkName}
                  </div>
                  <span className="fpd-active-badge">Active</span>
                </div>
                <div className="fpd-meta-pills">
                  <span className="fpd-meta-pill">{outcomeCount} outcomes</span>
                  <span className="fpd-meta-pill direct">{directCount} direct</span>
                  <span className="fpd-meta-pill indirect">{indirectCount} indirect</span>
                  {unmappedCount > 0 && (
                    <span className="fpd-meta-pill unmapped">{unmappedCount} unmapped</span>
                  )}
                </div>
                <div className="fpd-active-actions">
                  <button
                    className="fpd-action-btn"
                    onClick={() => {
                      setCloneOpen(false);
                      setRenameOpen(true);
                      setRenameName(frameworkName);
                    }}
                  >
                    <Pencil size={13} strokeWidth={2} /> Rename
                  </button>
                  <button
                    className="fpd-action-btn"
                    onClick={() => {
                      setRenameOpen(false);
                      setCloneOpen(true);
                      setCloneName("");
                    }}
                  >
                    <Copy size={13} strokeWidth={2} /> Clone as new…
                  </button>
                  <button
                    className="fpd-action-btn danger"
                    onClick={() => setRemoveConfirmOpen(true)}
                  >
                    <Trash2 size={13} strokeWidth={2} /> Remove
                  </button>
                </div>

                {/* Rename inline form */}
                {renameOpen && (
                  <div className="fpd-inline-form">
                    <input
                      className="fs-input"
                      placeholder="Framework name"
                      value={renameName}
                      onChange={(e) => setRenameName(e.target.value)}
                      autoFocus
                      disabled={renaming}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        className="fs-btn fs-btn-secondary"
                        onClick={() => setRenameOpen(false)}
                        disabled={renaming}
                      >
                        Cancel
                      </button>
                      <button
                        className="fs-btn fs-btn-primary"
                        onClick={handleRename}
                        disabled={!renameName.trim() || renaming}
                      >
                        <AsyncButtonContent loading={renaming}>Save</AsyncButtonContent>
                      </button>
                    </div>
                  </div>
                )}

                {/* Clone as new inline form */}
                {cloneOpen && (
                  <div className="fpd-inline-form">
                    <input
                      className={["fs-input", isDupeName(cloneName) ? "error" : ""].filter(Boolean).join(" ")}
                      placeholder={`${frameworkName} — Copy`}
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                      autoFocus
                      disabled={cloning}
                    />
                    {isDupeName(cloneName) && (
                      <InlineError>A framework with this name already exists</InlineError>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        className="fs-btn fs-btn-secondary"
                        onClick={() => setCloneOpen(false)}
                        disabled={cloning}
                      >
                        Cancel
                      </button>
                      <button
                        className="fs-btn fs-btn-primary"
                        onClick={handleCloneAsNew}
                        disabled={!cloneName.trim() || isDupeName(cloneName) || cloning}
                      >
                        <AsyncButtonContent loading={cloning}>Clone</AsyncButtonContent>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Section 2: Previous Periods (org frameworks, excluding active) ── */}
          {orgFrameworks.length > 0 && (
            <div className="fpd-section">
              <div className="fpd-section-label">Previous Periods</div>
              <div className="fpd-fw-list">
                {orgFrameworks.map((fw) => (
                  <div key={fw.id} className="fpd-fw-row">
                    <div className="fpd-fw-row-info">
                      <div className="fpd-fw-row-name">{fw.name}</div>
                    </div>
                    <button
                      className="fpd-clone-use-btn"
                      onClick={() => handleCloneAndUse(fw)}
                      disabled={changingFw}
                    >
                      <AsyncButtonContent loading={changingFw && pendingTarget?.id === fw.id}>
                        Clone &amp; Use
                      </AsyncButtonContent>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 3: Platform Defaults (global frameworks, org IS NULL) ── */}
          {platformFrameworks.length > 0 && (
            <div className="fpd-section">
              <div className="fpd-section-label">Starter Templates</div>
              <div className="fpd-fw-list">
                {platformFrameworks.map((fw) => (
                  <div key={fw.id} className="fpd-fw-row platform">
                    <div className="fpd-fw-row-info">
                      <div className="fpd-fw-row-name">{fw.name}</div>
                      {fw.description && (
                        <div className="fpd-fw-row-desc">{fw.description}</div>
                      )}
                    </div>
                    <button
                      className="fpd-clone-use-btn"
                      onClick={() => handleCloneAndUse(fw)}
                      disabled={changingFw}
                    >
                      <AsyncButtonContent loading={changingFw && pendingTarget?.id === fw.id}>
                        Clone &amp; Use
                      </AsyncButtonContent>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Create blank ── */}
          <div className="fpd-section">
            <div className="fpd-section-label">Create from Scratch</div>
            {!createOpen ? (
              <button className="fpd-create-blank-btn" onClick={() => setCreateOpen(true)}>
                <PlusCircle size={14} strokeWidth={2} />
                Create blank framework
              </button>
            ) : (
              <div className="fpd-inline-form">
                <input
                  className="fs-input"
                  placeholder="Framework name (e.g. ABET, Custom)"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  autoFocus
                  disabled={creating}
                />
                <textarea
                  className="fs-input"
                  placeholder="Description (optional)"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={2}
                  disabled={creating}
                  style={{ marginTop: 8, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="fs-btn fs-btn-secondary"
                    onClick={() => {
                      setCreateOpen(false);
                      setCreateName("");
                      setCreateDesc("");
                    }}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    className="fs-btn fs-btn-primary"
                    onClick={handleCreate}
                    disabled={!createName.trim() || creating}
                  >
                    <AsyncButtonContent loading={creating}>Create &amp; Use</AsyncButtonContent>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="fs-drawer-footer">
          <span className="fpd-footer-disclaimer">
            <AlertCircle size={12} strokeWidth={2} />
            Switching framework clears current mappings
          </span>
          <button className="fs-btn fs-btn-ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      </Drawer>

      {/* Remove (unassign) confirm */}
      <ConfirmDialog
        open={removeConfirmOpen}
        onOpenChange={(v) => { if (!v) setRemoveConfirmOpen(false); }}
        onConfirm={handleRemove}
        title="Remove framework?"
        body="This will unassign the framework from this period. All outcome mappings will be cleared. This cannot be undone."
        confirmLabel="Remove"
        tone="danger"
      />

      {/* Clone & Use confirm — shown only when period already has mappings */}
      <ConfirmDialog
        open={changeConfirmOpen}
        onOpenChange={(v) => { if (!v) { setChangeConfirmOpen(false); setPendingTarget(null); } }}
        onConfirm={() => execCloneAndUse()}
        title="Change framework?"
        body="All outcome mappings for this period will be deleted. Are you sure you want to continue?"
        confirmLabel="Change"
        tone="danger"
      />
    </>
  );
}
```

- [ ] **Step 2: Verify the file exists**

Run: `ls src/admin/drawers/FrameworkPickerDrawer.jsx`
Expected: file listed, no error.

---

## Task 2: Add `.fpd-*` CSS to `outcomes.css`

**Files:**
- Modify: `src/styles/pages/outcomes.css` — append to end of file

- [ ] **Step 1: Append the CSS block**

Append after the last line of `src/styles/pages/outcomes.css`:

```css

/* ── Framework Picker Drawer (fpd-*) ────────────────────────── */

.fpd-section {
  margin-bottom: 24px;
}

.fpd-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-tertiary);
  margin-bottom: 10px;
}

/* Active framework card */
.fpd-active-card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}

.fpd-active-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.fpd-active-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 650;
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fpd-active-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-ring);
  flex-shrink: 0;
}

.fpd-meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.fpd-meta-pill {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 99px;
  background: var(--surface-0);
  color: var(--text-tertiary);
  border: 1px solid var(--border);
}

.fpd-meta-pill.direct {
  background: var(--success-soft);
  color: var(--success);
  border-color: rgba(22, 163, 74, 0.15);
}

.fpd-meta-pill.indirect {
  background: var(--warning-soft);
  color: var(--warning);
  border-color: rgba(217, 119, 6, 0.15);
}

.fpd-meta-pill.unmapped {
  background: var(--surface-1);
  color: var(--text-tertiary);
  border-color: var(--border);
}

.dark-mode .fpd-meta-pill.direct {
  background: rgba(34, 197, 94, 0.14);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.32);
}

.dark-mode .fpd-meta-pill.indirect {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.30);
}

.fpd-active-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.fpd-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.fpd-action-btn:hover {
  background: var(--surface-1);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.fpd-action-btn.danger {
  color: var(--danger);
  border-color: rgba(225, 29, 72, 0.2);
}

.fpd-action-btn.danger:hover {
  background: rgba(225, 29, 72, 0.05);
  border-color: rgba(225, 29, 72, 0.35);
}

/* Inline forms inside active card or create section */
.fpd-inline-form {
  margin-top: 12px;
  padding: 14px;
  background: var(--surface-0);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

/* Framework list rows (Previous Periods + Platform Defaults) */
.fpd-fw-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fpd-fw-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.15s, background 0.15s;
}

.fpd-fw-row:hover {
  border-color: var(--border-strong);
  background: var(--surface-1);
}

.fpd-fw-row.platform {
  background: var(--surface-1);
}

.fpd-fw-row-info {
  flex: 1;
  min-width: 0;
}

.fpd-fw-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fpd-fw-row-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
  line-height: 1.4;
}

.fpd-clone-use-btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.fpd-clone-use-btn:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.fpd-clone-use-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Create blank button */
.fpd-create-blank-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-radius: var(--radius);
  border: 1.5px dashed var(--border);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  width: 100%;
  transition: all 0.15s;
}

.fpd-create-blank-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

/* Footer disclaimer */
.fpd-footer-disclaimer {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-right: auto;
}

/* Trigger chip — the fw-chip becomes clickable */
.fw-chip-trigger {
  cursor: pointer !important;
}

.fw-chip-trigger:hover {
  background: rgba(59, 130, 246, 0.08) !important;
  border-color: rgba(59, 130, 246, 0.25) !important;
}

.dark-mode .fw-chip-trigger:hover {
  background: rgba(96, 165, 250, 0.1) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
}
```

- [ ] **Step 2: Verify no CSS syntax errors**

Run: `npm run build 2>&1 | grep -i "css\|error" | head -20`
Expected: No CSS parsing errors.

---

## Task 3: Update `OutcomesPage.jsx`

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx`

This task has 5 sub-steps. Read the file before each edit.

- [ ] **Step 1: Update imports**

Replace:
```jsx
import { Pencil, Trash2, Copy, MoreVertical, Layers, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useAdminContext } from "../hooks/useAdminContext";
import { useFrameworkOutcomes } from "../hooks/useFrameworkOutcomes";
import { useToast } from "@/shared/hooks/useToast";
import { createFramework, cloneFramework, assignFrameworkToPeriod } from "@/shared/api";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import AddOutcomeDrawer from "../drawers/AddOutcomeDrawer";
import OutcomeDetailDrawer from "../drawers/OutcomeDetailDrawer";
import Modal from "@/shared/ui/Modal";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import FrameworkPickerModal from "../modals/FrameworkPickerModal";
import FbAlert from "@/shared/ui/FbAlert";
import InlineError from "@/shared/ui/InlineError";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import Pagination from "@/shared/ui/Pagination";
```

With:
```jsx
import { Pencil, Trash2, Copy, MoreVertical, Layers, CheckCircle2, AlertCircle, XCircle, ChevronDown } from "lucide-react";
import { useAdminContext } from "../hooks/useAdminContext";
import { useFrameworkOutcomes } from "../hooks/useFrameworkOutcomes";
import { useToast } from "@/shared/hooks/useToast";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import AddOutcomeDrawer from "../drawers/AddOutcomeDrawer";
import OutcomeDetailDrawer from "../drawers/OutcomeDetailDrawer";
import Modal from "@/shared/ui/Modal";
import FrameworkPickerDrawer from "../drawers/FrameworkPickerDrawer";
import FbAlert from "@/shared/ui/FbAlert";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import Pagination from "@/shared/ui/Pagination";
```

- [ ] **Step 2: Remove old framework state + handlers; add `frameworkDrawerOpen`**

Remove this entire block (lines 213–240 approximately):
```jsx
  // ── Create-framework modal state ─────────────────────────

  const [createFwOpen, setCreateFwOpen] = useState(false);
  const [createFwName, setCreateFwName] = useState("");
  const [createFwDesc, setCreateFwDesc] = useState("");
  const [createFwSubmitting, setCreateFwSubmitting] = useState(false);

  const handleCreateFramework = async () => {
    if (!createFwName.trim() || !organizationId) return;
    setCreateFwSubmitting(true);
    try {
      const created = await createFramework({
        organization_id: organizationId,
        name: createFwName.trim(),
        description: createFwDesc.trim() || null,
      });
      if (selectedPeriodId && created?.id) {
        await assignFrameworkToPeriod(selectedPeriodId, created.id);
      }
      toast.success("Framework created");
      setCreateFwOpen(false);
      setCreateFwName("");
      setCreateFwDesc("");
      onFrameworksChange?.();
    } catch (e) {
      toast.error(e?.message || "Failed to create framework");
    } finally {
      setCreateFwSubmitting(false);
    }
  };
```

Remove the old framework picker + clone state block:
```jsx
  // Framework picker + clone state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [changePickerOpen, setChangePickerOpen] = useState(false);
  const [changeConfirmOpen, setChangeConfirmOpen] = useState(false);
  const [pendingChangeFramework, setPendingChangeFramework] = useState(null);
  const [cloneNameOpen, setCloneNameOpen] = useState(false);
  const [cloneNameValue, setCloneNameValue] = useState("");
  const [cloneSubmitting, setCloneSubmitting] = useState(false);
```

Remove the old framework handlers block:
```jsx
  // ── Framework handlers ───────────────────────────────────

  // "Start from existing" → clone selected → assign to current period
  const handlePickAndClone = async (selected) => {
    if (!organizationId || !selectedPeriodId) return;
    try {
      const autoName = `${selected.name} — Copy`;
      const { id: clonedId } = await cloneFramework(selected.id, autoName, organizationId);
      await assignFrameworkToPeriod(selectedPeriodId, clonedId);
      toast.success("Framework cloned and assigned");
      onFrameworksChange?.();
    } catch (e) {
      toast.error(e?.message || "Failed to clone framework");
    }
  };

  // "Clone as new..." → clone current framework into org library (period unchanged)
  const handleCloneAsNew = async () => {
    if (!frameworkId || !cloneNameValue.trim() || !organizationId) return;
    setCloneSubmitting(true);
    try {
      await cloneFramework(frameworkId, cloneNameValue.trim(), organizationId);
      toast.success("Framework cloned");
      setCloneNameOpen(false);
      setCloneNameValue("");
      onFrameworksChange?.();
    } catch (e) {
      toast.error(e?.message || "Failed to clone");
    } finally {
      setCloneSubmitting(false);
    }
  };

  // "Change..." → picked a framework → if mappings exist: show hard confirm; else assign directly
  const handleChangeFrameworkPicked = (selected) => {
    setPendingChangeFramework(selected);
    if (fw.mappings.length > 0) {
      setChangeConfirmOpen(true);
    } else {
      handleChangeConfirmed(selected);
    }
  };

  const handleChangeConfirmed = async (selected) => {
    const target = selected || pendingChangeFramework;
    if (!target || !organizationId || !selectedPeriodId) return;
    setChangeConfirmOpen(false);
    try {
      const autoName = `${target.name} — Copy`;
      const { id: clonedId } = await cloneFramework(target.id, autoName, organizationId);
      await assignFrameworkToPeriod(selectedPeriodId, clonedId);
      toast.success("Framework changed");
      setPendingChangeFramework(null);
      onFrameworksChange?.();
      fw.loadAll();
    } catch (e) {
      toast.error(e?.message || "Failed to change framework");
    }
  };
```

Add `frameworkDrawerOpen` state after the existing drawer state declarations (after `const [editingOutcome, setEditingOutcome] = useState(null);`):
```jsx
  // Framework picker drawer
  const [frameworkDrawerOpen, setFrameworkDrawerOpen] = useState(false);
```

- [ ] **Step 3: Replace the empty-state buttons and remove old modals from empty state**

Replace the empty state section (the entire `noFramework ? (...)` block within the `{noFramework ? (` conditional):
```jsx
      {noFramework ? (
        <>
          <div className="sw-empty-state">
            <div className="sw-empty-icon">
              <Layers size={32} strokeWidth={1.5} />
            </div>
            <div className="sw-empty-title">No framework assigned to this period</div>
            <div className="sw-empty-desc">
              A framework defines programme outcomes and criterion mappings.
              Required for accreditation analytics and reporting.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={() => setPickerOpen(true)}
              >
                Start from an existing framework
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={() => setCreateFwOpen(true)}
              >
                Create from scratch
              </button>
            </div>
            <div className="sw-empty-context">Optional step · Recommended for accreditation</div>
          </div>

          {/* "Start from existing" picker */}
          <FrameworkPickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            frameworks={frameworks}
            onSelect={handlePickAndClone}
          />

          {/* Create Framework Modal */}
          <Modal open={createFwOpen} onClose={() => setCreateFwOpen(false)} title="Create Framework">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4, display: "block" }}>Framework Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. MÜDEK, ABET, Custom"
                  value={createFwName}
                  onChange={(e) => setCreateFwName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 4, display: "block" }}>Description (optional)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Brief description of the accreditation framework"
                  value={createFwDesc}
                  onChange={(e) => setCreateFwDesc(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setCreateFwOpen(false)} disabled={createFwSubmitting}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "auto", padding: "8px 20px" }}
                  onClick={handleCreateFramework}
                  disabled={!createFwName.trim() || createFwSubmitting}
                >
                  <AsyncButtonContent loading={createFwSubmitting}>Create</AsyncButtonContent>
                </button>
              </div>
            </div>
          </Modal>
        </>
```

With:
```jsx
      {noFramework ? (
        <>
          <div className="sw-empty-state">
            <div className="sw-empty-icon">
              <Layers size={32} strokeWidth={1.5} />
            </div>
            <div className="sw-empty-title">No framework assigned to this period</div>
            <div className="sw-empty-desc">
              A framework defines programme outcomes and criterion mappings.
              Required for accreditation analytics and reporting.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                Start from an existing framework
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                Create from scratch
              </button>
            </div>
            <div className="sw-empty-context">Optional step · Recommended for accreditation</div>
          </div>
        </>
```

- [ ] **Step 4: Replace fw-context-bar chip + buttons with trigger button**

Replace:
```jsx
          {/* Framework context bar */}
          <div className="fw-context-bar">
            <div className="fw-context-label">FRAMEWORK</div>
            <div className="fw-chips">
              <button className="fw-chip active" style={{ cursor: "default" }}>
                <Layers size={14} strokeWidth={1.5} className="fw-chip-icon" />
                {frameworkName}
                <span className="fw-chip-count">{fw.outcomes.length}</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setCloneNameValue(""); setCloneNameOpen(true); }}
              >
                Clone as new…
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setChangePickerOpen(true)}
              >
                Change…
              </button>
            </div>
          </div>
```

With:
```jsx
          {/* Framework context bar */}
          <div className="fw-context-bar">
            <div className="fw-context-label">FRAMEWORK</div>
            <div className="fw-chips">
              <button
                className="fw-chip active fw-chip-trigger"
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                <Layers size={14} strokeWidth={1.5} className="fw-chip-icon" />
                {frameworkName}
                <span className="fw-chip-count">{fw.outcomes.length}</span>
                <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: 2, opacity: 0.6 }} />
              </button>
            </div>
          </div>
```

- [ ] **Step 5: Remove old clone/change modals; add `<FrameworkPickerDrawer>`**

Remove the "Clone as new..." name input modal (lines ~716–762):
```jsx
      {/* "Clone as new..." name input modal */}
      <Modal open={cloneNameOpen} onClose={() => setCloneNameOpen(false)} size="sm">
        ...entire modal block...
      </Modal>
```

Remove the "Change..." framework picker modal (lines ~764–770):
```jsx
      {/* "Change..." framework picker */}
      <FrameworkPickerModal
        open={changePickerOpen}
        onClose={() => setChangePickerOpen(false)}
        frameworks={frameworks}
        onSelect={(selected) => { setChangePickerOpen(false); handleChangeFrameworkPicked(selected); }}
      />
```

Remove the change hard-confirm ConfirmDialog (lines ~772–781):
```jsx
      {/* Hard confirm when period has existing mappings */}
      <ConfirmDialog
        open={changeConfirmOpen}
        onOpenChange={(v) => { if (!v) { setChangeConfirmOpen(false); setPendingChangeFramework(null); } }}
        onConfirm={() => handleChangeConfirmed()}
        title="Change framework?"
        body="All outcome mappings for this period will be deleted. Are you sure you want to continue?"
        confirmLabel="Change"
        tone="danger"
      />
```

Add `<FrameworkPickerDrawer>` just before the closing `</div>` at the very end of the component return (after the Delete Confirm Modal closing `</Modal>` tag):

```jsx
      {/* Framework Picker Drawer */}
      <FrameworkPickerDrawer
        open={frameworkDrawerOpen}
        onClose={() => setFrameworkDrawerOpen(false)}
        frameworkId={frameworkId}
        frameworkName={frameworkName}
        frameworks={frameworks}
        organizationId={organizationId}
        selectedPeriodId={selectedPeriodId}
        outcomeCount={totalOutcomes}
        directCount={directCount}
        indirectCount={indirectCount}
        unmappedCount={unmappedCount}
        onFrameworksChange={onFrameworksChange}
        hasMappings={fw.mappings.length > 0}
      />
```

- [ ] **Step 6: Build to verify no errors**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds with no errors.

---

## Task 4: Delete `FrameworkPickerModal.jsx`

**Files:**
- Delete: `src/admin/modals/FrameworkPickerModal.jsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -r "FrameworkPickerModal" src/`
Expected: zero results.

- [ ] **Step 2: Delete the file**

Run: `rm src/admin/modals/FrameworkPickerModal.jsx`

- [ ] **Step 3: Final build verify**

Run: `npm run build 2>&1 | tail -10`
Expected: clean build, no missing module errors.

---

## Task 5: Smoke-test in browser

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Navigate to: `http://localhost:5173/admin/outcomes`

- [ ] **Step 2: Verify with a framework assigned**

- The `fw-context-bar` shows only the chip with a `ChevronDown` icon — no "Clone as new…" / "Change…" buttons.
- Click the chip → drawer slides in from the right.
- Drawer header shows "Programme Framework" + subtitle.
- Section 1 "Active Framework" shows the framework name, "Active" badge, meta pills (outcomes / direct / indirect / unmapped counts).
- Click "Rename" → inline input appears prefilled with framework name; cancel closes it.
- Click "Clone as new…" → inline input appears; entering a duplicate name shows error; entering a unique name and clicking Clone succeeds + toast.
- Click "Remove" → ConfirmDialog appears; confirming unassigns the framework, drawer closes, page shows empty state.
- Section 2 "Previous Periods" lists other org frameworks (excluding current).
- "Clone & Use" on a previous period: if no current mappings, proceeds immediately. If mappings exist, ConfirmDialog appears.
- Section 3 "Starter Templates" lists platform frameworks (org IS NULL).
- "Create blank framework" button → inline form appears; fill name + optional desc → "Create & Use" creates and assigns framework, drawer closes.

- [ ] **Step 3: Verify empty state**

Remove the framework assignment (or use a period with no framework).
- Both "Start from an existing framework" and "Create from scratch" buttons open the `FrameworkPickerDrawer`.
- Drawer works the same way.

- [ ] **Step 4: Verify dark mode**

Toggle dark mode.
- Active framework card, meta pills, action buttons, fw-rows, create blank button all render correctly in dark mode.
