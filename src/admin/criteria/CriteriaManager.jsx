// src/admin/criteria/CriteriaManager.jsx
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
//   isLocked      — when true, the entire template is read-only; no field or action is editable
// ============================================================

import { useId } from "react";
import AlertCard from "../../shared/AlertCard";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CirclePlusIcon } from "../../shared/Icons";
import { CSS } from "@dnd-kit/utilities";
import { getCriterionDisplayName } from "./criteriaFormHelpers";
import { useCriteriaForm } from "./useCriteriaForm";
import CriterionEditor from "./CriterionEditor";
import CriterionDeleteDialog from "./CriterionDeleteDialog";

// ── Sortable row wrapper ──────────────────────────────────────

function SortableCriterionRow({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
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
  onDirtyChange,
  disabled = false,
  isLocked = false,
  saveDisabled = false,
}) {
  const instanceId = useId();

  const {
    rows,
    activeRows,
    saveError,
    saving,
    saveAttempted,
    pendingDeleteIndex,
    setPendingDeleteIndex,
    errors,
    rubricErrorsByCriterion,
    totalMax,
    totalOk,
    saveBlockReasons,
    canSave,
    fullyLocked,
    mudekOutcomeByCode,
    sanitizeMudekSelection,
    markTouched,
    setRow,
    addRow,
    requestRemoveRow,
    confirmRemoveRow,
    toggleRubric,
    toggleMudek,
    toggleCriterionCard,
    sensors,
    handleDragEnd,
    handleSave,
  } = useCriteriaForm({ template, mudekTemplate, onSave, onDirtyChange, disabled, isLocked });

  const rowIds = activeRows.map((r) => r._id);

  const rowActions = {
    setRow,
    markTouched,
    toggleCriterionCard,
    toggleMudek,
    toggleRubric,
    requestRemoveRow,
  };

  return (
    <div className="criteria-manager">
      <div className="criteria-manager-header">
        <span className="criteria-manager-title">Evaluation Criteria</span>
        <div className={`criteria-total-bar${totalOk ? " criteria-total-valid" : " criteria-total-invalid"}`}>
          Total: {totalMax} / 100 {totalOk ? "✓" : "— must equal 100"}
        </div>
      </div>

      {isLocked && (
        <AlertCard variant="warning">
          Evaluation template locked — scoring has started for this semester. No criteria changes are allowed.
        </AlertCard>
      )}

      <DndContext
        id={instanceId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <div className="criteria-manager-rows">
            {rows.map((row, i) => (
              <SortableCriterionRow key={row._id} id={row._id} disabled={fullyLocked}>
                {({ attributes, listeners, setNodeRef, style }) => (
                  <CriterionEditor
                    row={row}
                    index={i}
                    errors={errors}
                    rubricErrorsByCriterion={rubricErrorsByCriterion}
                    saveAttempted={saveAttempted}
                    fullyLocked={fullyLocked}
                    mudekTemplate={mudekTemplate}
                    mudekOutcomeByCode={mudekOutcomeByCode}
                    sanitizeMudekSelection={sanitizeMudekSelection}
                    rowActions={rowActions}
                    rowCount={rows.length}
                    attributes={attributes}
                    listeners={listeners}
                    setNodeRef={setNodeRef}
                    style={style}
                  />
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
          disabled={fullyLocked}
        >
          <span aria-hidden="true"><CirclePlusIcon className="manage-btn-icon" /></span>
          Add Criterion
        </button>
        <button
          type="button"
          className="manage-btn primary"
          onClick={handleSave}
          disabled={!canSave || saveDisabled}
        >
          {saving ? "Saving…" : "Save Criteria"}
        </button>
      </div>
      {saveAttempted && saveBlockReasons.length > 0 && (
        <AlertCard variant="error">
          {saveBlockReasons.length === 1
            ? saveBlockReasons[0]
            : (
              <ul className="manage-hint-list" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {saveBlockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )
          }
        </AlertCard>
      )}

      {saveError && (
        <AlertCard variant="error">
          {saveError}
        </AlertCard>
      )}

      <CriterionDeleteDialog
        open={pendingDeleteIndex !== null}
        rowLabel={pendingDeleteIndex !== null ? getCriterionDisplayName(rows[pendingDeleteIndex], pendingDeleteIndex) : ""}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDeleteIndex(null);
        }}
        onConfirm={confirmRemoveRow}
        saveDisabled={saveDisabled}
      />
    </div>
  );
}
