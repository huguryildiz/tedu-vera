// src/admin/settings/ManageOrganizationsPanel.jsx
// ============================================================
// Organization/tenant identity management panel.
// Super-admin only — rendered from OrgSettingsPage.
// ============================================================

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  Clock3Icon,
  CirclePlusIcon,
  CodeIcon,
  HistoryIcon,
  LandmarkIcon,
  MailIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  UserStarIcon,
  UniversityIcon,
} from "../../shared/Icons";
import AlertCard from "../../shared/AlertCard";
import Tooltip from "../../shared/Tooltip";
import ConfirmDialog from "../../shared/ConfirmDialog";
import LastActivity from "../LastActivity";

// ── Status badge styles ──────────────────────────────────────

const STATUS_BADGE = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  disabled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_LABELS = {
  active:   "Active",
  disabled: "Disabled",
  archived: "Archived",
};

function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function copyEmailToClipboard(email) {
  if (!email) return;
  const write = navigator.clipboard?.writeText
    ? () => navigator.clipboard.writeText(email)
    : () => {
        const ta = document.createElement("textarea");
        ta.value = email;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      };
  write();
  showCopyToast(email);
}

function showCopyToast(email) {
  const existing = document.querySelector(".copy-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.textContent = `Copied: ${email}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("copy-toast--visible"));
  setTimeout(() => {
    toast.classList.remove("copy-toast--visible");
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

// ── Shared sub-components ────────────────────────────────────

function ModalOverlay({ children, ...props }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" {...props}>
      {children}
    </div>
  );
}

function ModalCard({ children, className }) {
  return (
    <div className={cn("w-full max-w-lg rounded-lg border bg-card p-0 shadow-lg", className)}>
      {children}
    </div>
  );
}

function ModalHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3 border-b px-6 py-4">
      {Icon && <span className="text-muted-foreground" aria-hidden="true"><Icon /></span>}
      <h3 className="text-base font-semibold">{title}</h3>
    </div>
  );
}

function ModalBody({ children, className }) {
  return <div className={cn("flex flex-col gap-3 px-6 py-4", className)}>{children}</div>;
}

function ModalActions({ children, className }) {
  return <div className={cn("flex justify-end gap-3 border-t px-6 py-4", className)}>{children}</div>;
}

function FieldLabel({ children }) {
  return <label className="text-sm font-medium text-foreground">{children}</label>;
}

function FieldInput({ className, danger, ...props }) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring disabled:opacity-50",
        danger ? "border-destructive" : "border-input",
        className,
      )}
      {...props}
    />
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-sm text-destructive">{children}</p>;
}

