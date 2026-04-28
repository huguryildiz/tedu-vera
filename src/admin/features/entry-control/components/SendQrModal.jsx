import { Check, Send, X } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import FbAlert from "@/shared/ui/FbAlert";

export default function SendQrModal({
  open,
  onClose,
  periodName,
  recipients,
  emailRecipients,
  selectedRecipientIds,
  selectedSet,
  selectedCount,
  noEmailCount,
  bulkSending,
  onToggleRecipient,
  onSelectAll,
  onDeselectAll,
  onBulkSend,
  onOpenNewUserModal,
}) {
  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="fs-modal-header">
        <div className="fs-modal-header-row">
          <div style={{ flex: 1 }}>
            <div className="fs-title">Send QR to All Jurors</div>
            <div className="fs-subtitle" style={{ marginTop: 3 }}>
              The active access link will be emailed to every juror assigned to <strong>{periodName || "this period"}</strong>.
            </div>
          </div>
          <button className="fs-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="fs-modal-body" style={{ paddingTop: 10, paddingBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface-1)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{recipients.length}</div>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--text-tertiary)", marginTop: 2 }}>Assigned</div>
          </div>
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", background: "var(--accent-soft)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{selectedCount}</div>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--text-tertiary)", marginTop: 2 }}>Selected</div>
          </div>
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface-1)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color: "var(--warning)" }}>{noEmailCount}</div>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--text-tertiary)", marginTop: 2 }}>No Email</div>
          </div>
        </div>
        <div className="ec-send-toolbar">
          <div className="ec-send-toolbar-label"><span id="ec-send-count-label">{selectedCount} of {recipients.length}</span> jurors selected</div>
          <div className="ec-send-toolbar-actions">
            <button className="ec-send-toolbar-btn" onClick={onSelectAll}>Select all</button>
            <button className="ec-send-toolbar-btn" onClick={onDeselectAll}>Deselect all</button>
          </div>
        </div>
        <div className="ec-send-recipients" id="ec-send-list">
          {recipients.map((recipient) => {
            const checked = selectedSet.has(recipient.id);
            const rowClassName = recipient.hasEmail
              ? `ec-send-recipient ${checked ? "checked" : "unchecked"}`
              : "ec-send-recipient no-email-row";
            return (
              <div
                key={recipient.id}
                className={rowClassName}
                onClick={recipient.hasEmail ? () => onToggleRecipient(recipient) : undefined}
              >
                <div className="ec-send-check">
                  <Check size={14} strokeWidth={3} />
                </div>
                <div className="ec-send-recipient-avatar">{recipient.initials}</div>
                <span className="ec-send-recipient-name">{recipient.name}</span>
                {recipient.hasEmail ? (
                  <span className="ec-send-recipient-email">{recipient.email}</span>
                ) : (
                  <span className="ec-send-recipient-tag no-email">No email</span>
                )}
              </div>
            );
          })}
        </div>
        {noEmailCount > 0 && (
          <FbAlert variant="warning" title={`${noEmailCount} juror${noEmailCount === 1 ? "" : "s"} without email addresses`} style={{ margin: "14px 0 0" }}>
            They will be skipped. You can add their emails in the Jurors page.
          </FbAlert>
        )}
      </div>
      <div className="fs-modal-footer ec-send-footer">
        <div className="ec-send-footer-left">
          <button
            className="ec-distribute-link"
            onClick={onOpenNewUserModal}
            style={{ fontSize: 11, padding: "6px 10px" }}
          >
            Send to new user
          </button>
        </div>
        <button className="fs-btn fs-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="fs-btn fs-btn-primary" id="ec-send-submit-btn" onClick={onBulkSend} disabled={bulkSending || selectedCount === 0}>
          <Send size={13} />
          <AsyncButtonContent loading={bulkSending} loadingText="Sending...">
            <span id="ec-send-btn-label">Send to {selectedCount} Juror{selectedCount === 1 ? "" : "s"}</span>
          </AsyncButtonContent>
        </button>
      </div>
    </Modal>
  );
}
