import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RequestPayloadSchema } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readBearerToken(req: Request): string {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function toIsoOrNull(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const str = String(value).trim();
  if (!str) return null;

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function safeText(input: unknown, maxLen: number, fallback = ""): string {
  return String(input ?? fallback).trim().slice(0, maxLen);
}

function firstForwardedIp(req: Request): string | null {
  const raw = req.headers.get("x-forwarded-for");
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

function countryFromHeaders(req: Request): string | null {
  const raw =
    req.headers.get("x-country-code") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    "";

  const code = String(raw).trim().toUpperCase();
  if (!code) return null;
  if (code.length !== 2) return null;
  return code;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "Supabase environment not configured." });
  }

  const token = readBearerToken(req);
  if (!token) return json(401, { error: "Missing bearer token" });

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await caller.auth.getUser(token);
  const userId = userData?.user?.id || null;
  if (userErr || !userId) {
    return json(401, { error: "Unauthorized", details: userErr?.message || "User ID not found" });
  }

  const body = await req.json().catch(() => null);

  const parsed = RequestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: parsed.error.issues.map(i => i.message).join(", ") });
  }
  const payload = parsed.data;

  const deviceId = safeText(payload.deviceId, 128);
  if (!deviceId) {
    return json(400, { error: "deviceId is required" });
  }

  const nowIso = new Date().toISOString();
  const signedInAt = toIsoOrNull(payload.signedInAt);
  const expiresAt = toIsoOrNull(payload.expiresAt);
  const userAgent = safeText(payload.userAgent || req.headers.get("user-agent"), 1024);
  const browser = safeText(payload.browser, 80, "Unknown");
  const os = safeText(payload.os, 80, "Unknown");
  const authMethod = safeText(payload.authMethod, 80, "Unknown");
  const ipAddress = firstForwardedIp(req);
  const countryCode = countryFromHeaders(req);

  const service = createClient(supabaseUrl, serviceKey);

  const { data: existing, error: existingErr } = await service
    .from("admin_user_sessions")
    .select("signed_in_at, first_seen_at")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existingErr) return json(500, { error: existingErr.message });

  const resolvedSignedInAt = existing?.signed_in_at || signedInAt || null;
  const resolvedFirstSeenAt = existing?.first_seen_at || nowIso;

  const { data: sessionRow, error: upsertErr } = await service
    .from("admin_user_sessions")
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        user_agent: userAgent || null,
        browser: browser || "Unknown",
        os: os || "Unknown",
        ip_address: ipAddress,
        country_code: countryCode,
        auth_method: authMethod || "Unknown",
        signed_in_at: resolvedSignedInAt,
        first_seen_at: resolvedFirstSeenAt,
        last_activity_at: nowIso,
        expires_at: expiresAt,
      },
      { onConflict: "user_id,device_id" },
    )
    .select("*")
    .single();

  if (upsertErr) return json(500, { error: upsertErr.message });

  const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await service
    .from("admin_user_sessions")
    .delete()
    .eq("user_id", userId)
    .lt("last_activity_at", retentionCutoff);

  return json(200, { ok: true, session: sessionRow });
});
