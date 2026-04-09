// src/admin/SettingsPage.jsx — Phase 9
// Settings page: org-admin profile/security view vs super-admin control center.
// Prototype: vera-premium-prototype.html lines 15647–16066

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminContext } from "../hooks/useAdminContext";
import { useAuth } from "@/auth";
import { useUpdatePolicy } from "@/auth/SecurityPolicyContext";
import { useToast } from "@/shared/hooks/useToast";
import { useTheme } from "@/shared/theme/ThemeProvider";
import FbAlert from "@/shared/ui/FbAlert";
import Drawer from "@/shared/ui/Drawer";
import Modal from "@/shared/ui/Modal";
import { useProfileEdit } from "../hooks/useProfileEdit";
import { useManageOrganizations } from "../hooks/useManageOrganizations";
import SecurityPolicyDrawer from "../drawers/SecurityPolicyDrawer";
import EditProfileDrawer from "../drawers/EditProfileDrawer";
import Avatar from "@/shared/ui/Avatar";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import { upsertProfile, getSecurityPolicy, setSecurityPolicy, listPeriods, setCurrentPeriod, updateOrganization } from "@/shared/api";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  GlobalSettingsDrawer,
  ExportBackupDrawer,
  MaintenanceDrawer,
  FeatureFlagsDrawer,
  SystemHealthDrawer,
} from "../drawers/GovernanceDrawers";

import { DEMO_MODE as isDemoMode } from "@/shared/lib/demoMode";

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

