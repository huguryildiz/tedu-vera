// src/admin/MudekManager.jsx
// ============================================================
// MÜDEK outcome template editor for semester settings.
//
// Admin-facing canonical editor model per outcome:
//   code, en, tr
//
// Internal `id` is NEVER shown in the UI. It is auto-derived
// from `code` in the save normalizer: id = "po_" + code.replace(/\./g, "_")
//
// The DB persists { id, code, desc_en, desc_tr }; the UI maps
//   en → desc_en, tr → desc_tr at save time.
//
// Rows support drag-and-drop reordering via @dnd-kit.
//
// Props:
//   mudekTemplate — current outcomes array [{ id, code, desc_en, desc_tr }]
//   onSave        — (newTemplate) => Promise<{ ok, error? }>
//   disabled      — disables all inputs and the save button
//   isLocked      — when true, structural edits (add/delete/reorder/code)
//                   are disabled; only en and tr remain editable
// ============================================================

import { useEffect, useId, useRef, useState } from "react";
import AutoGrow from "../shared/AutoGrow";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVerticalIcon, TrashIcon, XIcon } from "../shared/Icons";
import DangerIconButton from "../components/admin/DangerIconButton";
import { CSS } from "@dnd-kit/utilities";

// ── Internal helpers ──────────────────────────────────────────

function codeToId(code) {
  return "po_" + String(code).replace(/\./g, "_");
}


// ── View-model row ────────────────────────────────────────────

function templateToRow(o, idx) {
  return {
    _rowId: `mudek-row-${idx}-${Date.now()}`,
    code:   o.code ?? "",
    en:     o.desc_en ?? "",
    tr:     o.desc_tr ?? "",
  };
}

function emptyRow(idx) {
  return {
    _rowId: `mudek-row-new-${idx}-${Date.now()}`,
    code:   "",
    en:     "",
    tr:     "",
  };
}

// ── Validation ────────────────────────────────────────────────

function validateRows(rows) {
  const errors = {};

  rows.forEach((r, i) => {
    if (!r.code.trim()) errors[`code_${i}`]  = "Required";
    if (!r.en.trim())   errors[`en_${i}`]    = "Required";
    if (!r.tr.trim())   errors[`tr_${i}`]    = "Required";
  });

  // Duplicate code check
  const codes = rows.map((r) => r.code.trim()).filter(Boolean);
  codes.forEach((code, i) => {
    if (codes.indexOf(code) !== i) errors[`code_${i}`] = "Duplicate code";
  });

  return { errors };
}

// ── Sortable row wrapper ──────────────────────────────────────

function SortableMudekRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  return children({ attributes, listeners, setNodeRef, style });
}

// ── Main component ───────────────────────────────────────────

