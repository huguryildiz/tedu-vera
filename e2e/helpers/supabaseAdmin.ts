import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
 * produced by visiting the invite action_link.
 *
 * Supabase requires redirect_to to be in the project's allowed-URL list.
 * In local E2E environments localhost isn't in that list, so Supabase
 * ignores redirect_to and sends the token to the site URL instead.
 * We follow the redirect with a manual fetch, extract the hash from the
 * Location header, and return it so tests can navigate directly to the
 * local app route with the token already in the hash.
 */
export async function extractInviteHash(
  email: string,
  appBase: string
): Promise<string> {
  const actionLink = await generateInviteLink(email, `${appBase}/invite/accept`);
  const res = await fetch(actionLink, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const hashIdx = location.indexOf("#");
  if (hashIdx === -1) {
    throw new Error(`No hash fragment in Supabase redirect. Location: ${location.slice(0, 120)}`);
  }
  return location.slice(hashIdx); // "#access_token=...&refresh_token=...&type=invite"
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
export async function buildInviteSession(
  email: string,
  appBase: string
): Promise<{ storageKey: string; sessionValue: object }> {
  const hash = await extractInviteHash(email, appBase);

  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? "";
  const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10);
  if (!accessToken) throw new Error("No access_token in invite hash");

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
 * Reads score_sheets (with nested score_sheet_items) for a given juror+period.
 * Uses the service-role client so RLS is bypassed — suitable for test assertions.
 * Returns an empty array if no sheets exist yet.
 */
export async function readRubricScores(jurorId: string, periodId: string) {
  const { data, error } = await adminClient
    .from("score_sheets")
    .select("id, juror_id, period_id, project_id, status, score_sheet_items(score_value)")
    .eq("juror_id", jurorId)
    .eq("period_id", periodId);
  if (error) throw new Error(`readRubricScores failed: ${error.message}`);
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
