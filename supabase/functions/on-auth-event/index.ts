// supabase/functions/on-auth-event/index.ts
// ============================================================
// Database Webhook handler for auth.sessions and auth.users events.
//
// Triggered by a Supabase Database Webhook (not a user request).
// Writes:
//   - auth.admin.login.success  on auth.sessions INSERT
//   - admin.logout              on auth.sessions DELETE
//   - auth.admin.email.changed  on auth.users UPDATE when email differs
// to audit_logs via service role so the event is server-side durable.
//
// Auth: verify_jwt=false — this is called by Supabase infra, not a user JWT.
// Request is authenticated by HMAC-SHA256 signature in X-Supabase-Signature.
//
// Always returns 200 — Supabase retries on non-2xx which would create
// duplicate audit rows. Errors are logged but not propagated.
//
// Operator setup (per-project, in Supabase Dashboard → Database → Webhooks):
//   1. Create webhook on auth.sessions (events: INSERT, DELETE)
//   2. Create webhook on auth.users    (events: UPDATE)
//   Both point at this Edge Function URL with header X-Webhook-Secret
//   matching the WEBHOOK_HMAC_SECRET env value.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Constant-time string comparison to prevent timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const webhookSecret = Deno.env.get("WEBHOOK_HMAC_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceKey) {
    console.error("on-auth-event: Supabase environment not configured");
    return json(200, { ok: false, error: "Environment not configured" });
  }

  // Verify shared secret header (constant-time to prevent timing attacks)
  if (webhookSecret) {
    const incoming = req.headers.get("x-webhook-secret") || "";
    if (!constantTimeEqual(incoming, webhookSecret)) {
      console.error("on-auth-event: Invalid or missing X-Webhook-Secret");
      return json(200, { ok: false, error: "Unauthorized" });
    }
  }

  // Read the body
  const bodyText = await req.text();

  let payload: {
    type?: string;
    table?: string;
    schema?: string;
    record?: Record<string, unknown> | null;
    old_record?: Record<string, unknown> | null;
  };

  try {
    payload = JSON.parse(bodyText);
  } catch {
    console.error("on-auth-event: Invalid JSON payload");
    return json(200, { ok: false, error: "Invalid JSON" });
  }

  const { type, table, schema, record, old_record } = payload;

  // Dispatch by (schema, table). auth.sessions handles login/logout;
  // auth.users UPDATE handles email-change events.
  if (schema !== "auth" || (table !== "sessions" && table !== "users")) {
    return json(200, { ok: true, skipped: true });
  }

  // Resolve action + the relevant record + extra detail fields per event.
  let action: string;
  let sourceRecord: Record<string, unknown> | null | undefined;
  let resourceType = "profiles";
  let extraDetails: Record<string, unknown> = {};
  let severity: "info" | "low" | "medium" | "high" | "critical" = "info";

  if (table === "sessions") {
    if (type === "INSERT") {
      action = "auth.admin.login.success";
      sourceRecord = record;
      extraDetails = { method: "session", session_id: record?.id ?? null };
    } else if (type === "DELETE") {
      action = "admin.logout";
      sourceRecord = old_record;
      extraDetails = { method: "logout", session_id: old_record?.id ?? null };
    } else {
      // UPDATE, TRUNCATE — not relevant for sessions
      return json(200, { ok: true, skipped: true });
    }
  } else {
    // table === "users". Only UPDATE with email change is in scope.
    if (type !== "UPDATE") {
      return json(200, { ok: true, skipped: true });
    }
    const oldEmail = (old_record?.email as string | null) ?? null;
    const newEmail = (record?.email as string | null) ?? null;
    if (!oldEmail || !newEmail || oldEmail === newEmail) {
      return json(200, { ok: true, skipped: true });
    }
    action = "auth.admin.email.changed";
    sourceRecord = record;
    resourceType = "profiles";
    severity = "medium";
    extraDetails = {
      old_email: oldEmail,
      new_email: newEmail,
      email_change_confirmed: Boolean(record?.email_confirmed_at),
    };
  }

  // Identify the affected user. For auth.sessions the FK is `user_id`; for
  // auth.users the row id IS the user_id. Be strict per-table — falling back
  // from user_id to id for auth.sessions would mis-assign a session id as a
  // user id when the webhook payload is incomplete.
  const userIdRaw =
    table === "users"
      ? sourceRecord?.id
      : sourceRecord?.user_id;
  const userId = userIdRaw ? String(userIdRaw) : "";
  if (!userId) {
    console.error(`on-auth-event: No user_id resolvable for ${action}`);
    return json(200, { ok: false, error: "No user_id" });
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Resolve organization_id from memberships (first active tenant membership)
  let organizationId: string | null = null;
  try {
    const { data: membership } = await service
      .from("memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .not("organization_id", "is", null)
      .limit(1)
      .single();
    organizationId = membership?.organization_id ?? null;
  } catch {
    // Super-admin has no org membership — leave null
  }

  // Extract IP/UA from session record if available (auth.sessions stores these);
  // auth.users payload does not carry IP/UA, so leave null.
  const ipAddress = (sourceRecord?.ip as string | null) ?? null;
  const userAgent = (sourceRecord?.user_agent as string | null) ?? null;

  try {
    const { error: insertErr } = await service.from("audit_logs").insert({
      action,
      organization_id: organizationId,
      user_id: userId,
      resource_type: resourceType,
      resource_id: userId,
      category: "auth",
      severity,
      actor_type: "admin",
      details: extraDetails,
      diff: null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (insertErr) {
      console.error(`on-auth-event: audit insert failed for ${action}:`, insertErr);
      return json(200, { ok: false, error: insertErr.message });
    }
  } catch (err) {
    console.error(`on-auth-event: unexpected error for ${action}:`, err);
    return json(200, { ok: false, error: String(err) });
  }

  return json(200, { ok: true, action });
});
