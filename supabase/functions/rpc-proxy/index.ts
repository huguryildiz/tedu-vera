// supabase/functions/rpc-proxy/index.ts
// ============================================================
// Supabase Edge Function — proxies admin RPC calls so that the
// RPC_SECRET never leaves the server. The client sends:
//   { fn: "rpc_admin_login", params: { p_password: "..." } }
// and this function injects p_rpc_secret from Deno.env before
// calling Supabase.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesOriginPattern = (
  pattern: string,
  origin: string,
  wildcardAllowed: boolean,
) => {
  if (pattern === "*") return wildcardAllowed;
  if (!pattern.includes("*")) return pattern === origin;
  if (!wildcardAllowed) return false;

  const regex = new RegExp(`^${pattern.split("*").map(escapeRegex).join(".*")}$`);
  return regex.test(origin);
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const wildcardAllowed = Deno.env.get("ALLOW_WILDCARD_ORIGIN") === "true";
  const normalizedOrigin = origin ? origin.replace(/\/$/, "") : null;

  const isAllowed =
    !normalizedOrigin ||
    allowedOrigins.some((pattern) =>
      matchesOriginPattern(pattern, normalizedOrigin, wildcardAllowed)
    );

  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin ?? "*") : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { fn, params } = await req.json();

    if (!fn || typeof fn !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'fn' parameter." }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Only allow admin RPC functions. All admin functions use the rpc_admin_ prefix.
    // rpc_admin_bootstrap_password matches this prefix and requires no special case.
    // (Previously, "rpc_bootstrap_admin_password" was listed as an ALLOWED_EXTRA,
    //  but that name does not match any real RPC — it was a phantom entry and has
    //  been removed. The real function is rpc_admin_bootstrap_password.)
    const ALLOWED_PREFIX = "rpc_admin_";
    if (!fn.startsWith(ALLOWED_PREFIX)) {
      return new Response(
        JSON.stringify({ error: `Function '${fn}' is not allowed through proxy.` }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rpcSecret = Deno.env.get("RPC_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Inject the RPC secret into the params
    const enrichedParams = {
      ...params,
      p_rpc_secret: rpcSecret,
    };

    const { data, error } = await supabase.rpc(fn, enrichedParams);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
