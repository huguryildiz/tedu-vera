import { useState, useEffect } from "react";
import { AlertCircle, Crown, Icon, Mail, Trash2, UserPlus, CheckCircle2, X } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import Drawer from "@/shared/ui/Drawer";
import Avatar from "@/shared/ui/Avatar";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import CustomSelect from "@/shared/ui/CustomSelect";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { jurorInitials, jurorAvatarBg } from "@/admin/utils/jurorIdentity";
import { formatShortDate } from "./organizationHelpers";

export function CreateOrgDrawer({
  open,
  onClose,
  createForm,
  setCreateForm,
  createFieldErrors,
  setCreateFieldErrors,
  createError,
  createSaving,
  onSave,
}) {
  const [touched, setTouched] = useState({});
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  useEffect(() => {
    if (open) setTouched({});
  }, [open]);

  const handleSave = () => {
    setTouched({ name: true, shortLabel: true, contact_email: true });
    onSave();
  };

  const nameEmpty = !(createForm.name || "").trim();
  const codeEmpty = !(createForm.shortLabel || "").trim();
  const emailEmpty = !(createForm.contact_email || "").trim();

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="vera-icon-surface" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 9 }}>
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </Icon>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Create Organization</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                Register a new organization
              </div>
            </div>
          </div>
          <button className="fs-close" onClick={onClose}>
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></Icon>
          </button>
        </div>
      </div>
      <div className="fs-drawer-body" style={{ gap: 16 }}>
        <div className="fs-field">
          <label className="fs-field-label">Organization Name <span className="fs-field-req">*</span></label>
          <input
            data-testid="orgs-drawer-name"
            className={`fs-input${(touched.name && nameEmpty) || createFieldErrors.name ? " error" : ""}`}
            type="text"
            value={createForm.name || ""}
            onChange={(e) => {
              setCreateForm((prev) => ({ ...prev, name: e.target.value }));
              if (createFieldErrors.name) setCreateFieldErrors((prev) => ({ ...prev, name: "" }));
            }}
            onBlur={() => touch("name")}
            placeholder="e.g., TED University — Electrical-Electronics Engineering"
          />
          {((touched.name && nameEmpty) || createFieldErrors.name) && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{createFieldErrors.name || "Organization name is required."}</p>
          )}
        </div>
        <div className="fs-field">
          <label className="fs-field-label">Code <span className="fs-field-req">*</span></label>
          <input
            data-testid="orgs-drawer-code"
            className={`fs-input${(touched.shortLabel && codeEmpty) || createFieldErrors.shortLabel ? " error" : ""}`}
            type="text"
            value={createForm.shortLabel || ""}
            onChange={(e) => {
              const shortLabel = e.target.value.toUpperCase();
              setCreateForm((prev) => ({ ...prev, shortLabel, code: shortLabel.toLowerCase().replace(/\s+/g, "-") }));
              if (createFieldErrors.shortLabel) setCreateFieldErrors((prev) => ({ ...prev, shortLabel: "" }));
            }}
            onBlur={() => touch("shortLabel")}
            placeholder="e.g., TEDU-EEE"
            style={{ textTransform: "uppercase", fontFamily: "var(--mono)" }}
          />
          {((touched.shortLabel && codeEmpty) || createFieldErrors.shortLabel) && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{createFieldErrors.shortLabel || "Code is required."}</p>
          )}
        </div>
        <div className="fs-field">
          <label className="fs-field-label">Contact Email <span className="fs-field-req">*</span></label>
          <input
            data-testid="orgs-drawer-contact-email"
            className={`fs-input${(touched.contact_email && emailEmpty) || createFieldErrors.contact_email ? " error" : ""}`}
            type="email"
            value={createForm.contact_email || ""}
            onChange={(e) => {
              setCreateForm((prev) => ({ ...prev, contact_email: e.target.value }));
              if (createFieldErrors.contact_email) setCreateFieldErrors((prev) => ({ ...prev, contact_email: "" }));
            }}
            onBlur={() => touch("contact_email")}
            placeholder="admin@organization.org"
          />
          {((touched.contact_email && emailEmpty) || createFieldErrors.contact_email) && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{createFieldErrors.contact_email || "Contact email is required."}</p>
          )}
        </div>
        <div className="fs-field">
          <label className="fs-field-label">Initial Status</label>
          <CustomSelect value={createForm.status || "active"} onChange={(val) => setCreateForm((prev) => ({ ...prev, status: val }))} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
        </div>
        {createError && <FbAlert data-testid="orgs-drawer-error" variant="danger">{createError}</FbAlert>}
      </div>
      <div className="fs-drawer-footer">
        <button data-testid="orgs-drawer-cancel" className="fs-btn fs-btn-secondary" onClick={onClose} disabled={createSaving}>Cancel</button>
        <button
          data-testid="orgs-drawer-save"
          className="fs-btn fs-btn-primary"
          onClick={handleSave}
          disabled={
            createSaving ||
            nameEmpty ||
            codeEmpty ||
            emailEmpty ||
            Object.values(createFieldErrors || {}).some(Boolean)
          }
        >
          <AsyncButtonContent loading={createSaving} loadingText="Creating…">Create Organization</AsyncButtonContent>
        </button>
      </div>
    </Drawer>
  );
}

