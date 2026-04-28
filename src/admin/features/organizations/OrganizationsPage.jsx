// src/admin/features/organizations/OrganizationsPage.jsx
// Super-admin only: organization management, pending approvals, governance.
// Extracted from SettingsPage.jsx as part of Settings restructure.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useAuth } from "@/auth";
import { useToast } from "@/shared/hooks/useToast";
import useCardSelection from "@/shared/hooks/useCardSelection";
import { useManageOrganizations } from "@/admin/shared/useManageOrganizations";
import { Icon } from "lucide-react";
import { updateOrganization, listUnlockRequests, resolveUnlockRequest, deleteOrganization } from "@/shared/api";
import {
  GlobalSettingsDrawer,
  ExportBackupDrawer,
  MaintenanceDrawer,
  SystemHealthDrawer,
} from "./GovernanceDrawers";
import { LOCK_TOOLTIP_GRACE, LOCK_TOOLTIP_EXPIRED } from "@/auth/shared/lockedActions";
import OrgTable from "./components/OrgTable";
import UnlockRequestsPanel from "./components/UnlockRequestsPanel";
import PendingApplicationsPanel from "./components/PendingApplicationsPanel";
import { CreateOrgDrawer, EditOrgDrawer, ViewOrgDrawer, ManageAdminsDrawer } from "./components/OrgDrawers";
import { ToggleStatusModal, DeleteOrgModal, ResolveUnlockModal } from "./components/OrgModals";
import "./OrganizationsPage.css";

