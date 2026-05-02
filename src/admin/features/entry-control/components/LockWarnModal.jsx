import { Lock } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import FbAlert from "@/shared/ui/FbAlert";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";

export default function LockWarnModal({ open, onClose, onConfirm, periodName, regenerating }) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!regenerating) onClose(); }}
      size="sm"
      centered
    >
      <div className="fs-modal-header">
        <div className="fs-modal-icon warning">
          <Lock size={22} strokeWidth={2} />
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>Generate QR &amp; lock period?</div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          Publishing the QR marks <strong style={{ color: "var(--text-primary)" }}>{periodName || "this period"}</strong> as live.
        </div>
      </div>
      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        <FbAlert variant="warning" title="Criteria and outcomes will become read-only">
          Once the QR is live, every criterion and outcome field — names, descriptions, weights, rubric bands, mappings, coverage types — is frozen so each juror scores against the same rubric. You can unlock from the Periods page if you need to adjust something later.
        </FbAlert>
      </div>
      <div className="fs-modal-footer" style={{ justifyContent: "center", background: "transparent", borderTop: "none", paddingTop: 0 }}>
        <button
          type="button"
          className="fs-btn fs-btn-secondary"
          onClick={onClose}
          disabled={regenerating}
          style={{ flex: 1 }}
          data-testid="lock-warn-modal-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-primary"
          onClick={onConfirm}
          disabled={regenerating}
          style={{ flex: 1 }}
          data-testid="lock-warn-modal-confirm"
        >
          <AsyncButtonContent loading={regenerating} loadingText="Generating…">
            Generate &amp; lock
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}
