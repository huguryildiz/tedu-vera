// src/shared/api/admin/audit.js
// ============================================================
// Admin audit log functions.
// ============================================================

import { callAdminRpc, rethrowUnauthorized } from "../transport";

/**
 * Returns paginated audit log entries matching the given filters.
 *
 * @param {object}   filters                  - Filter parameters (all optional).
 * @param {string}   [filters.startAt]         ISO timestamp lower bound.
 * @param {string}   [filters.endAt]           ISO timestamp upper bound.
 * @param {string[]} [filters.actorTypes]      Actor type filter (e.g. ["admin", "juror"]).
 * @param {string[]} [filters.actions]         Action filter (e.g. ["create", "delete"]).
 * @param {string}   [filters.search]          Full-text search string.
 * @param {string}   [filters.searchDay]       Day filter (DD).
 * @param {string}   [filters.searchMonth]     Month filter (MM).
 * @param {string}   [filters.searchYear]      Year filter (YYYY).
 * @param {number}   [filters.limit=120]       Max rows to return.
 * @param {string}   [filters.beforeAt]        Cursor: return entries before this timestamp.
 * @param {string}   [filters.beforeId]        Cursor: tiebreaker for beforeAt.
 * @param {string}   adminPassword             Admin password for authorization.
 * @returns {Promise<object[]>} Array of audit log rows.
 * @throws {Error} With `unauthorized=true` when the password is wrong.
 */
export async function adminListAuditLogs(filters, adminPassword) {
  let data;
  try {
    data = await callAdminRpc("rpc_admin_list_audit_logs", {
      p_admin_password: adminPassword,
      p_start_at:       filters?.startAt       || null,
      p_end_at:         filters?.endAt         || null,
      p_actor_types:    filters?.actorTypes    || null,
      p_actions:        filters?.actions       || null,
      p_search:         filters?.search        || null,
      p_search_day:     filters?.searchDay     || null,
      p_search_month:   filters?.searchMonth   || null,
      p_search_year:    filters?.searchYear    || null,
      p_limit:          filters?.limit         || 120,
      p_before_at:      filters?.beforeAt      || null,
      p_before_id:      filters?.beforeId      || null,
    });
  } catch (error) {
    rethrowUnauthorized(error);
  }
  return data || [];
}
