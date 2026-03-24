// src/shared/api/admin/export.js
// ============================================================
// Admin export / import functions.
// ============================================================

import { callAdminRpc } from "../transport";

/**
 * Exports the full database as a serialized backup blob.
 * Requires both the backup password and admin password.
 *
 * @param {string} backupPassword - Backup password for authorization.
 * @param {string} adminPassword  - Admin password for authorization.
 * @returns {Promise<object>} Serialized backup data.
 */
export async function adminFullExport(backupPassword, adminPassword) {
  return callAdminRpc("rpc_admin_full_export", {
    p_backup_password: backupPassword,
    p_admin_password:  adminPassword,
  });
}

/**
 * Imports a full backup, replacing all data.
 * Requires both the backup password and admin password.
 *
 * @param {object} backup         - Backup data returned by `adminFullExport`.
 * @param {string} backupPassword - Backup password for authorization.
 * @param {string} adminPassword  - Admin password for authorization.
 * @returns {Promise<void>}
 */
export async function adminFullImport(backup, backupPassword, adminPassword) {
  return callAdminRpc("rpc_admin_full_import", {
    p_backup_password: backupPassword,
    p_admin_password:  adminPassword,
    p_data:            backup,
  });
}
