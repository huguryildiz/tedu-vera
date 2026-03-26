// supabase/functions/approve-admin-application/index.ts
// ============================================================
// Approves a pending tenant admin application using Supabase
// Auth Admin API for user creation (no direct auth.* table writes).
//
// Flow:
// 1) Caller (tenant_admin/super_admin) is validated by DB RPC.
// 2) If auth user doesn't exist, create via auth.admin.createUser
//    using the pre-hashed bcrypt password from application row.
// 3) Finalize approval via rpc_admin_application_approve.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ApprovalPayloadRow = {
  tenant_id: string;
  applicant_email: string;
  applicant_name: string | null;
  encrypted_password: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Missing bearer token" });

    const { application_id } = await req.json();
    if (!application_id || typeof application_id !== "string") {
      return json(400, { error: "Missing required field: application_id" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, { error: "Supabase environment is not configured." });
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const { data: payloadRows, error: payloadErr } = await caller.rpc(
      "rpc_admin_application_get_approval_payload",
      { p_application_id: application_id },
    );
    if (payloadErr) return json(400, { error: payloadErr.message, code: payloadErr.code });

    const payload = (payloadRows?.[0] || null) as ApprovalPayloadRow | null;
    if (!payload) return json(404, { error: "Pending application not found." });

    let userId = "";
    const { data: existingUserId, error: findErr } = await service.rpc(
      "rpc_admin_auth_user_id_by_email",
      { p_email: payload.applicant_email },
    );
    if (findErr) return json(500, { error: findErr.message, code: findErr.code });

    userId = String(existingUserId || "");

    if (!userId) {
      if (!payload.encrypted_password) {
        return json(400, { error: "Application password is missing." });
      }

      const { data: created, error: createErr } = await service.auth.admin.createUser({
        email: payload.applicant_email,
        email_confirm: true,
        password_hash: payload.encrypted_password,
        user_metadata: payload.applicant_name ? { name: payload.applicant_name } : {},
        app_metadata: { provider: "email", providers: ["email"] },
      } as never);

      if (createErr) {
        return json(400, { error: createErr.message });
      }

      userId = String(created?.user?.id || "");
      if (!userId) return json(500, { error: "Could not create auth user." });
    }

    const { data: approved, error: approveErr } = await caller.rpc(
      "rpc_admin_application_approve",
      { p_application_id: application_id },
    );
    if (approveErr) return json(400, { error: approveErr.message, code: approveErr.code });

    return json(200, { ok: true, data: approved, user_id: userId });
  } catch (e) {
    return json(500, { error: (e as Error).message || "Internal server error" });
  }
});

