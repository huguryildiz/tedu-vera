// src/shared/api/admin/auth.js
// ============================================================
// Admin authentication functions.
// v1: password-based (legacy, kept for backward compatibility).
// v2: JWT-based via Supabase Auth (Phase C).
// ============================================================

import { supabase } from "../core/client";
import { callAdminRpc, callAdminRpcV2 } from "../transport";

/**
 * Validates an admin password against the database.
 *
 * @param {string} password - The admin password to validate.
 * @returns {Promise<boolean>} True when the password is correct.
 * @throws {Error} With `adminLocked=true` and `lockedUntil` if too many attempts.
 */
export async function adminLogin(password) {
  const data = await callAdminRpc("rpc_admin_login", { p_password: password });
  const row = data?.[0] ?? {};
  if (!row.ok && row.locked_until) {
    const e = new Error("Too many failed attempts.");
    e.adminLocked = true;
    e.lockedUntil = row.locked_until;
    throw e;
  }
  return !!row.ok;
}

/**
 * Returns the current admin security configuration state.
 * Does not require an admin password.
 *
 * @returns {Promise<{admin_password_set: boolean, delete_password_set: boolean, backup_password_set: boolean}>}
 */
export async function adminSecurityState() {
  const { data, error } = await supabase.rpc("rpc_admin_security_state");
  if (error) throw error;
  return data?.[0] || {
    admin_password_set:  false,
    delete_password_set: false,
    backup_password_set: false,
  };
}

// ── v2 Auth Functions (Phase C) ──────────────────────────────

/**
 * Returns the current user's tenant memberships and roles.
 * Requires a valid Supabase Auth session (JWT).
 */
export async function adminGetSession() {
  return callAdminRpcV2("rpc_admin_auth_get_session");
}

/**
 * Lists active tenants for the application form dropdown.
 * Public RPC (works before authentication).
 */
export async function listTenantsPublic() {
  return callAdminRpcV2("rpc_admin_tenant_list_public");
}

/**
 * Submit a tenant admin application (anon-accessible — no auth required).
 * Password is hashed server-side and stored until approval.
 */
export async function submitAdminApplication({ tenantId, email, password, name, university, department }) {
  const { data, error } = await supabase.rpc("rpc_admin_application_submit", {
    p_tenant_id: tenantId,
    p_email: email,
    p_password: password,
    p_name: name,
    p_university: university || "",
    p_department: department || "",
  });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    const details = String(error.details || "").toLowerCase();
    if (error.code === "23505" && (msg.includes("taa_pending_email_tenant_unique") || details.includes("taa_pending_email_tenant_unique"))) {
      const e = new Error("application_already_pending");
      e.code = error.code;
      throw e;
    }
    throw error;
  }
  return data;
}

/**
 * Get the current user's applications.
 */
export async function getMyApplications() {
  return callAdminRpcV2("rpc_admin_application_get_mine");
}

/**
 * Cancel a pending application (own only).
 */
export async function cancelAdminApplication(applicationId) {
  return callAdminRpcV2("rpc_admin_application_cancel", {
    p_application_id: applicationId,
  });
}

/**
 * Approve a pending admin application (tenant-admin or super-admin).
 */
export async function approveAdminApplication(applicationId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  try {
    const { data, error } = await supabase.functions.invoke("approve-admin-application", {
      body: { application_id: applicationId },
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
    });
    if (error) throw error;
    if (data?.error) {
      const e = new Error(data.error);
      e.code = data.code;
      throw e;
    }
    return data?.data ?? true;
  } catch (err) {
    // FunctionsHttpError.message is generic ("Edge Function returned a non-2xx status code").
    // Try to surface the JSON body from the function response.
    const fallback = String(err?.message || "Could not approve application.");
    const response = err?.context;
    if (!response || typeof response.text !== "function") {
      throw err;
    }
    try {
      const raw = await response.text();
      if (!raw) throw err;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const detailed = parsed?.error || parsed?.message || raw;
      const e = new Error(String(detailed || fallback));
      if (parsed?.code) e.code = parsed.code;
      throw e;
    } catch {
      throw err;
    }
  }
}

/**
 * Reject a pending admin application (tenant-admin or super-admin).
 */
export async function rejectAdminApplication(applicationId) {
  return callAdminRpcV2("rpc_admin_application_reject", {
    p_application_id: applicationId,
  });
}

/**
 * List pending applications for a tenant (admin dashboard).
 */
export async function listPendingApplications(tenantId) {
  return callAdminRpcV2("rpc_admin_application_list_pending", {
    p_tenant_id: tenantId,
  });
}
