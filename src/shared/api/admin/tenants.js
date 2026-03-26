// src/shared/api/admin/tenants.js
// ============================================================
// Admin tenant/organization management functions (v2 — JWT-based auth).
// Super-admin only — all RPCs call _assert_super_admin().
//
// Field mapping: the DB column is `short_label`, and the client
// also uses `shortLabel` for clarity. Mapping happens here at the
// API boundary so components never see raw DB column names.
// ============================================================

import { callAdminRpcV2 } from "../transport";

/**
 * @typedef {object} TenantRow
 * @property {string} id
 * @property {string} code
 * @property {string} shortLabel
 * @property {string} university
 * @property {string} department
 * @property {string} status
 * @property {string} created_at
 * @property {string} updated_at
 * @property {{userId: string, name: string, email: string, status: "approved", updatedAt: string}[]} tenantAdmins
 * @property {{applicationId: string, name: string, email: string, status: "pending", createdAt: string}[]} pendingApplications
 */

/**
 * Maps a raw RPC row (with `short_label`) to client shape (with `shortLabel`).
 * @param {object} row
 * @returns {TenantRow}
 */
function mapAdmins(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((entry) => ({
      userId: String(entry?.user_id || entry?.userId || entry?.id || "").trim(),
      name: String(entry?.name || "").trim() || String(entry?.email || "").trim() || "Unknown",
      email: String(entry?.email || "").trim(),
      status: "approved",
      updatedAt: String(entry?.updated_at || entry?.updatedAt || "").trim(),
    }))
    .filter((entry) => entry.email !== "");
}

function mapPending(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((entry) => ({
      applicationId: String(entry?.application_id || "").trim(),
      name: String(entry?.name || "").trim() || String(entry?.email || "").trim() || "Unknown",
      email: String(entry?.email || "").trim(),
      status: "pending",
      createdAt: String(entry?.created_at || "").trim(),
    }))
    .filter((entry) => entry.applicationId !== "");
}

export function mapTenantRow(row) {
  return {
    ...row,
    shortLabel: row.short_label,
    tenantAdmins: mapAdmins(row?.tenant_admins),
    pendingApplications: mapPending(row?.pending_applications),
  };
}

/**
 * Sort comparator: code ascending (case-insensitive).
 */
function byCodeAsc(a, b) {
  return a.code.localeCompare(b.code);
}

/**
 * Lists all tenants. Super-admin only.
 * Returns rows sorted by `code` ascending.
 * @returns {Promise<TenantRow[]>}
 */
export async function adminListTenants() {
  const data = await callAdminRpcV2("rpc_admin_tenant_list");
  return (data || []).map(mapTenantRow).sort(byCodeAsc);
}

/**
 * Creates a new tenant. Super-admin only.
 * @param {{ code: string, shortLabel: string, university: string, department: string }} payload
 * @returns {Promise<string>} The new tenant's UUID.
 */
export async function adminCreateTenant(payload) {
  return callAdminRpcV2("rpc_admin_tenant_create", {
    p_code:       payload.code,
    p_short_label: payload.shortLabel,
    p_university:  payload.university,
    p_department:  payload.department,
  });
}

/**
 * Updates a tenant's identity and/or status. Super-admin only.
 * Pass only the fields you want to change; others default to NULL
 * (RPC uses COALESCE to keep existing values).
 * @param {{ tenantId: string, shortLabel?: string, university?: string, department?: string, status?: string }} payload
 * @returns {Promise<boolean>}
 */
export async function adminUpdateTenant(payload) {
  const data = await callAdminRpcV2("rpc_admin_tenant_update", {
    p_tenant_id:   payload.tenantId,
    p_short_label: payload.shortLabel ?? null,
    p_university: payload.university ?? null,
    p_department: payload.department ?? null,
    p_status:     payload.status ?? null,
  });
  return data === true;
}

/**
 * Updates an approved organization admin (name and/or email). Super-admin only.
 * @param {{ tenantId: string, userId: string, name?: string, email?: string }} payload
 * @returns {Promise<boolean>}
 */
export async function adminUpdateTenantAdmin(payload) {
  const data = await callAdminRpcV2("rpc_admin_tenant_admin_update", {
    p_tenant_id: payload.tenantId,
    p_user_id: payload.userId,
    p_name: payload.name ?? null,
    p_email: payload.email ?? null,
  });
  return data === true;
}

/**
 * Hard-deletes an approved organization admin from auth/profile/memberships.
 * Super-admin only.
 * @param {{ tenantId: string, userId: string }} payload
 * @returns {Promise<boolean>}
 */
export async function adminDeleteTenantAdminHard(payload) {
  const data = await callAdminRpcV2("rpc_admin_tenant_admin_delete_hard", {
    p_tenant_id: payload.tenantId,
    p_user_id: payload.userId,
  });
  return data === true;
}
