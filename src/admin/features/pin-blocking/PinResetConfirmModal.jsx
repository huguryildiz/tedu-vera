// src/admin/modals/PinResetConfirmModal.jsx
// Step 1 of 2 in the PIN reset flow.
// Shows juror identity, current PIN mask, and a warning before confirming.
//
// Props:
//   open    — boolean
//   onClose — () => void
//   juror   — { juror_name, juryName, affiliation }
//   loading — boolean
//   onConfirm — () => void

import { KeyRound, Icon } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import JurorBadge from "@/admin/shared/JurorBadge";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import FbAlert from "@/shared/ui/FbAlert";

export default function PinResetConfirmModal({ open, onClose, juror, loading, onConfirm }) {
  const name = juror?.juryName || juror?.juror_name || "";

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="fs-modal-header">
        <div className="fs-modal-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon" style={{ background: "var(--surface-2)" }}>
              <KeyRound size={17} strokeWidth={2} />
            </div>
            <div className="fs-title-group">
              <div className="fs-title">Reset Juror PIN</div>
              <div className="fs-subtitle">Generate a new 4-digit access PIN.</div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </Icon>
          </button>
        </div>
      </div>
      <div className="fs-modal-body">
        {/* Step indicator */}
        <div className="fs-steps">
          <div className="fs-step active">
            <div className="fs-step-dot">1</div>
            <div className="fs-step-label">Confirm</div>
          </div>
          <div className="fs-step-line" />
          <div className="fs-step">
            <div className="fs-step-dot">2</div>
            <div className="fs-step-label">New PIN</div>
          </div>
        </div>

        {/* Juror card */}
        {juror && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", background: "var(--surface-1)",
              borderRadius: "var(--radius)", marginBottom: 12,
            }}
          >
            <JurorBadge
              name={name}
              affiliation={`${juror.affiliation || ""}  ·  Current PIN: ****`}
              size="md"
            />
          </div>
        )}

        {/* Warning banner */}
        <FbAlert variant="warning" title="Current PIN will stop working" style={{ marginBottom: 0 }}>
          The juror must use the new PIN to continue scoring.
        </FbAlert>
      </div>
      <div className="fs-modal-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={onConfirm}
          disabled={loading}
        >
          <span className="btn-loading-content">
            <AsyncButtonContent loading={loading} loadingText="Resetting…">Reset PIN</AsyncButtonContent>
          </span>
        </button>
      </div>
    </Modal>
  );
}
