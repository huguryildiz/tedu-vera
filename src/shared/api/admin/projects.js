// src/shared/api/admin/projects.js
// ============================================================
// Admin project management functions.
// ============================================================

import { callAdminRpc } from "../transport";

/**
 * @typedef {object} ProjectRow
 * @property {string}       id              UUID primary key.
 * @property {string}       semester_id     Foreign key -> semesters.id.
 * @property {number}       group_no        Group number (1-based).
 * @property {string}       project_title   Title of the project / group name.
 * @property {string}       group_students  Newline-separated student names.
 * @property {string|null}  updated_at      ISO timestamp of last update.
 */

/**
 * Lists all projects for a semester.
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<ProjectRow[]>} Array of project rows.
 */
export async function adminListProjects(semesterId, adminPassword) {
  const data = await callAdminRpc("rpc_admin_list_projects", {
    p_semester_id:    semesterId,
    p_admin_password: adminPassword,
  });
  return data || [];
}

/**
 * Creates a new project in a semester.
 *
 * @param {{semesterId: string, group_no: number, project_title: string, group_students: string}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<{project_id: string}|null>} Object with the new project's UUID, or null.
 */
export async function adminCreateProject(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_create_project", {
    p_semester_id:    payload.semesterId,
    p_group_no:       payload.group_no,
    p_project_title:  payload.project_title,
    p_group_students: payload.group_students,
    p_admin_password: adminPassword,
  });
  return data?.[0] || null;
}

/**
 * Updates an existing project (upsert by group_no within the semester).
 *
 * @param {{semesterId: string, group_no: number, project_title: string, group_students: string}} payload
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<{project_id: string}|null>} Object with the project's UUID, or null.
 */
export async function adminUpsertProject(payload, adminPassword) {
  const data = await callAdminRpc("rpc_admin_upsert_project", {
    p_semester_id:    payload.semesterId,
    p_group_no:       payload.group_no,
    p_project_title:  payload.project_title,
    p_group_students: payload.group_students,
    p_admin_password: adminPassword,
  });
  return data?.[0] || null;
}

/**
 * Permanently deletes a project and its associated score data.
 *
 * @param {string} projectId     - UUID of the project to delete.
 * @param {string} deletePassword - Delete password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminDeleteProject(projectId, deletePassword) {
  const data = await callAdminRpc("rpc_admin_delete_project", {
    p_project_id:      projectId,
    p_delete_password: deletePassword,
  });
  return data === true;
}
