import { createClient } from "@supabase/supabase-js";

// E2E_SUPABASE_URL is required. Falling back to VITE_SUPABASE_URL would point
// the service-role admin client at prod and let test fixtures pollute it.
const supabaseUrl = process.env.E2E_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl) {
  throw new Error(
    "E2E_SUPABASE_URL is not set. Refusing to run E2E against an unset target. " +
      "Set E2E_SUPABASE_URL to the dedicated E2E Supabase project URL.",
  );
}
// Block only when VITE_SUPABASE_URL points at a hosted Supabase project
// (*.supabase.co). In CI both env vars point at the same local CLI emulator
// (127.0.0.1) and that's safe — only collision with a real prod URL is dangerous.
const _viteUrl = process.env.VITE_SUPABASE_URL || "";
const _viteHosted = (() => {
  try { return new URL(_viteUrl).hostname.endsWith(".supabase.co"); }
  catch { return false; }
})();
if (_viteUrl && supabaseUrl === _viteUrl && _viteHosted) {
  throw new Error(
    "E2E_SUPABASE_URL must not equal VITE_SUPABASE_URL (the prod URL). " +
      "Use a separate Supabase project for E2E.",
  );
}

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function generateRecoveryLink(email: string): Promise<string> {
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error || !data?.properties?.action_link) {
    throw new Error(`generateRecoveryLink failed: ${error?.message}`);
  }
  return data.properties.action_link;
}

export async function generateInviteLink(
  email: string,
  redirectTo?: string
): Promise<string> {
  const opts: Parameters<typeof adminClient.auth.admin.generateLink>[0] = {
    type: "invite",
    email,
  };
  if (redirectTo) opts.options = { redirectTo };
  const { data, error } = await adminClient.auth.admin.generateLink(opts);
  if (error || !data?.properties?.action_link) {
    throw new Error(`generateInviteLink failed: ${error?.message}`);
  }
  return data.properties.action_link;
}

/**
 * Returns the URL hash fragment (e.g. "#access_token=...&type=invite")
 * produced by visiting a Supabase auth action_link (invite or recovery).
 *
 * Supabase requires redirect_to to be in the project's allowed-URL list.
 * In local E2E environments localhost isn't in that list, so Supabase
 * ignores redirect_to and sends the token to the site URL instead.
 * We follow the redirect with a manual fetch, extract the hash from the
 * Location header, and return it so tests can navigate directly to the
 * local app route with the token already in the hash.
 */
export async function extractAuthHash(
  type: "invite" | "recovery",
  email: string,
  appBase: string,
): Promise<string> {
  const redirectPath = type === "invite" ? "/invite/accept" : "/reset-password";
  const actionLink =
    type === "invite"
      ? await generateInviteLink(email, `${appBase}${redirectPath}`)
      : await generateRecoveryLink(email);
  const res = await fetch(actionLink, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const hashIdx = location.indexOf("#");
  if (hashIdx === -1) {
    throw new Error(`No hash fragment in Supabase redirect. Location: ${location.slice(0, 120)}`);
  }
  return location.slice(hashIdx); // "#access_token=...&refresh_token=...&type=invite|recovery"
}

/** Back-compat alias — existing tests import extractInviteHash. */
export async function extractInviteHash(email: string, appBase: string): Promise<string> {
  return extractAuthHash("invite", email, appBase);
}

/**
 * Generates an invite for `email`, follows the action_link to obtain the session
 * tokens, fetches the full user record from the admin API, and returns a
 * localStorage session object ready to be injected into the browser page.
 *
 * Why admin getUserById instead of decoding the JWT payload:
 *   The JWT payload uses `sub` for the user ID, but Supabase JS v2 expects
 *   `user.id` in the stored session. Using the admin API gives us the full,
 *   correctly-keyed User object the SDK expects without any field mapping.
 *
 * Why localStorage injection instead of URL hash navigation:
 *   This project issues ES256 (ECDSA P-256) JWTs. When the Supabase JS client
 *   processes the #access_token hash it exchanges the token via a PostgREST
 *   endpoint that rejects ES256 signatures. Pre-seeding localStorage lets the
 *   SDK restore the session on init via the Auth-v1 path (tolerates ES256).
 */
async function buildAuthSession(
  type: "invite" | "recovery",
  email: string,
  appBase: string,
): Promise<{ storageKey: string; sessionValue: object }> {
  const hash = await extractAuthHash(type, email, appBase);

  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? "";
  const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10);
  if (!accessToken) throw new Error(`No access_token in ${type} hash`);

  // Decode the sub (user ID) from the JWT payload without verifying the signature
  const payloadB64 = accessToken.split(".")[1];
  const jwtPayload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  const userId: string = jwtPayload.sub;

  // Fetch the properly-shaped User object from the admin API
  const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    throw new Error(`getUserById failed: ${userErr?.message}`);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const sessionValue = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: userData.user,
  };
  return { storageKey, sessionValue };
}

