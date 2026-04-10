// src/shared/api/admin/organizations.js
// ============================================================
// Admin organization management (PostgREST).
// ============================================================

import { supabase } from "../core/client";

function mapAdmins(memberships) {
  if (!Array.isArray(memberships)) return [];
  return memberships
    .map((m) => ({
      userId: m.user_id,
      name: m.profiles?.display_name || m.profiles?.email || "Unknown",
      email: m.profiles?.email || "",
      role: m.role,
      status: "approved",
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
  const institution =
    payload.institution ??
    payload.subtitle ??
    ([payload.university, payload.department].filter(Boolean).join(" · ") ||
      null);
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: payload.name,
      code: payload.code || payload.shortLabel || null,
      institution,
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
  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  const resolvedCode = payload.code !== undefined ? payload.code : payload.shortLabel;
  if (resolvedCode !== undefined) updates.code = resolvedCode;
  if (payload.institution !== undefined) updates.institution = payload.institution;
  else if (payload.subtitle !== undefined) updates.institution = payload.subtitle;
  if (payload.university !== undefined || payload.department !== undefined) {
    const uni = String(payload.university || "").trim();
    const dept = String(payload.department || "").trim();
    updates.institution = [uni, dept].filter(Boolean).join(" · ") || null;
  }
  if (payload.contact_email !== undefined) updates.contact_email = payload.contact_email;
  if (payload.status !== undefined) updates.status = payload.status;

  const { data, error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listOrganizationsPublic() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, code")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function updateMemberAdmin(payload) {
  const userId = payload?.userId || payload?.id;
  if (!userId) throw new Error("userId is required");

  const displayName =
    payload.displayName !== undefined
      ? payload.displayName
      : payload.name;
  if (displayName !== undefined) {
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: String(displayName || "").trim() || null })
      .eq("id", userId);
    if (error) throw error;
  }
  return true;
}

// ── Admin Invite API ──────────────────────────────────────────

/**
 * Send an admin invite. Returns { status: 'invited', invite_id, token, email }
 * or { status: 'added', user_id } for existing users.
 */
export async function sendAdminInvite(orgId, email) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_send", {
    p_org_id: orgId,
    p_email: email,
  });
  if (error) throw error;

  // Fire-and-forget: send email via Edge Function
  const orgName = await _getOrgName(orgId);
  supabase.functions.invoke("send-admin-invite", {
    body: {
      type: data.status === "added" ? "added" : "invite",
      email: data.email || email,
      token: data.token || null,
      org_name: orgName,
    },
  }).catch((e) => console.warn("send-admin-invite email failed:", e?.message));

  return data;
}

/**
 * List pending invites for an organization.
 * Returns array of { id, email, created_at, expires_at }.
 */
export async function listAdminInvites(orgId) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_list", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Resend an existing invite (new token, reset expiry).
 */
export async function resendAdminInvite(inviteId, orgId) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_resend", {
    p_invite_id: inviteId,
  });
  if (error) throw error;

  // Fire-and-forget: send email
  const orgName = await _getOrgName(orgId);
  supabase.functions.invoke("send-admin-invite", {
    body: {
      type: "invite",
      email: data.email,
      token: data.token,
      org_name: orgName,
    },
  }).catch((e) => console.warn("resend invite email failed:", e?.message));

  return data;
}

/**
 * Cancel a pending invite.
 */
export async function cancelAdminInvite(inviteId) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_cancel", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return data;
}

/**
 * Get invite payload by token (for the accept page).
 */
export async function getInvitePayload(token) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_get_payload", {
    p_token: token,
  });
  if (error) throw error;
  return data;
}

/**
 * Accept an invite (calls Edge Function which creates user + membership).
 */
export async function acceptAdminInvite(token, password, displayName) {
  const { data, error } = await supabase.functions.invoke(
    "accept-admin-invite",
    { body: { token, password, display_name: displayName } },
  );
  if (error) throw error;
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

/** @private Resolve org name for email templates */
async function _getOrgName(orgId) {
  try {
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    return data?.name || "your organization";
  } catch {
    return "your organization";
  }
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