function BtnPrimary({ children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function BtnOutline({ children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function BtnGhost({ children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, className, danger, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md p-1.5 text-sm transition-colors",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────

export default function ManageOrganizationsPanel({
  // From useManageOrganizations
  orgList,
  filteredOrgs,
  error,
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
  openEdit,
  closeEdit,
  handleUpdateOrg,
  handleApproveApplication,
  handleRejectApplication,
  applicationActionLoading,
  handleCreateTenantAdminApplication,
  handleUpdateTenantAdmin,
  handleDeleteTenantAdmin,
  isDirty,
  isDemoMode = false,
}) {
  const [showAll, setShowAll] = useState(false);
  const [adminsDialogOrg, setAdminsDialogOrg] = useState(null);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminEditError, setAdminEditError] = useState("");
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ organizationId: "", userId: "", name: "", email: "" });
  const [adminCreateOpen, setAdminCreateOpen] = useState(false);
  const [adminCreateSaving, setAdminCreateSaving] = useState(false);
  const [adminCreateError, setAdminCreateError] = useState("");
  const [adminCreateForm, setAdminCreateForm] = useState({
    organizationId: "",
    name: "",
    email: "",
    password: "",
  });
  const [adminDeleteTarget, setAdminDeleteTarget] = useState(null);
  const adminCreateErrorLower = adminCreateError.trim().toLowerCase();
  const adminCreateNameError = adminCreateErrorLower.includes("name");
  const adminCreateEmailError = adminCreateErrorLower.includes("email");
  const adminCreatePasswordError = adminCreateErrorLower.includes("password");
  const adminEditErrorLower = adminEditError.trim().toLowerCase();
  const adminEditNameError = adminEditErrorLower.includes("name");
  const adminEditEmailError = adminEditErrorLower.includes("email");

  useEffect(() => {
    if (!adminsDialogOrg?.id) return;
    const fresh = orgList.find((org) => org.id === adminsDialogOrg.id);
    if (!fresh) {
      setAdminsDialogOrg(null);
      setAdminCreateOpen(false);
      return;
    }
    setAdminsDialogOrg(fresh);
  }, [orgList, adminsDialogOrg?.id]);

  const openAdminCreate = (org) => {
    setAdminCreateError("");
    setAdminCreateForm({
      organizationId: org?.id || "",
      name: "",
      email: "",
      password: "",
    });
    setAdminCreateOpen(true);
  };

  const saveAdminCreate = async () => {
    const organizationId = adminCreateForm.organizationId;
    const name = adminCreateForm.name.trim();
    const email = adminCreateForm.email.trim().toLowerCase();
    const password = adminCreateForm.password;

    if (!organizationId) { setAdminCreateError("Organization is missing."); return; }
    if (!name) { setAdminCreateError("Name is required."); return; }
    if (!email || !email.includes("@")) { setAdminCreateError("A valid email is required."); return; }
    if (!password || password.length < 10) { setAdminCreateError("Password must be at least 10 characters."); return; }

    setAdminCreateSaving(true);
    setAdminCreateError("");
    const result = await handleCreateTenantAdminApplication?.({
      organizationId,
      name,
      email,
      password,
      university: adminsDialogOrg?.university || "",
      department: adminsDialogOrg?.department || "",
    });
    setAdminCreateSaving(false);
    if (result?.ok) { setAdminCreateOpen(false); return; }
    setAdminCreateError(result?.error || "Could not create admin application.");
  };

  const openAdminEdit = (organizationId, admin) => {
    setAdminEditError("");
    setAdminEditForm({
      organizationId,
      userId: admin?.userId || "",
      name: admin?.name || "",
      email: admin?.email || "",
    });
    setAdminEditOpen(true);
  };

  const saveAdminEdit = async () => {
    const name = adminEditForm.name.trim();
    const email = adminEditForm.email.trim().toLowerCase();
    if (!adminEditForm.organizationId || !adminEditForm.userId) { setAdminEditError("Admin identity is missing."); return; }
    if (!name) { setAdminEditError("Name is required."); return; }
    if (!email || !email.includes("@")) { setAdminEditError("A valid email is required."); return; }
    setAdminEditSaving(true);
    setAdminEditError("");
    const ok = await handleUpdateTenantAdmin?.({
      organizationId: adminEditForm.organizationId,
      userId: adminEditForm.userId,
      name,
      email,
    });
    setAdminEditSaving(false);
    if (ok) { setAdminEditOpen(false); return; }
    setAdminEditError("Could not update admin.");
  };

  const confirmAdminDelete = async () => {
    if (isDemoMode) throw new Error("Demo mode: delete is disabled.");
    if (!adminDeleteTarget?.organizationId || !adminDeleteTarget?.userId) return;
    await handleDeleteTenantAdmin?.({
      organizationId: adminDeleteTarget.organizationId,
      userId: adminDeleteTarget.userId,
    });
    setAdminDeleteTarget(null);
  };

  const createCanSubmit =
    createForm.code.trim() !== "" &&
    createForm.shortLabel.trim() !== "" &&
    createForm.university.trim() !== "" &&
    createForm.department.trim() !== "";

  const editCanSubmit =
    editForm.shortLabel.trim() !== "" &&
    editForm.university.trim() !== "" &&
    editForm.department.trim() !== "";

  const normalizedSearch = search.trim().toLowerCase();
  const visibleOrgs = normalizedSearch
    ? filteredOrgs
    : showAll
      ? orgList
      : orgList.slice(0, 3);

  return (
    <div className="space-y-4">
      {error && <AlertCard variant="error">{error}</AlertCard>}

      {/* ── Organization list ── */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">All Organizations</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
                <SearchIcon className="size-4" />
              </span>
              <input
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring sm:w-56"
                type="text"
                placeholder="Search organizations"
                aria-label="Search organizations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <BtnPrimary onClick={openCreate}>
              <CirclePlusIcon className="size-4" />
              <span className="hidden sm:inline">Organization</span>
            </BtnPrimary>
          </div>
        </div>

        <div className="divide-y">
          {visibleOrgs.map((org) => (
            <div key={org.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{org.shortLabel}</span>
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_BADGE[org.status] || STATUS_BADGE.disabled,
                  )}>
                    {STATUS_LABELS[org.status] || org.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CodeIcon className="size-3.5 shrink-0" />
                  <span className="font-mono">{org.code}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UniversityIcon className="size-3.5 shrink-0" />
                  <span>{org.university || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LandmarkIcon className="size-3.5 shrink-0" />
                  <span>{org.department || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserStarIcon className="size-3.5 shrink-0" />
                  <span>
                    {org.tenantAdmins?.length || 0} approved
                    {" · "}
                    <span className={(org.pendingApplications?.length || 0) > 0 ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                      {org.pendingApplications?.length || 0} pending
                    </span>
                    {" "}admin(s)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <LastActivity value={org.updated_at || null} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip text="Edit organization">
                  <IconBtn aria-label={`Edit ${org.shortLabel}`} onClick={() => openEdit(org)}>
                    <PencilIcon className="size-4" />
                    <span className="text-xs">Edit</span>
                  </IconBtn>
                </Tooltip>
                <Tooltip text="Review admins">
                  <IconBtn aria-label={`Review admins for ${org.shortLabel}`} onClick={() => setAdminsDialogOrg(org)}>
                    <UserStarIcon className="size-4" />
                    <span className="text-xs">Admins</span>
                  </IconBtn>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        {normalizedSearch && filteredOrgs.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No organizations match your search.
          </div>
        )}

        {!normalizedSearch && orgList.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No organizations found.{" "}
            <button className="text-primary underline-offset-4 hover:underline" type="button" onClick={openCreate}>
              Create one
            </button>
          </div>
        )}

        {!normalizedSearch && orgList.length > 3 && (
          <div className="border-t px-4 py-3">
            <BtnGhost onClick={() => setShowAll((v) => !v)} className="w-full">
              {showAll ? "Show fewer organizations" : `Show all organizations (${orgList.length})`}
            </BtnGhost>
          </div>
        )}
      </div>

      {/* ── Create Organization modal ── */}
      {showCreate && (
        <ModalOverlay role="dialog" aria-modal="true">
          <ModalCard>
            <ModalHeader icon={CirclePlusIcon} title="Create Organization" />
            <ModalBody>
              <FieldLabel>Code</FieldLabel>
              <FieldInput
                danger={createError && createError.toLowerCase().includes("code")}
                value={createForm.code}
                onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/\s/g, "-") }))}
                placeholder="tedu-ee"
              />
              <p className="text-xs text-muted-foreground">Immutable identifier. Lowercase slug format (e.g. tedu-ee).</p>

              <FieldLabel>Short Label</FieldLabel>
              <FieldInput
                value={createForm.shortLabel}
                onChange={(e) => setCreateForm((f) => ({ ...f, shortLabel: e.target.value }))}
                placeholder="EE"
              />

              <FieldLabel>University</FieldLabel>
              <FieldInput
                value={createForm.university}
                onChange={(e) => setCreateForm((f) => ({ ...f, university: e.target.value }))}
                placeholder="TED University"
              />

              <FieldLabel>Department</FieldLabel>
              <FieldInput
                value={createForm.department}
                onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Electrical & Electronics Engineering"
              />

              <FieldError>{createError}</FieldError>
            </ModalBody>
            <ModalActions>
              <BtnOutline onClick={closeCreate}>Cancel</BtnOutline>
              <BtnPrimary disabled={!createCanSubmit || isDemoMode} onClick={handleCreateOrg}>
                Create
              </BtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Edit Organization modal ── */}
      {showEdit && (
        <ModalOverlay role="dialog" aria-modal="true">
          <ModalCard>
            <ModalHeader icon={PencilIcon} title="Edit Organization" />
            <ModalBody>
              <FieldLabel>Code</FieldLabel>
              <FieldInput value={editForm.code} disabled />

              <FieldLabel>Short Label</FieldLabel>
              <FieldInput
                value={editForm.shortLabel}
                onChange={(e) => setEditForm((f) => ({ ...f, shortLabel: e.target.value }))}
              />

              <FieldLabel>University</FieldLabel>
              <FieldInput
                value={editForm.university}
                onChange={(e) => setEditForm((f) => ({ ...f, university: e.target.value }))}
              />

              <FieldLabel>Department</FieldLabel>
              <FieldInput
                value={editForm.department}
                onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
              />

              <FieldLabel>Status</FieldLabel>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="archived">Archived</option>
              </select>

              <FieldError>{editError}</FieldError>
            </ModalBody>
            <ModalActions>
              <BtnOutline onClick={closeEdit}>Cancel</BtnOutline>
              <BtnPrimary disabled={!editCanSubmit || isDemoMode} onClick={handleUpdateOrg}>
                Save
              </BtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Organization admins modal ── */}
      {adminsDialogOrg && (
        <ModalOverlay role="dialog" aria-modal="true" aria-label={`Admins for ${adminsDialogOrg.shortLabel}`}>
          <ModalCard className="max-w-xl">
            <ModalHeader icon={UserStarIcon} title={`${adminsDialogOrg.shortLabel} · Admins`} />
            <ModalBody className="max-h-[60vh] overflow-y-auto">
              {/* Approved admins */}
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved</h4>
              <div className="space-y-2">
                {adminsDialogOrg.tenantAdmins?.length ? (
                  adminsDialogOrg.tenantAdmins.map((admin, idx) => (
                    <div key={`${adminsDialogOrg.id}-approved-${idx}`} className="flex items-center justify-between rounded-md border p-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <UserStarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{admin.name || "—"}</span>
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => copyEmailToClipboard(admin.email)}
                          title="Copy email to clipboard"
                        >
                          <MailIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{admin.email}</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <HistoryIcon className="size-3.5 shrink-0" />
                          <span>{formatTimestamp(admin.updatedAt || admin.updated_at || adminsDialogOrg.updated_at || null)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckIcon className="size-3" />
                          Approved
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Tooltip text="Edit admin">
                            <IconBtn
                              aria-label={`Edit admin ${admin.name || admin.email}`}
                              onClick={() => openAdminEdit(adminsDialogOrg.id, admin)}
                              disabled={!admin.userId}
                            >
                              <PencilIcon className="size-3.5" />
                            </IconBtn>
                          </Tooltip>
                          <Tooltip text="Delete admin">
                            <IconBtn
                              danger
                              aria-label={`Delete admin ${admin.name || admin.email}`}
                              onClick={() => setAdminDeleteTarget({
                                organizationId: adminsDialogOrg.id,
                                userId: admin.userId,
                                name: admin.name,
                                email: admin.email,
                              })}
                              disabled={!admin.userId}
                            >
                              <TrashIcon className="size-3.5" />
                            </IconBtn>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-center text-xs text-muted-foreground">No approved admin yet.</p>
                )}
              </div>

              {/* Pending applications */}
              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending Applications</h4>
              <div className="space-y-2">
                {adminsDialogOrg.pendingApplications?.length ? (
                  adminsDialogOrg.pendingApplications.map((entry) => {
                    const isApproveLoading =
                      applicationActionLoading?.id === entry.applicationId
                      && applicationActionLoading?.action === "approve";
                    const isRejectLoading =
                      applicationActionLoading?.id === entry.applicationId
                      && applicationActionLoading?.action === "reject";
                    const isRowLoading = isApproveLoading || isRejectLoading;

                    return (
                      <div key={entry.applicationId} className="rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-sm">
                            <UserStarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">{entry.name || "—"}</span>
                          </div>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => copyEmailToClipboard(entry.email)}
                            title="Copy email to clipboard"
                          >
                            <MailIcon className="size-3.5 shrink-0" />
                            <span className="truncate">{entry.email}</span>
                          </button>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <HistoryIcon className="size-3.5 shrink-0" />
                            <span>{formatTimestamp(entry.updatedAt || entry.updated_at || entry.createdAt || null)}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Clock3Icon className="size-3" />
                            Pending approval
                          </span>
                          <div className="flex items-center gap-2">
                            <BtnPrimary
                              className="h-7 px-3 text-xs"
                              onClick={() => handleApproveApplication(entry.applicationId)}
                              disabled={isRowLoading || isDemoMode}
                            >
                              {isApproveLoading && <span className="spinner size-3" aria-hidden="true" />}
                              Approve
                            </BtnPrimary>
                            <BtnOutline
                              className="h-7 px-3 text-xs"
                              onClick={() => handleRejectApplication(entry.applicationId)}
                              disabled={isRowLoading || isDemoMode}
                            >
                              {isRejectLoading && <span className="spinner size-3" aria-hidden="true" />}
                              Reject
                            </BtnOutline>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-2 text-center text-xs text-muted-foreground">No pending applications.</p>
                )}
              </div>
            </ModalBody>
            <ModalActions>
              <BtnPrimary onClick={() => openAdminCreate(adminsDialogOrg)}>
                <CirclePlusIcon className="size-4" />
                Add admin
              </BtnPrimary>
              <BtnOutline onClick={() => { setAdminCreateOpen(false); setAdminsDialogOrg(null); }}>
                Close
              </BtnOutline>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Add admin modal ── */}
      {adminCreateOpen && (
        <ModalOverlay role="dialog" aria-modal="true" aria-label="Add admin">
          <ModalCard>
            <ModalHeader icon={CirclePlusIcon} title="Add Admin" />
            <ModalBody>
              <FieldLabel>Name</FieldLabel>
              <FieldInput
                danger={adminCreateNameError}
                value={adminCreateForm.name}
                onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Admin name"
              />
              <FieldLabel>Email</FieldLabel>
              <FieldInput
                danger={adminCreateEmailError}
                type="email"
                value={adminCreateForm.email}
                onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="admin@example.edu"
              />
              <FieldLabel>Temporary Password</FieldLabel>
              <FieldInput
                danger={adminCreatePasswordError}
                type="password"
                value={adminCreateForm.password}
                onChange={(e) => setAdminCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Minimum 10 characters"
              />
              <FieldError>{adminCreateError}</FieldError>
            </ModalBody>
            <ModalActions>
              <BtnOutline onClick={() => setAdminCreateOpen(false)}>Cancel</BtnOutline>
              <BtnPrimary onClick={saveAdminCreate} disabled={adminCreateSaving || isDemoMode}>
                Create
              </BtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Edit admin modal ── */}
      {adminEditOpen && (
        <ModalOverlay role="dialog" aria-modal="true" aria-label="Edit admin">
          <ModalCard>
            <ModalHeader icon={PencilIcon} title="Edit Admin" />
            <ModalBody>
              <FieldLabel>Name</FieldLabel>
              <FieldInput
                danger={adminEditNameError}
                value={adminEditForm.name}
                onChange={(e) => setAdminEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Admin name"
              />
              <FieldLabel>Email</FieldLabel>
              <FieldInput
                danger={adminEditEmailError}
                type="email"
                value={adminEditForm.email}
                onChange={(e) => setAdminEditForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="admin@example.com"
              />
              <FieldError>{adminEditError}</FieldError>
            </ModalBody>
            <ModalActions>
              <BtnOutline onClick={() => setAdminEditOpen(false)}>Cancel</BtnOutline>
              <BtnPrimary onClick={saveAdminEdit} disabled={adminEditSaving || isDemoMode}>
                Save
              </BtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      <ConfirmDialog
        open={!!adminDeleteTarget}
        onOpenChange={(open) => { if (!open) setAdminDeleteTarget(null); }}
        title="Delete Confirmation"
        body={
          adminDeleteTarget
            ? `This will permanently remove ${adminDeleteTarget.name || adminDeleteTarget.email} (${adminDeleteTarget.email}).`
            : ""
        }
        warning="This action is permanent and cannot be undone."
        typedConfirmation={adminDeleteTarget?.name || adminDeleteTarget?.email || undefined}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        icon="alert"
        onConfirm={confirmAdminDelete}
      />
    </div>
  );
}
