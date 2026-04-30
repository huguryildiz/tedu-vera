import { AlertCircle, PauseCircle, PlayCircle, Trash2, TriangleAlert, X, XCircle } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";

export function ToggleStatusModal({
  open,
  onClose,
  toggleOrg,
  toggleReason,
  setToggleReason,
  toggleError,
  toggleSaving,
  graceLockTooltip,
  isGraceLocked,
  onSave,
}) {
  const isSuspending = toggleOrg?.status === "active";
  const orgName = String(toggleOrg?.code || "").toUpperCase();

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="fs-modal-header" style={{ textAlign: "center", borderBottom: "none", paddingBottom: 4, position: "relative" }}>
        <button className="fs-close" onClick={onClose} style={{ position: "absolute", top: 0, right: 0 }}>
          <X size={16} strokeWidth={2} />
        </button>
        <div className="eem-icon" style={{ margin: "0 auto 10px", display: "grid", placeItems: "center" }}>
          {isSuspending ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
        </div>
        <div className="fs-title" style={{ letterSpacing: "-0.3px" }}>
          {isSuspending ? "Suspend" : "Activate"}{" "}
          <strong>{orgName}</strong>?
        </div>
        <div className="fs-subtitle" style={{ marginTop: 4 }}>
          {isSuspending
            ? "Jurors and evaluations will be paused."
            : "This organization will accept jurors and evaluations again."}
        </div>
      </div>
      <div className="fs-modal-body" style={{ paddingTop: 8 }}>
        {isSuspending && isGraceLocked && (
          <FbAlert variant="warning" style={{ marginBottom: 12 }}>
            {graceLockTooltip}
          </FbAlert>
        )}
        <div>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-tertiary)" }}>Reason</span>
            <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>Optional</span>
          </label>
          <textarea className="fs-input" rows={2} placeholder="Describe the reason for this status change…" style={{ resize: "vertical", width: "100%", lineHeight: 1.55, fontSize: 13, height: "auto", padding: "9px 12px" }} value={toggleReason} onChange={(e) => setToggleReason(e.target.value)} />
        </div>
        {toggleError && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--danger)" }}>
            <TriangleAlert size={13} />
            {toggleError}
          </div>
        )}
      </div>
      <div className="fs-modal-footer" style={{ justifyContent: "center", borderTop: "none", background: "transparent", paddingTop: 0, paddingBottom: 20, gap: 8 }}>
        <button className="fs-btn fs-btn-secondary" onClick={onClose} style={{ minWidth: 88 }}>Cancel</button>
        <PremiumTooltip text={isSuspending ? graceLockTooltip : null}>
          <button
            className={`fs-btn ${isSuspending ? "fs-btn-danger" : "fs-btn-primary"}`}
            onClick={onSave}
            disabled={toggleSaving || (isSuspending && isGraceLocked)}
            style={{ minWidth: 130 }}
          >
            <AsyncButtonContent loading={toggleSaving} loadingText={isSuspending ? "Suspending…" : "Activating…"}>
              {isSuspending ? "Suspend Organization" : "Activate Organization"}
            </AsyncButtonContent>
          </button>
        </PremiumTooltip>
      </div>
    </Modal>
  );
}

