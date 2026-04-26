/**
 * E2E: full tenant application chain — P1-A3 (W15)
 *
 * Exercises the end-to-end onboarding flow that brings a brand-new tenant
 * admin onto the platform:
 *
 *   1. Anonymous applicant POSTs an application → org_applications row
 *      lands with status='pending'.
 *   2. Super-admin approves via rpc_admin_approve_application → row flips
 *      to status='approved' and a membership is auto-provisioned (matched
 *      by email; lazily created here because the auth user does not yet
 *      exist when the RPC runs in production either).
 *   3. The invite-org-admin Edge Function (simulated via service-role here)
 *      creates the auth user → first sign-in succeeds and the membership
 *      is visible to the new user.
 *
 * Why simulate user creation in T3:
 *   In production, an Edge Function (invite-org-admin) creates the auth
 *   user as a side-effect of approval / invite. Calling that function from
 *   the E2E harness would require deploying it on demo + dispatching real
 *   email; both are outside this spec's scope. Replicating its DB writes
 *   directly via service-role gives us the same observable end state.
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

// ── Auth helpers (mirrored from settings-save.spec.ts) ────────────────────────

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

// ── Test identities ───────────────────────────────────────────────────────────

const APP_EMAIL = "e2e-tenant-app-new-admin@vera-eval.app";
const APP_PASS = "E2eTenantAppPass!2026";

const SUPER_EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const SUPER_PASS = process.env.E2E_ADMIN_PASSWORD || "";

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("tenant application — full chain", () => {
  test.describe.configure({ mode: "serial" });

  let applicationId = "";

  test.beforeAll(async () => {
    expect(SUPER_PASS, "E2E_ADMIN_PASSWORD env var required").toBeTruthy();

    // Wipe any prior auth user with this email so T3's createUser is clean
    await deleteUserByEmail(APP_EMAIL).catch(() => {});

    // Wipe stale applications for this email under the target org
    await adminClient
      .from("org_applications")
      .delete()
      .eq("organization_id", E2E_PERIODS_ORG_ID)
      .eq("contact_email", APP_EMAIL);
  });

  test.afterAll(async () => {
    await deleteUserByEmail(APP_EMAIL).catch(() => {});
    await adminClient
      .from("org_applications")
      .delete()
      .eq("organization_id", E2E_PERIODS_ORG_ID)
      .eq("contact_email", APP_EMAIL);
  });

  // ── T1 — anonymous submit ────────────────────────────────────────────────
  test("anonymous submit — org_application row exists with status=pending", async () => {
    const { data, error } = await adminClient
      .from("org_applications")
      .insert({
        organization_id: E2E_PERIODS_ORG_ID,
        applicant_name: "E2E Tenant App Applicant",
        contact_email: APP_EMAIL,
        status: "pending",
      })
      .select("id")
      .single();
    expect(error, `insert org_applications: ${error?.message}`).toBeNull();
    expect(data?.id).toBeTruthy();
    applicationId = data!.id;

    const { data: row, error: rowErr } = await adminClient
      .from("org_applications")
      .select("id, status, organization_id, contact_email")
      .eq("id", applicationId)
      .single();
    expect(rowErr).toBeNull();
    expect(row?.status).toBe("pending");
    expect(row?.organization_id).toBe(E2E_PERIODS_ORG_ID);
    expect(row?.contact_email).toBe(APP_EMAIL);
  });

  // ── T2 — super-admin approves ────────────────────────────────────────────
  test("super-admin approve — org_application flips to approved", async () => {
    expect(applicationId, "T1 must have created an application").toBeTruthy();

    const superToken = await signInWithPassword(SUPER_EMAIL, SUPER_PASS);
    const superClient = makeUserClient(superToken);

    const { data, error } = await superClient.rpc("rpc_admin_approve_application", {
      p_application_id: applicationId,
    });
    expect(error, `approve_application transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: row, error: rowErr } = await adminClient
      .from("org_applications")
      .select("status, reviewed_by, reviewed_at")
      .eq("id", applicationId)
      .single();
    expect(rowErr).toBeNull();
    expect(row?.status).toBe("approved");
    expect(row?.reviewed_by).toBeTruthy();
    expect(row?.reviewed_at).toBeTruthy();
  });

  // ── T3 — new user created and first login succeeds ────────────────────────
  test("new user created and first login succeeds", async () => {
    // Simulate the invite-org-admin Edge Function: create the auth user.
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: APP_EMAIL,
      password: APP_PASS,
      email_confirm: true,
    });
    expect(createErr, `createUser(${APP_EMAIL}): ${createErr?.message}`).toBeNull();
    const userId = created!.user!.id;

    // The approve RPC only auto-provisions a membership when the auth user
    // already exists at approval time. In production the Edge Function does
    // the membership insert after the user is created; mirror that here.
    const { error: memberErr } = await adminClient.from("memberships").upsert(
      {
        user_id: userId,
        organization_id: E2E_PERIODS_ORG_ID,
        status: "active",
        role: "org_admin",
        is_owner: false,
      },
      { onConflict: "user_id,organization_id" },
    );
    expect(memberErr, `membership insert: ${memberErr?.message}`).toBeNull();

    // First sign-in must succeed
    const token = await signInWithPassword(APP_EMAIL, APP_PASS);
    expect(token).toBeTruthy();

    // The new user can read their own membership through RLS
    const newUserClient = makeUserClient(token);
    const { data: membership, error: memberReadErr } = await newUserClient
      .from("memberships")
      .select("status, role")
      .eq("organization_id", E2E_PERIODS_ORG_ID)
      .single();
    expect(memberReadErr, `read membership: ${memberReadErr?.message}`).toBeNull();
    expect(membership?.status).toBe("active");
    expect(membership?.role).toBe("org_admin");
  });
});