export function EditOrgDrawer({
  open,
  onClose,
  editForm,
  setEditForm,
  editError,
  editFieldErrors = { name: "", contact_email: "" },
  setEditFieldErrors = () => {},
  editSaving,
  onSave,
}) {
  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="vera-icon-surface" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 9 }}>
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </Icon>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Edit Organization</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{editForm.shortLabel || editForm.code || "Update organization identity and settings"}</div>
            </div>
          </div>
          <button className="fs-close" onClick={onClose}>
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></Icon>
          </button>
        </div>
      </div>
      <div className="fs-drawer-body" style={{ gap: 16 }}>
        <div className="fs-field">
          <label className="fs-field-label">Organization Name <span className="fs-field-req">*</span></label>
          <input
            data-testid="orgs-edit-drawer-name"
            className={`fs-input${editFieldErrors.name || !(editForm.name || "").trim() ? " error" : ""}`}
            type="text"
            value={editForm.name || ""}
            onChange={(e) => {
              setEditForm((prev) => ({ ...prev, name: e.target.value }));
              setEditFieldErrors((prev) => ({ ...prev, name: e.target.value.trim() ? "" : "Organization name is required." }));
            }}
            placeholder="e.g., TED University — Electrical-Electronics Engineering"
          />
          {(editFieldErrors.name || !(editForm.name || "").trim()) && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{editFieldErrors.name || "Organization name is required."}</p>
          )}
        </div>
        <div className="fs-field">
          <label className="fs-field-label">Code</label>
          <input className="fs-input" type="text" value={editForm.code || ""} disabled placeholder="Auto-generated" style={{ fontFamily: "var(--mono)" }} />
        </div>
        <div className="fs-field">
          <label className="fs-field-label">Contact Email</label>
          <input
            data-testid="orgs-edit-drawer-contact-email"
            className={`fs-input${editFieldErrors.contact_email ? " error" : ""}`}
            type="email"
            value={editForm.contact_email || ""}
            onChange={(e) => {
              setEditForm((prev) => ({ ...prev, contact_email: e.target.value }));
              if (editFieldErrors.contact_email) setEditFieldErrors((prev) => ({ ...prev, contact_email: "" }));
            }}
            placeholder="admin@organization.org"
          />
          {editFieldErrors.contact_email && (
            <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{editFieldErrors.contact_email}</p>
          )}
        </div>
        {editError && <FbAlert data-testid="orgs-edit-drawer-error" variant="danger">{editError}</FbAlert>}
      </div>
      <div className="fs-drawer-footer">
        <button data-testid="orgs-edit-drawer-cancel" className="fs-btn fs-btn-secondary" onClick={onClose} disabled={editSaving}>Cancel</button>
        <button
          data-testid="orgs-edit-drawer-save"
          className="fs-btn fs-btn-primary"
          onClick={onSave}
          disabled={
            editSaving ||
            !(editForm.name || "").trim() ||
            Object.values(editFieldErrors || {}).some(Boolean)
          }
        >
          <AsyncButtonContent loading={editSaving} loadingText="Saving…">Save Changes</AsyncButtonContent>
        </button>
      </div>
    </Drawer>
  );
}

