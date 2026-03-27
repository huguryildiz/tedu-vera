// src/admin/criteria/CriterionDeleteDialog.jsx

import { useRef } from "react";
import { useFocusTrap } from "../../shared/useFocusTrap";
import AlertCard from "../../shared/AlertCard";
import { TrashIcon } from "../../shared/Icons";

export default function CriterionDeleteDialog({ open, rowLabel, onOpenChange, onConfirm, saveDisabled = false }) {
  const containerRef = useRef(null);

  useFocusTrap({
    containerRef,
    isOpen: open,
    onClose: () => onOpenChange(false),
  });

  if (!open) return null;

  return (
    <div className="manage-modal" role="dialog" aria-modal="true" aria-labelledby="criterion-delete-dialog-title">
      <div className="manage-modal-card manage-modal-card--delete" ref={containerRef}>
        <div className="delete-dialog__header">
          <span className="delete-dialog__icon" aria-hidden="true">
            <TrashIcon />
          </span>
          <div className="delete-dialog__title" id="criterion-delete-dialog-title">
            Delete Confirmation
          </div>
        </div>
        <div className="delete-dialog__body">
          <div className="delete-dialog__line delete-dialog__line--lead">
            <strong className="manage-delete-focus">{rowLabel || "This criterion"}</strong>
            {" will be deleted. Are you sure?"}
          </div>
          <AlertCard variant="error">
            This action removes the criterion from the semester settings. It cannot be undone.
          </AlertCard>
        </div>
        <div className="delete-dialog__actions">
          <button
            className="manage-btn manage-btn--delete-cancel"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            className="manage-btn manage-btn--delete-confirm"
            type="button"
            onClick={onConfirm}
            disabled={saveDisabled}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
