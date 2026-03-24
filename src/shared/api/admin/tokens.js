// src/shared/api/admin/tokens.js
// ============================================================
// Admin jury entry token management functions.
// ============================================================

import { callAdminRpc, rethrowUnauthorized } from "../transport";

/**
 * Generates a new jury entry token for a semester. The raw token is
 * returned once and should be stored or shared immediately.
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<string|null>} The raw token string, or null on failure.
 */
export async function adminGenerateEntryToken(semesterId, adminPassword) {
  try {
    const rows = await callAdminRpc("rpc_admin_generate_entry_token", {
      p_semester_id:    semesterId,
      p_admin_password: adminPassword,
    });
    return rows?.[0]?.raw_token || null;
  } catch (e) { rethrowUnauthorized(e); throw e; }
}

/**
 * Revokes the active jury entry token for a semester, preventing new logins.
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminRevokeEntryToken(semesterId, adminPassword) {
  try {
    await callAdminRpc("rpc_admin_revoke_entry_token", {
      p_semester_id:    semesterId,
      p_admin_password: adminPassword,
    });
    return true;
  } catch (e) { rethrowUnauthorized(e); throw e; }
}

/**
 * Returns the current entry token status for a semester.
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<{token_active: boolean, expires_at: string|null}|null>}
 */
export async function adminGetEntryTokenStatus(semesterId, adminPassword) {
  try {
    const rows = await callAdminRpc("rpc_admin_get_entry_token_status", {
      p_semester_id:    semesterId,
      p_admin_password: adminPassword,
    });
    return rows?.[0] || null;
  } catch (e) { rethrowUnauthorized(e); throw e; }
}
