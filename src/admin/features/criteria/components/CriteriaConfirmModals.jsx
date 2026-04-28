import { Trash2, Icon } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import FbAlert from "@/shared/ui/FbAlert";

export function ClearAllCriteriaModal({
  open,
  submitting,
  confirmText,
  onConfirmTextChange,
  onClose,
  onConfirm,
  displayName,
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!submitting) onClose(); }}
      size="sm"
      centered
    >
      <div className="fs-modal-header">
        <div className="fs-modal-icon danger">
          <Trash2 size={22} strokeWidth={2} />
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>Delete All Criteria?</div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          You are about to permanently delete all criteria from{" "}
          <strong style={{ color: "var(--text-primary)" }}>{displayName}</strong>.
        </div>
      </div>
      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        <FbAlert variant="danger" title="This action cannot be undone" style={{ margin: 0 }}>
          All rubric bands, weights, and outcome mappings for every criterion will be permanently removed.
          Scores already submitted will not be affected.
        </FbAlert>
        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
            Type <strong style={{ color: "var(--text-primary)" }}>{displayName}</strong> to confirm
          </label>
          <input
            className="fs-typed-input"
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={`Type ${displayName} to confirm`}
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
          onClick={onClose}
          disabled={submitting}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-danger"
          onClick={onConfirm}
          disabled={submitting || confirmText !== displayName}
          style={{ flex: 1 }}
        >
          <AsyncButtonContent loading={submitting} loadingText="Deleting…">
            Delete All Criteria
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}

export function DeleteCriterionModal({
  open,
  submitting,
  confirmText,
  onConfirmTextChange,
  onClose,
  onConfirm,
  deleteLabel,
  canDelete,
}) {
  const deleteTargetText = deleteLabel || "";
  return (
    <Modal
      open={open}
      onClose={() => { if (!submitting) onClose(); }}
      size="sm"
      centered
    >
      <div className="fs-modal-header">
        <div className="fs-modal-icon danger">
          <Icon
            iconNode={[]}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </Icon>
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>Remove Criterion?</div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          You are about to remove{" "}
          <strong style={{ color: "var(--text-primary)" }}>{deleteLabel || "this criterion"}</strong>{" "}
          from the evaluation template.
        </div>
      </div>

      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        <FbAlert variant="danger" title="This action cannot be undone" style={{ margin: 0 }}>
          All rubric bands and outcome mappings for this criterion will be permanently removed.
          Scores already submitted will not be affected.
        </FbAlert>

        <div style={{ marginTop: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 6,
            }}
          >
            Type <strong style={{ color: "var(--text-primary)" }}>{deleteTargetText}</strong> to confirm
          </label>
          <input
            className="fs-typed-input"
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={deleteTargetText ? `Type ${deleteTargetText} to confirm` : "Type to confirm"}
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
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
          onClick={onClose}
          disabled={submitting}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-danger"
          onClick={onConfirm}
          disabled={submitting || !canDelete}
          style={{ flex: 1 }}
        >
          <AsyncButtonContent loading={submitting} loadingText="Removing…">
            Remove Criterion
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}
