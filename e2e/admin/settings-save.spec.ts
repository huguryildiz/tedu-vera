/**
 * E2E: settings-save flows — P0-E1 (W10)
 *
 * Covers four save flows that had zero E2E coverage:
 *   1. Security policy  — super admin changes maxPinAttempts, DB row confirms new value
 *   2. PIN policy       — org admin changes pin settings, re-fetched via get RPC
 *   3. Team CRUD        — org owner cancels an invited membership row
 *   4. Change password  — user updates password, new password works for sign-in
 *
 * All tests are RPC/API-level (no browser UI) for stability. Each test
 * reverts its changes; the afterAll guard restores the full original policy.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

// ── Supabase connection ───────────────────────────────────────────────────────

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_DEMO_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function signInWithPassword(email: string, password: string): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) failed ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body.access_token) throw new Error(`No access_token for ${email}`);
  return body.access_token as string;
}

function makeUserClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Change a user's password via the Supabase Auth REST endpoint. */
async function changePasswordViaApi(accessToken: string, newPassword: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) throw new Error(`changePassword failed ${res.status}: ${await res.text()}`);
}

// ── Test user identities ──────────────────────────────────────────────────────

const SUPER_EMAIL = "e2e-settings-super@vera-eval.app";
const OWNER_EMAIL = "e2e-settings-owner@vera-eval.app";
const ORG_EMAIL   = "e2e-settings-org@vera-eval.app";
const PWD_EMAIL   = "e2e-settings-pwd@vera-eval.app";
const SHARED_PASS = "E2eSettingsPass!2026";
const NEW_PASS    = "E2eSettingsNew!2026";

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("settings-save flows", () => {
  test.describe.configure({ mode: "serial" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let superClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orgClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ownerClient: any;

  let originalPolicy: Record<string, unknown> = {};

  test.beforeAll(async () => {
    // ── Save original security_policy so afterAll can fully restore it ──────
    const { data: policyRow } = await adminClient
      .from("security_policy")
      .select("policy")
      .eq("id", 1)
      .single();
    if (policyRow?.policy) originalPolicy = { ...(policyRow.policy as Record<string, unknown>) };

    // ── Create super admin ──────────────────────────────────────────────────
    await deleteUserByEmail(SUPER_EMAIL).catch(() => {});
    const { data: superData, error: superErr } = await adminClient.auth.admin.createUser({
      email: SUPER_EMAIL,
      password: SHARED_PASS,
      email_confirm: true,
    });
    expect(superErr, `createUser(super): ${superErr?.message}`).toBeNull();
    const { error: superMemberErr } = await adminClient.from("memberships").insert({
      user_id: superData!.user!.id,
      organization_id: null,
      status: "active",
      role: "super_admin",
      is_owner: false,
    });
    expect(superMemberErr, `membership(super): ${superMemberErr?.message}`).toBeNull();

    // ── Create org owner (can cancel invites) ───────────────────────────────
    await deleteUserByEmail(OWNER_EMAIL).catch(() => {});
    const { data: ownerData, error: ownerErr } = await adminClient.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: SHARED_PASS,
      email_confirm: true,
    });
    expect(ownerErr, `createUser(owner): ${ownerErr?.message}`).toBeNull();
    const { error: ownerMemberErr } = await adminClient.from("memberships").insert({
      user_id: ownerData!.user!.id,
      organization_id: E2E_PERIODS_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: true,
    });
    expect(ownerMemberErr, `membership(owner): ${ownerMemberErr?.message}`).toBeNull();

    // ── Create org admin (non-owner, for PIN policy) ────────────────────────
    await deleteUserByEmail(ORG_EMAIL).catch(() => {});
    const { data: orgData, error: orgErr } = await adminClient.auth.admin.createUser({
      email: ORG_EMAIL,
      password: SHARED_PASS,
      email_confirm: true,
    });
    expect(orgErr, `createUser(org): ${orgErr?.message}`).toBeNull();
    const { error: orgMemberErr } = await adminClient.from("memberships").insert({
      user_id: orgData!.user!.id,
      organization_id: E2E_PERIODS_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: false,
    });
    expect(orgMemberErr, `membership(org): ${orgMemberErr?.message}`).toBeNull();

    // ── Sign all users in ───────────────────────────────────────────────────
    const superToken = await signInWithPassword(SUPER_EMAIL, SHARED_PASS);
    superClient = makeUserClient(superToken);

    const ownerToken = await signInWithPassword(OWNER_EMAIL, SHARED_PASS);
    ownerClient = makeUserClient(ownerToken);

    const orgToken = await signInWithPassword(ORG_EMAIL, SHARED_PASS);
    orgClient = makeUserClient(orgToken);
  });

  test.afterAll(async () => {
    // Restore original policy (guards against any mid-test failure)
    if (Object.keys(originalPolicy).length > 0) {
      await adminClient
        .from("security_policy")
        .update({ policy: originalPolicy })
        .eq("id", 1);
    }
    await deleteUserByEmail(SUPER_EMAIL).catch(() => {});
    await deleteUserByEmail(OWNER_EMAIL).catch(() => {});
    await deleteUserByEmail(ORG_EMAIL).catch(() => {});
    await deleteUserByEmail(PWD_EMAIL).catch(() => {});
  });

  // ── Test 1: Security policy ────────────────────────────────────────────────

  test("security policy: super admin saves maxPinAttempts, DB row reflects new value", async () => {
    const originalAttempts = (originalPolicy.maxPinAttempts as number) ?? 5;
    const newAttempts = originalAttempts === 7 ? 8 : 7;

    // Change via RPC
    const { data, error } = await superClient.rpc("rpc_admin_set_security_policy", {
      p_policy: { maxPinAttempts: newAttempts },
    });
    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // Verify DB row via service-role client (bypasses RLS)
    const { data: row, error: rowErr } = await adminClient
      .from("security_policy")
      .select("policy, updated_at")
      .eq("id", 1)
      .single();
    expect(rowErr).toBeNull();
    expect((row?.policy as Record<string, unknown>)?.maxPinAttempts).toBe(newAttempts);
    expect(row?.updated_at).toBeTruthy();

    // Revert
    await superClient.rpc("rpc_admin_set_security_policy", {
      p_policy: { maxPinAttempts: originalAttempts },
    });

    // Confirm revert
    const { data: reverted } = await adminClient
      .from("security_policy")
      .select("policy")
      .eq("id", 1)
      .single();
    expect((reverted?.policy as Record<string, unknown>)?.maxPinAttempts).toBe(originalAttempts);
  });

  // ── Test 2: PIN policy ─────────────────────────────────────────────────────

  test("PIN policy: org admin saves settings, re-fetched via rpc_admin_get_pin_policy", async () => {
    const originalAttempts = (originalPolicy.maxPinAttempts as number) ?? 5;
    const newAttempts = originalAttempts === 9 ? 10 : 9;
    const originalCooldown = (originalPolicy.pinLockCooldown as string) ?? "30m";
    const originalQrTtl = (originalPolicy.qrTtl as string) ?? "24h";

    // Change via rpc_admin_set_pin_policy (org admin + super admin)
    const { data, error } = await orgClient.rpc("rpc_admin_set_pin_policy", {
      p_max_attempts: newAttempts,
      p_cooldown: originalCooldown,
      p_qr_ttl: originalQrTtl,
    });
    expect(error, `set_pin_policy error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // Re-fetch via rpc_admin_get_pin_policy
    const { data: policy, error: getErr } = await orgClient.rpc("rpc_admin_get_pin_policy");
    expect(getErr, `get_pin_policy error: ${getErr?.message}`).toBeNull();
    expect(policy?.maxPinAttempts).toBe(newAttempts);
    expect(policy?.pinLockCooldown).toBe(originalCooldown);
    expect(policy?.qrTtl).toBe(originalQrTtl);

    // Revert
    await orgClient.rpc("rpc_admin_set_pin_policy", {
      p_max_attempts: originalAttempts,
      p_cooldown: originalCooldown,
      p_qr_ttl: originalQrTtl,
    });

    const { data: reverted } = await orgClient.rpc("rpc_admin_get_pin_policy");
    expect(reverted?.maxPinAttempts).toBe(originalAttempts);
  });

  // ── Test 3: Team CRUD ──────────────────────────────────────────────────────

  test("team CRUD: invite member creates membership row, cancel removes it", async () => {
    // Create an auth user to simulate a pending invite (Edge Function creates a real user then
    // inserts an 'invited' membership — we replicate that state directly via service-role client).
    const INVITE_EMAIL = "e2e-invited-member@vera-eval.app";
    await deleteUserByEmail(INVITE_EMAIL).catch(() => {});
    const { data: invitedUser, error: createInvitedErr } =
      await adminClient.auth.admin.createUser({
        email: INVITE_EMAIL,
        password: SHARED_PASS,
        email_confirm: true,
      });
    expect(createInvitedErr, `createUser(invited): ${createInvitedErr?.message}`).toBeNull();
    const invitedUserId = invitedUser!.user!.id;

    const { data: inviteData, error: insertErr } = await adminClient
      .from("memberships")
      .insert({
        user_id: invitedUserId,
        organization_id: E2E_PERIODS_ORG_ID,
        status: "invited",
        role: "org_admin",
        is_owner: false,
      })
      .select("id")
      .single();
    expect(insertErr, `insert invited membership: ${insertErr?.message}`).toBeNull();
    const membershipId = inviteData!.id;

    // Verify invited row exists
    const { data: check, error: checkErr } = await adminClient
      .from("memberships")
      .select("id, status")
      .eq("id", membershipId)
      .single();
    expect(checkErr).toBeNull();
    expect(check?.status).toBe("invited");

    // Cancel invite via RPC as org owner
    const { data: cancelData, error: cancelErr } = await ownerClient.rpc(
      "rpc_org_admin_cancel_invite",
      { p_membership_id: membershipId },
    );
    expect(cancelErr, `cancel invite error: ${cancelErr?.message}`).toBeNull();
    expect(cancelData?.ok).toBe(true);

    // Verify row is gone
    const { data: gone, error: goneErr } = await adminClient
      .from("memberships")
      .select("id")
      .eq("id", membershipId)
      .maybeSingle();
    expect(goneErr).toBeNull();
    expect(gone).toBeNull();
  });

  // ── Test 4: Change password ────────────────────────────────────────────────

  test("change password: new password works for sign-in, old password fails", async () => {
    // Create a dedicated user for this test
    await deleteUserByEmail(PWD_EMAIL).catch(() => {});
    const { data: pwdData, error: createErr } = await adminClient.auth.admin.createUser({
      email: PWD_EMAIL,
      password: SHARED_PASS,
      email_confirm: true,
    });
    expect(createErr, `createUser(pwd): ${createErr?.message}`).toBeNull();

    // Sign in with original password — must succeed
    const originalToken = await signInWithPassword(PWD_EMAIL, SHARED_PASS);
    expect(originalToken).toBeTruthy();

    // Change password via Supabase Auth REST API (same endpoint ChangePasswordDrawer calls)
    await changePasswordViaApi(originalToken, NEW_PASS);

    // Old password must now fail
    const oldPassRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: PWD_EMAIL, password: SHARED_PASS }),
    });
    expect(oldPassRes.ok, "old password should be rejected after change").toBe(false);

    // New password must succeed
    const newToken = await signInWithPassword(PWD_EMAIL, NEW_PASS);
    expect(newToken).toBeTruthy();

    // Cleanup (also handled in afterAll)
    const userId = pwdData!.user!.id;
    await adminClient.from("audit_logs").update({ user_id: null }).eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);
    await adminClient.auth.admin.deleteUser(userId);
  });
});
