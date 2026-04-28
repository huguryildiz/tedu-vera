// src/admin/modals/UnlockAllModal.jsx
// Confirm bulk unlock of all locked jurors.
// Follows the RemoveJurorModal fs-modal pattern.
//
// Props:
//   open         — boolean
//   onClose      — () => void
//   lockedCount  — number (jurors currently auto-locked)
//   onConfirm    — () => Promise<void>

import { useState } from "react";
import { LockOpen } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import FbAlert from "@/shared/ui/FbAlert";

export default function UnlockAllModal({
  open,
  onClose,
  lockedCount = 0,
  onConfirm,
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm?.();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" centered>
      <div className="fs-modal-header">
        <div
          className="fs-modal-icon danger"
          style={{ margin: "0 auto 10px" }}
        >
          <LockOpen size={20} />
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>
          Unlock All Jurors?
        </div>
        <div
          className="fs-subtitle"
          style={{ textAlign: "center", marginTop: 4 }}
        >
          <strong style={{ color: "var(--text-primary)" }}>{lockedCount} juror{lockedCount !== 1 ? "s" : ""}</strong>{" "}
          will be immediately unlocked and their failed attempt counters reset.
        </div>
      </div>

      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        <FbAlert variant="warning" title="Actions will be logged" style={{ margin: 0 }}>
          Each unlock is recorded in the Audit Log with your admin identity and timestamp.
        </FbAlert>
      </div>

      <div
        className="fs-modal-footer"
        style={{
          justifyContent: "center",
          background: "transparent",
          borderTop: "none",
          paddingTop: 0,
        }}
      >
        <button
          type="button"
          className="fs-btn fs-btn-secondary"
          onClick={onClose}
          disabled={loading}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-danger"
          onClick={handleConfirm}
          disabled={loading || lockedCount === 0}
          style={{ flex: 1 }}
        >
          <span className="btn-loading-content">
            <AsyncButtonContent loading={loading} loadingText="Unlocking…">
              Unlock All
            </AsyncButtonContent>
          </span>
        </button>
      </div>
    </Modal>
  );
}
