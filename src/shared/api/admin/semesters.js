// src/shared/api/admin/semesters.js
// ============================================================
// Admin semester management functions.
// ============================================================

import { callAdminRpc } from "../transport";

// ── Shared typedefs ───────────────────────────────────────────

/**
 * @typedef {object} SemesterRow
 * @property {string}       id           UUID primary key.
 * @property {string}       name         Display name (e.g. "2026 Spring").
 * @property {boolean}      is_active    Whether this is the current active semester.
 * @property {boolean}      is_locked    Whether scoring is locked for this semester.
 * @property {string}       poster_date  ISO date string (YYYY-MM-DD) of poster day.
 * @property {string|null}  updated_at   ISO timestamp of last update.
 */

/**
 * Sets the active semester. Only one semester can be active at a time.
 *
 * @param {string} semesterId    - UUID of the semester to activate.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<void>}
 */
export async function adminSetActiveSemester(semesterId, adminPassword) {
  return callAdminRpc("rpc_admin_set_active_semester", {
    p_semester_id:    semesterId,
    p_admin_password: adminPassword,
  });
}

/**
 * Creates a new semester.
 *
 * @param {{name: string, poster_date: string}} payload - Semester fields.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<SemesterRow|null>} The created semester row, or null.
 */
export async function adminCreateSemester(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_create_semester", {
    p_name:              payload.name,
    p_poster_date:       payload.poster_date,
    p_criteria_template: payload.criteria_template ?? null,
    p_mudek_template:    payload.mudek_template ?? null,
    p_admin_password:    adminPassword,
  });
  return data?.[0] || null;
}

/**
 * Updates name, poster date, and optionally the criteria template of a semester.
 * Pass `criteria_template` in the payload to update it; omit to preserve the existing value.
 *
 * @param {{id: string, name: string, poster_date: string, criteria_template?: Array}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminUpdateSemester(payload, adminPassword) {
  await callAdminRpc("rpc_admin_update_semester", {
    p_semester_id:       payload.id,
    p_name:              payload.name,
    p_poster_date:       payload.poster_date,
    p_criteria_template: payload.criteria_template ?? null,
    p_mudek_template:    payload.mudek_template ?? null,
    p_admin_password:    adminPassword,
  });
  return true;
}

/**
 * Updates only the criteria template for a semester (name + poster_date must also be provided
 * since the underlying RPC validates the name field).
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} name          - Current semester name (required by RPC).
 * @param {string|null} posterDate - Current poster date (may be null).
 * @param {Array<{key: string, label: string, max: number}>} template - New criteria template.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminUpdateSemesterCriteriaTemplate(semesterId, name, posterDate, template, adminPassword) {
  await callAdminRpc("rpc_admin_update_semester", {
    p_semester_id:       semesterId,
    p_name:              name,
    p_poster_date:       posterDate || null,
    p_criteria_template: template,
    p_admin_password:    adminPassword,
  });
  return true;
}

/**
 * Updates only the MUDEK template for a semester (name + poster_date must also be provided
 * since the underlying RPC validates the name field).
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} name          - Current semester name (required by RPC).
 * @param {string|null} posterDate - Current poster date (may be null).
 * @param {Array<{id: string, code: string, desc_en: string, desc_tr: string}>} template - New MUDEK template.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminUpdateSemesterMudekTemplate(semesterId, name, posterDate, template, adminPassword) {
  await callAdminRpc("rpc_admin_update_semester", {
    p_semester_id:    semesterId,
    p_name:           name,
    p_poster_date:    posterDate || null,
    p_mudek_template: template,
    p_admin_password: adminPassword,
  });
  return true;
}

/**
 * Permanently deletes a semester and all associated data.
 * Requires the separate delete password (not the admin password).
 *
 * @param {string} semesterId     - UUID of the semester to delete.
 * @param {string} deletePassword - Delete password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminDeleteSemester(semesterId, deletePassword) {
  const data = await callAdminRpc("rpc_admin_delete_semester", {
    p_semester_id:     semesterId,
    p_delete_password: deletePassword,
  });
  return data === true;
}
