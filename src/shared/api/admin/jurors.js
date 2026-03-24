// src/shared/api/admin/jurors.js
// ============================================================
// Admin juror management functions.
// ============================================================

import { callAdminRpc } from "../transport";

/**
 * @typedef {object} JurorRow
 * @property {string}       jurorId           UUID (mapped from juror_id).
 * @property {string}       juryName          Display name (mapped from juror_name).
 * @property {string}       juryDept          Institution / department (mapped from juror_inst).
 * @property {boolean}      isAssigned        Whether the juror is assigned to this semester.
 * @property {boolean}      editEnabled       Whether re-edit mode is currently active.
 * @property {string}       finalSubmittedAt  ISO timestamp of final submission, or "".
 * @property {boolean}      finalSubmitted    True when finalSubmittedAt is set.
 * @property {string}       lastActivityAt    ISO timestamp of last scoring activity, or "".
 * @property {number}       lastActivityMs    Unix ms of lastActivityAt, or 0.
 * @property {number}       totalProjects     Number of projects assigned.
 * @property {number}       completedProjects Number of projects fully scored.
 * @property {string|null}  lockedUntil       ISO timestamp while login is locked, or null.
 * @property {boolean}      isLocked          Whether the juror's login is currently locked.
 */

/**
 * Creates a new juror.
 *
 * @param {{juror_name: string, juror_inst: string}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<{juror_id: string, juror_name: string, juror_inst: string}|null>}
 */
export async function adminCreateJuror(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_create_juror", {
    p_juror_name:     payload.juror_name,
    p_juror_inst:     payload.juror_inst,
    p_admin_password: adminPassword,
  });
  return data?.[0] || null;
}

/**
 * Updates a juror's name and institution.
 *
 * @param {{jurorId: string, juror_name: string, juror_inst: string}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminUpdateJuror(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_update_juror", {
    p_juror_id:       payload.jurorId,
    p_juror_name:     payload.juror_name,
    p_juror_inst:     payload.juror_inst,
    p_admin_password: adminPassword,
  });
  return data === true;
}

/**
 * Resets a juror's PIN for a specific semester. The new PIN is returned
 * once and should be displayed immediately to the admin.
 *
 * @param {{semesterId: string, jurorId: string}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<{pin_plain_once: string, juror_name: string, juror_inst: string}|null>}
 */
export async function adminResetJurorPin(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_reset_juror_pin", {
    p_semester_id:    payload.semesterId,
    p_juror_id:       payload.jurorId,
    p_admin_password: adminPassword,
  });
  return data?.[0] || null;
}

/**
 * Enables re-edit mode for a juror who has already submitted. Only `enabled=true`
 * is allowed from the admin side — closing edit mode requires juror resubmission.
 *
 * @param {{semesterId: string, jurorId: string, enabled: boolean}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminSetJurorEditMode(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_set_juror_edit_mode", {
    p_semester_id:    payload.semesterId,
    p_juror_id:       payload.jurorId,
    p_enabled:        !!payload.enabled,
    p_admin_password: adminPassword,
  });
  return data === true;
}

/**
 * Force-closes re-edit mode for a juror without waiting for resubmission.
 * Use sparingly — prefer letting the juror resubmit normally.
 *
 * @param {{semesterId: string, jurorId: string}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminForceCloseJurorEditMode(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_force_close_juror_edit_mode", {
    p_semester_id:    payload.semesterId,
    p_juror_id:       payload.jurorId,
    p_admin_password: adminPassword,
  });
  return data === true;
}

/**
 * Permanently deletes a juror and all their associated score data.
 *
 * @param {string} jurorId       - UUID of the juror to delete.
 * @param {string} deletePassword - Delete password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminDeleteJuror(jurorId, deletePassword) {
  const data = await callAdminRpc("rpc_admin_delete_juror", {
    p_juror_id:        jurorId,
    p_delete_password: deletePassword,
  });
  return data === true;
}
