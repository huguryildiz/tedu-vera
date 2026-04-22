// src/admin/hooks/useManageOrganizations.js
// ============================================================
// Organization/tenant CRUD state management.
// Super-admin only — hook no-ops when `enabled` is false.
//
// Follows useManagePeriods.js pattern but is self-contained
// (no cross-domain dependencies on period selection or
// useSettingsCrud orchestration).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../shared/lib/supabaseClient";
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  updateMemberAdmin,
  deleteMemberHard,
  submitApplication,
  approveApplication,
  rejectApplication,
  notifyApplication,
  inviteOrgAdmin,
  cancelOrgAdminInvite,
  approveJoinRequest,
  rejectJoinRequest,
} from "../../shared/api";

const EMPTY_CREATE = {
  name: "",
  code: "",
  shortLabel: "",
  contact_email: "",
  status: "active",
};
const EMPTY_EDIT = {
  id: "",
  name: "",
  code: "",
  shortLabel: "",
  contact_email: "",
  status: "active",
  created_at: "",
  updated_at: "",
};
const VALID_STATUSES = ["active", "archived"];
const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMPTY_CREATE_ERRORS = { shortLabel: "", contact_email: "" };

const normalizeAdminApplicationError = (raw) => {
  const msg = String(raw || "").trim();
  const lower = msg.toLowerCase();
  if (!lower) return "Could not create admin application.";
  if (lower.includes("email_already_registered")) {
    return "This email is already registered.";
  }
  if (lower.includes("application_already_pending")) {
    return "There is already a pending application for this email in this organization.";
  }
  if (lower.includes("password_too_short")) {
    return "Password must be at least 10 characters.";
  }
  if (lower.includes("tenant_not_found")) {
    return "Organization was not found. Please refresh and try again.";
  }
  return msg;
};

const normalizeAdminInviteError = (raw) => {
  const msg = String(raw || "").trim();
  const lower = msg.toLowerCase();
  if (!lower) return "Could not send invite.";
  if (lower.includes("already_member")) return "This email is already a member of this organization.";
  if (lower.includes("already_exists_in_auth")) return "This email is already registered in VERA. The user must sign in and request access.";
  if (lower.includes("invalid_email")) return "Please enter a valid email address.";
  if (lower.includes("rate_limit_exceeded")) return "Too many invites sent recently. Please try again later.";
  if (lower.includes("organization_not_found")) return "Organization not found.";
  return msg;
};

/**
 * useManageOrganizations — organization identity CRUD for super-admins.
 *
 * @param {object}   opts
 * @param {boolean}  opts.enabled        When false, hook issues no RPCs and returns inert state.
 * @param {Function} opts.setMessage     Toast setter.
 * @param {Function} opts.incLoading     Increment global loading counter.
 * @param {Function} opts.decLoading     Decrement global loading counter.
 * @param {Function} opts.onDirtyChange  (isDirty: boolean) → called when dirty state changes.
 */
