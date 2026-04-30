// src/admin/drawers/AddProjectDrawer.jsx
// Drawer: add a new project (group/entry) to the current period.
//
// Props:
//   open       — boolean
//   onClose    — () => void
//   onSave     — (data) => Promise<void>
//   error      — string | null

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Icon } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";

const HANDLE_SVG = (
  <Icon
    iconNode={[]}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2">
    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
    <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
  </Icon>
);
import Drawer from "@/shared/ui/Drawer";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import useShakeOnError from "@/shared/hooks/useShakeOnError";

const EMPTY = { title: "", advisor: "", description: "", members: [""] };

export default function AddProjectDrawer({ open, onClose, onSave, error }) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (open) { setForm(EMPTY); setTouched({}); setSaveError(""); setSaving(false); }
  }, [open]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));

  const setMember = (i, val) =>
    setForm((f) => { const m = [...f.members]; m[i] = val; return { ...f, members: m }; });

  const addMember = () =>
    setForm((f) => ({ ...f, members: [...f.members, ""] }));

  const removeMember = (i) =>
    setForm((f) => ({ ...f, members: f.members.filter((_, idx) => idx !== i) }));

  const dragIndex = useRef(null);
  const dragOverIndex = useRef(null);
  const [draggableIdx, setDraggableIdx] = useState(null);

  const onDragStart = (i) => { dragIndex.current = i; };
  const onDragEnter = (i) => { dragOverIndex.current = i; };
  const onDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) {
      dragIndex.current = null;
      dragOverIndex.current = null;
      setDraggableIdx(null);
      return;
    }
    setForm((f) => {
      const m = [...f.members];
      const [moved] = m.splice(from, 1);
      m.splice(to, 0, moved);
      return { ...f, members: m };
    });
    dragIndex.current = null;
    dragOverIndex.current = null;
    setDraggableIdx(null);
  };

  const hasMember = form.members.some((m) => m.trim());

  const handleSave = async () => {
    setTouched({ title: true, members: true });
    if (!form.title.trim() || !hasMember) return;
    setSaveError("");
    setSaving(true);
    try {
      await onSave?.({
        title: form.title.trim(),
        advisor: form.advisor.trim() || null,
        description: form.description.trim() || null,
        members: form.members.map((m) => m.trim()).filter(Boolean),
      });
      onClose();
    } catch (e) {
      setSaveError("Failed to add project. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const displayError = saveError || error;
  const saveBtnRef = useShakeOnError(displayError);
  const showMembersError = touched.members && !hasMember;

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="fs-icon accent" aria-hidden="true">
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></Icon>
            </span>
            <div className="fs-title-group">
              <div className="fs-title">Add Project</div>
              <div className="fs-subtitle">Create a new project entry for this period</div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></Icon>
          </button>
        </div>
      </div>
      <div className="fs-drawer-body">
        {displayError && (
          <FbAlert variant="danger" style={{ marginBottom: 14 }}>{displayError}</FbAlert>
        )}

        <div className="fs-field">
          <label className="fs-field-label">
            Title <span className="fs-field-req">*</span>
          </label>
          <input
            className={`fs-input${touched.title && !form.title.trim() ? " error" : ""}`}
            type="text"
            placeholder="Project title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            onBlur={() => touch("title")}
            disabled={saving}
            data-testid="project-drawer-title"
          />
          {touched.title && !form.title.trim() && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />Title is required.</p>
          )}
        </div>

        <div className="fs-field">
          <label className="fs-field-label">
            Advisor <span className="fs-field-opt">(optional)</span>
          </label>
          <input
            className="fs-input"
            type="text"
            placeholder="e.g., Dr. Ali Yılmaz, Prof. Aylin Kaya"
            value={form.advisor}
            onChange={(e) => set("advisor", e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="fs-field">
          <label className="fs-field-label">
            Description <span className="fs-field-opt">(optional)</span>
          </label>
          <textarea
            className="fs-textarea"
            placeholder="Brief project description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={saving}
            rows={3}
          />
        </div>

        <div className="fs-field">
          <label className="fs-field-label">Team Members <span className="fs-field-req">*</span></label>
          {form.members.map((m, i) => (
            <div
              key={i}
              className="fs-list-row"
              draggable={draggableIdx === i}
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div
                className="fs-list-handle"
                title="Drag to reorder"
                style={{ cursor: "grab" }}
                onMouseDown={() => setDraggableIdx(i)}
                onMouseUp={() => setDraggableIdx(null)}
              >{HANDLE_SVG}</div>
              <input
                className={`fs-input${i === 0 && showMembersError ? " error" : ""}`}
                type="text"
                placeholder={`Member ${i + 1}`}
                value={m}
                onChange={(e) => setMember(i, e.target.value)}
                onBlur={() => touch("members")}
                disabled={saving}
                data-testid={`project-drawer-member-${i}`}
              />
              {form.members.length > 1 && (
                <button
                  className="fs-list-remove"
                  type="button"
                  onClick={() => removeMember(i)}
                  disabled={saving}
                  aria-label="Remove member"
                >
                  <Icon
                    iconNode={[]}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></Icon>
                </button>
              )}
            </div>
          ))}
          <button className="fs-list-add" type="button" onClick={addMember} disabled={saving}>
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></Icon>
            Add member
          </button>
          {showMembersError && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />At least one team member is required.</p>
          )}
        </div>
      </div>
      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={saving} data-testid="project-drawer-cancel">
          Cancel
        </button>
        <button
          ref={saveBtnRef}
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.members.some((m) => m.trim())}
          data-testid="project-drawer-save"
        >
          <span className="btn-loading-content">
            <AsyncButtonContent loading={saving} loadingText="Saving…">Add Project</AsyncButtonContent>
          </span>
        </button>
      </div>
    </Drawer>
  );
}
