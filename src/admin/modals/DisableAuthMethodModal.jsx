// src/admin/modals/DisableAuthMethodModal.jsx
// Modal: confirm disabling one of the two shared authentication methods.
// Mirrors the RemoveJurorModal layout — centered danger header, impact
// alert, typed-confirmation input, and centered footer buttons.
//
// Props:
//   open            — boolean
//   onClose         — () => void
//   disabledMethod  — "Google OAuth" | "Email/Password"
//   remainingMethod — "Google OAuth" | "Email/Password"
//   onConfirm       — () => Promise<void>

import { useState } from "react";
import { AlertCircle, ShieldOff } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";

export default function DisableAuthMethodModal({
  open,
  onClose,
  disabledMethod,
  remainingMethod,
  onConfirm,
}) {
  const [working, setWorking] = useState(false);
  const [typed, setTyped] = useState("");

  const handleClose = () => {
    if (working) return;
    setTyped("");
    onClose();
  };

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm?.();
      setTyped("");
      onClose();
    } finally {
      setWorking(false);
    }
  };

  const canDisable = typed === "DISABLE";

  return (
    <Modal open={open} onClose={handleClose} size="sm" centered>
      <div className="fs-modal-header">
        <div className="fs-modal-icon danger">
          <ShieldOff size={22} />
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>
          Disable {disabledMethod} login?
        </div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          The only remaining way to sign in will be{" "}
          <strong style={{ color: "var(--text-primary)" }}>{remainingMethod}</strong>.
        </div>
      </div>

      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        <div className="fs-alert danger" style={{ margin: 0, textAlign: "left" }}>
          <div className="fs-alert-icon"><AlertCircle size={15} /></div>
          <div className="fs-alert-body">
            <div className="fs-alert-title">Admins who rely on {disabledMethod} will lose access</div>
            <div className="fs-alert-desc">
              Make sure every active admin can sign in with {remainingMethod} before you
              continue. You can re-enable {disabledMethod} later from this drawer.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 6,
            }}
          >
            Type <strong style={{ color: "var(--text-primary)" }}>DISABLE</strong> to confirm
          </label>
          <input
            className="fs-typed-input"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type DISABLE to confirm"
            autoComplete="off"
            spellCheck={false}
            disabled={working}
          />
        </div>
      </div>

      <div
        className="fs-modal-footer"
        style={{ justifyContent: "center", background: "transparent", borderTop: "none", paddingTop: 0 }}
      >
        <button
          type="button"
          className="fs-btn fs-btn-secondary"
          onClick={handleClose}
          disabled={working}
          style={{ flex: 1 }}
        >
          Keep Both
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-danger"
          onClick={handleConfirm}
          disabled={working || !canDisable}
          style={{ flex: 1 }}
        >
          <span className="btn-loading-content">
            <AsyncButtonContent loading={working} loadingText="Disabling…">
              Disable {disabledMethod}
            </AsyncButtonContent>
          </span>
        </button>
      </div>
    </Modal>
  );
}