export default function OrganizationsPage() {
  const { organizationId: _organizationId } = useAdminContext();
  const { user: _user, isSuper, activeOrganization: _activeOrganization, refreshMemberships, isEmailVerified, graceEndsAt, loading: authLoading } = useAuth();
  const isGraceLocked    = !!(graceEndsAt && !isEmailVerified && new Date(graceEndsAt) < new Date());
  const graceLockTooltip = isGraceLocked
    ? (new Date(graceEndsAt) < new Date() ? LOCK_TOOLTIP_EXPIRED : LOCK_TOOLTIP_GRACE)
    : null;
  const _toast = useToast();
  const setMessage = useCallback((msg) => { if (msg) _toast.success(msg); }, [_toast]);
  const noop = useCallback(() => {}, []);
  const orgsScopeRef = useCardSelection();

  const {
    orgList,
    filteredOrgs,
    search,
    setSearch,
    showCreate,
    createForm,
    setCreateForm,
    createError,
    createFieldErrors,
    setCreateFieldErrors,
    openCreate,
    closeCreate,
    handleCreateOrg,
    showEdit,
    editForm,
    setEditForm,
    editError,
    openEdit,
    closeEdit,
    handleUpdateOrg,
    handleDeleteTenantAdmin,
    loadOrgs,
    inviteLoading,
    handleInviteAdmin: hookHandleInviteAdmin,
    handleCancelInvite,
    joinRequestLoading,
    handleApproveJoinRequest,
    handleRejectJoinRequest,
    applicationLoading,
    handleApproveApplication,
    handleRejectApplication,
  } = useManageOrganizations({
    enabled: isSuper,
    setMessage,
    incLoading: noop,
    decLoading: noop,
  });

  const [orgStatusFilter, setOrgStatusFilter] = useState("all");
  const [orgStaffingFilter, setOrgStaffingFilter] = useState("all");
  const [orgFilterOpen, setOrgFilterOpen] = useState(false);
  const [openOrgActionMenuId, setOpenOrgActionMenuId] = useState(null);
  const [viewOrg, setViewOrg] = useState(null);
  const [manageAdminsOrg, setManageAdminsOrg] = useState(null);
  const [adminInviteEmail, setAdminInviteEmail] = useState("");
  const [adminInviteLoading, setAdminInviteLoading] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState("");
  const [adminRemoveLoadingId, setAdminRemoveLoadingId] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [toggleOrg, setToggleOrg] = useState(null);
  const [toggleStatus, setToggleStatus] = useState("active");
  const [toggleReason, setToggleReason] = useState("");
  const [toggleSaving, setToggleSaving] = useState(false);
  const [toggleError, setToggleError] = useState("");
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Governance drawer states
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [exportBackupOpen, setExportBackupOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [systemHealthOpen, setSystemHealthOpen] = useState(false);

  const [mainTab, setMainTab] = useState("organizations");

  // Unlock Requests state
  const [unlockTab, setUnlockTab] = useState("pending");
  const [unlockRows, setUnlockRows] = useState([]);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const [unlockSortKey, setUnlockSortKey] = useState("created_at");
  const [unlockSortDir, setUnlockSortDir] = useState("desc");
  const [unlockPage, setUnlockPage] = useState(1);
  const [unlockPageSize, setUnlockPageSize] = useState(10);

  const [orgSortKey, setOrgSortKey] = useState("name");
  const [orgSortDir, setOrgSortDir] = useState("asc");

  const getOrgMeta = useCallback((org) => {
    const lookup = {};
    const periodFromSettings = org?.settings?.currentPeriodName || org?.settings?.activePeriod || org?.settings?.active_period;
    const period = org?.active_period_name || periodFromSettings || lookup.period || "—";
    const jurors = org?.juror_count != null ? Number(org.juror_count) : "—";
    const projects = org?.project_count != null ? Number(org.project_count) : "—";
    const status = org?.status || "active";
    return { period, jurors, projects, status };
  }, []);

  const kpis = useMemo(() => {
    const total = orgList.length;
    const active = orgList.filter((o) => o.status === "active").length;
    const archived = orgList.filter((o) => o.status === "archived").length;
    const orgAdmins = orgList.reduce((sum, o) => sum + (o.tenantAdmins?.filter((a) => a.status === "active").length ?? 0), 0);
    const unstaffedOrgs = orgList.filter((o) => (o.tenantAdmins?.filter((a) => a.status === "active").length ?? 0) === 0).length;
    const liveEvaluations = orgList.filter((o) => o.active_period_name).length;
    const totalJurors = orgList.reduce((sum, o) => {
      const jurors = getOrgMeta(o).jurors;
      return sum + (Number.isFinite(jurors) ? jurors : 0);
    }, 0);
    const totalProjects = orgList.reduce((sum, o) => {
      const projects = getOrgMeta(o).projects;
      return sum + (Number.isFinite(projects) ? projects : 0);
    }, 0);
    return { total, active, archived, orgAdmins, unstaffedOrgs, liveEvaluations, totalJurors, totalProjects };
  }, [orgList, getOrgMeta]);

  const allPendingApplications = useMemo(() =>
    orgList.flatMap((o) =>
      (o.pendingApplications || []).map((a) => ({ ...a, orgName: o.name, orgId: o.id }))
    ),
    [orgList]
  );

  const orgActiveFilterCount =
    (orgStatusFilter !== "all" ? 1 : 0) +
    (orgStaffingFilter !== "all" ? 1 : 0);

  const statusFilteredOrgs = useMemo(() => {
    let rows = orgStatusFilter === "all"
      ? filteredOrgs
      : filteredOrgs.filter((org) => String(org.status || "").toLowerCase() === orgStatusFilter);
    if (orgStaffingFilter === "unstaffed") {
      rows = rows.filter((org) => (org.tenantAdmins?.filter((a) => a.status === "active").length ?? 0) === 0);
    } else if (orgStaffingFilter === "staffed") {
      rows = rows.filter((org) => (org.tenantAdmins?.filter((a) => a.status === "active").length ?? 0) > 0);
    }
    return rows;
  }, [filteredOrgs, orgStatusFilter, orgStaffingFilter]);

  const sortedFilteredOrgs = useMemo(() => {
    const statusRank = { active: 1, archived: 2 };
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
      } else if (orgSortKey === "status") {
        cmp = (statusRank[a.status] || 99) - (statusRank[b.status] || 99);
      } else if (orgSortKey === "admins") {
        cmp = (a.tenantAdmins?.filter((x) => x.status === "active").length || 0) - (b.tenantAdmins?.filter((x) => x.status === "active").length || 0);
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

  const [orgPageSize, setOrgPageSize] = useState(25);
  const [orgCurrentPage, setOrgCurrentPage] = useState(1);
  useEffect(() => { setOrgCurrentPage(1); }, [sortedFilteredOrgs]);

  const orgTotalPages = Math.max(1, Math.ceil(sortedFilteredOrgs.length / orgPageSize));
  const orgSafePage = Math.min(orgCurrentPage, orgTotalPages);
  const pagedOrgs = useMemo(() => {
    const start = (orgSafePage - 1) * orgPageSize;
    return sortedFilteredOrgs.slice(start, start + orgPageSize);
  }, [sortedFilteredOrgs, orgSafePage, orgPageSize]);

  // Unlock Requests logic
  const loadUnlockRequests = useCallback(async (status) => {
    setUnlockLoading(true);
    setUnlockError("");
    try {
      const data = await listUnlockRequests(status);
      setUnlockRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setUnlockError(e?.message || "Could not load unlock requests.");
      setUnlockRows([]);
    } finally {
      setUnlockLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab !== "unlock-requests") return;
    loadUnlockRequests(unlockTab);
    setUnlockPage(1);
  }, [mainTab, unlockTab, loadUnlockRequests]);

  const sortedUnlockRows = useMemo(() => {
    const dir = unlockSortDir === "asc" ? 1 : -1;
    return [...unlockRows].sort((a, b) => {
      let cmp = 0;
      if (unlockSortKey === "organization_name") {
        cmp = String(a.organization_name || "").localeCompare(String(b.organization_name || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (unlockSortKey === "period_name") {
        cmp = String(a.period_name || "").localeCompare(String(b.period_name || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (unlockSortKey === "requester_name") {
        cmp = String(a.requester_name || "").localeCompare(String(b.requester_name || ""), "tr", { sensitivity: "base", numeric: true });
      } else if (unlockSortKey === "created_at") {
        cmp = Date.parse(a.created_at || "") - Date.parse(b.created_at || "");
      } else if (unlockSortKey === "status") {
        cmp = String(a.status || "").localeCompare(String(b.status || ""));
      } else if (unlockSortKey === "reviewed_at") {
        cmp = Date.parse(a.reviewed_at || "") - Date.parse(b.reviewed_at || "");
      }
      return cmp * dir;
    });
  }, [unlockRows, unlockSortKey, unlockSortDir]);

  const unlockTotalPages = Math.max(1, Math.ceil(sortedUnlockRows.length / unlockPageSize));
  const unlockSafePage = Math.min(unlockPage, unlockTotalPages);
  const pagedUnlockRows = useMemo(() => {
    const start = (unlockSafePage - 1) * unlockPageSize;
    return sortedUnlockRows.slice(start, start + unlockPageSize);
  }, [sortedUnlockRows, unlockSafePage, unlockPageSize]);

  function handleUnlockSort(key) {
    if (unlockSortKey === key) {
      setUnlockSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setUnlockSortKey(key);
      setUnlockSortDir("asc");
    }
    setUnlockPage(1);
  }

  const openResolve = (row, decision) => {
    setResolveTarget({ row, decision });
    setNoteDraft("");
  };

  const closeResolve = () => {
    if (resolveSubmitting) return;
    setResolveTarget(null);
    setNoteDraft("");
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setResolveSubmitting(true);
    try {
      const result = await resolveUnlockRequest(
        resolveTarget.row.id,
        resolveTarget.decision,
        noteDraft.trim() || null,
      );
      if (result?.ok) {
        _toast.success(
          resolveTarget.decision === "approved"
            ? `Unlocked ${resolveTarget.row.period_name || "period"}.`
            : `Rejected unlock request for ${resolveTarget.row.period_name || "period"}.`
        );
        setResolveTarget(null);
        setNoteDraft("");
        loadUnlockRequests(unlockTab);
      } else {
        _toast.error(
          result?.error_code === "request_not_pending"
            ? "This request was already resolved"
            : "Failed to resolve the request"
        );
      }
    } catch (e) {
      _toast.error("Failed to resolve the request");
    } finally {
      setResolveSubmitting(false);
    }
  };

  useEffect(() => {
    if (!manageAdminsOrg?.id) return;
    const fresh = orgList.find((org) => org.id === manageAdminsOrg.id);
    if (!fresh) {
      setManageAdminsOrg(null);
      return;
    }
    setManageAdminsOrg(fresh);
  }, [orgList, manageAdminsOrg?.id]);

  const runOrgMenuAction = useCallback((event, action) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenOrgActionMenuId(null);
    action?.();
  }, []);

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
    const result = await hookHandleInviteAdmin(manageAdminsOrg.id, email);
    setAdminInviteLoading(false);
    if (result?.ok) {
      setAdminInviteEmail("");
      setAdminInviteError("");
      const fresh = orgList.find((o) => o.id === manageAdminsOrg.id);
      if (fresh) setManageAdminsOrg(fresh);
      return;
    }
    setAdminInviteError(result?.error || "Could not invite admin.");
  }, [adminInviteEmail, manageAdminsOrg, hookHandleInviteAdmin, orgList]);

  const handleRemoveAdmin = useCallback(async (orgId, userId) => {
    if (!orgId || !userId) return;
    setAdminRemoveLoadingId(userId);
    const ok = await handleDeleteTenantAdmin({ organizationId: orgId, userId });
    setAdminRemoveLoadingId("");
    if (!ok) {
      _toast.error("Failed to remove admin");
    }
  }, [handleDeleteTenantAdmin, _toast]);

  const handleSaveToggleStatus = useCallback(async () => {
    if (!toggleOrg?.id) return;
    setToggleSaving(true);
    setToggleError("");
    try {
      await updateOrganization({
        organizationId: toggleOrg.id,
        status: toggleStatus,
        reason: toggleReason.trim() || undefined,
      });
      setMessage(`Organization status updated to ${toggleStatus}`);
      setToggleOrg(null);
      setToggleReason("");
      await loadOrgs();
      refreshMemberships().catch(() => {});
    } catch (e) {
      setToggleError(e?.message || "Could not update organization status.");
    } finally {
      setToggleSaving(false);
    }
  }, [loadOrgs, refreshMemberships, setMessage, toggleOrg, toggleReason, toggleStatus]);

  const handleDeleteOrg = useCallback(async () => {
    if (!deleteOrg?.id) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteOrganization(deleteOrg.id);
      setMessage(`"${deleteOrg.code}" organization deleted.`);
      setDeleteOrg(null);
      await loadOrgs();
      refreshMemberships().catch(() => {});
    } catch (e) {
      setDeleteError(e?.message || "Could not delete organization.");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteOrg, loadOrgs, refreshMemberships, setMessage]);

  function handleOrgSort(key) {
    if (orgSortKey === key) {
      setOrgSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setOrgSortKey(key);
    setOrgSortDir(key === "created_at" ? "desc" : "asc");
  }

  const viewOrgMeta = viewOrg ? getOrgMeta(viewOrg) : null;

  const orgRowHandlers = useMemo(() => ({
    onView: (org) => setViewOrg(org),
    onEdit: (org) => openEdit(org),
    onManageAdmins: (org) => { setManageAdminsOrg(org); loadOrgs(); },
    onToggleStatus: (org) => { setToggleOrg(org); setToggleStatus(org.status || "active"); setToggleReason(""); setToggleError(""); },
    onDelete: (org) => { setDeleteOrg(org); setDeleteConfirmCode(""); setDeleteError(""); },
  }), [openEdit, loadOrgs]);

  if (!authLoading && !isSuper) {
    return <Navigate to="../overview" replace />;
  }

  return (
    <>
      <GlobalSettingsDrawer open={globalSettingsOpen} onClose={() => setGlobalSettingsOpen(false)} />
      <ExportBackupDrawer open={exportBackupOpen} onClose={() => setExportBackupOpen(false)} />
      <MaintenanceDrawer open={maintenanceOpen} onClose={() => setMaintenanceOpen(false)} />
      <SystemHealthDrawer open={systemHealthOpen} onClose={() => setSystemHealthOpen(false)} />

      <CreateOrgDrawer
        open={showCreate}
        onClose={closeCreate}
        createForm={createForm}
        setCreateForm={setCreateForm}
        createFieldErrors={createFieldErrors}
        setCreateFieldErrors={setCreateFieldErrors}
        createError={createError}
        createSaving={createSaving}
        onSave={handleSaveCreateOrganization}
      />
      <EditOrgDrawer
        open={showEdit}
        onClose={closeEdit}
        editForm={editForm}
        setEditForm={setEditForm}
        editError={editError}
        editSaving={editSaving}
        onSave={handleSaveEditOrganization}
      />
      <ViewOrgDrawer
        open={!!viewOrg}
        onClose={() => setViewOrg(null)}
        viewOrg={viewOrg}
        viewOrgMeta={viewOrgMeta}
        onEdit={() => { if (viewOrg) openEdit(viewOrg); setViewOrg(null); }}
      />
      <ManageAdminsDrawer
        open={!!manageAdminsOrg}
        onClose={() => setManageAdminsOrg(null)}
        manageAdminsOrg={manageAdminsOrg}
        adminInviteEmail={adminInviteEmail}
        setAdminInviteEmail={setAdminInviteEmail}
        adminInviteLoading={adminInviteLoading}
        adminInviteError={adminInviteError}
        setAdminInviteError={setAdminInviteError}
        inviteLoading={inviteLoading}
        adminRemoveLoadingId={adminRemoveLoadingId}
        joinRequestLoading={joinRequestLoading}
        graceLockTooltip={graceLockTooltip}
        isGraceLocked={isGraceLocked}
        onInvite={handleInviteAdmin}
        onCancelInvite={handleCancelInvite}
        onRemoveAdmin={handleRemoveAdmin}
        onApproveJoin={handleApproveJoinRequest}
        onRejectJoin={handleRejectJoinRequest}
      />
      <ToggleStatusModal
        open={!!toggleOrg}
        onClose={() => setToggleOrg(null)}
        toggleOrg={toggleOrg}
        toggleStatus={toggleStatus}
        setToggleStatus={setToggleStatus}
        toggleReason={toggleReason}
        setToggleReason={setToggleReason}
        toggleError={toggleError}
        toggleSaving={toggleSaving}
        graceLockTooltip={graceLockTooltip}
        isGraceLocked={isGraceLocked}
        onSave={handleSaveToggleStatus}
      />
      <DeleteOrgModal
        open={!!deleteOrg}
        onClose={() => setDeleteOrg(null)}
        deleteOrg={deleteOrg}
        deleteConfirmCode={deleteConfirmCode}
        setDeleteConfirmCode={setDeleteConfirmCode}
        deleteError={deleteError}
        setDeleteError={setDeleteError}
        deleteLoading={deleteLoading}
        onDelete={handleDeleteOrg}
      />
      <ResolveUnlockModal
        open={!!resolveTarget}
        onClose={closeResolve}
        resolveTarget={resolveTarget}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        resolveSubmitting={resolveSubmitting}
        onSubmit={submitResolve}
      />

      <div className="page" id="page-platform-control">
        <div className="page-title">Platform Control</div>
        <div className="page-desc" style={{ marginBottom: 12 }}>
          Super-admin hub for organization management, unlock request approvals, and platform governance.
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 0 }}>
          <span className="badge badge-neutral">Super Admin</span>
        </div>

        <div
          role="tablist"
          style={{ display: "flex", gap: 6, margin: "16px 0 0", borderBottom: "1px solid var(--border)" }}
        >
          {[
            { key: "organizations", label: "Organizations" },
            { key: "unlock-requests", label: "Unlock Requests" },
          ].map((t) => {
            const active = mainTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMainTab(t.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {mainTab === "organizations" && (
          <>
            {isSuper && allPendingApplications.length > 0 && (
              <PendingApplicationsPanel
                applications={allPendingApplications}
                onApprove={handleApproveApplication}
                onReject={handleRejectApplication}
                loading={applicationLoading}
              />
            )}

            {/* KPI strip */}
            <div className="scores-kpi-strip" style={{ marginBottom: 14 }}>
              <div className="scores-kpi-item">
                <div className="scores-kpi-item-value">
                  <span className={kpis.unstaffedOrgs > 0 ? "danger" : undefined}>
                    {kpis.unstaffedOrgs || "—"}
                  </span>
                </div>
                <div className="scores-kpi-item-label">Unstaffed Orgs</div>
                <div className="scores-kpi-item-sub">
                  {kpis.unstaffedOrgs > 0 ? (
                    <span className="sub-danger">need an admin</span>
                  ) : (
                    <span className="sub-muted">all staffed</span>
                  )}
                </div>
              </div>

              <div className="scores-kpi-item">
                <div className="scores-kpi-item-value">
                  <span className="success">{kpis.active || "—"}</span>
                </div>
                <div className="scores-kpi-item-label">Active Orgs</div>
                <div className="scores-kpi-item-sub">
                  <span className="sub-muted">
                    {kpis.total} total
                    {kpis.archived > 0 ? ` · ${kpis.archived} archived` : ""}
                  </span>
                </div>
              </div>

              <div className="scores-kpi-item">
                <div className="scores-kpi-item-value">{kpis.liveEvaluations || "—"}</div>
                <div className="scores-kpi-item-label">Live Evaluations</div>
                <div className="scores-kpi-item-sub">
                  <span className="sub-muted">
                    {kpis.liveEvaluations === 1 ? "org running" : "orgs running"}
                  </span>
                </div>
              </div>

              <div className="scores-kpi-item">
                <div className="scores-kpi-item-value">{kpis.orgAdmins || "—"}</div>
                <div className="scores-kpi-item-label">Admin Seats</div>
                <div className="scores-kpi-item-sub">
                  <span className="sub-muted">across {kpis.total || 0} orgs</span>
                </div>
              </div>

              <div className="scores-kpi-item">
                <div className="scores-kpi-item-value">
                  {kpis.totalJurors || "—"} · {kpis.totalProjects || 0}
                </div>
                <div className="scores-kpi-item-label">Platform Reach</div>
                <div className="scores-kpi-item-sub">
                  <span className="sub-muted">jurors · projects</span>
                </div>
              </div>
            </div>

            <OrgTable
              search={search}
              setSearch={setSearch}
              orgFilterOpen={orgFilterOpen}
              setOrgFilterOpen={setOrgFilterOpen}
              orgActiveFilterCount={orgActiveFilterCount}
              orgStatusFilter={orgStatusFilter}
              setOrgStatusFilter={setOrgStatusFilter}
              orgStaffingFilter={orgStaffingFilter}
              setOrgStaffingFilter={setOrgStaffingFilter}
              onOpenCreate={openCreate}
              sortedFilteredOrgs={sortedFilteredOrgs}
              pagedOrgs={pagedOrgs}
              getOrgMeta={getOrgMeta}
              orgSortKey={orgSortKey}
              orgSortDir={orgSortDir}
              onOrgSort={handleOrgSort}
              orgsScopeRef={orgsScopeRef}
              openOrgActionMenuId={openOrgActionMenuId}
              setOpenOrgActionMenuId={setOpenOrgActionMenuId}
              runOrgMenuAction={runOrgMenuAction}
              rowHandlers={orgRowHandlers}
              orgSafePage={orgSafePage}
              orgTotalPages={orgTotalPages}
              orgPageSize={orgPageSize}
              setOrgCurrentPage={setOrgCurrentPage}
              setOrgPageSize={setOrgPageSize}
            />

            {/* Platform Governance */}
            <div style={{ marginBottom: 14 }}>
              <div className="card" style={{ padding: 14 }}>
                <div className="card-header" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="card-title">Platform Governance</div>
                    <div className="text-sm text-muted" style={{ marginTop: 3 }}>System-wide controls and operational tools.</div>
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: 9 }}>Super Admin Only</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    {
                      label: "Global Settings",
                      icon: <Icon
                        iconNode={[]}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M19.07 19.07A10 10 0 0 0 4.93 4.93" /></Icon>,
                      onClick: () => setGlobalSettingsOpen(true),
                    },
                    {
                      label: "Export & Backup",
                      icon: <Icon
                        iconNode={[]}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ width: 14, height: 14 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icon>,
                      onClick: () => setExportBackupOpen(true),
                    },
                    {
                      label: "Maintenance",
                      icon: <Icon
                        iconNode={[]}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ width: 14, height: 14 }}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></Icon>,
                      onClick: () => setMaintenanceOpen(true),
                    },
                    {
                      label: "System Health",
                      icon: <Icon
                        iconNode={[]}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ width: 14, height: 14 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Icon>,
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
          </>
        )}

        {mainTab === "unlock-requests" && (
          <UnlockRequestsPanel
            unlockTab={unlockTab}
            setUnlockTab={setUnlockTab}
            unlockError={unlockError}
            unlockLoading={unlockLoading}
            pagedUnlockRows={pagedUnlockRows}
            unlockSortKey={unlockSortKey}
            unlockSortDir={unlockSortDir}
            onUnlockSort={handleUnlockSort}
            onOpenResolve={openResolve}
            unlockSafePage={unlockSafePage}
            unlockTotalPages={unlockTotalPages}
            unlockPageSize={unlockPageSize}
            sortedUnlockRowsLength={sortedUnlockRows.length}
            setUnlockPage={setUnlockPage}
            setUnlockPageSize={setUnlockPageSize}
          />
        )}
      </div>
    </>
  );
}
