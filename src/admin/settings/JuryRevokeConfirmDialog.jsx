// src/admin/settings/JuryRevokeConfirmDialog.jsx
import { useRef } from "react";
import { BanIcon } from "../../shared/Icons";
import { useFocusTrap } from "../../shared/useFocusTrap";
import AlertCard from "../../shared/AlertCard";

export default function JuryRevokeConfirmDialog({
  open,
  loading,
  activeJurorCount = 0,
  onCancel,
  onConfirm,
}) {
  const containerRef = useRef(null);
  useFocusTrap({ containerRef, isOpen: !!open, onClose: onCancel });

  if (!open) return null;

  return (
    <div className="manage-modal" role="dialog" aria-modal="true" aria-labelledby="jury-revoke-dialog-title">
      <div className="manage-modal-card manage-modal-card--danger" ref={containerRef}>
        <div className="delete-dialog__header">
          <span className="delete-dialog__icon delete-dialog__icon--danger" aria-hidden="true">
            <BanIcon />
          </span>
          <div className="delete-dialog__title" id="jury-revoke-dialog-title">
            Revoke Access
          </div>
        </div>
        <div className="delete-dialog__body">
          <div className="delete-dialog__line">
            Are you sure you want to revoke jury entry access?
          </div>
          <AlertCard variant="error" icon={BanIcon}>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", textAlign: "left" }}>
              <li>New scans of the current QR code will be <strong>blocked immediately</strong>.</li>
              <li>All evaluations will be <strong>locked</strong> — active jurors will no longer be able to submit scores.</li>
            </ul>
          </AlertCard>
          {activeJurorCount > 0 && (
            <AlertCard variant="warning">
              <strong>{activeJurorCount}</strong> juror{activeJurorCount !== 1 ? "s are" : " is"} currently
              active and will be locked from further edits.
            </AlertCard>
          )}
        </div>
        <div className="manage-modal-actions">
          <button
            className="manage-btn manage-btn--delete-cancel"
            type="button"
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="manage-btn manage-btn--delete-confirm"
            type="button"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Revoking..." : "Revoke Access"}
          </button>
        </div>
      </div>
    </div>
  );
}
