import { useState } from "react";
import { UserPlus, MoreVertical, MailOpen, X, AlertCircle, Crown, ArrowRightLeft, UserMinus, Info, CheckCircle2, Clock } from "lucide-react";
import FbAlert from "../../shared/ui/FbAlert.jsx";
import "./AdminTeamCard.css";

// Deterministic avatar color from string hash
function avatarColor(str) {
  const colors = [
    "#6366f1", // Indigo
    "#8b5cf6", // Violet
    "#0ea5e9", // Cyan
    "#14b8a6", // Teal
    "#f59e0b", // Amber
    "#ec4899", // Pink
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Extract initials from name or email
function initials(member) {
  if (member.displayName) {
    const parts = member.displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return member.email.slice(0, 2).toUpperCase();
}

// Skeleton loading rows
function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="admin-team-skeleton-row">
          <td colSpan={4}>
            <div className="admin-team-skeleton-cell" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function AdminTeamCard({
  members = [],
  loading,
  error,
  inviteForm,
  openInviteForm,
  closeInviteForm,
  setInviteEmail,
  sendInvite,
  resendInvite,
  cancelInvite,
  transferOwnership,
  removeMember,
  setAdminsCanInvite,
  adminsCanInvite,
  canInvite,
  isOwnerViewer,
  currentUserId,
}) {
  // inline confirm state per row: { id: string, kind: 'transfer'|'remove'|'cancel' } | null
  const [rowConfirm, setRowConfirm] = useState(null);

  const active = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "invited");

  return (
    <div className="admin-team-card">
      <div className="admin-team-header">
        <div>
          <span className="admin-team-title">Admin Team</span>
          {!loading && (active.length > 0 || pending.length > 0) && (
            <span className="admin-team-meta">
              {[
                active.length > 0 && `${active.length} active`,
                pending.length > 0 && `${pending.length} pending`,
              ].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        {!inviteForm?.open && canInvite && (
          <button type="button" className="btn-invite-admin" onClick={openInviteForm}>
            <UserPlus size={14} strokeWidth={2} />
            Invite Admin
          </button>
        )}
      </div>

      {!loading && !canInvite && !isOwnerViewer && (
        <p className="admin-team-info-note">
          <Info size={12} strokeWidth={2} />
          Only the owner can invite new admins.
        </p>
      )}

      {isOwnerViewer && (
        <label className="admin-team-toggle">
          <input
            type="checkbox"
            checked={!!adminsCanInvite}
            onChange={(e) => setAdminsCanInvite(e.target.checked)}
          />
          <span className="admin-team-toggle-body">
            <span className="admin-team-toggle-label">Allow admins to invite other admins</span>
            <span className="admin-team-toggle-helper">When on, other admins can invite new admins. You always can.</span>
          </span>
        </label>
      )}

      {inviteForm?.open && (
        <div className="admin-team-invite-form">
          <div className="admin-team-invite-label">Invite New Admin</div>
          <div className="admin-team-invite-row">
            <input
              type="email"
              placeholder="email@university.edu"
              value={inviteForm.email}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              className={inviteForm.error ? "error" : ""}
              disabled={inviteForm.submitting}
              autoFocus
            />
            <button
              type="button"
              className="btn-send-invite"
              onClick={sendInvite}
              disabled={inviteForm.submitting}
            >
              {inviteForm.submitting ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              className="btn-close-invite"
              onClick={closeInviteForm}
              disabled={inviteForm.submitting}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          {inviteForm.error && (
            <p className="crt-field-error">
              <AlertCircle size={12} strokeWidth={2} />
              {inviteForm.error}
            </p>
          )}
        </div>
      )}

      {error && <FbAlert variant="danger">{error}</FbAlert>}

      <table className="admin-team-table">
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} className="admin-team-section-label">
                      Active ({active.length})
                    </td>
                  </tr>
                  {active.map((m) => {
                    const isSelf = m.userId === currentUserId;
                    const showKebab = isOwnerViewer && !isSelf;
                    const openConfirm = rowConfirm?.id === m.id ? rowConfirm.kind : null;

                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="admin-team-member-cell">
                            <div
                              className="admin-team-avatar"
                              style={{ background: avatarColor(m.email) }}
                            >
                              {initials(m)}
                            </div>
                            <div>
                              <div className="admin-team-name">
                                {m.displayName || m.email}
                                {isSelf && <span className="admin-team-you-badge admin-team-you-inline">You</span>}
                              </div>
                              {m.displayName && (
                                <div className="admin-team-email">{m.email}</div>
                              )}
                              {m.isOwner && (
                                <span className="admin-team-owner-pill" title="Owner">
                                  <Crown size={10} strokeWidth={2.2} /> Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-team-status-stack">
                            {isSelf && <span className="admin-team-you-badge admin-team-you-stacked">You</span>}
                            <span className="badge-active"><CheckCircle2 size={11} strokeWidth={2.5} /> Active</span>
                          </div>
                        </td>
                        <td className="admin-team-actions">
                          <div className="admin-team-actions-wrap">
                            {openConfirm === "transfer" || openConfirm === "remove" ? (
                              <div className="fs-confirm-panel">
                                <span className="fs-confirm-msg">
                                  {openConfirm === "transfer"
                                    ? `Transfer ownership to ${m.displayName || m.email}? You'll become a regular admin.`
                                    : `Remove ${m.displayName || m.email} from the admin team? They'll lose access immediately.`}
                                </span>
                                <span className="fs-confirm-btns">
                                  <button
                                    type="button"
                                    className="fs-confirm-cancel"
                                    onClick={() => setRowConfirm(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="fs-confirm-action"
                                    onClick={async () => {
                                      if (openConfirm === "transfer") {
                                        await transferOwnership(m.id);
                                      } else {
                                        await removeMember(m.id);
                                      }
                                      setRowConfirm(null);
                                    }}
                                  >
                                    {openConfirm === "transfer" ? "Transfer" : "Remove"}
                                  </button>
                                </span>
                              </div>
                            ) : showKebab ? (
                              <RowKebab
                                onTransfer={() => setRowConfirm({ id: m.id, kind: "transfer" })}
                                onRemove={() => setRowConfirm({ id: m.id, kind: "remove" })}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}

              {pending.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={4}
                      className="admin-team-section-label admin-team-section-pending"
                    >
                      Pending ({pending.length})
                    </td>
                  </tr>
                  {pending.map((m) => {
                    const showActions = canInvite;
                    const openConfirm = rowConfirm?.id === m.id ? rowConfirm.kind : null;

                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="admin-team-member-cell">
                            <div className="admin-team-avatar admin-team-avatar-pending">?</div>
                            <div>
                              <div className="admin-team-name admin-team-name-pending">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge-pending"><Clock size={11} strokeWidth={2.5} /> Pending</span>
                        </td>
                        <td className="admin-team-actions">
                          <div className="admin-team-actions-wrap">
                            {openConfirm === "cancel" ? (
                              <div className="fs-confirm-panel">
                                <span className="fs-confirm-msg">Cancel invite for {m.email}?</span>
                                <span className="fs-confirm-btns">
                                  <button
                                    type="button"
                                    className="fs-confirm-cancel"
                                    onClick={() => setRowConfirm(null)}
                                  >
                                    Keep
                                  </button>
                                  <button
                                    type="button"
                                    className="fs-confirm-action"
                                    onClick={async () => {
                                      await cancelInvite(m.id);
                                      setRowConfirm(null);
                                    }}
                                  >
                                    Cancel invite
                                  </button>
                                </span>
                              </div>
                            ) : showActions ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-resend"
                                  onClick={() => resendInvite(m.id, m.email)}
                                  title="Resend invite"
                                >
                                  <MailOpen size={12} strokeWidth={2} />
                                  Resend
                                </button>
                                <button
                                  type="button"
                                  className="btn-cancel-invite"
                                  onClick={() => setRowConfirm({ id: m.id, kind: "cancel" })}
                                  title="Cancel invite"
                                >
                                  <X size={12} strokeWidth={2} />
                                  Cancel
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}

              {!loading && active.length === 0 && pending.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-team-empty">
                    No admins yet
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RowKebab({ onTransfer, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-team-kebab-wrap">
      <button
        type="button"
        className="btn-kebab"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
      >
        <MoreVertical size={14} strokeWidth={2} />
      </button>
      {open && (
        <div className="admin-team-kebab-menu" onMouseLeave={() => setOpen(false)}>
          <button
            type="button"
            className="admin-team-kebab-item"
            onClick={() => { setOpen(false); onTransfer(); }}
          >
            <ArrowRightLeft size={12} strokeWidth={2} />
            Transfer ownership
          </button>
          <button
            type="button"
            className="admin-team-kebab-item admin-team-kebab-item-danger"
            onClick={() => { setOpen(false); onRemove(); }}
          >
            <UserMinus size={12} strokeWidth={2} />
            Remove from team
          </button>
        </div>
      )}
    </div>
  );
}