export function useManageOrganizations({
  enabled,
  setMessage,
  incLoading,
  decLoading,
  onDirtyChange,
}) {
  const [orgList, setOrgList] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // ── Create modal ──────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createError, setCreateError] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState(EMPTY_CREATE_ERRORS);
  const createOrigRef = useRef(EMPTY_CREATE);

  // ── Edit modal ────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editError, setEditError] = useState("");
  const editOrigRef = useRef(EMPTY_EDIT);
  const [applicationActionLoading, setApplicationActionLoading] = useState({ id: "", action: "" });

  // ── Invite loading ─────────────────────────────────────────────
  const [inviteLoading, setInviteLoading] = useState(false);

  // ── Load ──────────────────────────────────────────────────
  const loadOrgs = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await listOrganizations();
      setOrgList(data);
    } catch (e) {
      setError(e?.message || "Could not load organizations.");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    loadOrgs();
  }, [enabled, loadOrgs]);

  // ── Realtime: auto-refresh on org/application/membership changes ──
  useEffect(() => {
    if (!enabled) return;
    const timerRef = { current: null };
    const schedule = () => {
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        loadOrgs();
      }, 600);
    };
    const channel = supabase
      .channel("orgs-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "organizations" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "org_applications" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "memberships" }, schedule)
      .subscribe();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, loadOrgs]);

  // ── Dirty state tracking ──────────────────────────────────
  const createDirty = useMemo(() => {
    if (!showCreate) return false;
    const orig = createOrigRef.current;
    return (
      createForm.name !== orig.name ||
      createForm.code !== orig.code ||
      createForm.shortLabel !== orig.shortLabel ||
      createForm.contact_email !== orig.contact_email ||
      createForm.status !== orig.status
    );
  }, [showCreate, createForm]);

  const editDirty = useMemo(() => {
    if (!showEdit) return false;
    const orig = editOrigRef.current;
    return (
      editForm.name !== orig.name ||
      editForm.shortLabel !== orig.shortLabel ||
      editForm.contact_email !== orig.contact_email ||
      editForm.status !== orig.status
    );
  }, [showEdit, editForm]);

  const isDirty = createDirty || editDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Warn before browser close if dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Search / filter ───────────────────────────────────────
  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgList;
    return orgList.filter(
      (o) =>
        String(o.code || "").toLowerCase().includes(q) ||
        String(o.shortLabel || "").toLowerCase().includes(q) ||
        String(o.name || "").toLowerCase().includes(q)
    );
  }, [orgList, search]);

  // ── Modal openers / closers ───────────────────────────────
  const openCreate = useCallback(() => {
    const blank = { ...EMPTY_CREATE };
    setCreateForm(blank);
    createOrigRef.current = blank;
    setCreateError("");
    setShowCreate(true);
  }, []);

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setCreateForm(EMPTY_CREATE);
    setCreateError("");
    setCreateFieldErrors(EMPTY_CREATE_ERRORS);
  }, []);

  const openEdit = useCallback((org) => {
    const snapshot = {
      id: org.id,
      name: org.name || "",
      code: org.code,
      shortLabel: String(org.code || "").toUpperCase(),
      contact_email: org.contact_email || "",
      status: org.status,
      created_at: org.created_at,
      updated_at: org.updated_at,
    };
    setEditForm(snapshot);
    editOrigRef.current = { ...snapshot };
    setEditError("");
    setShowEdit(true);
  }, []);

  const closeEdit = useCallback(() => {
    setShowEdit(false);
    setEditForm(EMPTY_EDIT);
    setEditError("");
  }, []);

  // ── Validation helpers ────────────────────────────────────
  const validateCreate = useCallback(
    (form) => {
      const code = String(form.code || form.shortLabel || "").trim().toLowerCase().replace(/\s+/g, "-");
      if (!code) return "Code is required.";
      if (!CODE_RE.test(code)) return "Code must be a lowercase slug (e.g. tedu-ee).";
      if (orgList.some((o) => o.code === code)) return `Code "${code}" already exists.`;
      if (!String(form.shortLabel || "").trim()) return "Short Label is required.";
      const name = String(form.name || "").trim();
      if (!name) {
        return "Organization name is required.";
      }
      if (!VALID_STATUSES.includes(form.status || "active")) return "Invalid status.";
      return null;
    },
    [orgList]
  );

  const validateEdit = useCallback((form) => {
    if (!String(form.name || "").trim()) return "Organization name is required.";
    if (!String(form.shortLabel || "").trim()) return "Short Label is required.";
    const slug = String(form.shortLabel || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!CODE_RE.test(slug)) return "Short Label must be slug-compatible (e.g. TEDU-EE).";
    if (!VALID_STATUSES.includes(form.status)) return "Invalid status.";
    return null;
  }, []);

  // ── Create handler ────────────────────────────────────────
  const handleCreateOrg = useCallback(async () => {
    if (!enabled) return;
    const labelVal = String(createForm.shortLabel || "").trim();
    const emailVal = String(createForm.contact_email || "").trim();
    const fieldErrs = {
      shortLabel: !labelVal ? "Code is required." : (!CODE_RE.test(labelVal.toLowerCase().replace(/\s+/g, "-")) ? "Use a slug-compatible code (e.g. TEDU-EE)." : ""),
      contact_email: !emailVal ? "Contact email is required." : (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal) ? "Enter a valid email address." : ""),
    };
    if (Object.values(fieldErrs).some(Boolean)) {
      setCreateFieldErrors(fieldErrs);
      return;
    }
    setCreateFieldErrors(EMPTY_CREATE_ERRORS);
    const validationError = validateCreate(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError("");
    setError("");
    incLoading();
    try {
      const code = String(createForm.code || createForm.shortLabel || "").trim().toLowerCase().replace(/\s+/g, "-");
      const shortLabel = String(createForm.shortLabel || code).trim().toUpperCase();
      const name = String(createForm.name || "").trim();
      await createOrganization({
        name,
        code,
        shortLabel,
        contact_email: String(createForm.contact_email || "").trim() || null,
        status: createForm.status || "active",
      });
      closeCreate();
      await loadOrgs();
      setMessage?.("Organization created.");
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        setCreateError("An organization with this code already exists.");
      } else {
        setCreateError(msg || "Could not create organization.");
      }
    } finally {
      decLoading();
    }
  }, [enabled, createForm, validateCreate, closeCreate, loadOrgs, setMessage, incLoading, decLoading]);

  // ── Update handler ────────────────────────────────────────
  const handleUpdateOrg = useCallback(async () => {
    if (!enabled) return;
    const validationError = validateEdit(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    setEditError("");
    setError("");
    incLoading();
    try {
      const shortLabel = String(editForm.shortLabel || editForm.code || "").trim().toUpperCase();
      const code = shortLabel.toLowerCase().replace(/\s+/g, "-");
      await updateOrganization({
        organizationId: editForm.id,
        name: String(editForm.name || "").trim(),
        code,
        shortLabel,
        contact_email: String(editForm.contact_email || "").trim() || null,
        status: editForm.status,
      });
      closeEdit();
      await loadOrgs();
      setMessage?.("Organization updated.");
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("organization_not_found")) {
        setEditError("Organization not found. It may have been removed.");
      } else {
        setEditError(msg || "Could not update organization.");
      }
    } finally {
      decLoading();
    }
  }, [enabled, editForm, validateEdit, closeEdit, loadOrgs, setMessage, incLoading, decLoading]);

  const handleApproveApplication = useCallback(async (applicationId) => {
    if (!enabled || !applicationId) return;
    setError("");
    setApplicationActionLoading({ id: applicationId, action: "approve" });
    incLoading();
    try {
      // Capture application data before the action (list refreshes after)
      const appData = orgList
        .flatMap((o) => (o.pendingApplications || []).map((a) => ({ ...a, orgId: o.id, orgName: o.name })))
        .find((a) => a.applicationId === applicationId);

      const result = await approveApplication(applicationId);

      // If the applicant has no Supabase Auth account yet, send an invite so
      // they can set a password and gain access. The invite-org-admin Edge
      // Function creates the auth user + an invited membership row.
      if (result?.membership_created === false && appData?.email && appData?.orgId) {
        try {
          // Pass approvalFlow=true so the Edge Function creates an 'active'
          // membership directly. The invite email is still sent so the user
          // can set their password, but the admin panel shows them as active
          // immediately rather than stuck in the 'Invited' state.
          await inviteOrgAdmin(appData.orgId, appData.email, true);
        } catch (inviteErr) {
          console.warn("Auto-invite after approval failed:", inviteErr?.message);
        }
      }

      // Fire-and-forget notification (never blocks approve flow)
      if (appData?.email) {
        notifyApplication({
          type: "application_approved",
          applicationId,
          recipientEmail: appData.email,
          applicantName: appData.name,
          organizationId: appData.orgId,
          organizationName: appData.orgName,
        });
      }

      await loadOrgs();
      setMessage?.("Application approved.");
    } catch (e) {
      const msg = String(e?.message || "");
      setError(msg || "Could not approve application.");
    } finally {
      setApplicationActionLoading({ id: "", action: "" });
      decLoading();
    }
  }, [enabled, orgList, loadOrgs, setMessage, incLoading, decLoading]);

  const handleRejectApplication = useCallback(async (applicationId) => {
    if (!enabled || !applicationId) return;
    setError("");
    setApplicationActionLoading({ id: applicationId, action: "reject" });
    incLoading();
    try {
      // Capture application data before the action (list refreshes after)
      const appData = orgList
        .flatMap((o) => (o.pendingApplications || []).map((a) => ({ ...a, orgId: o.id, orgName: o.name })))
        .find((a) => a.applicationId === applicationId);

      await rejectApplication(applicationId);

      // Fire-and-forget notification (never blocks reject flow)
      if (appData?.email) {
        notifyApplication({
          type: "application_rejected",
          applicationId,
          recipientEmail: appData.email,
          applicantName: appData.name,
          organizationId: appData.orgId,
          organizationName: appData.orgName,
        });
      }

      await loadOrgs();
      setMessage?.("Application rejected.");
    } catch (e) {
      const msg = String(e?.message || "");
      setError(msg || "Could not reject application.");
    } finally {
      setApplicationActionLoading({ id: "", action: "" });
      decLoading();
    }
  }, [enabled, orgList, loadOrgs, setMessage, incLoading, decLoading]);

  const handleUpdateTenantAdmin = useCallback(async ({ organizationId, userId, name, email }) => {
    if (!enabled || !organizationId || !userId) return false;
    setError("");
    incLoading();
    try {
      const cleanName = String(name || "").trim();
      const cleanEmail = String(email || "").trim().toLowerCase();
      await updateMemberAdmin({
        organizationId,
        userId,
        name: cleanName,
        email: cleanEmail,
      });
      await loadOrgs();
      setMessage?.("Admin updated.");
      return true;
    } catch (e) {
      const msg = String(e?.message || "");
      setError(msg || "Could not update admin.");
      return false;
    } finally {
      decLoading();
    }
  }, [enabled, loadOrgs, setMessage, incLoading, decLoading]);

  const handleDeleteTenantAdmin = useCallback(async ({ organizationId, userId }) => {
    if (!enabled || !organizationId || !userId) return false;
    setError("");
    incLoading();
    try {
      await deleteMemberHard({ organizationId, userId });
      await loadOrgs();
      setMessage?.("Admin deleted.");
      return true;
    } catch (e) {
      const msg = String(e?.message || "");
      setError(msg || "Could not delete admin.");
      return false;
    } finally {
      decLoading();
    }
  }, [enabled, loadOrgs, setMessage, incLoading, decLoading]);

  const handleCreateTenantAdminApplication = useCallback(async ({
    organizationId,
    name,
    email,
    password,
  }) => {
    if (!enabled || !organizationId) return { ok: false, error: "Organization is missing." };
    setError("");
    incLoading();
    try {
      await submitApplication({
        organizationId,
        name: String(name || "").trim(),
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
      });
      await loadOrgs();
      setMessage?.("Admin application created.");
      return { ok: true };
    } catch (e) {
      const friendly = normalizeAdminApplicationError(e?.message || "");
      setError(friendly);
      return { ok: false, error: friendly };
    } finally {
      decLoading();
    }
  }, [enabled, loadOrgs, setMessage, incLoading, decLoading]);

  const handleInviteAdmin = useCallback(async (orgId, email) => {
    if (!enabled || !orgId) return { ok: false, error: "Organization is missing." };
    setError("");
    setInviteLoading(true);
    try {
      const result = await inviteOrgAdmin(orgId, email);
      await loadOrgs();
      if (result.status === "added") {
        setMessage?.("Admin added — they already had an account.");
      } else if (result.status === "reinvited") {
        setMessage?.(`Invite resent to ${email}.`);
      } else {
        setMessage?.(`Invitation sent to ${email}.`);
      }
      return { ok: true, status: result.status };
    } catch (e) {
      const msg = normalizeAdminInviteError(e?.message || "");
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setInviteLoading(false);
    }
  }, [enabled, loadOrgs, setMessage]);

  const handleCancelInvite = useCallback(async (membershipId) => {
    if (!enabled || !membershipId) return;
    setInviteLoading(true);
    try {
      await cancelOrgAdminInvite(membershipId);
      await loadOrgs();
      setMessage?.("Invite cancelled.");
    } catch (e) {
      setError(e?.message || "Could not cancel invite.");
    } finally {
      setInviteLoading(false);
    }
  }, [enabled, loadOrgs, setMessage]);

  // ── Join Request Management ──────────────────────────────
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);

  const handleApproveJoinRequest = useCallback(async (membershipId) => {
    if (!enabled || !membershipId) return;
    setJoinRequestLoading(true);
    try {
      await approveJoinRequest(membershipId);
      await loadOrgs();
      setMessage?.("Join request approved.");
    } catch (e) {
      setError(e?.message || "Could not approve join request.");
    } finally {
      setJoinRequestLoading(false);
    }
  }, [enabled, loadOrgs, setMessage]);

  const handleRejectJoinRequest = useCallback(async (membershipId) => {
    if (!enabled || !membershipId) return;
    setJoinRequestLoading(true);
    try {
      await rejectJoinRequest(membershipId);
      await loadOrgs();
      setMessage?.("Join request rejected.");
    } catch (e) {
      setError(e?.message || "Could not reject join request.");
    } finally {
      setJoinRequestLoading(false);
    }
  }, [enabled, loadOrgs, setMessage]);

  return {
    orgList,
    filteredOrgs,
    error,
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
    handleApproveApplication,
    handleRejectApplication,
    applicationActionLoading,
    handleCreateTenantAdminApplication,
    handleUpdateTenantAdmin,
    handleDeleteTenantAdmin,

    isDirty,
    loadOrgs,

    inviteLoading,
    handleInviteAdmin,
    handleCancelInvite,

    joinRequestLoading,
    handleApproveJoinRequest,
    handleRejectJoinRequest,
  };
}
