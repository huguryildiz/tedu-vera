// src/admin/pages/SettingsPage.jsx
// Simplified: profile + security for both roles.
// Organization management moved to OrganizationsPage.jsx.

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/auth";
import { useUpdatePolicy } from "@/auth/SecurityPolicyContext";
import { useToast } from "@/shared/hooks/useToast";
import FbAlert from "@/shared/ui/FbAlert";
import { useProfileEdit } from "../hooks/useProfileEdit";
import SecurityPolicyDrawer from "../drawers/SecurityPolicyDrawer";
import EditProfileDrawer from "../drawers/EditProfileDrawer";
import Avatar from "@/shared/ui/Avatar";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import { upsertProfile, getSecurityPolicy, setSecurityPolicy } from "@/shared/api";
import { supabase } from "@/shared/lib/supabaseClient";

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];
function getAvatarColor(name) {
  const code = (name || "?").charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ── Password Change Modal ─────────────────────────────────────

function PasswordModal({ profile }) {
  if (!profile.modalOpen || profile.modalView !== "password") return null;
  return createPortal(
    <div
      className="crud-overlay"
      style={{ display: "flex" }}
      onClick={(e) => { if (e.target === e.currentTarget) profile.closeModal(); }}
    >
      <div className="crud-modal" style={{ maxWidth: 440 }}>
        <div className="crud-modal-header">
          <h3>Change Password</h3>
          <button className="crud-modal-close" onClick={profile.closeModal}>&#215;</button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {profile.passwordErrors._general && (
            <FbAlert variant="danger">
              {profile.passwordErrors._general}
            </FbAlert>
          )}
          <label className="form-label" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            New Password
            <input
              className="form-input"
              type="password"
              value={profile.passwordForm.password}
              onChange={(e) => profile.setPasswordField("password", e.target.value)}
              disabled={profile.passwordSaving}
              placeholder="Min 10 chars, upper, lower, digit, symbol"
              autoComplete="new-password"
            />
            {profile.passwordErrors.password && (
              <span style={{ fontSize: 11, color: "var(--danger)" }}>{profile.passwordErrors.password}</span>
            )}
          </label>
          <label className="form-label" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Confirm Password
            <input
              className="form-input"
              type="password"
              value={profile.passwordForm.confirmPassword}
              onChange={(e) => profile.setPasswordField("confirmPassword", e.target.value)}
              disabled={profile.passwordSaving}
              placeholder="Enter your new password"
              autoComplete="new-password"
            />
            {profile.passwordErrors.confirmPassword && (
              <span style={{ fontSize: 11, color: "var(--danger)" }}>{profile.passwordErrors.confirmPassword}</span>
            )}
          </label>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--surface-1)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={profile.closeModal}
            disabled={profile.passwordSaving}
          >
            Cancel
          </button>
          <button
            className="btn btn-sm"
            style={{ background: "var(--accent)", color: "#fff" }}
            onClick={profile.handlePasswordSave}
            disabled={profile.passwordSaving}
          >
            <span className="btn-loading-content">
              <AsyncButtonContent loading={profile.passwordSaving} loadingText="Saving…">Update Password</AsyncButtonContent>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main Component ────────────────────────────────────────────

