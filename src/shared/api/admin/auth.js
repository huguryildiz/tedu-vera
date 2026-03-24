// src/shared/api/admin/auth.js
// ============================================================
// Admin authentication functions.
// ============================================================

import { supabase } from "../core/client";
import { callAdminRpc } from "../transport";

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