export function ViewOrgDrawer({ open, onClose, viewOrg, viewOrgMeta, onEdit }) {
  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="vera-icon-surface" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 9 }}>
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{viewOrg?.name || "Organization Profile"}</div>
            </div>
          </div>
          <button className="fs-close" onClick={onClose}>
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></Icon>
          </button>
        </div>
      </div>
      <div className="fs-drawer-body" style={{ gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
            <div className="text-xs text-muted">Status</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: viewOrgMeta?.status === "active" ? "var(--success)" : "var(--text-secondary)" }}>
              {viewOrgMeta?.status ? viewOrgMeta.status.charAt(0).toUpperCase() + viewOrgMeta.status.slice(1) : "—"}
            </div>
          </div>
          <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
            <div className="text-xs text-muted">Active Admins</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{viewOrg?.tenantAdmins?.filter((a) => a.status === "active").length ?? 0}</div>
          </div>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Name</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{viewOrg?.name || "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Code</span><span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--mono)" }}>{String(viewOrg?.code || "").toUpperCase() || "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Current Period</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{viewOrgMeta?.period || "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Total Jurors</span><span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "var(--mono)" }}>{viewOrgMeta?.jurors ?? "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Total Projects</span><span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "var(--mono)" }}>{viewOrgMeta?.projects ?? "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px" }}><span className="text-sm text-muted">Created</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatShortDate(viewOrg?.created_at)}</span></div>
        </div>
      </div>
      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" onClick={onClose}>Close</button>
        <button className="fs-btn fs-btn-primary" onClick={onEdit}>Edit Organization</button>
      </div>
    </Drawer>
  );
}