export function buildInviteSession(email: string, appBase: string) {
  return buildAuthSession("invite", email, appBase);
}

/**
 * Builds a recovery session storage payload for injection into localStorage.
 * Mirrors buildInviteSession; same cross-project ES256 rationale — see that
 * function's docstring. Use for /reset-password E2E flows where generating
 * a real recovery email + intercepting the link isn't feasible.
 */
export function buildRecoverySession(email: string, appBase: string) {
  return buildAuthSession("recovery", email, appBase);
}

export async function deleteUserByEmail(email: string): Promise<void> {
  // listUsers paginates (default 50/page); iterate until found or exhausted
  let page = 1;
  while (true) {
    const { data } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    const user = data?.users?.find((u) => u.email === email);
    if (user) {
      await deleteUserById(user.id);
      return;
    }
    if (!data?.users?.length || data.users.length < 1000) break;
    page++;
  }
}

/**
 * Directly sets juror_period_auth fields to simulate an admin having toggled
 * edit mode (or its expiration). We bypass rpc_juror_toggle_edit_mode here
 * because that RPC requires auth.uid() to match a tenant admin membership,
 * which the service-role adminClient does not satisfy. Writing the same
 * resulting columns reproduces the state rpc_jury_upsert_score checks.
 */
export async function setJurorEditMode(
  jurorId: string,
  periodId: string,
  fields: {
    final_submitted_at?: string | null;
    edit_enabled?: boolean;
    edit_reason?: string | null;
    edit_expires_at?: string | null;
    session_token_hash?: string | null;
    session_expires_at?: string | null;
  },
): Promise<void> {
  const { error } = await adminClient
    .from("juror_period_auth")
    .update(fields)
    .eq("juror_id", jurorId)
    .eq("period_id", periodId);
  if (error) throw new Error(`setJurorEditMode failed: ${error.message}`);
}

/**
 * Seeds a usable session_token_hash so service-role-driven test calls can
 * invoke rpc_jury_upsert_score (which verifies session_token_hash against
 * sha256(plaintext)). Returns the plaintext token for the caller to use.
 */
export async function seedJurorSession(
  jurorId: string,
  periodId: string,
  hoursValid = 12,
): Promise<string> {
  const { randomBytes, createHash } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + hoursValid * 3600 * 1000).toISOString();
  const { error } = await adminClient
    .from("juror_period_auth")
    .update({ session_token_hash: hash, session_expires_at: expiresAt })
    .eq("juror_id", jurorId)
    .eq("period_id", periodId);
  if (error) throw new Error(`seedJurorSession failed: ${error.message}`);
  return token;
}

export async function readJurorAuth(jurorId: string, periodId: string) {
  const { data, error } = await adminClient
    .from("juror_period_auth")
    .select(
      "failed_attempts, locked_until, is_blocked, session_token_hash, final_submitted_at, edit_enabled, edit_reason, edit_expires_at",
    )
    .eq("juror_id", jurorId)
    .eq("period_id", periodId)
    .single();
  if (error) throw new Error(`readJurorAuth failed: ${error.message}`);
  return data;
}

