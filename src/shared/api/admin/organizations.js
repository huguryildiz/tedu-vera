// src/shared/api/admin/organizations.js
// ============================================================
// Admin organization management (PostgREST).
// ============================================================

import { supabase } from "../core/client";

function mapAdmins(memberships) {
  if (!Array.isArray(memberships)) return [];
  return memberships
    .map((m) => ({
      membershipId: m.id,
      userId: m.user_id,
      name: m.profiles?.display_name || m.profiles?.email || "Unknown",
      email: m.profiles?.email || "",
      role: m.role,
      status: m.status || "active",
      updatedAt: m.created_at || "",
    }))
    .filter((e) => e.userId);
}

function mapPending(applications) {
  if (!Array.isArray(applications)) return [];
  return applications
    .filter((a) => a.status === "pending")
    .map((a) => ({
      applicationId: a.id,
      name: a.applicant_name || a.contact_email || "Unknown",
      email: a.contact_email || "",
      status: "pending",
      createdAt: a.created_at || "",
    }));
}

export async function listOrganizations() {
  // Use SECURITY DEFINER RPC to bypass RLS on joined tables.
  // Direct PostgREST embedding (memberships + org_applications) 403s because
  // the org_applications RLS policy previously accessed auth.users directly
  // (authenticated role has no SELECT on that table).
  const { data, error } = await supabase.rpc("rpc_admin_list_organizations");
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    shortLabel: row.code,
    tenantAdmins: mapAdmins(row.memberships),
    pendingApplications: mapPending(row.org_applications),
  }));
}

export async function createOrganization(payload) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: payload.name,
      code: payload.code || payload.shortLabel || null,
      contact_email: payload.contact_email || null,
      status: payload.status || "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrganization(payload) {
  const id = payload.organizationId || payload.id;
  if (!id) throw new Error("updateOrganization: organizationId required");

  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  const resolvedCode = payload.code !== undefined ? payload.code : payload.shortLabel;
  if (resolvedCode !== undefined) updates.code = resolvedCode;
  if (payload.contact_email !== undefined) updates.contact_email = payload.contact_email;
  if (payload.status !== undefined) updates.status = payload.status;

  const { data, error } = await supabase.rpc("rpc_admin_update_organization", {
    p_org_id: id,
    p_updates: updates,
  });
  if (error) throw error;
  return data;
}

export async function listOrganizationsPublic() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, code, setup_completed_at")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data || [];
}

/**
 * Stamp organizations.setup_completed_at when the setup wizard's final step
 * succeeds. Idempotent on the server (COALESCE) — safe to retry. Caller must
 * be a super-admin or an active member of the org.
 * Returns the resulting ISO timestamp.
 */
export async function markSetupComplete(organizationId) {
  if (!organizationId) throw new Error("markSetupComplete: organizationId required");
  const { data, error } = await supabase.rpc("rpc_admin_mark_setup_complete", {
    p_org_id: organizationId,
  });
  if (error) throw error;
  return data;
}

/**
 * Hard-delete an organization and all CASCADE children (periods, projects, jurors, scores, etc.)
 * after writing an audit log entry. Caller must be a super-admin.
 * Raises 'unauthorized' if caller is not a super-admin.
 */
export async function deleteOrganization(organizationId) {
  if (!organizationId) throw new Error("deleteOrganization: organizationId required");
  const { data, error } = await supabase.rpc("rpc_admin_delete_organization", {
    p_org_id: organizationId,
  });
  if (error) throw error;
  return data;
}

export async function updateMemberAdmin(payload) {
  const userId = payload?.userId || payload?.id;
  if (!userId) throw new Error("userId is required");
  if (!payload?.organizationId) throw new Error("organizationId is required");

  const displayName =
    payload.displayName !== undefined ? payload.displayName : payload.name;

  // RPC updates profiles.display_name + writes audit atomically.
  const { error } = await supabase.rpc("rpc_admin_update_member_profile", {
    p_user_id: userId,
    p_display_name: displayName ?? null,
    p_organization_id: payload.organizationId,
  });
  if (error) throw error;

  return true;
}

// ── Invite API (Supabase-native flow) ─────────────────────────

/**
 * Invite an admin to an org via Supabase Auth.
 * Calls the invite-org-admin Edge Function.
 * Returns { status: 'invited' | 'reinvited' | 'added', user_id, email? }.
 */
