// src/shared/api/admin/audit.js
// Admin audit log functions (PostgREST).

import { supabase } from "../core/client";

export async function writeAuditLog(action, { resourceType, resourceId, details, organizationId } = {}) {
  const { error } = await supabase.rpc("rpc_admin_write_audit_log", {
    p_action: action,
    p_resource_type: resourceType || null,
    p_resource_id: resourceId || null,
    p_details: details || {},
    p_organization_id: organizationId || null,
  });
  if (error) throw error;
}

export async function listAuditLogs(filters = {}) {
  let query = supabase
    .from("audit_logs")
    .select("*, profiles(display_name)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(filters.limit || 120);

  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId);
  }
  if (filters.actions?.length) {
    query = query.in("action", filters.actions);
  }
  if (filters.startAt) {
    query = query.gte("created_at", filters.startAt);
  }
  if (filters.endAt) {
    query = query.lte("created_at", filters.endAt);
  }

  // Cursor-based keyset pagination: fetch rows older than the last seen row
  if (filters.beforeAt) {
    if (filters.beforeId) {
      query = query.or(
        `created_at.lt.${filters.beforeAt},and(created_at.eq.${filters.beforeAt},id.lt.${filters.beforeId})`
      );
    } else {
      query = query.lt("created_at", filters.beforeAt);
    }
  }

  // Search across action, resource_type, and details JSONB fields
  if (filters.search) {
    const s = filters.search.replace(/%/g, "");
    const term = `%${s}%`;
    query = query.or(
      [
        `action.ilike.${term}`,
        `resource_type.ilike.${term}`,
        `details->>applicant_email.ilike.${term}`,
        `details->>applicant_name.ilike.${term}`,
        `details->>actor_name.ilike.${term}`,
        `details->>juror_name.ilike.${term}`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
