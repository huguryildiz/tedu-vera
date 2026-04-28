import { Trash2 } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import FbAlert from "@/shared/ui/FbAlert";

export default function UnassignFrameworkModal({
  open,
  frameworkName,
  confirmText,
  onConfirmTextChange,
  submitting,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!submitting) onCancel(); }}
      size="sm"
      centered
    >
      <div className="fs-modal-header">
        <div className="fs-modal-icon danger">
          <Trash2 size={22} strokeWidth={2} />
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>Remove Framework?</div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          You are about to remove the framework{" "}
          <strong style={{ color: "var(--text-primary)" }}>{frameworkName}</strong>{" "}
          from this evaluation period.
        </div>
      </div>
      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        <FbAlert variant="danger" title="This action cannot be undone" style={{ margin: 0 }}>
          All programme outcomes and criterion mappings defined for this period will be permanently removed.
          Scores already submitted will not be affected.
        </FbAlert>
        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
            Type <strong style={{ color: "var(--text-primary)" }}>{frameworkName}</strong> to confirm
          </label>
          <input
            className="fs-typed-input"
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={`Type ${frameworkName} to confirm`}
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
          />
        </div>
      </div>
      <div className="fs-modal-footer" style={{ justifyContent: "center", background: "transparent", borderTop: "none", paddingTop: 0 }}>
        <button
          type="button"
          className="fs-btn fs-btn-secondary"
          onClick={onCancel}
          disabled={submitting}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-danger"
          onClick={onConfirm}
          disabled={submitting || confirmText !== frameworkName}
          style={{ flex: 1 }}
        >
          <AsyncButtonContent loading={submitting} loadingText="Removing…">
            Remove Outcome
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}
