import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase environment is not configured." }, 500);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const token = (body as Record<string, unknown>)?.token;
    if (typeof token !== "string") {
      return json({ error: "token is required and must be a string" }, 400);
    }

    // Validate token format (UUID pattern)
    const uuidPattern = /^[0-9a-f-]{36}$/i;
    if (!uuidPattern.test(token)) {
      return json({ error: "invalid_token_format" }, 400);
    }

    // Use service role for DB operations
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Lookup token
    const { data: tokenRow, error: tokenErr } = await service
      .from("email_verification_tokens")
      .select("token, user_id, email, expires_at, consumed_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr) {
      return json({ error: tokenErr.message }, 500);
    }

    if (!tokenRow) {
      return json({ error: "token_not_found" }, 404);
    }

    // Check if already consumed
    if (tokenRow.consumed_at !== null) {
      return json({ error: "token_already_used" }, 410);
    }

    // Check if expired
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return json({ error: "token_expired" }, 410);
    }

    const now = new Date().toISOString();

    // Update profile: mark email as verified
    const { error: profileUpdateErr } = await service
      .from("profiles")
      .update({ email_verified_at: now })
      .eq("id", tokenRow.user_id);

    if (profileUpdateErr) {
      return json({ error: profileUpdateErr.message }, 500);
    }

    // Mark token as consumed
    const { error: tokenUpdateErr } = await service
      .from("email_verification_tokens")
      .update({ consumed_at: now })
      .eq("token", token);

    if (tokenUpdateErr) {
      return json({ error: tokenUpdateErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("email-verification-confirm error:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