export async function resetJurorAuth(jurorId: string, periodId: string): Promise<void> {
  const { error } = await adminClient
    .from("juror_period_auth")
    .update({
      failed_attempts: 0,
      locked_until: null,
      final_submitted_at: null,
      session_token_hash: null, // F1: prevents cross-test session leak
      edit_enabled: false,
      edit_reason: null,
      edit_expires_at: null,
    })
    .eq("juror_id", jurorId)
    .eq("period_id", periodId);
  if (error) throw new Error(`resetJurorAuth failed: ${error.message}`);
}

/**
 * Reads score_sheets (with nested score_sheet_items) for a given juror+period.
 * Uses the service-role client so RLS is bypassed — suitable for test assertions.
 * Returns an empty array if no sheets exist yet.
 */
/**
 * Delete score_sheets matching the filter, bypassing the
 * `block_score_sheet_delete` trigger (which fires on activated periods).
 *
 * Captures the period's current `activated_at`, clears it for the delete, then
 * restores it. Use only in test fixtures where the trigger needs to be
 * bypassed for state reset.
 */
export async function deleteScoreSheetsForJurorPeriod(
  jurorId: string,
  periodId: string,
): Promise<void> {
  const { data: periodRow } = await adminClient
    .from("periods")
    .select("activated_at")
    .eq("id", periodId)
    .single();
  const savedActivatedAt = periodRow?.activated_at ?? null;
  if (savedActivatedAt) {
    await adminClient
      .from("periods")
      .update({ activated_at: null })
      .eq("id", periodId);
  }
  const { error } = await adminClient
    .from("score_sheets")
    .delete()
    .eq("juror_id", jurorId)
    .eq("period_id", periodId);
  if (savedActivatedAt) {
    await adminClient
      .from("periods")
      .update({ activated_at: savedActivatedAt })
      .eq("id", periodId);
  }
  if (error) throw new Error(`deleteScoreSheetsForJurorPeriod failed: ${error.message}`);
}

export async function readRubricScores(jurorId: string, periodId: string) {
  const { data, error } = await adminClient
    .from("score_sheets")
    .select("id, juror_id, period_id, project_id, status, score_sheet_items(score_value)")
    .eq("juror_id", jurorId)
    .eq("period_id", periodId);
  if (error) throw new Error(`readRubricScores failed: ${error.message}`);
  return data ?? [];
}

/**
 * Reads audit_logs rows matching the given action and optional filters.
 * Pass orgId=null to match rows where organization_id IS NULL (e.g. auth failure events).
 */
export async function readAuditLogs(
  orgId: string | null,
  action: string,
  since?: string,
  actorName?: string,
): Promise<any[]> {
  let query = adminClient
    .from("audit_logs")
    .select("*")
    .eq("action", action)
    .order("created_at", { ascending: false });

  if (orgId !== null) {
    query = query.eq("organization_id", orgId);
  } else {
    query = query.is("organization_id", null);
  }

  if (since) {
    query = query.gte("created_at", since);
  }

  if (actorName) {
    query = query.eq("actor_name", actorName);
  }

  const { data, error } = await query;
  if (error) throw new Error(`readAuditLogs failed: ${error.message}`);
  return data ?? [];
}

// Full cascading cleanup needed because several public tables reference profiles(id)
// without ON DELETE CASCADE:
//   audit_logs.user_id → profiles(id)   (nullable — null it out)
//   profiles.id        → auth.users(id) (no cascade)
export async function deleteUserById(userId: string): Promise<void> {
  await adminClient.from("audit_logs").update({ user_id: null }).eq("user_id", userId);
  await adminClient.from("profiles").delete().eq("id", userId);
  await adminClient.auth.admin.deleteUser(userId);
}