export async function inviteOrgAdmin(orgId, email, approvalFlow = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  // Use raw fetch so the Authorization header is guaranteed to reach the
  // Edge Function. supabase.functions.invoke() through the Proxy was not
  // reliably attaching the user JWT — the header arrived absent at the function.
  const supabaseUrl = supabase.supabaseUrl; // Proxy → active env client URL
  const anonKey = supabase.supabaseKey;    // required by Supabase API gateway (Kong)
  const res = await fetch(`${supabaseUrl}/functions/v1/invite-org-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ org_id: orgId, email, approval_flow: approvalFlow }),
  });

  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  if (data?.error) throw new Error(data.error);

  // Audit row is written inside the invite-org-admin Edge Function
  // (notification.admin_invite) — no client-side fire-and-forget.

  return data;
}

/**
 * Cancel an invited membership (removes the 'invited' membership row).
 */
export async function cancelOrgAdminInvite(membershipId) {
  const { data, error } = await supabase.rpc("rpc_org_admin_cancel_invite", {
    p_membership_id: membershipId,
  });
  if (error) throw error;
  return data;
}

/**
 * Owner-only: transfer ownership to another active admin in the same org.
 */
export async function transferOwnership(targetMembershipId) {
  const { data, error } = await supabase.rpc("rpc_org_admin_transfer_ownership", {
    p_target_membership_id: targetMembershipId,
  });
  if (error) throw error;
  return data;
}

/**
 * Owner-only: remove another admin (active or invited).
 */
export async function removeOrgAdmin(membershipId) {
  const { data, error } = await supabase.rpc("rpc_org_admin_remove_member", {
    p_membership_id: membershipId,
  });
  if (error) throw error;
  return data;
}

/**
 * Owner-only: toggle the "admins can invite" delegation flag for an org.
 */
export async function setAdminsCanInvite(orgId, enabled) {
  const { data, error } = await supabase.rpc("rpc_org_admin_set_admins_can_invite", {
    p_org_id: orgId,
    p_enabled: Boolean(enabled),
  });
  if (error) throw error;
  return data;
}

// ── Join Request API ─────────────────────────────────────────

/**
 * Search active organizations for the registration discovery dropdown.
 * Anon-accessible — does not require authentication.
 */
export async function searchOrganizationsForJoin(query) {
  const { data, error } = await supabase.rpc("rpc_public_search_organizations", { p_query: query });
  if (error) throw error;
  return data || [];
}

/**
 * Request to join an existing organization.
 * Creates a membership row with status='requested'.
 */
export async function requestToJoinOrg(orgId) {
  const { data, error } = await supabase.rpc("rpc_request_to_join_org", { p_org_id: orgId });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error_code || "join_request_failed");
  return data;
}

/**
 * Approve a pending join request (org admin promotes 'requested' → 'active').
 */
export async function approveJoinRequest(membershipId) {
  const { data, error } = await supabase.rpc("rpc_admin_approve_join_request", { p_membership_id: membershipId });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error_code || "approve_failed");
  return data;
}

/**
 * Reject a pending join request (org admin deletes 'requested' membership).
 */
export async function rejectJoinRequest(membershipId) {
  const { data, error } = await supabase.rpc("rpc_admin_reject_join_request", { p_membership_id: membershipId });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error_code || "reject_failed");
  return data;
}

export async function deleteMemberHard(payload) {
  const userId = typeof payload === "string" ? payload : payload?.userId;
  const organizationId = typeof payload === "object" ? payload?.organizationId : null;
  if (!userId) throw new Error("userId is required");
  if (!organizationId) throw new Error("organizationId is required");

  // Remove only the membership for this specific organization.
  // The Supabase Auth user and profile are intentionally kept intact —
  // the user may belong to other organizations or re-join later.
  const { error: memErr } = await supabase
    .from("memberships")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  if (memErr) throw memErr;

  return true;
}

/**
 * Returns { members: Array, adminsCanInvite: boolean }.
 * Members include per-row is_owner / is_you fields.
 */
export async function listOrgAdminMembers() {
  const { data, error } = await supabase.rpc("rpc_org_admin_list_members");
  if (error) throw error;
  return {
    members: Array.isArray(data?.members) ? data.members : [],
    adminsCanInvite: Boolean(data?.admins_can_invite),
  };
}
