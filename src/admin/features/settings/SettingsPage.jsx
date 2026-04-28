// src/admin/pages/SettingsPage.jsx
// Simplified: profile + security for both roles.
// Organization management moved to OrganizationsPage.jsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/auth";
import { useUpdatePolicy } from "@/auth/shared/SecurityPolicyContext";
import { useToast } from "@/shared/hooks/useToast";
import "./SettingsPage.css";
import SecurityPolicyDrawer from "./SecurityPolicyDrawer";
import PinPolicyDrawer from "@/admin/shared/PinPolicyDrawer";
import EditProfileDrawer from "./EditProfileDrawer";
import ChangePasswordDrawer from "./ChangePasswordDrawer";
import ViewSessionsDrawer from "@/admin/shared/ViewSessionsDrawer";
import SecuritySignalPill from "@/admin/features/settings/SecuritySignalPill";
import { computeSecuritySignal } from "@/admin/utils/computeSecuritySignal.js";
import Avatar from "@/shared/ui/Avatar";
import { useAdminTeam } from "@/admin/features/settings/useAdminTeam";
import AdminTeamCard from "@/admin/shared/AdminTeamCard.jsx";
import { upsertProfile, getSecurityPolicy, setSecurityPolicy, getPinPolicy, setPinPolicy, listAdminSessions, deleteAdminSession, updateOrganization } from "@/shared/api";
import { getAdminDeviceId, getAuthMethodLabelFromSession } from "@/shared/lib/adminSession";
import { supabase } from "@/shared/lib/supabaseClient";
import { formatDate } from "@/shared/lib/dateUtils";

import { Icon, Lock, Pencil, Check, X } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";

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


function formatRelativeDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

function normalizePasswordChangeError(raw) {
  const msg = String(raw?.message || raw || "").toLowerCase().trim();
  if (!msg) return "Could not update password. Please try again.";
  if (msg.includes("current password is incorrect")) return "Current password is incorrect.";
  if (msg.includes("invalid login credentials")) return "Current password is incorrect.";
  if (msg.includes("session expired")) return "Session expired. Please sign in again.";
  if (msg.includes("current password is required")) return "Current password is required.";
  if (msg.includes("new password should be different")) return "New password must be different from current password.";
  if (msg.includes("same password")) return "New password must be different from current password.";
  if (msg.includes("weak password")) return "Password does not meet security requirements.";
  return String(raw?.message || raw || "Could not update password. Please try again.");
}

// ── Main Component ────────────────────────────────────────────

