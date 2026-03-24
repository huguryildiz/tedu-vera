// src/shared/api/admin/scores.js
// ============================================================
// Admin score data, settings, eval-lock, and delete functions.
// ============================================================

import { callAdminRpc, rethrowUnauthorized } from "../transport";
import { dbAvgScoresToUi } from "../fieldMapping";
import { normalizeScoreRow } from "../../../admin/selectors/scoreSelectors";
import { adminDeleteSemester } from "./semesters";
import { adminDeleteProject } from "./projects";
import { adminDeleteJuror } from "./jurors";

/**
 * @typedef {object} ScoreRow
 * @property {string}      jurorId          UUID of the juror.
 * @property {string}      juryName         Display name of the juror.
 * @property {string}      juryDept         Institution / department of the juror.
 * @property {string}      projectId        UUID of the project.
 * @property {number}      groupNo          Group number.
 * @property {string}      projectName      Title of the project.
 * @property {string}      posterDate       ISO date string of poster day.
 * @property {number|null} technical        Score for Technical criterion (0-30).
 * @property {number|null} design           Score for Design criterion (mapped from written, 0-30).
 * @property {number|null} delivery         Score for Delivery criterion (mapped from oral, 0-30).
 * @property {number|null} teamwork         Score for Teamwork criterion (0-10).
 * @property {number|null} total            Computed total (null when not all criteria are filled).
 * @property {string}      comments         Juror's comment text.
 * @property {string}      updatedAt        ISO timestamp of last update.
 * @property {number}      updatedMs        Unix ms of updatedAt.
 * @property {string}      finalSubmittedAt ISO timestamp of final submission, or "".
 * @property {number}      finalSubmittedMs Unix ms of finalSubmittedAt, or 0.
 * @property {string}      status           "not_started" | "in_progress" | "submitted" | "completed" | "editing".
 */

/**
 * Returns all score rows for a semester, normalized to the field names
 * that admin tab components expect. DB `written`/`oral` are mapped to
 * UI `design`/`delivery`.
 *
 * @param {string} semesterId     - UUID of the semester.
 * @param {string} adminPassword  - Admin password for authorization.
 * @returns {Promise<ScoreRow[]>} Array of normalized score rows.
 * @throws {Error} With `unauthorized=true` when the password is wrong.
 */
export async function adminGetScores(semesterId, adminPassword) {
  let data;
  try {
    data = await callAdminRpc("rpc_admin_get_scores", {
      p_semester_id:    semesterId,
      p_admin_password: adminPassword,
    });
  } catch (error) {
    rethrowUnauthorized(error);
  }

  return (data || []).map(normalizeScoreRow);
}

/**
 * Returns all jurors for the semester, including those who have not scored yet.
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<JurorRow[]>} Array of normalized juror rows.
 * @throws {Error} With `unauthorized=true` when the password is wrong.
 */
export async function adminListJurors(semesterId, adminPassword) {
  let data;
  try {
    data = await callAdminRpc("rpc_admin_list_jurors", {
      p_admin_password: adminPassword,
      p_semester_id:    semesterId,
    });
  } catch (error) {
    rethrowUnauthorized(error);
  }
  return (data || []).map((j) => ({
    jurorId:           j.juror_id,
    juryName:          j.juror_name,
    juryDept:          j.juror_inst || "",
    scoredSemesters:   Array.isArray(j.scored_semesters) ? j.scored_semesters : [],
    isAssigned:        j.is_assigned,
    editEnabled:       j.edit_enabled,
    finalSubmittedAt:  j.final_submitted_at || "",
    finalSubmitted:    Boolean(j.final_submitted_at),
    lastActivityAt:    j.last_activity_at || "",
    lastActivityMs:    j.last_activity_at ? new Date(j.last_activity_at).getTime() : 0,
    lastSeenAt:        j.last_seen_at || "",
    lastSeenMs:        j.last_seen_at ? new Date(j.last_seen_at).getTime() : 0,
    updatedAt:         j.updated_at || "",
    updatedMs:         j.updated_at ? new Date(j.updated_at).getTime() : 0,
    totalProjects:     j.total_projects,
    completedProjects: j.completed_projects,
    lockedUntil:       j.locked_until,
    isLocked:          j.is_locked,
  }));
}

/**
 * Returns per-project summary aggregates for the Rankings and Analytics tabs.
 * `avg` is keyed by criterion id, sourced from `criteria_avgs` JSONB.
 *
 * @param {string} semesterId    - UUID of the semester.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<Array<{id: string, groupNo: number, name: string, students: string, count: number, avg: object, totalAvg: number|null, totalMin: number|null, totalMax: number|null, note: string}>>}
 * @throws {Error} With `unauthorized=true` when the password is wrong.
 */
