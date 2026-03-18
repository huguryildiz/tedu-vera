// src/admin/CriteriaManager.jsx
// ============================================================
// Rich evaluation criteria editor for semester settings.
//
// Admin-facing canonical model per criterion:
//   label, shortLabel, color, max, blurb, mudek[], rubric[]
//
// Internal machine-safe `key` is NEVER shown to the admin.
// It is silently preserved from the existing template (row._key)
// or auto-derived from label in criterionToTemplate().
//
// `mudek_outcomes` is a legacy field — it is never stored in editor
// state and is only emitted in the save normalizer (criterionToTemplate).
//
// Props:
//   template      — current criteria array (any stored shape)
//   mudekTemplate — semester's MÜDEK outcomes [{ id, code, ... }]
//   onSave        — (newTemplate) => Promise<{ ok, error? }>
//   disabled      — disables all inputs and the save button
//   isLocked      — when true, structural edits disabled; only label/shortLabel/blurb editable
// ============================================================

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
import { GripVerticalIcon, TrashIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from "../shared/Icons";
import DangerIconButton from "../components/admin/DangerIconButton";
import { CSS } from "@dnd-kit/utilities";
import { normalizeCriterion, criterionToTemplate } from "../shared/criteriaHelpers";
import { CRITERIA } from "../config";

// ── Default rubric seed for a new criterion ───────────────────

function defaultRubricBands(max) {
  const m = Number(max) || 30;
  // Excellent: top ~10%, Good: next ~20%, Developing: next ~30%, Insufficient: rest
  const e = Math.round(m * 0.9);
  const g = Math.round(m * 0.7);
  const d = Math.round(m * 0.4);
  return [
    { level: "Excellent",    min: e,     max: m,     desc: "" },
    { level: "Good",         min: g,     max: e - 1, desc: "" },
    { level: "Developing",   min: d,     max: g - 1, desc: "" },
    { level: "Insufficient", min: 0,     max: d - 1, desc: "" },
  ];
}

// ── View-model row shape ──────────────────────────────────────

function templateToRow(c, idx) {
  const n = normalizeCriterion(c);
  return {
    _id:        `row-${idx}-${Date.now()}`,
    _key:       n.key,                          // hidden stable key
    label:      n.label,
    shortLabel: n.shortLabel,
    color:      n.color,
    max:        String(n.max),
    blurb:      n.blurb,
    mudek:      n.mudek,                        // display codes only
    rubric:     n.rubric.length > 0 ? n.rubric : defaultRubricBands(n.max),
    _rubricOpen: false,
  };
}

function emptyRow(idx) {
  const id = `row-new-${idx}-${Date.now()}`;
  return {
    _id:        id,
    _key:       "",                             // will be derived on save
    label:      "",
    shortLabel: "",
    color:      "#94A3B8",
    max:        "",
    blurb:      "",
    mudek:      [],
    rubric:     [],
    _rubricOpen: false,
  };
}

// ── Validation ────────────────────────────────────────────────

function validateRows(rows) {
  const errors = {};
  let totalMax = 0;

  rows.forEach((r, i) => {
    if (!r.label.trim()) {
      errors[`label_${i}`] = "Required";
    }
    if (!r.shortLabel.trim()) {
      errors[`short_label_${i}`] = "Required";
    }
    const maxN = Number(r.max);
    if (!r.max || !Number.isInteger(maxN) || maxN <= 0) {
      errors[`max_${i}`] = "Enter positive integer";
    } else {
      totalMax += maxN;
    }

    // Rubric band validation (only if bands exist)
    if (r.rubric.length > 0) {
      r.rubric.forEach((b, bi) => {
        const bMin = Number(b.min);
        const bMax = Number(b.max);
        if (!Number.isFinite(bMin) || !Number.isFinite(bMax)) {
          errors[`rubric_${i}_${bi}_range`] = "Min and max must be numbers";
        } else if (bMin > bMax) {
          errors[`rubric_${i}_${bi}_range`] = "Min must be ≤ max";
        }
      });

      // Overlap check (block)
      const sorted = r.rubric
        .map((b, bi) => ({ bi, min: Number(b.min), max: Number(b.max) }))
        .filter((b) => Number.isFinite(b.min) && Number.isFinite(b.max) && b.min <= b.max)
        .sort((a, b) => a.min - b.min);

      for (let j = 0; j < sorted.length - 1; j++) {
        if (sorted[j].max >= sorted[j + 1].min) {
          errors[`rubric_${i}_overlap`] = `Bands ${sorted[j].bi + 1} and ${sorted[j + 1].bi + 1} overlap`;
        }
      }
    }
  });

  // Duplicate label check
  const labels = rows.map((r) => r.label.trim().toLowerCase()).filter(Boolean);
  labels.forEach((l, i) => {
    if (labels.indexOf(l) !== i) {
      errors[`label_${i}`] = "Duplicate label";
    }
  });

  return { errors, totalMax };
}


// ── MÜDEK pill selector ───────────────────────────────────────

function MudekPillSelector({ selected, mudekTemplate, onChange, disabled, criterionColor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = (mudekTemplate || []);
  const color = criterionColor || "#94A3B8";

  if (options.length === 0) {
    return (
      <span className="criteria-mudek-empty">
        No MÜDEK Outcomes defined yet.
      </span>
    );
  }

  const filtered = query.trim()
    ? options.filter((o) =>
        o.code.includes(query.trim()) ||
        (o.desc_en || "").toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  const toggle = (code) => {
    if (disabled) return;
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next);
  };

  return (
    <div className="criteria-mudek-selector">
      <div className="criteria-mudek-pills">
        {selected.length === 0 && (
          <span className="criteria-mudek-none">None selected</span>
        )}
        {selected.map((code) => (
          <span
            key={code}
            className="criteria-mudek-pill"
            style={{ backgroundColor: color + "22", borderColor: color, color }}
          >
            {code}
            {!disabled && (
              <button
                type="button"
                className="criteria-mudek-pill-remove"
                onClick={() => toggle(code)}
                aria-label={`Remove MÜDEK ${code}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button
            type="button"
            className="criteria-mudek-add-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Select MÜDEK Outcomes"
          >
            {open ? (
              <><ChevronUpIcon className="criteria-btn-icon" /> Close</>
            ) : (
              <><ChevronDownIcon className="criteria-btn-icon" /> Select</>
            )}
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="criteria-mudek-panel">
          <input
            className="manage-input criteria-mudek-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter outcomes…"
            aria-label="Filter MÜDEK Outcomes"
          />
          <div className="criteria-mudek-chips">
            {filtered.map((o) => {
              const checked = selected.includes(o.code);
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`criteria-mudek-chip${checked ? " selected" : ""}`}
                  style={checked ? { backgroundColor: color + "33", borderColor: color } : {}}
                  onClick={() => toggle(o.code)}
                  title={o.desc_en || o.code}
                >
                  {o.code}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rubric band editor ────────────────────────────────────────

function RubricBandEditor({ bands, onChange, disabled, criterionMax, errors, criterionIdx }) {
  const addBand = () => {
    onChange([...bands, { level: "", min: 0, max: 0, desc: "" }]);
  };
  const removeBand = (bi) => {
    onChange(bands.filter((_, idx) => idx !== bi));
  };
  const setBand = (bi, field, value) => {
    const next = bands.map((b, idx) => idx === bi ? { ...b, [field]: value } : b);
    onChange(next);
  };

  // Coverage warning
  const filled = bands.filter(
    (b) => Number.isFinite(Number(b.min)) && Number.isFinite(Number(b.max)) && Number(b.min) <= Number(b.max)
  );
  const covered = new Set();
  filled.forEach((b) => {
    for (let i = Number(b.min); i <= Number(b.max); i++) covered.add(i);
  });
  const max = Number(criterionMax) || 0;
  let coverageWarning = null;
  if (bands.length > 0 && max > 0) {
    for (let i = 0; i <= max; i++) {
      if (!covered.has(i)) {
        coverageWarning = `Score range [0–${max}] not fully covered by rubric bands.`;
        break;
      }
    }
  }

  const overlapError = errors[`rubric_${criterionIdx}_overlap`];

  return (
    <div className="rubric-band-editor">
      {overlapError && (
        <div className="manage-field-error">{overlapError}</div>
      )}
      {coverageWarning && !overlapError && (
        <div className="manage-hint manage-hint-warning">{coverageWarning}</div>
      )}
      {bands.map((band, bi) => {
        const rangeError = errors[`rubric_${criterionIdx}_${bi}_range`];
        return (
          <div key={bi} className="rubric-band-card">
            <div className="rubric-band-header">
              <div className="rubric-band-level-group">
                <label className="criteria-manager-cell-label small-label">Band Name</label>
                <input
                  className="manage-input rubric-band-level"
                  value={band.level}
                  onChange={(e) => setBand(bi, "level", e.target.value)}
                  placeholder="Excellent"
                  disabled={disabled}
                  aria-label={`Band ${bi + 1} level`}
                />
              </div>

              <div className="rubric-band-score-group">
                <label className="criteria-manager-cell-label small-label">Score Range</label>
                <div className="rubric-band-range-inputs">
                  <input
                    className={`manage-input rubric-band-score-input${rangeError ? " is-danger" : ""}`}
                    type="number"
                    min="0"
                    max={criterionMax}
                    value={band.min}
                    onChange={(e) => setBand(bi, "min", e.target.value)}
                    placeholder="Min"
                    disabled={disabled}
                    aria-label={`Band ${bi + 1} min`}
                  />
                  <span className="rubric-band-separator">–</span>
                  <input
                    className={`manage-input rubric-band-score-input${rangeError ? " is-danger" : ""}`}
                    type="number"
                    min="0"
                    max={criterionMax}
                    value={band.max}
                    onChange={(e) => setBand(bi, "max", e.target.value)}
                    placeholder="Max"
                    disabled={disabled}
                    aria-label={`Band ${bi + 1} max`}
                  />
                </div>
              </div>

              {!disabled && (
                <div className="rubric-band-actions">
                  <DangerIconButton
                    Icon={XIcon}
                    onClick={() => removeBand(bi)}
                    disabled={disabled}
                    ariaLabel={`Remove band ${bi + 1}`}
                    title="Remove band"
                    className="rubric-band-remove-btn"
                  />
                </div>
              )}
            </div>

            <div className="rubric-band-description-row">
              <label className="criteria-manager-cell-label small-label">Description</label>
              <AutoGrow
                value={band.desc}
                onChange={(e) => setBand(bi, "desc", e.target.value)}
                disabled={disabled}
                placeholder="Exemplary performance across all areas…"
                ariaLabel={`Band ${bi + 1} description`}
                className="rubric-band-desc-textarea"
                rows={2}
              />
            </div>

            {rangeError && (
              <div className="manage-field-error rubric-band-error">{rangeError}</div>
            )}
          </div>
        );
      })}
      {!disabled && (
        <button type="button" className="manage-btn rubric-add-band-btn" onClick={addBand}>
          + Add Band
        </button>
      )}
    </div>
  );
}

// ── Sortable row wrapper ──────────────────────────────────────

function SortableCriterionRow({ id, children }) {
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

export default function CriteriaManager({
  template = [],
  mudekTemplate = [],
  onSave,
  disabled = false,
  isLocked = false,
}) {
  const instanceId = useId();

  const buildRows = useCallback(
    (tpl) =>
      tpl.length > 0
        ? tpl.map((c, i) => templateToRow(c, i))
        : [emptyRow(0)],
    []
  );

  const [rows, setRows] = useState(() => buildRows(template));
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync when template prop changes
  useEffect(() => {
    setRows(buildRows(template));
    setSaveError("");
  }, [JSON.stringify(template)]); // eslint-disable-line react-hooks/exhaustive-deps

  const { errors, totalMax } = validateRows(rows);
  const hasErrors = Object.keys(errors).length > 0;
  const totalOk = totalMax === 100;
  const canSave = !hasErrors && totalOk && !disabled && rows.length > 0;

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

  const toggleRubric = (i) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], _rubricOpen: !next[i]._rubricOpen };
      if (next[i]._rubricOpen && next[i].rubric.length === 0) {
        next[i] = { ...next[i], rubric: defaultRubricBands(Number(next[i].max) || 30) };
      }
      return next;
    });
  };

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const fromIndex = prev.findIndex((r) => r._id === String(active.id));
      const toIndex   = prev.findIndex((r) => r._id === String(over.id));
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
      const normalized = rows.map((r) => criterionToTemplate(r));
      const result = await onSave(normalized);
      if (!result?.ok) {
        setSaveError(result?.error || "Could not save criteria template. Try again.");
      }
    } catch (e) {
      setSaveError(e?.message || "Could not save criteria template. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const rowIds = rows.map((r) => r._id);

  return (
    <div className="criteria-manager">
      <div className="criteria-manager-header">
        <span className="criteria-manager-title">Evaluation Criteria</span>
        <div className={`criteria-total-bar${totalOk ? " criteria-total-valid" : " criteria-total-invalid"}`}>
          Total: {totalMax} / 100 {totalOk ? "✓" : "— must equal 100"}
        </div>
      </div>

      <DndContext
        id={instanceId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <div className="criteria-manager-rows">
            {rows.map((row, i) => (
              <SortableCriterionRow key={row._id} id={row._id}>
                {({ attributes, listeners, setNodeRef, style }) => (
                  <div
                    ref={setNodeRef}
                    style={{ ...style, borderLeftColor: row.color || "#94A3B8" }}
                    className="criterion-card"
                  >
                    {/* ── Card header row ── */}
                    <div className="criterion-card-header">
                      {/* ── Toolbar: Drag, Swatch, Remove ── */}
                      <div className="criterion-card-toolbar">
                        <label className="criteria-manager-cell-label toolbar-label-placeholder">&nbsp;</label>
                        <div className="criterion-card-toolbar-actions">
                          <button
                            type="button"
                            className="manage-icon-btn manage-drag-handle"
                            disabled={structurallyLocked}
                            aria-label={`Drag to reorder criterion ${i + 1}`}
                            title="Drag to reorder"
                            {...attributes}
                            {...listeners}
                          >
                            <GripVerticalIcon />
                          </button>
                          
                          <label
                            className="criterion-color-picker-trigger"
                            title="Change color"
                            style={{ backgroundColor: row.color }}
                          >
                            <input
                              type="color"
                              className="criterion-color-input--hidden"
                              value={row.color}
                              onChange={(e) => setRow(i, "color", e.target.value)}
                              disabled={structurallyLocked}
                              aria-label={`Criterion ${i + 1} color`}
                            />
                          </label>

                          <DangerIconButton
                            Icon={XIcon}
                            onClick={() => removeRow(i)}
                            disabled={structurallyLocked || rows.length === 1}
                            ariaLabel={`Remove criterion ${i + 1}`}
                            title="Remove criterion"
                          />
                        </div>
                      </div>

                      {/* Label */}
                      <div className="criterion-field criterion-field--label">
                        <label className="criteria-manager-cell-label">Label</label>
                        <input
                          className={`manage-input${errors[`label_${i}`] ? " is-danger" : ""}`}
                          value={row.label}
                          onChange={(e) => setRow(i, "label", e.target.value)}
                          placeholder="Technical Content"
                          disabled={disabled}
                          aria-label={`Criterion ${i + 1} label`}
                        />
                        {errors[`label_${i}`] && (
                          <div className="manage-field-error manage-field-error--simple">{errors[`label_${i}`]}</div>
                        )}
                      </div>

                      {/* ShortLabel */}
                      <div className="criterion-field criterion-field--short">
                        <label className="criteria-manager-cell-label">Short label</label>
                        <input
                          className={`manage-input${errors[`short_label_${i}`] ? " is-danger" : ""}`}
                          value={row.shortLabel}
                          onChange={(e) => setRow(i, "shortLabel", e.target.value)}
                          placeholder="Technical"
                          disabled={disabled}
                          aria-label={`Criterion ${i + 1} short label`}
                        />
                        {errors[`short_label_${i}`] && (
                          <div className="manage-field-error manage-field-error--simple">{errors[`short_label_${i}`]}</div>
                        )}
                      </div>

                      {/* Max */}
                      <div className="criterion-field criterion-field--max">
                        <label className="criteria-manager-cell-label">Max</label>
                        <input
                          className={`manage-input${errors[`max_${i}`] ? " is-danger" : ""}`}
                          type="number"
                          min="1"
                          max="100"
                          value={row.max}
                          onChange={(e) => setRow(i, "max", e.target.value)}
                          placeholder="30"
                          disabled={structurallyLocked}
                          aria-label={`Criterion ${i + 1} max score`}
                        />
                        {errors[`max_${i}`] && (
                          <div className="manage-field-error manage-field-error--simple">{errors[`max_${i}`]}</div>
                        )}
                      </div>
                    </div>

                    {/* ── Description ── */}
                    <div className="criterion-field criterion-field--blurb">
                      <label className="criteria-manager-cell-label">Description</label>
                      <AutoGrow
                        value={row.blurb}
                        onChange={(e) => setRow(i, "blurb", e.target.value)}
                        disabled={disabled}
                        placeholder="Brief description shown to jurors…"
                        ariaLabel={`Criterion ${i + 1} description`}
                      />
                    </div>

                    {/* ── MÜDEK mapping ── */}
                    {mudekTemplate.length > 0 && (
                      <div className="criterion-field criterion-field--mudek">
                        <label className="criteria-manager-cell-label">MÜDEK Outcomes</label>
                        <MudekPillSelector
                          selected={row.mudek}
                          mudekTemplate={mudekTemplate}
                          onChange={(next) => setRow(i, "mudek", next)}
                          disabled={structurallyLocked}
                          criterionColor={row.color}
                        />
                      </div>
                    )}

                    {/* ── Rubric bands ── */}
                    <div className="criterion-field criterion-field--rubric">
                      <button
                        type="button"
                        className="rubric-toggle-btn"
                        onClick={() => toggleRubric(i)}
                        aria-expanded={row._rubricOpen}
                      >
                        {row._rubricOpen ? (
                          <><ChevronUpIcon className="criteria-btn-icon" /> Hide Rubric</>
                        ) : (
                          <><ChevronDownIcon className="criteria-btn-icon" /> Edit Rubric ({row.rubric.length} band{row.rubric.length !== 1 ? "s" : ""})</>
                        )}
                      </button>
                      {row._rubricOpen && (
                        <RubricBandEditor
                          bands={row.rubric}
                          onChange={(next) => setRow(i, "rubric", next)}
                          disabled={structurallyLocked}
                          criterionMax={row.max}
                          errors={errors}
                          criterionIdx={i}
                        />
                      )}
                    </div>
                  </div>
                )}
              </SortableCriterionRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="criteria-manager-footer">
        <button
          type="button"
          className="manage-btn"
          onClick={addRow}
          disabled={structurallyLocked}
        >
          + Add Criterion
        </button>
        <button
          type="button"
          className="manage-btn primary"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? "Saving…" : "Save Criteria"}
        </button>
      </div>

      {isLocked && (
        <div className="manage-hint manage-hint-warning" role="status">
          Structure locked — scoring has started for this semester. Only labels and descriptions can be edited.
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