export default function SettingsPage() {
  const {
    user,
    session,
    displayName,
    setDisplayName,
    avatarUrl,
    setAvatarUrl,
    isSuper,
    activeOrganization,
    signOut,
    signOutAll,
    refreshUser,
    clearPendingEmail,
    updatePassword,
    reauthenticateWithPassword,
    refreshMemberships,
    loading,
  } = useAuth();
  const updatePolicy = useUpdatePolicy();
  const _toast = useToast();
  const navigate = useNavigate();
  const { onStartTour } = useOutletContext() || {};
  const adminTeam = useAdminTeam(!isSuper ? activeOrganization?.id : null);

  const initials = getInitials(displayName, user?.email);
  const avatarBg = getAvatarColor(displayName || user?.email);
  const joinedAt = session?.user?.created_at || null;
  const lastActiveAt = session?.user?.last_sign_in_at || null;
  const lastLoginAt = session?.user?.last_sign_in_at || null;
  const authMethod = getAuthMethodLabelFromSession(session, user);
  const currentDeviceId = getAdminDeviceId();

  // Drawer states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [securityPolicyOpen, setSecurityPolicyOpen] = useState(false);
  const [viewSessionsOpen, setViewSessionsOpen] = useState(false);

  // Security policy state
  const [securityPolicy, setSecurityPolicyState] = useState(null);
  const [securityPolicyError, setSecurityPolicyError] = useState(null);
  const policyFetched = useRef(false);

  // PIN policy state (org admin)
  const [pinPolicyOpen, setPinPolicyOpen] = useState(false);
  const [pinPolicy, setPinPolicyState] = useState(null);
  const [pinPolicyError, setPinPolicyError] = useState(null);
  const [adminSessions, setAdminSessions] = useState([]);
  const [adminSessionsLoading, setAdminSessionsLoading] = useState(false);
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [orgNameDraft, setOrgNameDraft] = useState("");
  const [orgNameError, setOrgNameError] = useState(null);
  const [orgNameSaving, setOrgNameSaving] = useState(false);
  const knownSessionCount = adminSessions.length > 0 ? adminSessions.length : (session ? 1 : 0);
  const sessionCount = `${knownSessionCount} Active`;
  const securitySignal = useMemo(
    () => computeSecuritySignal({
      adminSessions,
      lastLoginAt,
      loading: loading || adminSessionsLoading,
    }),
    [adminSessions, lastLoginAt, loading, adminSessionsLoading],
  );

  const loadAdminSessions = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) {
      setAdminSessions([]);
      return;
    }

    setAdminSessionsLoading(true);
    try {
      const rows = await listAdminSessions();
      setAdminSessions(rows);
    } catch (e) {
      if (!silent) {
        _toast.error("Failed to load session history");
      }
    } finally {
      setAdminSessionsLoading(false);
    }
  }, [user?.id, _toast]);

  useEffect(() => {
    if (!user?.id) {
      setAdminSessions([]);
      return;
    }
    loadAdminSessions({ silent: true });
  }, [user?.id, loadAdminSessions]);

  useEffect(() => {
    if (!viewSessionsOpen) return;
    loadAdminSessions();
  }, [viewSessionsOpen, loadAdminSessions]);

  const handleRevokeSession = useCallback(async (id) => {
    try {
      await deleteAdminSession(id);
      const rows = await listAdminSessions();
      setAdminSessions(rows);
      _toast.success("Session revoked");
    } catch (e) {
      _toast.error("Failed to revoke session");
    }
  }, [_toast]);

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

  const handleOpenPinPolicy = useCallback(async () => {
    setPinPolicyError(null);
    setPinPolicyOpen(true);
    try {
      const data = await getPinPolicy();
      setPinPolicyState(data);
    } catch (e) {
      setPinPolicyError(e?.message || "Failed to load PIN policy.");
    }
  }, []);

  const handleSavePinPolicy = useCallback(async (policy) => {
    await setPinPolicy(policy);
    setPinPolicyState(policy);
    updatePolicy(policy);
    _toast.success("PIN lockout policy saved");
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
      _toast.success("Confirmation link sent to your new email address");
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
      _toast.error("Failed to cancel email change");
    } else {
      _toast.success("Email change cancelled");
    }
  }, [user, _toast, refreshUser, clearPendingEmail]);

  const handleSavePassword = useCallback(async ({ currentPassword, newPassword }) => {
    try {
      await reauthenticateWithPassword(currentPassword);
      await updatePassword(newPassword);
      _toast.success("Password updated");
    } catch (e) {
      throw new Error(normalizePasswordChangeError(e));
    }
  }, [reauthenticateWithPassword, updatePassword, _toast]);

  const handleOrgNameSave = useCallback(async () => {
    const trimmed = orgNameDraft.trim();
    if (!trimmed) return;
    if (trimmed === (activeOrganization?.name || "")) {
      setEditingOrgName(false);
      return;
    }
    setOrgNameSaving(true);
    setOrgNameError(null);
    try {
      await updateOrganization({ organizationId: activeOrganization.id, name: trimmed });
      await refreshMemberships();
      setEditingOrgName(false);
    } catch (err) {
      setOrgNameError(err?.message || "Failed to update organization name.");
    } finally {
      setOrgNameSaving(false);
    }
  }, [orgNameDraft, activeOrganization, refreshMemberships]);

  return (
    <>
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
      <ChangePasswordDrawer
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSave={handleSavePassword}
        error={null}
      />
      <ViewSessionsDrawer
        open={viewSessionsOpen}
        onClose={() => setViewSessionsOpen(false)}
        sessions={adminSessions}
        loading={adminSessionsLoading}
        currentDeviceId={currentDeviceId}
        onRevoke={handleRevokeSession}
      />
      <PinPolicyDrawer
        open={pinPolicyOpen}
        onClose={() => setPinPolicyOpen(false)}
        policy={pinPolicy}
        onSave={handleSavePinPolicy}
        error={pinPolicyError}
      />
      <div className="page" id="page-settings">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="page-title">Settings</div>
            <div className="page-desc">Manage your profile, security, and account preferences.</div>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span className="badge badge-neutral" style={{ whiteSpace: "nowrap" }}>{isSuper ? "Super Admin" : "Organization Admin"}</span>
            {!isSuper && activeOrganization?.code && (
              <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.18)" }}>
                {activeOrganization.code}
              </span>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ gap: 10 }}>
          {/* ── Left column: Profile + Security ────────────────────── */}
          <div className="settings-col-left" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                    <span className="badge badge-neutral" style={{ fontSize: 9, padding: "1px 7px", whiteSpace: "nowrap" }}>{isSuper ? "Super Admin" : "Organization Admin"}</span>
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
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>{formatDate(joinedAt)}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>Joined</div>
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-1)", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>{formatRelativeDate(lastActiveAt)}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>Last Active</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditProfileOpen(true)}>Edit Profile</button>
                <button className="btn btn-outline btn-sm" onClick={() => setChangePasswordOpen(true)}>Change Password</button>
              </div>
            </div>

            {/* Security & Sessions card */}
            <div className="card settings-role-card" style={{ padding: 14 }}>
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div className="card-title">Security &amp; Sessions</div>
                <SecuritySignalPill
                  signal={securitySignal}
                  onReviewSessions={() => setViewSessionsOpen(true)}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "Last Login", value: loading ? "—" : formatRelativeDate(lastLoginAt) },
                  { label: "Sessions", value: loading || adminSessionsLoading ? "—" : sessionCount },
                  { label: "Auth Method", value: loading ? "—" : authMethod },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: "7px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-1)", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11.5, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setViewSessionsOpen(true)}>View Sessions</button>
                <button className="btn btn-outline btn-sm" style={{ borderColor: "rgba(225,29,72,0.25)", color: "var(--danger)" }} onClick={async () => { await signOutAll(); window.location.href = "/"; }} title="Sign out from all devices">Sign Out All</button>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: "rgba(225,29,72,0.25)", color: "var(--danger)" }}
                  onClick={async () => { await signOut(); window.location.href = "/"; }}
                >
                  Sign Out
                </button>
              </div>
            </div>

            {/* Jury Access Policy — org admin only */}
            {!isSuper && (
              <div className="card settings-role-card" style={{ padding: 14 }}>
                <div className="card-header" style={{ marginBottom: 8 }}>
                  <div className="card-title">Jury Access Policy</div>
                  <span className="badge badge-neutral">Juror Security</span>
                </div>
                <div className="text-sm text-muted" style={{ marginBottom: 10 }}>
                  Controls PIN lockout thresholds and QR code validity for jurors in your organization.
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleOpenPinPolicy}>Edit Access Policy</button>
              </div>
            )}

            {/* Help & Onboarding card */}
            <div className="card settings-role-card" style={{ padding: 14 }}>
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div className="card-title">Help &amp; Onboarding</div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, textAlign: "justify", textJustify: "inter-word" }}>
                Take a guided walkthrough of the admin panel. The tour highlights each section of the sidebar and explains what it does.
              </p>
              <button
                className="btn btn-outline btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={onStartTour}
              >
                <HelpCircle size={13} strokeWidth={2} />
                Restart Guided Tour
              </button>
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
                <button data-testid="settings-security-policy-btn" className="btn btn-outline btn-sm" onClick={handleOpenSecurityPolicy}>Edit Security Policy</button>
              </div>
            )}

            {/* Organization Access — org admin only */}
            {!isSuper && (
              <div className="card settings-role-card" style={{ padding: 14 }}>
                <div className="card-header" style={{ marginBottom: 8 }}>
                  <div className="card-title">Organization Access</div>
                  <span className="badge badge-neutral"><Lock size={10} strokeWidth={2.5} />Code &amp; status managed by Super Admin</span>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", fontSize: 12 }}>

                  {/* Organization name row — inline editable */}
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", padding: "7px 10px", background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                    <div className="text-xs text-muted">Organization</div>
                    {editingOrgName ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <input
                          autoFocus
                          data-testid="settings-org-name"
                          value={orgNameDraft}
                          onChange={(e) => setOrgNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleOrgNameSave(); }
                            if (e.key === "Escape") { setEditingOrgName(false); setOrgNameError(null); }
                          }}
                          style={{ flex: 1, fontWeight: 600, fontSize: 12, padding: "2px 6px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", minWidth: 0 }}
                          disabled={orgNameSaving}
                        />
                        <button
                          data-testid="settings-save"
                          onClick={handleOrgNameSave}
                          disabled={orgNameSaving || !orgNameDraft.trim()}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "var(--radius-sm)", border: "none", background: "var(--success-soft)", color: "var(--success)", cursor: "pointer", flexShrink: 0 }}
                          title="Save"
                        >
                          <Check size={12} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => { setEditingOrgName(false); setOrgNameError(null); }}
                          disabled={orgNameSaving}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "var(--radius-sm)", border: "none", background: "var(--surface-3)", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
                          title="Cancel"
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span data-testid="settings-org-name-display" style={{ fontWeight: 600, flex: 1 }}>{activeOrganization?.name || "—"}</span>
                        <button
                          data-testid="settings-org-name-edit"
                          onClick={() => { setOrgNameDraft(activeOrganization?.name || ""); setEditingOrgName(true); setOrgNameError(null); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, transition: "color 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          title="Edit name"
                        >
                          <Pencil size={13} strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </div>
                  {orgNameError && (
                    <div style={{ padding: "0 10px 8px" }}>
                      <FbAlert variant="danger" style={{ marginTop: 6 }}>{orgNameError}</FbAlert>
                    </div>
                  )}

                  {/* Code row — read only */}
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid var(--border)" }}>
                    <div className="text-xs text-muted">Code</div>
                    <span className="mono">{activeOrganization?.code || "—"}</span>
                  </div>

                  {/* Membership status row — read only */}
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "flex-start", padding: "7px 10px", background: "var(--surface-1)" }}>
                    <div className="text-xs text-muted">Membership status</div>
                    <span className="badge badge-success" style={{ justifySelf: "start" }}>
                      <Check size={12} strokeWidth={2.5} className="badge-ico" />Active
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                  Organization name can be edited by org admins. Code, ownership, and status are managed by Super Admin.
                </div>
              </div>
            )}

            {/* Admin Team — org admin only */}
            {!isSuper && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <AdminTeamCard
                  {...adminTeam}
                  currentUserId={user?.id}
                  style={{ flex: 1 }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