export function ManageAdminsDrawer({
  open,
  onClose,
  manageAdminsOrg,
  adminInviteEmail,
  setAdminInviteEmail,
  adminInviteLoading,
  adminInviteError,
  setAdminInviteError,
  inviteLoading,
  adminRemoveLoadingId,
  joinRequestLoading,
  graceLockTooltip,
  isGraceLocked,
  onInvite,
  onCancelInvite,
  onRemoveAdmin,
  onApproveJoin,
  onRejectJoin,
}) {
  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon identity">
              <Icon iconNode={[]} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></Icon>
            </div>
            <div className="fs-title-group">
              <div className="fs-title">Manage Admins</div>
              <div className="fs-subtitle">{String(manageAdminsOrg?.code || "").toUpperCase()} admin memberships</div>
            </div>
          </div>
          <button className="fs-close" onClick={onClose}>
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></Icon>
          </button>
        </div>
      </div>
      <div className="fs-drawer-body" style={{ gap: 10 }}>
        {(manageAdminsOrg?.tenantAdmins || []).filter((a) => a.status !== "requested").length === 0 && (manageAdminsOrg?.tenantAdmins || []).filter((a) => a.status === "requested").length === 0 && (
          <div className="text-sm text-muted" style={{ textAlign: "center", padding: "8px 0" }}>No admins yet.</div>
        )}
        {(manageAdminsOrg?.tenantAdmins || []).filter((a) => a.status !== "requested").map((admin, idx) => {
          const isInvited = admin.status === "invited";
          return (
            <div key={admin.userId || `${admin.email}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: `1px ${isInvited ? "dashed" : "solid"} var(--border)`, borderRadius: "var(--radius-sm)", opacity: isInvited ? 0.85 : 1 }}>
              {isInvited ? (
                <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Mail size={14} style={{ color: "var(--text-tertiary)" }} />
                </div>
              ) : (
                <Avatar initials={jurorInitials(admin.name || admin.email)} bg={jurorAvatarBg(admin.name || admin.email)} size={34} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: isInvited ? 500 : 600, color: isInvited ? "var(--text-secondary)" : undefined }}>{admin.name || admin.email || "—"}</div>
                <div className="text-xs text-muted">{admin.email || "—"}</div>
                {!isInvited && admin.isOwner && (
                  <span className="admin-team-owner-pill" title="Owner">
                    <Crown size={10} strokeWidth={2.2} /> Owner
                  </span>
                )}
              </div>
              {isInvited ? (
                <>
                  <span className="badge badge-warning" style={{ fontSize: 9 }}>Invited</span>
                  <button
                    title="Cancel invite"
                    disabled={inviteLoading}
                    onClick={() => onCancelInvite(admin.membershipId)}
                    style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)", background: "color-mix(in srgb, var(--danger) 8%, transparent)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <button
                  title="Remove admin"
                  onClick={() => onRemoveAdmin(manageAdminsOrg.id, admin.userId)}
                  disabled={adminRemoveLoadingId === admin.userId}
                  style={{
                    width: 30, height: 30, borderRadius: "var(--radius-sm)",
                    border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                    background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                    color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0, transition: "background 0.15s, border-color 0.15s",
                    opacity: adminRemoveLoadingId === admin.userId ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 16%, transparent)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--danger) 45%, transparent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 8%, transparent)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--danger) 25%, transparent)"; }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              )}
            </div>
          );
        })}
        {(manageAdminsOrg?.tenantAdmins || []).filter((a) => a.status === "requested").map((req) => (
          <div key={req.membershipId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px dashed color-mix(in srgb, var(--accent) 35%, transparent)", borderRadius: "var(--radius-sm)", opacity: 0.85 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px dashed color-mix(in srgb, var(--accent) 40%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <UserPlus size={14} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{req.name || req.email || "—"}</div>
              <div className="text-xs text-muted">{req.email || "—"}</div>
            </div>
            <span className="badge badge-info" style={{ fontSize: 9 }}>Join Request</span>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button type="button" title="Approve join request" disabled={joinRequestLoading} onClick={() => onApproveJoin(req.membershipId)} style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <CheckCircle2 size={13} strokeWidth={2} />
              </button>
              <button type="button" title="Reject join request" disabled={joinRequestLoading} onClick={() => onRejectJoin(req.membershipId)} style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)", background: "color-mix(in srgb, var(--danger) 8%, transparent)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "color-mix(in srgb, var(--accent) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <UserPlus size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.3 }}>Invite Admin</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.3 }}>They'll receive an email to set their password</div>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Mail size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }} />
            <input className="fs-input" type="email" placeholder="admin@university.edu" value={adminInviteEmail} onChange={(e) => { setAdminInviteEmail(e.target.value); if (adminInviteError) setAdminInviteError(""); }} onKeyDown={(e) => { if (e.key === "Enter" && !adminInviteLoading) onInvite(); }} style={{ paddingLeft: 32 }} />
          </div>
          {adminInviteError && <div style={{ marginTop: 8 }}><FbAlert variant="danger">{adminInviteError}</FbAlert></div>}
        </div>
      </div>
      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" onClick={onClose}>Close</button>
        <PremiumTooltip text={graceLockTooltip}>
          <button className="fs-btn fs-btn-primary" onClick={onInvite} disabled={adminInviteLoading || !adminInviteEmail.trim() || isGraceLocked}>
            <AsyncButtonContent loading={adminInviteLoading} loadingText="Sending…">Send Invite</AsyncButtonContent>
          </button>
        </PremiumTooltip>
      </div>
    </Drawer>
  );
}