export function DeleteOrgModal({
  open,
  onClose,
  deleteOrg,
  deleteConfirmCode,
  setDeleteConfirmCode,
  deleteError,
  setDeleteError,
  deleteLoading,
  onDelete,
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="fs-modal-header" style={{ textAlign: "center", borderBottom: "none", paddingBottom: 4, position: "relative" }}>
        <button className="fs-close" onClick={onClose} style={{ position: "absolute", top: 0, right: 0 }}>
          <X size={16} strokeWidth={2} />
        </button>
        <div className="eem-icon" style={{ margin: "0 auto 10px", display: "grid", placeItems: "center" }}>
          <Trash2 size={20} />
        </div>
        <div className="fs-title" style={{ letterSpacing: "-0.3px" }}>Delete Organization</div>
      </div>
      <div className="fs-modal-body" style={{ paddingTop: 8 }}>
        <FbAlert variant="danger">
          <p style={{ textAlign: "justify", textJustify: "inter-word" }}>
            This will permanently delete <strong>{deleteOrg?.name}</strong>{" "}
            (<code>{deleteOrg?.code}</code>) and <strong>all associated data</strong>:
            evaluation periods, projects, jurors, scores, and audit logs.
            This action cannot be undone.
          </p>
        </FbAlert>
        <label
          style={{
            display: "block",
            marginTop: 16,
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 6,
            textAlign: "center",
          }}
        >
          Type <strong style={{ color: "var(--text-primary)" }}>{deleteOrg?.code}</strong> to confirm
        </label>
        <input
          data-testid="orgs-delete-code-input"
          className={`fs-typed-input${deleteError ? " error" : ""}`}
          value={deleteConfirmCode}
          onChange={(e) => { setDeleteConfirmCode(e.target.value); setDeleteError(""); }}
          placeholder={deleteOrg?.code ? `Type ${deleteOrg.code} to confirm` : ""}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          style={{ marginTop: 6 }}
        />
        {deleteError && (
          <p className="crt-field-error">
            <AlertCircle size={12} strokeWidth={2} />{deleteError}
          </p>
        )}
      </div>
      <div className="fs-modal-footer" style={{ justifyContent: "center", borderTop: "none", background: "transparent", paddingTop: 0, paddingBottom: 20, gap: 8 }}>
        <button data-testid="orgs-delete-cancel" className="fs-btn fs-btn-secondary" onClick={onClose} style={{ minWidth: 88 }}>
          Cancel
        </button>
        <button
          data-testid="orgs-delete-confirm"
          className="fs-btn fs-btn-danger"
          disabled={
            deleteLoading ||
            deleteConfirmCode.trim().toUpperCase() !== (deleteOrg?.code || "").toUpperCase()
          }
          onClick={onDelete}
          style={{ minWidth: 150 }}
        >
          <AsyncButtonContent loading={deleteLoading} loadingText="Deleting…">
            Delete Organization
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}

export function ResolveUnlockModal({
  open,
  onClose,
  resolveTarget,
  noteDraft,
  setNoteDraft,
  resolveSubmitting,
  onSubmit,
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" centered>
      <div className="fs-modal-header">
        <div className={`fs-modal-icon ${resolveTarget?.decision === "approved" ? "success" : "danger"}`}>
          {resolveTarget?.decision === "approved"
            ? <CheckCircle2 size={22} strokeWidth={2} />
            : <XCircle size={22} strokeWidth={2} />}
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>
          {resolveTarget?.decision === "approved" ? "Approve Unlock?" : "Reject Unlock?"}
        </div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          {resolveTarget?.decision === "approved"
            ? <>Unlock <strong style={{ color: "var(--text-primary)" }}>{resolveTarget?.row?.period_name}</strong>. Admin can edit the rubric again — existing scores remain but may become inconsistent.</>
            : <>Keep <strong style={{ color: "var(--text-primary)" }}>{resolveTarget?.row?.period_name}</strong> locked. The requester will be notified.</>
          }
        </div>
      </div>

      <div className="fs-modal-body" style={{ paddingTop: 2 }}>
        {resolveTarget?.decision === "approved" && (
          <FbAlert variant="warning" title="High-impact action">
            This unlock bypasses the fairness guard. It is audit-logged with severity=high and the requester receives an email with your optional note below.
          </FbAlert>
        )}
        <div style={{ marginTop: 10 }}>
          <label
            htmlFor="resolve-note"
            style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}
          >
            Note to requester <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
          </label>
          <textarea
            id="resolve-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            disabled={resolveSubmitting}
            placeholder={resolveTarget?.decision === "approved"
              ? "e.g. Approved — please make the fix and re-generate the QR code after."
              : "e.g. Rejected — the change you described affects rubric weights and would invalidate existing scores."}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text-primary)",
              background: "var(--input-bg, var(--bg-2))",
              border: "1px solid var(--border)",
              borderRadius: 8,
              resize: "vertical",
              minHeight: 72,
              outline: "none",
            }}
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
          disabled={resolveSubmitting}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`fs-btn ${resolveTarget?.decision === "approved" ? "fs-btn-primary" : "fs-btn-danger"}`}
          onClick={onSubmit}
          disabled={resolveSubmitting}
          style={{ flex: 1 }}
        >
          <AsyncButtonContent
            loading={resolveSubmitting}
            loadingText={resolveTarget?.decision === "approved" ? "Approving…" : "Rejecting…"}
          >
            {resolveTarget?.decision === "approved" ? "Approve & Unlock" : "Reject Request"}
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}