export async function adminProjectSummary(semesterId, adminPassword) {
  let data;
  try {
    data = await callAdminRpc("rpc_admin_project_summary", {
      p_semester_id:    semesterId,
      p_admin_password: adminPassword,
    });
  } catch (error) {
    rethrowUnauthorized(error);
  }

  return (data || []).map((row) => ({
    id:       row.project_id,
    groupNo:  row.group_no,
    name:     row.project_title,
    students: row.group_students || "",
    count:    Number(row.juror_count || 0),
    // criteria_avgs JSONB keys already match config.js ids
    avg:      dbAvgScoresToUi(row),
    totalAvg: row.avg_total == null ? null : Number(row.avg_total),
    totalMin: row.min_total == null ? null : Number(row.min_total),
    totalMax: row.max_total == null ? null : Number(row.max_total),
    note:     row.note || "",
  }));
}

/**
 * Returns per-semester outcome averages used by the Analytics trend chart.
 * `criteriaAvgs` is keyed by criterion id, sourced from `criteria_avgs` JSONB.
 *
 * @param {string[]} semesterIds   - Array of semester UUIDs to include.
 * @param {string}   adminPassword - Admin password for authorization.
 * @returns {Promise<Array<{semesterId: string, semesterName: string, posterDate: string, criteriaAvgs: object, nEvals: number}>>}
 * @throws {Error} With `unauthorized=true` when the password is wrong.
 */
export async function adminGetOutcomeTrends(semesterIds, adminPassword) {
  let data;
  try {
    data = await callAdminRpc("rpc_admin_outcome_trends", {
      p_semester_ids:   semesterIds,
      p_admin_password: adminPassword,
    });
  } catch (error) {
    rethrowUnauthorized(error);
  }
  return (data || []).map((row) => ({
    semesterId:   row.semester_id,
    semesterName: row.semester_name || "",
    posterDate:   row.poster_date || "",
    // criteria_avgs keys match config.js ids (and the semester's own template keys)
    criteriaAvgs: dbAvgScoresToUi(row),
    nEvals:       Number(row.n_evals || 0),
  }));
}

// ── Admin settings ────────────────────────────────────────────

/**
 * Returns all admin settings key/value pairs.
 *
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<Array<{key: string, value: string}>>}
 */
export async function adminGetSettings(adminPassword) {
  const data = await callAdminRpc("rpc_admin_get_settings", {
    p_admin_password: adminPassword,
  });
  return data || [];
}

/**
 * Sets a single admin settings key to the given value.
 *
 * @param {string} key           - Settings key.
 * @param {string} value         - New value.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<void>}
 */
export async function adminSetSetting(key, value, adminPassword) {
  return callAdminRpc("rpc_admin_set_setting", {
    p_key:            key,
    p_value:          value,
    p_admin_password: adminPassword,
  });
}

/**
 * Locks or unlocks scoring for a semester. When locked, jurors cannot
 * submit or modify scores.
 *
 * @param {string}  semesterId    - UUID of the semester.
 * @param {boolean} enabled       - True to lock scoring; false to unlock.
 * @param {string}  adminPassword - Admin password for authorization.
 * @returns {Promise<boolean>} True on success.
 */
export async function adminSetSemesterEvalLock(semesterId, enabled, adminPassword) {
  const data = await callAdminRpc("rpc_admin_set_semester_eval_lock", {
    p_semester_id:    semesterId,
    p_enabled:        !!enabled,
    p_admin_password: adminPassword,
  });
  return data === true;
}

// ── Admin delete ──────────────────────────────────────────────

/**
 * Returns cascade counts for a delete operation (how many rows will be removed).
 * Used to populate the delete confirmation dialog before the user confirms.
 *
 * @param {"semester"|"project"|"juror"} targetType - The type of entity.
 * @param {string} targetId      - UUID of the entity.
 * @param {string} adminPassword - Admin password for authorization.
 * @returns {Promise<object>} Counts object (structure depends on targetType).
 */
export async function adminDeleteCounts(targetType, targetId, adminPassword) {
  return callAdminRpc("rpc_admin_delete_counts", {
    p_type:           targetType,
    p_id:             targetId,
    p_admin_password: adminPassword,
  });
}

/**
 * Dispatches a permanent delete to the appropriate domain function.
 *
 * @param {object} opts
 * @param {"semester"|"project"|"juror"} opts.targetType - The type of entity to delete.
 * @param {string} opts.targetId      - UUID of the entity to delete.
 * @param {string} opts.deletePassword - Delete password for authorization.
 * @returns {Promise<boolean>} True on success.
 * @throws {Error} When targetType is unsupported or ids are missing.
 */
export async function adminDeleteEntity({ targetType, targetId, deletePassword }) {
  if (!targetType || !targetId) throw new Error("targetType and targetId are required.");
  if (targetType === "semester") return adminDeleteSemester(targetId, deletePassword);
  if (targetType === "project")  return adminDeleteProject(targetId, deletePassword);
  if (targetType === "juror")    return adminDeleteJuror(targetId, deletePassword);
  throw new Error("Unsupported delete target.");
}