function OrgStatusBadge({ status }) {
  if (status === "active") return (
    <span className="badge badge-success">
      <svg className="badge-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      Active
    </span>
  );
  if (status === "disabled") return (
    <span className="badge badge-neutral">
      <svg className="badge-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M4.93 4.93l14.14 14.14" />
      </svg>
      Disabled
    </span>
  );
  if (status === "limited") return (
    <span className="badge badge-warning">
      <svg className="badge-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      Limited
    </span>
  );
  if (status === "archived") return <span className="badge badge-neutral">Archived</span>;
  return <span className="badge badge-warning">{status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : "—"}</span>;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function SortIcon({ colKey, sortKey, sortDir }) {
  if (sortKey !== colKey) {
    return <span className="sort-icon sort-icon-inactive">▲</span>;
  }
  return (
    <span className="sort-icon sort-icon-active">
      {sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];
function getAvatarColor(name) {
  const code = (name || "?").charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function splitSubtitle(subtitle) {
  const raw = String(subtitle || "").trim();
  if (!raw) return { university: "—", department: "—" };
  const parts = raw.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      university: parts.slice(0, parts.length - 1).join(" · "),
      department: parts[parts.length - 1],
    };
  }
  return { university: raw, department: "—" };
}

const ORG_PROTOTYPE_META = {
  "TEDU-EE": { period: "Spring 2026", jurors: 28, projects: 15 },
  "BOUN-CHEM": { period: "Fall 2025", jurors: 18, projects: 10 },
  "METU-IE": { period: "—", jurors: 12, projects: 8 },
};

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
            disabled={profile.passwordSaving || isDemoMode}
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
  const { organizationId, onNavigate } = useAdminContext();
  const { user, displayName, setDisplayName, avatarUrl, setAvatarUrl, isSuper, activeOrganization, signOut } = useAuth();
  const updatePolicy = useUpdatePolicy();
  const _toast = useToast();
  const { theme } = useTheme();
  const _dangerZoneBg = theme; // handled via CSS class now
  const setMessage = useCallback((msg) => { if (msg) _toast.success(msg); }, [_toast]);
  const noop = useCallback(() => {}, []);

  const profile = useProfileEdit();

  const {
    orgList,
    filteredOrgs,
    search,
    setSearch,
    showCreate,
    createForm,
    setCreateForm,
    createError,
    openCreate,
    closeCreate,
    handleCreateOrg,
    showEdit,
    editForm,
    setEditForm,
    editError,
    handleApproveApplication,
    handleRejectApplication,
    applicationActionLoading,
    openEdit,
    closeEdit,
    handleUpdateOrg,
    handleCreateTenantAdminApplication,
    handleDeleteTenantAdmin,
    loadOrgs,
  } = useManageOrganizations({
    enabled: isSuper,
    setMessage,
    incLoading: noop,
    decLoading: noop,
  });

  const initials = getInitials(displayName, user?.email);
  const avatarBg = getAvatarColor(displayName || user?.email);

  const [orgStatusFilter, setOrgStatusFilter] = useState("all");
  const [openOrgActionMenuId, setOpenOrgActionMenuId] = useState(null);
  const [viewOrg, setViewOrg] = useState(null);
  const [reviewApp, setReviewApp] = useState(null);
  const [allApplicationsOpen, setAllApplicationsOpen] = useState(false);
  const [inspectMembershipAdmin, setInspectMembershipAdmin] = useState(null);
  const [manageAdminsOrg, setManageAdminsOrg] = useState(null);
  const [adminInviteEmail, setAdminInviteEmail] = useState("");
  const [adminInviteLoading, setAdminInviteLoading] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState("");
  const [adminRemoveLoadingId, setAdminRemoveLoadingId] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [setPeriodOrg, setSetPeriodOrg] = useState(null);
  const [periodOptions, setPeriodOptions] = useState([]);
  const [periodSelection, setPeriodSelection] = useState("");
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodSaving, setPeriodSaving] = useState(false);
  const [periodError, setPeriodError] = useState("");
  const [orgPeriodOverrides, setOrgPeriodOverrides] = useState({});
  const [toggleOrg, setToggleOrg] = useState(null);
  const [toggleStatus, setToggleStatus] = useState("active");
  const [toggleReason, setToggleReason] = useState("");
  const [toggleSaving, setToggleSaving] = useState(false);
  const [toggleError, setToggleError] = useState("");

  // Drawer states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [securityPolicyOpen, setSecurityPolicyOpen] = useState(false);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  // AuditCenterDrawer removed — use /audit page instead
  const [exportBackupOpen, setExportBackupOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [featureFlagsOpen, setFeatureFlagsOpen] = useState(false);
  const [systemHealthOpen, setSystemHealthOpen] = useState(false);
  const [orgSortKey, setOrgSortKey] = useState("name");
  const [orgSortDir, setOrgSortDir] = useState("asc");
  const [membershipSortKey, setMembershipSortKey] = useState("name");
  const [membershipSortDir, setMembershipSortDir] = useState("asc");

  const getOrgMeta = useCallback((org) => {
    const lookup = ORG_PROTOTYPE_META[String(org?.code || "").toUpperCase()] || {};
    const periodFromSettings = org?.settings?.currentPeriodName || org?.settings?.activePeriod || org?.settings?.active_period;
    const period = orgPeriodOverrides[org.id] || org?.active_period_name || periodFromSettings || lookup.period || "—";
    const jurors = org?.juror_count != null ? Number(org.juror_count) : "—";
    const projects = org?.project_count != null ? Number(org.project_count) : "—";
    const status = org?.status || "active";
    const { university, department } = splitSubtitle(org?.subtitle);
    return { period, jurors, projects, status, university, department };
  }, [orgPeriodOverrides]);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest(".sa-org-action-wrap")) {
        setOpenOrgActionMenuId(null);
      }
    }
    if (!openOrgActionMenuId) return undefined;
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [openOrgActionMenuId]);

  const runOrgMenuAction = useCallback((event, action) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenOrgActionMenuId(null);
    action?.();
  }, []);

  useEffect(() => {
    if (!manageAdminsOrg?.id) return;
    const fresh = orgList.find((org) => org.id === manageAdminsOrg.id);
    if (!fresh) {
      setManageAdminsOrg(null);
      return;
    }
    setManageAdminsOrg(fresh);
  }, [orgList, manageAdminsOrg?.id]);

  useEffect(() => {
    if (!setPeriodOrg?.id) return undefined;
    let active = true;
    setPeriodLoading(true);
    setPeriodError("");
    setPeriodOptions([]);
    setPeriodSelection("");

    listPeriods(setPeriodOrg.id)
      .then((rows) => {
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        setPeriodOptions(list);
        const current = list.find((p) => p.is_current) || list[0] || null;
        setPeriodSelection(current?.id || "");
      })
      .catch((e) => {
        if (!active) return;
        setPeriodError(e?.message || "Could not load periods for this organization.");
      })
      .finally(() => {
        if (active) setPeriodLoading(false);
      });

    return () => { active = false; };
  }, [setPeriodOrg?.id]);

  const handleSaveCreateOrganization = useCallback(async () => {
    setCreateSaving(true);
    try {
      await handleCreateOrg();
    } finally {
      setCreateSaving(false);
    }
  }, [handleCreateOrg]);

  const handleSaveEditOrganization = useCallback(async () => {
    setEditSaving(true);
    try {
      await handleUpdateOrg();
    } finally {
      setEditSaving(false);
    }
  }, [handleUpdateOrg]);

  const handleInviteAdmin = useCallback(async () => {
    if (!manageAdminsOrg?.id) return;
    const email = String(adminInviteEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setAdminInviteError("A valid email is required.");
      return;
    }
    setAdminInviteLoading(true);
    setAdminInviteError("");
    const localPart = email.split("@")[0] || "Admin";
    const name = localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
      .join(" ");
    const { university, department } = getOrgMeta(manageAdminsOrg);
    const result = await handleCreateTenantAdminApplication({
      organizationId: manageAdminsOrg.id,
      name: name || "Admin User",
      email,
      password: "TempPass#2026",
      university: university === "—" ? "" : university,
      department: department === "—" ? "" : department,
    });
    setAdminInviteLoading(false);
    if (result?.ok) {
      setAdminInviteEmail("");
      setAdminInviteError("");
      setMessage(`Invitation sent to ${email}`);
      return;
    }
    setAdminInviteError(result?.error || "Could not invite admin.");
  }, [adminInviteEmail, getOrgMeta, handleCreateTenantAdminApplication, manageAdminsOrg, setMessage]);

  const handleRemoveAdmin = useCallback(async (organizationId, userId) => {
    if (!organizationId || !userId) return;
    setAdminRemoveLoadingId(userId);
    const ok = await handleDeleteTenantAdmin({ organizationId, userId });
    setAdminRemoveLoadingId("");
    if (!ok) {
      _toast.error("Could not remove admin.");
    }
  }, [handleDeleteTenantAdmin, _toast]);

  const handleSaveSetCurrentPeriod = useCallback(async () => {
    if (!setPeriodOrg?.id || !periodSelection) return;
    setPeriodSaving(true);
    setPeriodError("");
    try {
      await setCurrentPeriod(periodSelection, setPeriodOrg.id);
      const selected = periodOptions.find((p) => p.id === periodSelection);
      if (selected?.name) {
        setOrgPeriodOverrides((prev) => ({ ...prev, [setPeriodOrg.id]: selected.name }));
      }
      setMessage(selected?.name ? `Current period set to ${selected.name}` : "Current period updated");
      setSetPeriodOrg(null);
      await loadOrgs();
    } catch (e) {
      setPeriodError(e?.message || "Could not set current period.");
    } finally {
      setPeriodSaving(false);
    }
  }, [loadOrgs, periodOptions, periodSelection, setPeriodOrg, setMessage]);

  const handleSaveToggleStatus = useCallback(async () => {
    if (!toggleOrg?.id) return;
    setToggleSaving(true);
    setToggleError("");
    try {
      await updateOrganization({
        organizationId: toggleOrg.id,
        status: toggleStatus,
      });
      setMessage(`Organization status updated to ${toggleStatus}`);
      setToggleOrg(null);
      setToggleReason("");
      await loadOrgs();
    } catch (e) {
      setToggleError(e?.message || "Could not update organization status.");
    } finally {
      setToggleSaving(false);
    }
  }, [loadOrgs, setMessage, toggleOrg, toggleStatus]);

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

  // Super-admin Danger Zone modal state
  const [dangerModal, setDangerModal] = useState(null); // null | "disable_org" | "revoke_admin" | "maintenance"
  const [dangerConfirm, setDangerConfirm] = useState("");

  const handleSaveProfile = useCallback(async ({ displayName: newName, email: newEmail, avatarFile }) => {
    const trimmedName = newName.trim();
    const trimmedEmail = newEmail.trim();

    // 1. Save display name
    const result = await upsertProfile(trimmedName || null);
    const saved = result?.display_name ?? trimmedName;
    setDisplayName(saved);

    // 2. Save email if changed
    if (trimmedEmail && trimmedEmail !== user?.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (emailError) throw emailError;
      _toast.info("Confirmation link sent to your new email address");
    }

    // 3. Upload avatar if provided
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

  // Super-admin KPIs
  const kpis = useMemo(() => {
    const active = orgList.filter((o) => o.status === "active").length;
    const orgAdmins = orgList.reduce((sum, o) => sum + (o.tenantAdmins?.length ?? 0), 0);
    const pending = orgList.reduce((sum, o) => sum + (o.pendingApplications?.length ?? 0), 0);
    const activePeriods = orgList.reduce((sum, o) => (getOrgMeta(o).period && getOrgMeta(o).period !== "—" ? sum + 1 : sum), 0);
    const totalJurors = orgList.reduce((sum, o) => {
      const jurors = getOrgMeta(o).jurors;
      return sum + (Number.isFinite(jurors) ? jurors : 0);
    }, 0);
    return { total: orgList.length, active, orgAdmins, pending, activePeriods, totalJurors };
  }, [orgList, getOrgMeta]);

  const allPending = useMemo(() =>
    orgList.flatMap((o) =>
      (o.pendingApplications || []).map((a) => ({
        ...a,
        orgId: o.id,
        orgCode: o.code,
        orgName: o.name,
        orgSubtitle: o.subtitle || "",
      }))
    ),
    [orgList]
  );

  const crossOrgAdmins = useMemo(() => {
    const map = new Map();
    orgList.forEach((o) => {
      (o.tenantAdmins || []).forEach((a) => {
        if (!map.has(a.userId)) {
          map.set(a.userId, { ...a, orgs: [{ code: o.code, name: o.name }] });
        } else {
          map.get(a.userId).orgs.push({ code: o.code, name: o.name });
        }
      });
    });
    return [...map.values()];
  }, [orgList]);

  const statusFilteredOrgs = useMemo(() => (
    orgStatusFilter === "all"
      ? filteredOrgs
      : filteredOrgs.filter((org) => String(org.status || "").toLowerCase() === orgStatusFilter)
  ), [filteredOrgs, orgStatusFilter]);

  const sortedFilteredOrgs = useMemo(() => {
    const statusRank = { active: 1, limited: 2, disabled: 3, archived: 4 };
    const rows = [...statusFilteredOrgs];
    rows.sort((a, b) => {
      const direction = orgSortDir === "asc" ? 1 : -1;
      const aName = String(a.name || "");
      const bName = String(b.name || "");
      let cmp = 0;
      if (orgSortKey === "name") {
        cmp = aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
      } else if (orgSortKey === "code") {
        cmp = String(a.code || "").localeCompare(String(b.code || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (orgSortKey === "subtitle") {
        cmp = String(a.subtitle || "").localeCompare(String(b.subtitle || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (orgSortKey === "status") {
        cmp = (statusRank[a.status] || 99) - (statusRank[b.status] || 99);
      } else if (orgSortKey === "admins") {
        cmp = (a.tenantAdmins?.length || 0) - (b.tenantAdmins?.length || 0);
      } else if (orgSortKey === "created_at") {
        const aTs = Date.parse(a.created_at || "");
        const bTs = Date.parse(b.created_at || "");
        const aValue = Number.isFinite(aTs) ? aTs : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bTs) ? bTs : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      }
      if (cmp !== 0) return cmp * direction;
      return aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
    });
    return rows;
  }, [statusFilteredOrgs, orgSortKey, orgSortDir]);

  const sortedCrossOrgAdmins = useMemo(() => {
    const rows = [...crossOrgAdmins];
    rows.sort((a, b) => {
      const direction = membershipSortDir === "asc" ? 1 : -1;
      const aName = String(a.name || "");
      const bName = String(b.name || "");
      let cmp = 0;
      if (membershipSortKey === "name") {
        cmp = aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
      } else if (membershipSortKey === "email") {
        cmp = String(a.email || "").localeCompare(String(b.email || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (membershipSortKey === "primaryOrg") {
        cmp = String(a.orgs[0]?.code || "").localeCompare(String(b.orgs[0]?.code || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (membershipSortKey === "orgCount") {
        cmp = (a.orgs?.length || 0) - (b.orgs?.length || 0);
      } else if (membershipSortKey === "status") {
        const aStatus = (a.orgs?.length || 0) > 1 ? "multi-org" : "healthy";
        const bStatus = (b.orgs?.length || 0) > 1 ? "multi-org" : "healthy";
        cmp = aStatus.localeCompare(bStatus, "tr", { sensitivity: "base", numeric: true });
      }
      if (cmp !== 0) return cmp * direction;
      return aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
    });
    return rows;
  }, [crossOrgAdmins, membershipSortKey, membershipSortDir]);

  function handleOrgSort(key) {
    if (orgSortKey === key) {
      setOrgSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setOrgSortKey(key);
    setOrgSortDir(key === "created_at" ? "desc" : "asc");
  }

  function handleMembershipSort(key) {
    if (membershipSortKey === key) {
      setMembershipSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setMembershipSortKey(key);
    setMembershipSortDir(key === "orgCount" ? "desc" : "asc");
  }

  const DANGER_LABELS = {
    disable_org: "Disable Organization",
    revoke_admin: "Revoke Admin Access",
    maintenance: "Start Maintenance Mode",
  };
  const DANGER_CONFIRM_PHRASE = {
    disable_org: "DISABLE",
    revoke_admin: "REVOKE",
    maintenance: "MAINTENANCE",
  };
  const viewOrgMeta = viewOrg ? getOrgMeta(viewOrg) : null;
  const reviewAppMeta = reviewApp ? splitSubtitle(reviewApp.orgSubtitle) : null;

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
        initials={initials}
        avatarBg={avatarBg}
        isSuper={isSuper}
      />

      {/* Governance drawers */}
      <SecurityPolicyDrawer
        open={securityPolicyOpen}
        onClose={() => setSecurityPolicyOpen(false)}
        policy={securityPolicy}
        onSave={handleSaveSecurityPolicy}
        error={securityPolicyError}
      />
      <GlobalSettingsDrawer open={globalSettingsOpen} onClose={() => setGlobalSettingsOpen(false)} />
      {/* AuditCenterDrawer removed — use /audit page instead */}
      <ExportBackupDrawer open={exportBackupOpen} onClose={() => setExportBackupOpen(false)} />
      <MaintenanceDrawer open={maintenanceOpen} onClose={() => setMaintenanceOpen(false)} />
      <FeatureFlagsDrawer open={featureFlagsOpen} onClose={() => setFeatureFlagsOpen(false)} />
      <SystemHealthDrawer open={systemHealthOpen} onClose={() => setSystemHealthOpen(false)} />

      {/* Organization management drawers/modals */}
      <Drawer open={showCreate} onClose={closeCreate}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="vera-icon-surface" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Create Organization</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  Register a new university department or institution
                </div>
              </div>
            </div>
            <button className="fs-close" onClick={closeCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 16 }}>
          <div className="fs-field-row">
            <label className="fs-label">Organization Name</label>
            <input
              className="fs-input"
              type="text"
              value={createForm.name || ""}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. TED University Electrical Engineering"
            />
          </div>
          <div className="fs-field-row">
            <label className="fs-label">Short Label</label>
            <input
              className="fs-input"
              type="text"
              value={createForm.shortLabel || ""}
              onChange={(e) => {
                const shortLabel = e.target.value.toUpperCase();
                setCreateForm((prev) => ({
                  ...prev,
                  shortLabel,
                  code: shortLabel.toLowerCase().replace(/\s+/g, "-"),
                }));
              }}
              placeholder="e.g. TEDU-EE"
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fs-field-row">
              <label className="fs-label">University</label>
              <input
                className="fs-input"
                type="text"
                value={createForm.university || ""}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, university: e.target.value }))}
                placeholder="TED University"
              />
            </div>
            <div className="fs-field-row">
              <label className="fs-label">Department</label>
              <input
                className="fs-input"
                type="text"
                value={createForm.department || ""}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="EEE"
              />
            </div>
          </div>
          <div className="fs-field-row">
            <label className="fs-label">Contact Email</label>
            <input
              className="fs-input"
              type="email"
              value={createForm.contact_email || ""}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, contact_email: e.target.value }))}
              placeholder="admin@university.edu.tr"
            />
          </div>
          <div className="fs-field-row">
            <label className="fs-label">Initial Status</label>
            <select
              className="fs-input"
              style={{ cursor: "pointer" }}
              value={createForm.status || "active"}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="limited">Limited</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          {createError && (
            <FbAlert variant="danger">
              {createError}
            </FbAlert>
          )}
        </div>
        <div className="fs-drawer-footer">
          <button className="fs-btn fs-btn-secondary" onClick={closeCreate} disabled={createSaving}>Cancel</button>
          <button className="fs-btn fs-btn-primary" onClick={handleSaveCreateOrganization} disabled={createSaving || isDemoMode}>
            <AsyncButtonContent loading={createSaving} loadingText="Creating…">Create Organization</AsyncButtonContent>
          </button>
        </div>
      </Drawer>

      <Drawer open={showEdit} onClose={closeEdit}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="vera-icon-surface" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Edit Organization</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {editForm.shortLabel || editForm.code || "Update organization identity and settings"}
                </div>
              </div>
            </div>
            <button className="fs-close" onClick={closeEdit}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 16 }}>
          <div className="fs-field-row">
            <label className="fs-label">Organization Name</label>
            <input className="fs-input" type="text" value={editForm.name || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="fs-field-row">
            <label className="fs-label">Short Label</label>
            <input
              className="fs-input"
              type="text"
              value={editForm.shortLabel || ""}
              onChange={(e) => {
                const shortLabel = e.target.value.toUpperCase();
                setEditForm((prev) => ({ ...prev, shortLabel, code: shortLabel.toLowerCase().replace(/\s+/g, "-") }));
              }}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fs-field-row">
              <label className="fs-label">University</label>
              <input className="fs-input" type="text" value={editForm.university || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, university: e.target.value }))} />
            </div>
            <div className="fs-field-row">
              <label className="fs-label">Department</label>
              <input className="fs-input" type="text" value={editForm.department || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))} />
            </div>
          </div>
          <div className="fs-field-row">
            <label className="fs-label">Contact Email</label>
            <input className="fs-input" type="email" value={editForm.contact_email || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, contact_email: e.target.value }))} />
          </div>
          <div className="fs-field-row">
            <label className="fs-label">Status</label>
            <select className="fs-input" style={{ cursor: "pointer" }} value={editForm.status || "active"} onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="limited">Limited</option>
              <option value="disabled">Disabled</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {editError && <FbAlert variant="danger">{editError}</FbAlert>}
        </div>
        <div className="fs-drawer-footer">
          <button className="fs-btn fs-btn-secondary" onClick={closeEdit} disabled={editSaving}>Cancel</button>
          <button className="fs-btn fs-btn-primary" onClick={handleSaveEditOrganization} disabled={editSaving || isDemoMode}>
            <AsyncButtonContent loading={editSaving} loadingText="Saving…">Save Changes</AsyncButtonContent>
          </button>
        </div>
      </Drawer>

      <Drawer open={!!viewOrg} onClose={() => setViewOrg(null)}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="vera-icon-surface" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{viewOrgMeta?.university || viewOrg?.name || "Organization Profile"}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{viewOrg?.name || "—"}</div>
              </div>
            </div>
            <button className="fs-close" onClick={() => setViewOrg(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div className="text-xs text-muted">Status</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: viewOrgMeta?.status === "active" ? "var(--success)" : viewOrgMeta?.status === "limited" ? "var(--warning)" : "var(--text-secondary)" }}>
                {viewOrgMeta?.status ? viewOrgMeta.status.charAt(0).toUpperCase() + viewOrgMeta.status.slice(1) : "—"}
              </div>
            </div>
            <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div className="text-xs text-muted">Admins</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{viewOrg?.tenantAdmins?.length ?? 0}</div>
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Organization</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{viewOrgMeta?.university || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Name</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{viewOrg?.name || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Code</span><span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--mono)" }}>{String(viewOrg?.code || "").toUpperCase() || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Current Period</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{viewOrgMeta?.period || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Total Jurors</span><span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "var(--mono)" }}>{viewOrgMeta?.jurors ?? "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Total Projects</span><span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "var(--mono)" }}>{viewOrgMeta?.projects ?? "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px" }}><span className="text-sm text-muted">Created</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatShortDate(viewOrg?.created_at)}</span></div>
          </div>
        </div>
        <div className="fs-drawer-footer">
          <button className="fs-btn fs-btn-secondary" onClick={() => setViewOrg(null)}>Close</button>
          <button className="fs-btn fs-btn-primary" onClick={() => { if (viewOrg) openEdit(viewOrg); setViewOrg(null); }}>Edit Organization</button>
        </div>
      </Drawer>

      <Drawer open={!!manageAdminsOrg} onClose={() => setManageAdminsOrg(null)}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="fs-icon identity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
              </div>
              <div className="fs-title-group">
                <div className="fs-title">Manage Admins</div>
                <div className="fs-subtitle">{String(manageAdminsOrg?.code || "").toUpperCase()} admin memberships</div>
              </div>
            </div>
            <button className="fs-close" onClick={() => setManageAdminsOrg(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 10 }}>
          {(manageAdminsOrg?.tenantAdmins || []).length === 0 && (
            <div className="text-sm text-muted" style={{ textAlign: "center", padding: "8px 0" }}>No approved admin yet.</div>
          )}
          {(manageAdminsOrg?.tenantAdmins || []).map((admin, idx) => (
            <div key={admin.userId || `${admin.email}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div className="fs-avatar" style={{ width: 34, height: 34, fontSize: 11 }}>{getInitials(admin.name, admin.email)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{admin.name || "—"}</div>
                <div className="text-xs text-muted">{admin.email || "—"}</div>
              </div>
              {idx === 0 ? (
                <span className="badge badge-success" style={{ fontSize: 9 }}>Owner</span>
              ) : (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ padding: "3px 10px", fontSize: 10, borderColor: "rgba(225,29,72,0.2)", color: "var(--danger)" }}
                  onClick={() => handleRemoveAdmin(manageAdminsOrg.id, admin.userId)}
                  disabled={adminRemoveLoadingId === admin.userId || isDemoMode}
                >
                  {adminRemoveLoadingId === admin.userId ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 650, color: "var(--text-secondary)", marginBottom: 8 }}>Add New Admin</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="fs-input" type="email" placeholder="admin@university.edu.tr" value={adminInviteEmail} onChange={(e) => setAdminInviteEmail(e.target.value)} style={{ flex: 1 }} />
              <button className="fs-btn fs-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={handleInviteAdmin} disabled={adminInviteLoading || isDemoMode}>
                <AsyncButtonContent loading={adminInviteLoading} loadingText="Inviting…">Invite</AsyncButtonContent>
              </button>
            </div>
            {adminInviteError && <div className="text-xs" style={{ color: "var(--danger)", marginTop: 6 }}>{adminInviteError}</div>}
          </div>
        </div>
        <div className="fs-drawer-footer">
          <button className="fs-btn fs-btn-secondary" onClick={() => setManageAdminsOrg(null)}>Close</button>
        </div>
      </Drawer>

      <Drawer open={!!reviewApp} onClose={() => setReviewApp(null)}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="fs-icon identity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              </div>
              <div className="fs-title-group">
                <div className="fs-title">Review Application</div>
                <div className="fs-subtitle">{reviewApp?.name} — {String(reviewApp?.orgCode || "").toUpperCase()}</div>
              </div>
            </div>
            <button className="fs-close" onClick={() => setReviewApp(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-1)", borderRadius: "var(--radius-sm)" }}>
            <div className="fs-avatar" style={{ width: 42, height: 42, fontSize: 14 }}>{getInitials(reviewApp?.name, reviewApp?.email)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{reviewApp?.name}</div>
              <div className="text-sm text-muted">{reviewApp?.email}</div>
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Requested Organization</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{String(reviewApp?.orgCode || "").toUpperCase()}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">University</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{reviewAppMeta?.university || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}><span className="text-sm text-muted">Department</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{reviewAppMeta?.department || "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px" }}><span className="text-sm text-muted">Submitted</span><span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatShortDate(reviewApp?.createdAt)}</span></div>
          </div>
        </div>
        <div className="fs-drawer-footer" style={{ gap: 8 }}>
          <button className="fs-btn fs-btn-secondary" style={{ flex: 1 }} onClick={() => setReviewApp(null)}>Close</button>
          <button
            className="btn btn-outline btn-sm"
            style={{ borderColor: "rgba(225,29,72,0.2)", color: "var(--danger)", padding: "8px 18px", fontSize: 12 }}
            onClick={async () => {
              if (!reviewApp?.applicationId) return;
              await handleRejectApplication(reviewApp.applicationId);
              setReviewApp(null);
            }}
            disabled={applicationActionLoading.id === reviewApp?.applicationId}
          >
            Reject
          </button>
          <button
            className="fs-btn fs-btn-primary"
            style={{ flex: 1 }}
            onClick={async () => {
              if (!reviewApp?.applicationId) return;
              await handleApproveApplication(reviewApp.applicationId);
              setReviewApp(null);
            }}
            disabled={applicationActionLoading.id === reviewApp?.applicationId}
          >
            Approve
          </button>
        </div>
      </Drawer>

      <Drawer open={allApplicationsOpen} onClose={() => setAllApplicationsOpen(false)}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div className="fs-title-group">
              <div className="fs-title">All Applications</div>
              <div className="fs-subtitle">{allPending.length} pending applications</div>
            </div>
            <button className="fs-close" onClick={() => setAllApplicationsOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 8 }}>
          {allPending.map((app) => (
            <div key={app.applicationId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div className="fs-avatar" style={{ width: 34, height: 34, fontSize: 11 }}>{getInitials(app.name, app.email)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{app.name}</div>
                <div className="text-xs text-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.email} · {String(app.orgCode || "").toUpperCase()}</div>
              </div>
              <button className="btn btn-outline btn-sm" style={{ padding: "4px 10px", fontSize: 10 }} onClick={() => setReviewApp(app)}>Review</button>
            </div>
          ))}
        </div>
        <div className="fs-drawer-footer">
          <button className="fs-btn fs-btn-secondary" onClick={() => setAllApplicationsOpen(false)}>Close</button>
        </div>
      </Drawer>

      <Drawer open={!!inspectMembershipAdmin} onClose={() => setInspectMembershipAdmin(null)}>
        <div className="fs-drawer-header">
          <div className="fs-drawer-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="fs-icon identity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <div className="fs-title-group">
                <div className="fs-title">Inspect Membership</div>
                <div className="fs-subtitle">{inspectMembershipAdmin?.name || "Admin membership details"}</div>
              </div>
            </div>
            <button className="fs-close" onClick={() => setInspectMembershipAdmin(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-drawer-body" style={{ gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-1)", borderRadius: "var(--radius-sm)" }}>
            <div className="fs-avatar" style={{ width: 42, height: 42, fontSize: 14 }}>{getInitials(inspectMembershipAdmin?.name, inspectMembershipAdmin?.email)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{inspectMembershipAdmin?.name}</div>
              <div className="text-sm text-muted">{inspectMembershipAdmin?.email || "—"}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 650, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Organization Memberships</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            {(inspectMembershipAdmin?.orgs || []).map((org, idx) => (
              <div key={`${org.code}-${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: idx < (inspectMembershipAdmin.orgs.length - 1) ? "1px solid var(--border)" : undefined }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{org.code}</div>
                  <div className="text-xs text-muted">{org.name || "Organization"}</div>
                </div>
                <span className={`badge ${inspectMembershipAdmin?.orgs?.length > 1 ? "badge-warning" : "badge-success"}`} style={{ fontSize: 9 }}>
                  {inspectMembershipAdmin?.orgs?.length > 1 ? "Multi-org" : "Healthy"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="fs-drawer-footer">
          <button className="fs-btn fs-btn-secondary" onClick={() => setInspectMembershipAdmin(null)}>Close</button>
          <button
            className="btn btn-outline btn-sm"
            style={{ borderColor: "rgba(225,29,72,0.2)", color: "var(--danger)", padding: "8px 16px", fontSize: 12 }}
            onClick={() => {
              _toast.warning(`Access revoked for ${inspectMembershipAdmin?.name || "admin"}`);
              setInspectMembershipAdmin(null);
            }}
          >
            Revoke Access
          </button>
        </div>
      </Drawer>

      <Modal open={!!setPeriodOrg} onClose={() => setSetPeriodOrg(null)} size="sm">
        <div className="fs-modal-header">
          <div className="fs-modal-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="fs-icon accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m8 12 2.5 2.5L16 9" /></svg>
              </div>
              <div className="fs-title-group">
                <div className="fs-title">Set Current Period</div>
                <div className="fs-subtitle">Select the active evaluation period for {String(setPeriodOrg?.code || "").toUpperCase()}</div>
              </div>
            </div>
            <button className="fs-close" onClick={() => setSetPeriodOrg(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-modal-body">
          {periodLoading && <div className="text-sm text-muted">Loading periods…</div>}
          {!periodLoading && periodOptions.length === 0 && <div className="text-sm text-muted">No periods available for this organization.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {periodOptions.map((period) => (
              <label
                key={period.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: periodSelection === period.id ? "1px solid rgba(59,130,246,0.25)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  background: periodSelection === period.id ? "rgba(59,130,246,0.04)" : "transparent",
                }}
              >
                <input type="radio" name="org-period" checked={periodSelection === period.id} onChange={() => setPeriodSelection(period.id)} style={{ accentColor: "var(--accent)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{period.name}</div>
                  <div className="text-xs text-muted">{period.is_current ? "Active" : period.is_locked ? "Locked" : "Available"}</div>
                </div>
              </label>
            ))}
          </div>
          {periodError && <div className="text-xs" style={{ color: "var(--danger)", marginTop: 8 }}>{periodError}</div>}
        </div>
        <div className="fs-modal-footer">
          <button className="fs-btn fs-btn-secondary" onClick={() => setSetPeriodOrg(null)}>Cancel</button>
          <button className="fs-btn fs-btn-primary" onClick={handleSaveSetCurrentPeriod} disabled={periodSaving || !periodSelection}>
            <AsyncButtonContent loading={periodSaving} loadingText="Setting…">Set Period</AsyncButtonContent>
          </button>
        </div>
      </Modal>

      <Modal open={!!toggleOrg} onClose={() => setToggleOrg(null)} size="sm">
        <div className="fs-modal-header">
          <div className="fs-modal-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="fs-icon accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div className="fs-title-group">
                <div className="fs-title">Toggle Organization State</div>
                <div className="fs-subtitle">Change the active state of {String(toggleOrg?.code || "").toUpperCase()}</div>
              </div>
            </div>
            <button className="fs-close" onClick={() => setToggleOrg(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="fs-modal-body">
          <div className="fs-field-row">
            <label className="fs-label">New Status</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: "active", label: "Active", accent: "var(--success)" },
                { value: "limited", label: "Limited", accent: "var(--warning)" },
                { value: "disabled", label: "Disabled", accent: "var(--danger)" },
              ].map((opt) => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer", padding: "8px 14px", border: toggleStatus === opt.value ? `1px solid ${opt.accent}` : "1px solid var(--border)", borderRadius: "var(--radius-sm)", flex: 1, background: toggleStatus === opt.value ? "var(--surface-1)" : "transparent" }}>
                  <input type="radio" name="toggle-org-status" checked={toggleStatus === opt.value} onChange={() => setToggleStatus(opt.value)} style={{ accentColor: opt.accent }} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="fs-field-row" style={{ marginTop: 8 }}>
            <label className="fs-label">Reason</label>
            <textarea className="fs-input" rows={2} placeholder="Reason for status change..." style={{ resize: "vertical" }} value={toggleReason} onChange={(e) => setToggleReason(e.target.value)} />
          </div>
          {toggleError && <div className="text-xs" style={{ color: "var(--danger)" }}>{toggleError}</div>}
        </div>
        <div className="fs-modal-footer">
          <button className="fs-btn fs-btn-secondary" onClick={() => setToggleOrg(null)}>Cancel</button>
          <button className="fs-btn fs-btn-primary" onClick={handleSaveToggleStatus} disabled={toggleSaving || isDemoMode}>
            <AsyncButtonContent loading={toggleSaving} loadingText="Updating…">Update Status</AsyncButtonContent>
          </button>
        </div>
      </Modal>

      {/* Super-admin Danger Zone confirmation modal */}
      {dangerModal && createPortal(
        <div
          className="crud-overlay"
          style={{ display: "flex" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDangerModal(null); }}
        >
          <div className="crud-modal" style={{ maxWidth: 420 }}>
            <div className="crud-modal-header" style={{ borderBottom: "1px solid rgba(225,29,72,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <path d="M12 9v4m0 4h.01" />
                </svg>
                <h3 style={{ color: "var(--danger)" }}>{DANGER_LABELS[dangerModal]}</h3>
              </div>
              <button className="crud-modal-close" onClick={() => setDangerModal(null)}>&#215;</button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <FbAlert variant="danger">
                <div style={{ fontSize: 12 }}>
                  This action is irreversible and will take effect immediately. Type <strong>{DANGER_CONFIRM_PHRASE[dangerModal]}</strong> below to confirm.
                </div>
              </FbAlert>
              <input
                className="form-input"
                type="text"
                placeholder={`Type ${DANGER_CONFIRM_PHRASE[dangerModal]} to confirm`}
                value={dangerConfirm}
                onChange={(e) => setDangerConfirm(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--surface-1)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setDangerModal(null)}>Cancel</button>
              <button
                className="btn btn-sm"
                style={{ background: "var(--danger)", color: "#fff" }}
                disabled={dangerConfirm !== DANGER_CONFIRM_PHRASE[dangerModal]}
                onClick={() => {
                  _toast.success(`${DANGER_LABELS[dangerModal]} — action recorded (demo)`);
                  setDangerModal(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isSuper ? (
        /* ── Super-Admin Control Center ─────────────────────────────── */
        <div className="page">
          <div className="page-title">Super Admin Control Center</div>
          <div className="page-desc" style={{ marginBottom: 12 }}>
            Platform-wide administration, organization management, and governance controls.
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
            <span className="badge badge-neutral">Super Admin</span>
            <span className="badge" style={{ background: "var(--success-soft)", color: "var(--success)", border: "1px solid rgba(22,163,74,0.18)" }}>
              Platform Scope
            </span>
          </div>

          {/* Profile card */}
          <div className="card settings-role-card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar avatarUrl={avatarUrl} initials={initials} bg={avatarBg} size={54} fontSize={17} className="sb-avatar sa-avatar" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{displayName || "Platform Owner"}</div>
                  <div className="text-sm text-muted" style={{ marginTop: 2 }}>{user?.email}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <span className="badge badge-neutral">Super Admin</span>
                    <span className="badge badge-success">Cross-Organization Access</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditProfileOpen(true)}>Edit Profile</button>
                <button className="btn btn-outline btn-sm" onClick={handleOpenSecurityPolicy}>Security Policy</button>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="scores-kpi-strip" style={{ marginBottom: 14 }}>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">{kpis.total || "—"}</div>
              <div className="scores-kpi-item-label">Organizations</div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">
                <span style={{ color: "var(--success)" }}>{kpis.active || "—"}</span>
              </div>
              <div className="scores-kpi-item-label">Active</div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">{kpis.orgAdmins || "—"}</div>
              <div className="scores-kpi-item-label">Org Admins</div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value" style={{ color: kpis.pending > 0 ? "var(--warning)" : undefined }}>
                {kpis.pending || "—"}
              </div>
              <div className="scores-kpi-item-label">Pending Review</div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">{kpis.activePeriods || "—"}</div>
              <div className="scores-kpi-item-label">Active Periods</div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">{kpis.totalJurors || "—"}</div>
              <div className="scores-kpi-item-label">Total Jurors</div>
            </div>
          </div>

          {/* Organization Management table */}
          <div className="card" style={{ marginBottom: 14, padding: 14 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Organization Management</div>
                <div className="text-sm text-muted" style={{ marginTop: 3 }}>
                  Organization identity, health, admin capacity, and operational actions.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  className="form-input"
                  style={{ width: 132, height: 30, fontSize: 12, cursor: "pointer", flex: "0 0 132px" }}
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="limited">Limited</option>
                  <option value="disabled">Disabled</option>
                  <option value="archived">Archived</option>
                </select>
                <input
                  className="form-input"
                  style={{ width: 180, height: 30, fontSize: 12, flex: "1 1 180px", minWidth: 160 }}
                  placeholder="Search organizations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "auto", padding: "6px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, whiteSpace: "nowrap" }}
                  onClick={openCreate}
                  disabled={isDemoMode}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create Organization
                </button>
              </div>
            </div>
            <div className="table-wrap" style={{ overflow: "visible" }}>
              <table>
                <thead>
                  <tr>
                    <th className={`sortable${orgSortKey === "subtitle" ? " sorted" : ""}`} onClick={() => handleOrgSort("subtitle")}>
                      Organization <SortIcon colKey="subtitle" sortKey={orgSortKey} sortDir={orgSortDir} />
                    </th>
                    <th className={`sortable${orgSortKey === "name" ? " sorted" : ""}`} onClick={() => handleOrgSort("name")}>
                      Name <SortIcon colKey="name" sortKey={orgSortKey} sortDir={orgSortDir} />
                    </th>
                    <th className={`sortable${orgSortKey === "code" ? " sorted" : ""}`} onClick={() => handleOrgSort("code")}>
                      Code <SortIcon colKey="code" sortKey={orgSortKey} sortDir={orgSortDir} />
                    </th>
                    <th className={`sortable${orgSortKey === "status" ? " sorted" : ""}`} onClick={() => handleOrgSort("status")}>
                      Status <SortIcon colKey="status" sortKey={orgSortKey} sortDir={orgSortDir} />
                    </th>
                    <th>Active Period</th>
                    <th className={`text-center sortable${orgSortKey === "admins" ? " sorted" : ""}`} onClick={() => handleOrgSort("admins")}>
                      Admins <SortIcon colKey="admins" sortKey={orgSortKey} sortDir={orgSortDir} />
                    </th>
                    <th className={`sortable${orgSortKey === "created_at" ? " sorted" : ""}`} onClick={() => handleOrgSort("created_at")}>
                      Created <SortIcon colKey="created_at" sortKey={orgSortKey} sortDir={orgSortDir} />
                    </th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-sm text-muted" style={{ textAlign: "center", padding: "18px 0" }}>
                        No organizations found.
                      </td>
                    </tr>
                  ) : (
                    sortedFilteredOrgs.map((org) => {
                      const meta = getOrgMeta(org);
                      const code = String(org.code || "").toUpperCase();
                      return (
                        <tr key={org.id}>
                          <td style={{ fontWeight: 600 }}>{org.subtitle || "—"}</td>
                          <td>{org.name}</td>
                          <td className="mono">{code || "—"}</td>
                          <td><OrgStatusBadge status={org.status} /></td>
                          <td>{meta.period || "—"}</td>
                          <td className="text-center mono org-admin-count-cell">
                            <span className="org-admin-count-label">Admins:</span>{" "}
                            {org.tenantAdmins?.length ?? 0}
                          </td>
                          <td><span className="vera-datetime-text">{formatShortDate(org.created_at)}</span></td>
                          <td className="text-right">
                            <div className="juror-action-wrap sa-org-action-wrap menu-up" style={{ display: "inline-flex" }}>
                              <button
                                className="juror-action-btn"
                                title="Actions"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenOrgActionMenuId((prev) => (prev === org.id ? null : org.id));
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="5" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="12" cy="19" r="2" />
                                </svg>
                              </button>
                              <div
                                className={`juror-action-menu${openOrgActionMenuId === org.id ? " show" : ""}`}
                                style={{ zIndex: 300 }}
                              >
                                <button
                                  type="button"
                                  className="juror-action-item"
                                  style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}
                                  onClick={(event) => runOrgMenuAction(event, () => setViewOrg(org))}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                  View Organization
                                </button>
                                <button
                                  type="button"
                                  className="juror-action-item"
                                  style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}
                                  onClick={(event) => runOrgMenuAction(event, () => openEdit(org))}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                  Edit Organization
                                </button>
                                <button
                                  type="button"
                                  className="juror-action-item"
                                  style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}
                                  onClick={(event) => runOrgMenuAction(event, () => setManageAdminsOrg(org))}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                                  Manage Admins
                                </button>
                                <div className="juror-action-sep" />
                                <button
                                  type="button"
                                  className="juror-action-item"
                                  style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}
                                  onClick={(event) => runOrgMenuAction(event, () => setSetPeriodOrg(org))}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="m8 12 2.5 2.5L16 9" /></svg>
                                  Set Current Period
                                </button>
                                <button
                                  type="button"
                                  className="juror-action-item"
                                  style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}
                                  onClick={(event) =>
                                    runOrgMenuAction(event, () => {
                                      onNavigate?.("analytics");
                                      _toast.info(`${code || org.name} analytics opened`);
                                    })
                                  }
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                                  Open Analytics
                                </button>
                                <button
                                  type="button"
                                  className="juror-action-item danger"
                                  style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}
                                  onClick={(event) =>
                                    runOrgMenuAction(event, () => {
                                      setToggleOrg(org);
                                      setToggleStatus(org.status || "active");
                                      setToggleReason("");
                                      setToggleError("");
                                    })
                                  }
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                  Enable / Disable Organization
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cross-Organization Access & Memberships */}
          <div className="card" style={{ marginBottom: 14, padding: 14 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Cross-Organization Access &amp; Memberships</div>
                <div className="text-sm text-muted" style={{ marginTop: 3 }}>
                  Who is admin where, organization coverage, and membership health visibility.
                </div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  try {
                    const XLSX = await import("xlsx-js-style");
                    const headers = ["Admin", "Email", "Orgs Covered", "Org Codes"];
                    const rows = sortedCrossOrgAdmins.map((a) => [
                      a.name || "",
                      a.email || "",
                      a.orgs.length,
                      a.orgs.map((o) => o.code).join(", "),
                    ]);
                    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                    ws["!cols"] = [24, 32, 12, 36].map((w) => ({ wch: w }));
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Memberships");
                    XLSX.writeFile(wb, "memberships.xlsx");
                    _toast.success(`${crossOrgAdmins.length} admin${crossOrgAdmins.length !== 1 ? "s" : ""} exported · Excel`);
                  } catch (e) {
                    _toast.error(e?.message || "Memberships export failed — please try again");
                  }
                }}
                disabled={crossOrgAdmins.length === 0}
              >
                Export Memberships
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className={`sortable${membershipSortKey === "name" ? " sorted" : ""}`} onClick={() => handleMembershipSort("name")}>
                      Admin <SortIcon colKey="name" sortKey={membershipSortKey} sortDir={membershipSortDir} />
                    </th>
                    <th className={`sortable${membershipSortKey === "email" ? " sorted" : ""}`} onClick={() => handleMembershipSort("email")}>
                      Email <SortIcon colKey="email" sortKey={membershipSortKey} sortDir={membershipSortDir} />
                    </th>
                    <th className={`sortable${membershipSortKey === "primaryOrg" ? " sorted" : ""}`} onClick={() => handleMembershipSort("primaryOrg")}>
                      Primary Org <SortIcon colKey="primaryOrg" sortKey={membershipSortKey} sortDir={membershipSortDir} />
                    </th>
                    <th className={`text-center sortable${membershipSortKey === "orgCount" ? " sorted" : ""}`} onClick={() => handleMembershipSort("orgCount")}>
                      Orgs Covered <SortIcon colKey="orgCount" sortKey={membershipSortKey} sortDir={membershipSortDir} />
                    </th>
                    <th className={`sortable${membershipSortKey === "status" ? " sorted" : ""}`} onClick={() => handleMembershipSort("status")}>
                      Status <SortIcon colKey="status" sortKey={membershipSortKey} sortDir={membershipSortDir} />
                    </th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCrossOrgAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-sm text-muted" style={{ textAlign: "center", padding: "18px 0" }}>
                        No admin memberships found.
                      </td>
                    </tr>
                  ) : (
                    sortedCrossOrgAdmins.map((admin) => (
                      <tr key={admin.userId}>
                        <td style={{ fontWeight: 600 }}>{admin.name}</td>
                        <td>{admin.email}</td>
                        <td>{admin.orgs[0]?.code || "—"}</td>
                        <td className="text-center mono">{admin.orgs.length}</td>
                        <td>
                          {admin.orgs.length > 1 ? (
                            <span className="badge badge-warning">Multi-org</span>
                          ) : (
                            <span className="badge badge-success">
                              <svg className="badge-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              Healthy
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 11, padding: "3px 10px" }}
                            onClick={() => setInspectMembershipAdmin(admin)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Approvals + Platform Governance */}
          <div className="grid-2" style={{ marginBottom: 14 }}>
            {/* Pending Approvals */}
            <div className="card" style={{ padding: 14 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Pending Approvals</div>
                  <div className="text-sm text-muted" style={{ marginTop: 3 }}>Review admin applications and onboarding queue.</div>
                </div>
                {allPending.length > 0 && (
                  <span className="badge badge-warning">{allPending.length} Pending</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allPending.length === 0 ? (
                  <div className="text-sm text-muted" style={{ textAlign: "center", padding: "12px 0" }}>
                    No pending applications.
                  </div>
                ) : (
                  allPending.slice(0, 2).map((app) => (
                    <div key={app.applicationId} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                          <div className="text-sm text-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {app.email} · {app.orgCode}
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                            Submitted {formatShortDate(app.createdAt)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button
                            className="btn btn-sm"
                            style={{ padding: "5px 14px", fontSize: 11, background: "var(--accent)", color: "#fff", boxShadow: "none" }}
                            onClick={() => setReviewApp(app)}
                          >
                            Review
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ padding: "5px 10px", fontSize: 11, borderColor: "rgba(22,163,74,0.25)", color: "var(--success)" }}
                            onClick={() => handleApproveApplication(app.applicationId)}
                            disabled={applicationActionLoading.id === app.applicationId}
                          >
                            {applicationActionLoading.id === app.applicationId && applicationActionLoading.action === "approve" ? "…" : "Approve"}
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ padding: "5px 10px", fontSize: 11, borderColor: "rgba(225,29,72,0.2)", color: "var(--text-tertiary)" }}
                            onClick={() => handleRejectApplication(app.applicationId)}
                            disabled={applicationActionLoading.id === app.applicationId}
                          >
                            {applicationActionLoading.id === app.applicationId && applicationActionLoading.action === "reject" ? "…" : "Reject"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {allPending.length > 2 && (
                  <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
                    <button
                      className="text-xs text-muted"
                      style={{ border: "none", background: "transparent", cursor: "pointer" }}
                      onClick={() => setAllApplicationsOpen(true)}
                    >
                      View all {allPending.length} applications
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Governance */}
            <div className="card" style={{ padding: 14 }}>
              <div className="card-header" style={{ marginBottom: 10 }}>
                <div>
                  <div className="card-title">Platform Governance</div>
                  <div className="text-sm text-muted" style={{ marginTop: 3 }}>System-wide controls, flags, and operational tools.</div>
                </div>
                <span className="badge badge-neutral" style={{ fontSize: 9 }}>Super Admin Only</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  {
                    label: "Global Settings",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M19.07 19.07A10 10 0 0 0 4.93 4.93" /></svg>,
                    onClick: () => setGlobalSettingsOpen(true),
                  },
                  {
                    label: "Export & Backup",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
                    onClick: () => setExportBackupOpen(true),
                  },
                  {
                    label: "Maintenance",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
                    onClick: () => setMaintenanceOpen(true),
                  },
                  {
                    label: "Feature Flags",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>,
                    onClick: () => setFeatureFlagsOpen(true),
                  },
                  {
                    label: "System Health",
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
                    onClick: () => setSystemHealthOpen(true),
                  },
                ].map(({ label, icon, onClick }) => (
                  <button
                    key={label}
                    className="btn btn-outline btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-start", padding: "8px 10px", fontSize: 12 }}
                    onClick={onClick}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Super-admin Danger Zone */}
          <div className="card danger-zone-card" style={{ marginTop: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.2" style={{ width: 15, height: 15, flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <path d="M12 9v4m0 4h.01" />
                </svg>
                <div className="card-title" style={{ color: "var(--danger)", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Danger Zone</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", background: "rgba(225,29,72,0.12)", color: "var(--danger)", border: "1px solid rgba(225,29,72,0.35)", borderRadius: 4, padding: "2px 8px" }}>Irreversible</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "disable_org", label: "Disable Organization", desc: "Suspend all access for an organization. Evaluation sessions, juror logins, and admin access are frozen." },
                { key: "revoke_admin", label: "Revoke Admin Access", desc: "Remove an org-admin's membership and platform access immediately." },
                { key: "maintenance", label: "Start Maintenance Mode", desc: "Take the platform offline for all users except Super Admin. Schedule or trigger immediately." },
              ].map(({ key, label, desc }) => (
                <div key={key} className="danger-zone-item" style={{ flex: 1, minWidth: 180, padding: 11, borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.5 }}>{desc}</div>
                  <button
                    className="btn btn-sm"
                    style={{ border: "1px solid rgba(225,29,72,0.38)", color: "var(--danger)", background: "rgba(225,29,72,0.06)", fontSize: 11, padding: "4px 11px", borderRadius: "var(--radius-sm)" }}
                    onClick={() => { setDangerModal(key); setDangerConfirm(""); }}
                    disabled={isDemoMode}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        /* ── Org-Admin Settings ──────────────────────────────────────── */
        <div className="page">
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div className="page-title">Settings</div>
              <div className="page-desc">Manage your profile, security, and organization-scoped permissions.</div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <span className="badge badge-neutral">Organization Admin</span>
              {activeOrganization?.code && (
                <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.18)" }}>
                  {activeOrganization.code}
                </span>
              )}
            </div>
          </div>

          <div className="grid-2" style={{ gap: 10 }}>
            {/* Left column */}
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
                      <span className="badge badge-neutral" style={{ fontSize: 9, padding: "1px 7px" }}>Organization Admin</span>
                      {activeOrganization?.name && (
                        <span className="badge badge-success" style={{ fontSize: 9, padding: "1px 7px" }}>{activeOrganization.name}</span>
                      )}
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

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Organization Access card */}
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

              {/* Permissions Summary card */}
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
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card danger-zone-card" style={{ marginTop: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.2" style={{ width: 15, height: 15, flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <path d="M12 9v4m0 4h.01" />
                </svg>
                <div className="card-title" style={{ color: "var(--danger)", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Danger Zone</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", background: "rgba(225,29,72,0.12)", color: "var(--danger)", border: "1px solid rgba(225,29,72,0.35)", borderRadius: 4, padding: "2px 8px" }}>Restricted</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="danger-zone-item" style={{ flex: 1, minWidth: 180, padding: 11, borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>Leave Organization</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.5 }}>
                  Remove yourself from {activeOrganization?.name || "this organization"}. Account stays active.
                </div>
                <button
                  className="btn btn-sm"
                  style={{ border: "1px solid rgba(225,29,72,0.38)", color: "var(--danger)", background: "rgba(225,29,72,0.06)", fontSize: 11, padding: "4px 11px", borderRadius: "var(--radius-sm)", opacity: 0.5, cursor: "not-allowed" }}
                  disabled
                >
                  Request Leave
                </button>
              </div>
              <div className="danger-zone-item" style={{ flex: 1, minWidth: 180, padding: 11, borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>Deactivate Account</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.5 }}>
                  Full deactivation. All memberships and data access revoked.
                </div>
                <button
                  className="btn btn-sm"
                  style={{ border: "1px solid rgba(225,29,72,0.38)", color: "var(--danger)", background: "rgba(225,29,72,0.06)", fontSize: 11, padding: "4px 11px", borderRadius: "var(--radius-sm)", opacity: 0.5, cursor: "not-allowed" }}
                  disabled
                >
                  Request Deactivation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
