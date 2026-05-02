import { createClient } from "@supabase/supabase-js";

// Use the demo Supabase URL when available, since the session-injection tests
// target /demo/* routes which use VITE_DEMO_SUPABASE_URL in the browser.
// Never fall back to VITE_SUPABASE_URL — that points at prod and would let
// E2E auth flows write into the production project.
const supabaseUrl =
  process.env.VITE_DEMO_SUPABASE_URL || process.env.E2E_SUPABASE_URL || "";

const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.E2E_SUPABASE_ANON_KEY ||
  "";

// Block only when VITE_SUPABASE_URL is a hosted Supabase project (*.supabase.co).
// CI's local emulator URL (127.0.0.1) is safe to share across env vars.
const _viteUrl = process.env.VITE_SUPABASE_URL || "";
const _viteHosted = (() => {
  try { return new URL(_viteUrl).hostname.endsWith(".supabase.co"); }
  catch { return false; }
})();
if (_viteUrl && supabaseUrl === _viteUrl && _viteHosted) {
  throw new Error(
    "oauthSession: resolved supabaseUrl equals VITE_SUPABASE_URL (prod). " +
      "Set VITE_DEMO_SUPABASE_URL or E2E_SUPABASE_URL to a non-prod project.",
  );
}

// Local admin client scoped to the demo URL so getUserById targets the right project.
// This is intentionally separate from supabaseAdmin.ts (which may target prod).
const _admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The localStorage key the Supabase JS SDK uses for the current project. */
export function getStorageKey(): string {
  if (!supabaseUrl) return "sb-unknown-auth-token";
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

/**
 * Authenticates with email/password and returns a localStorage session object
 * that can be injected via page.addInitScript() to bootstrap the Supabase JS
 * client without going through the OAuth redirect.
 *
 * Uses the full User object from getUserById (not the JWT payload) so that the
 * SDK's stored session matches what it would produce after a real sign-in.
 */
export async function buildAdminSession(
  email: string,
  password: string,
): Promise<{ storageKey: string; sessionValue: object }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`buildAdminSession: auth failed ${res.status} — ${text}`);
  }

  const body = await res.json();
  const accessToken: string = body.access_token;
  const refreshToken: string = body.refresh_token ?? "";
  const expiresIn = parseInt(String(body.expires_in ?? "3600"), 10);

  if (!accessToken) throw new Error("buildAdminSession: no access_token in response");

  const payloadB64 = accessToken.split(".")[1];
  const { sub: userId } = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as {
    sub: string;
  };

  const { data: userData, error } = await _admin.auth.admin.getUserById(userId);
  if (error || !userData?.user) {
    throw new Error(`buildAdminSession: getUserById failed: ${error?.message}`);
  }

  return {
    storageKey: getStorageKey(),
    sessionValue: {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: userData.user,
    },
  };
}