export default function SettingsPage() {
  const { user, displayName, setDisplayName, avatarUrl, setAvatarUrl, isSuper, activeOrganization, signOut, refreshUser, clearPendingEmail } = useAuth();
  const updatePolicy = useUpdatePolicy();
  const _toast = useToast();

  const profile = useProfileEdit();

  const initials = getInitials(displayName, user?.email);
  const avatarBg = getAvatarColor(displayName || user?.email);

  // Drawer states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [securityPolicyOpen, setSecurityPolicyOpen] = useState(false);

  // Security policy state
  const [securityPolicy, setSecurityPolicyState] = useState(null);
  const [securityPolicyError, setSecurityPolicyError] = useState(null);
  const policyFetched = useRef(false);

  const handleOpenSecurityPolicy = useCallback(async () => {
    setSecurityPolicyError(null);
    setSecurityPolicyOpen(true);
    if (policyFetched.current) return;
    try {
      const data = await getSecurityPolicy();
      setSecurityPolicyState(data);
      policyFetched.current = true;
    } catch (e) {
      setSecurityPolicyError(e?.message || "Failed to load security policy.");
    }
  }, []);

  const handleSaveSecurityPolicy = useCallback(async (policy) => {
    await setSecurityPolicy(policy);
    setSecurityPolicyState(policy);
    updatePolicy(policy);
    _toast.success("Security policy saved");
  }, [_toast, updatePolicy]);

  const handleSaveProfile = useCallback(async ({ displayName: newName, email: newEmail, avatarFile }) => {
    const trimmedName = newName.trim();
    const trimmedEmail = newEmail.trim();

    const result = await upsertProfile(trimmedName || null);
    const saved = result?.display_name ?? trimmedName;
    setDisplayName(saved);

    if (trimmedEmail && trimmedEmail !== user?.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (emailError) throw emailError;
      _toast.success("Confirmation link sent to your new email address.");
    }

    if (avatarFile) {
      const userId = user?.id;
      if (userId) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
        setAvatarUrl(publicUrl);
      }
    }

    if (!avatarFile && (trimmedEmail === user?.email || !trimmedEmail)) {
      _toast.success("Display name saved");
    } else if (avatarFile && trimmedEmail === user?.email) {
      _toast.success("Profile saved");
    }
  }, [setDisplayName, setAvatarUrl, user, _toast]);

  const handleCancelEmailChange = useCallback(async () => {
    clearPendingEmail();
    const { error } = await supabase.auth.updateUser({ email: user?.email });
    if (error) {
      await refreshUser();
      _toast.error("Could not cancel email change.");
    } else {
      _toast.success("Email change cancelled.");
    }
  }, [user, _toast, refreshUser, clearPendingEmail]);

  return (
    <>
      <PasswordModal profile={profile} />

      <EditProfileDrawer
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={{
          displayName: displayName || "",
          email: user?.email || "",
          role: isSuper ? "Super Admin" : "Organization Admin",
          organization: activeOrganization?.name || "",
          avatarUrl: avatarUrl || null,
        }}
        onSave={handleSaveProfile}
        onCancelEmailChange={handleCancelEmailChange}
        pendingEmail={user?.newEmail || null}
        initials={initials}
        avatarBg={avatarBg}
        isSuper={isSuper}
      />

      <SecurityPolicyDrawer
        open={securityPolicyOpen}
        onClose={() => setSecurityPolicyOpen(false)}
        policy={securityPolicy}
        onSave={handleSaveSecurityPolicy}
        error={securityPolicyError}
      />

      <div className="page">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="page-title">Settings</div>
            <div className="page-desc">Manage your profile, security, and account preferences.</div>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span className="badge badge-neutral">{isSuper ? "Super Admin" : "Organization Admin"}</span>
            {!isSuper && activeOrganization?.code && (
              <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.18)" }}>
                {activeOrganization.code}
              </span>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ gap: 10 }}>
          {/* ── Left column: Profile + Security ────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Profile card */}
            <div className="card settings-role-card" style={{ padding: 14 }}>
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div className="card-title">Profile</div>
                <span className="badge badge-neutral">Personal</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <Avatar avatarUrl={avatarUrl} initials={initials} bg={avatarBg} size={44} fontSize={14} className="sb-avatar" style={{ boxShadow: "0 0 0 2px var(--accent-soft)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, letterSpacing: "-0.2px" }}>
                    {displayName || "Admin"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1, fontFamily: "var(--mono)" }}>
                    {user?.email}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                    <span className="badge badge-neutral" style={{ fontSize: 9, padding: "1px 7px" }}>{isSuper ? "Super Admin" : "Organization Admin"}</span>
                    {isSuper ? (
                      <span className="badge badge-success" style={{ fontSize: 9, padding: "1px 7px" }}>Cross-Organization Access</span>
                    ) : activeOrganization?.name ? (
                      <span className="badge badge-success" style={{ fontSize: 9, padding: "1px 7px" }}>{activeOrganization.name}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-1)", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>—</div>
                  <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>Joined</div>
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-1)", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>—</div>
                  <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>Last Active</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditProfileOpen(true)}>Edit Profile</button>
                <button className="btn btn-outline btn-sm" onClick={() => profile.openModal("password")}>Change Password</button>
              </div>
            </div>

            {/* Security & Sessions card */}
            <div className="card settings-role-card" style={{ padding: 14 }}>
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div className="card-title">Security &amp; Sessions</div>
                <span className="badge badge-success">
                  <span className="status-dot dot-success" />
                  Secure
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "Last Login", value: "—" },
                  { label: "Sessions", value: "—" },
                  { label: "Auth Method", value: "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: "7px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-1)", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11.5, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn btn-outline btn-sm" disabled title="Session management — coming soon">View Sessions</button>
                <button className="btn btn-outline btn-sm" style={{ borderColor: "rgba(225,29,72,0.2)", color: "var(--text-secondary)" }} disabled title="Sign out all sessions — coming soon">Sign Out All</button>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: "rgba(225,29,72,0.25)", color: "var(--danger)" }}
                  onClick={signOut}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column ──────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Security Policy — super admin only */}
            {isSuper && (
              <div className="card settings-role-card" style={{ padding: 14 }}>
                <div className="card-header" style={{ marginBottom: 8 }}>
                  <div className="card-title">Security Policy</div>
                  <span className="badge badge-neutral">Platform-wide</span>
                </div>
                <div className="text-sm text-muted" style={{ marginBottom: 10 }}>
                  Password requirements, auth methods, and session policies that apply to all admin accounts.
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleOpenSecurityPolicy}>Edit Security Policy</button>
              </div>
            )}

            {/* Organization Access — org admin only */}
            {!isSuper && (
              <div className="card settings-role-card" style={{ padding: 14 }}>
                <div className="card-header" style={{ marginBottom: 8 }}>
                  <div className="card-title">Organization Access</div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <span className="badge badge-neutral" style={{ fontSize: 9 }}>Read Only</span>
                    <span className="badge badge-neutral" style={{ fontSize: 9 }}>&#128274; Managed by Super Admin</span>
                  </div>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", fontSize: 12 }}>
                  {[
                    { label: "Organization", value: activeOrganization?.name || "—" },
                    { label: "Short label", value: <span className="mono">{activeOrganization?.code || "—"}</span> },
                    { label: "Membership status", value: <span className="badge badge-success"><svg className="badge-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Active</span> },
                  ].map(({ label, value }, i) => (
                    <div
                      key={label}
                      style={{ display: "grid", gridTemplateColumns: "140px 1fr", padding: "7px 10px", background: i % 2 === 0 ? "var(--surface-1)" : undefined, borderBottom: i < 2 ? "1px solid var(--border)" : undefined }}
                    >
                      <div className="text-xs text-muted">{label}</div>
                      <div style={{ fontWeight: label === "Organization" ? 600 : undefined }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                  Organization identity fields are locked. Name, code, ownership, and metadata can only be edited by Super Admin.
                </div>
              </div>
            )}

            {/* Permissions Summary — org admin only */}
            {!isSuper && (
              <div className="card settings-role-card" style={{ padding: 14 }}>
                <div className="card-header" style={{ marginBottom: 6 }}>
                  <div className="card-title">Permissions Summary</div>
                  <span className="badge badge-neutral" style={{ fontSize: 9 }}>Scope Clarification</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { allowed: true, text: "Manage evaluation periods, jurors, projects, and scoring templates" },
                    { allowed: true, text: "View and export scores and analytics" },
                    { allowed: true, text: "Control jury entry tokens for own organization" },
                    { allowed: false, text: "Edit organization identity (name, short label, code, ownership)" },
                    { allowed: false, text: "Approve admin applications platform-wide" },
                    { allowed: false, text: "Access or manage other organizations" },
                    { allowed: false, text: "Access platform governance controls" },
                  ].map(({ allowed, text }) => (
                    <div
                      key={text}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                        border: allowed ? "1px solid rgba(22,163,74,0.14)" : "1px solid rgba(225,29,72,0.12)",
                        borderRadius: "var(--radius-sm)",
                        background: allowed ? "var(--success-soft)" : "var(--danger-soft)",
                      }}
                    >
                      <span style={{ color: allowed ? "var(--success)" : "var(--danger)", fontSize: 11, flexShrink: 0 }}>
                        {allowed ? "✓" : "✕"}
                      </span>
                      <div style={{ fontSize: 11.5, color: allowed ? "var(--text-secondary)" : "var(--text-tertiary)" }}>{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
