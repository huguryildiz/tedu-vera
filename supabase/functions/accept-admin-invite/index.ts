import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { token, password, display_name } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || String(password).length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 8 characters.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const service = createClient(supabaseUrl, serviceKey);

    // 1. Validate invite token via RPC
    const { data: payload, error: rpcErr } = await service.rpc(
      "rpc_admin_invite_get_payload",
      { p_token: token },
    );
    if (rpcErr) throw rpcErr;
    if (payload?.error) {
      return new Response(JSON.stringify({ error: payload.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteId = payload.id;
    const email = payload.email;
    const name = String(display_name || "").trim() ||
      email.split("@")[0] || "Admin";

    // 2. Create auth user
    const { data: newUser, error: createErr } =
      await service.auth.admin.createUser({
        email,
        password: String(password),
        email_confirm: true,
        user_metadata: { name },
        app_metadata: { provider: "email", providers: ["email"] },
      });
    if (createErr) throw createErr;

    const userId = newUser.user.id;

    // 3. Create profile
    const { error: profileErr } = await service
      .from("profiles")
      .upsert({ id: userId, display_name: name }, { onConflict: "id" });
    if (profileErr) throw profileErr;

    // 4. Mark invite accepted + create membership
    const { error: acceptErr } = await service.rpc(
      "rpc_admin_invite_mark_accepted",
      {
        p_invite_id: inviteId,
        p_user_id: userId,
      },
    );
    if (acceptErr) throw acceptErr;

    // 5. Generate a session so invitee is immediately logged in
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
    );
    const { data: session, error: signInErr } =
      await anonClient.auth.signInWithPassword({
        email,
        password: String(password),
      });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        session: signInErr ? null : session?.session,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = (e as Error).message || "";
    if (msg.includes("already been registered") || msg.includes("duplicate")) {
      return new Response(
        JSON.stringify({
          error: "This email is already registered. Please log in instead.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
