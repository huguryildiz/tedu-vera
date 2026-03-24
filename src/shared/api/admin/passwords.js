// src/shared/api/admin/passwords.js
// ============================================================
// Admin password management functions.
// ============================================================

import { callAdminRpc } from "../transport";

/**
 * Changes the admin password. Requires the current password.
 *
 * @param {string} currentPassword - The current admin password.
 * @param {string} newPassword     - The new admin password to set.
 * @returns {Promise<object|null>} Result row or null.
 */
export async function adminChangePassword(currentPassword, newPassword) {
  const data = await callAdminRpc("rpc_admin_change_password", {
    p_current_password: currentPassword,
    p_new_password:     newPassword,
  });
  return data?.[0] || null;
}

/**
 * Sets the initial admin password when none has been configured yet.
 * Fails if an admin password is already set.
 *
 * @param {string} newPassword - The initial admin password to set.
 * @returns {Promise<object|null>} Result row or null.
 */
export async function adminBootstrapPassword(newPassword) {
  const data = await callAdminRpc("rpc_admin_bootstrap_password", {
    p_new_password: newPassword,
  });
  return data?.[0] || null;
}

/**
 * Sets the initial backup (export) password when none has been configured yet.
 *
 * @param {string} newPassword   - The initial backup password to set.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminBootstrapBackupPassword(newPassword, adminPassword) {
  const data = await callAdminRpc("rpc_admin_bootstrap_backup_password", {
    p_new_password:   newPassword,
    p_admin_password: adminPassword,
  });
  return data === true;
}

/**
 * Sets the initial delete password when none has been configured yet.
 *
 * @param {string} newPassword   - The initial delete password to set.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminBootstrapDeletePassword(newPassword, adminPassword) {
  const data = await callAdminRpc("rpc_admin_bootstrap_delete_password", {
    p_new_password:   newPassword,
    p_admin_password: adminPassword,
  });
  return data === true;
}

/**
 * Changes the backup (export) password. Requires the current backup password.
 *
 * @param {string} currentPassword - The current backup password.
 * @param {string} newPassword     - The new backup password.
 * @param {string} adminPassword   - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminChangeBackupPassword(currentPassword, newPassword, adminPassword) {
  const data = await callAdminRpc("rpc_admin_change_backup_password", {
    p_current_password: currentPassword,
    p_new_password:     newPassword,
    p_admin_password:   adminPassword,
  });
  return data === true;
}

/**
 * Changes the delete password. Requires the current delete password.
 *
 * @param {string} currentPassword - The current delete password.
 * @param {string} newPassword     - The new delete password.
 * @param {string} adminPassword   - Admin password for authorization.
 * @returns {Promise<boolean|object|null>} True or result row on success.
 */
export async function adminChangeDeletePassword(currentPassword, newPassword, adminPassword) {
  const data = await callAdminRpc("rpc_admin_change_delete_password", {
    p_current_password: currentPassword,
    p_new_password:     newPassword,
    p_admin_password:   adminPassword,
  });
  return data === true || data?.[0] || null;
}