export default function MudekManager({
  mudekTemplate = [],
  onSave,
  disabled = false,
  isLocked = false,
}) {
  const instanceId = useId();

  const buildRows = (tpl) =>
    tpl.length > 0 ? tpl.map((o, i) => templateToRow(o, i)) : [];

  const [rows, setRows] = useState(() => buildRows(mudekTemplate));
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync when mudekTemplate prop changes
  useEffect(() => {
    setRows(buildRows(mudekTemplate));
    setSaveError("");
  }, [JSON.stringify(mudekTemplate)]); // eslint-disable-line react-hooks/exhaustive-deps

  const { errors } = validateRows(rows);
  const hasErrors = Object.keys(errors).length > 0;
  const canSave = !hasErrors && !disabled && rows.length > 0;

  const structurallyLocked = isLocked || disabled;

  const setRow = (i, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
    setSaveError("");
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length)]);
    setSaveError("");
  };

  const removeRow = (i) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setSaveError("");
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const fromIndex = prev.findIndex((r) => r._rowId === String(active.id));
      const toIndex   = prev.findIndex((r) => r._rowId === String(over.id));
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      // Save normalizer: derive id from code, map en/tr → desc_en/desc_tr
      const normalized = rows.map((r) => ({
        id:      codeToId(r.code.trim()),
        code:    r.code.trim(),
        desc_en: r.en.trim(),
        desc_tr: r.tr.trim(),
      }));
      const result = await onSave(normalized);
      if (!result?.ok) {
        setSaveError(result?.error || "Could not save MÜDEK template. Try again.");
      }
    } catch (e) {
      setSaveError(e?.message || "Could not save MÜDEK template. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const rowIds = rows.map((r) => r._rowId);

  return (
    <div className="mudek-manager">
      <div className="mudek-manager-header">
        <span className="mudek-manager-title">MÜDEK Outcomes</span>
        <span className="mudek-manager-count">
          {rows.length} outcome{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {rows.length === 0 && (
        <div className="manage-hint" role="status">
          No custom MÜDEK Outcomes defined. Using default outcomes from config as fallback.
          Add rows below to define semester-specific outcomes.
        </div>
      )}

      {rows.length > 0 && (
        <DndContext
          id={instanceId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            <div className="mudek-manager-rows">
              {rows.map((row, i) => (
                <SortableMudekRow key={row._rowId} id={row._rowId}>
                  {({ attributes, listeners, setNodeRef, style }) => (
                    <div ref={setNodeRef} style={style} className="mudek-manager-row">
                      {/* ── Left Actions: Drag & Remove ── */}
                      <div className="mudek-manager-row-actions">
                        <button
                          type="button"
                          className="manage-icon-btn mudek-manager-drag-handle"
                          disabled={structurallyLocked}
                          aria-label={`Drag to reorder outcome ${i + 1}`}
                          title="Drag to reorder"
                          {...attributes}
                          {...listeners}
                        >
                          <GripVerticalIcon />
                        </button>
                        <DangerIconButton
                          Icon={XIcon}
                          onClick={() => removeRow(i)}
                          disabled={structurallyLocked || rows.length === 1}
                          ariaLabel={`Remove outcome ${i + 1}`}
                          title="Remove outcome"
                        />
                      </div>

                      {/* Code */}
                      <div className="mudek-manager-cell mudek-manager-cell--code">
                        <label className="mudek-manager-cell-label">Code</label>
                        <input
                          className={`manage-input mudek-manager-input${errors[`code_${i}`] ? " is-danger" : ""}`}
                          value={row.code}
                          onChange={(e) => setRow(i, "code", e.target.value)}
                          placeholder="1.2"
                          disabled={structurallyLocked}
                          aria-label={`Outcome ${i + 1} code`}
                        />
                        {errors[`code_${i}`] && (
                          <div className="manage-field-error manage-field-error--simple">
                            {errors[`code_${i}`]}
                          </div>
                        )}
                      </div>

                      {/* English description */}
                      <div className="mudek-manager-cell mudek-manager-cell--desc">
                        <label className="mudek-manager-cell-label">EN</label>
                        <AutoGrow
                          value={row.en}
                          onChange={(e) => setRow(i, "en", e.target.value)}
                          disabled={disabled}
                          placeholder="English description"
                          ariaLabel={`Outcome ${i + 1} English description`}
                          hasError={!!errors[`en_${i}`]}
                        />
                        {errors[`en_${i}`] && (
                          <div className="manage-field-error mudek-manager-field-error">
                            {errors[`en_${i}`]}
                          </div>
                        )}
                      </div>

                      {/* Turkish description */}
                      <div className="mudek-manager-cell mudek-manager-cell--desc">
                        <label className="mudek-manager-cell-label">TR</label>
                        <AutoGrow
                          value={row.tr}
                          onChange={(e) => setRow(i, "tr", e.target.value)}
                          disabled={disabled}
                          placeholder="Türkçe açıklama"
                          ariaLabel={`Outcome ${i + 1} Turkish description`}
                          hasError={!!errors[`tr_${i}`]}
                        />
                        {errors[`tr_${i}`] && (
                          <div className="manage-field-error mudek-manager-field-error">
                            {errors[`tr_${i}`]}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </SortableMudekRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="mudek-manager-footer">
        <button
          type="button"
          className="manage-btn"
          onClick={addRow}
          disabled={structurallyLocked}
        >
          + Add MÜDEK Outcome
        </button>
        <button
          type="button"
          className="manage-btn primary"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? "Saving…" : "Save MÜDEK Outcomes"}
        </button>
      </div>

      {isLocked && (
        <div className="manage-hint manage-hint-warning" role="status">
          Structure locked — scoring has started for this semester. Only descriptions can be edited.
        </div>
      )}
      {saveError && (
        <div className="manage-hint manage-hint-error" role="alert">
          {saveError}
        </div>
      )}
    </div>
  );
}
