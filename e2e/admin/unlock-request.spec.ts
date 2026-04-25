import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  setupScoringFixture,
  teardownScoringFixture,
  writeScoresAsJuror,
  ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

// URL + anon key — same resolution order as supabaseAdmin.ts so auth targets the same DB.
const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_DEMO_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

/**
 * Exchange email + password for an access token via Supabase password grant.
 * Returns the JWT so we can build a client that carries a real auth.uid().
 */
async function signInWithPassword(email: string, password: string): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`signIn(${email}) failed ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.access_token) throw new Error(`No access_token for ${email}`);
  return body.access_token as string;
}

/**
 * Build a Supabase client whose requests carry the given JWT in the
 * Authorization header. RPC calls made through this client resolve
 * auth.uid() correctly (unlike service-role which returns NULL).
 */
function makeUserClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const TENANT_EMAIL = "e2e-unlock-tenant@vera-eval.app";
const SUPER_EMAIL = "e2e-unlock-super@vera-eval.app";
const SHARED_PASS = "E2eUnlockPass!2026";

test.describe("unlock-request flow", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenantClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let superClient: any;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({ namePrefix: "E5 Unlock Request" });

    // Write scores so the period has content, then lock it
    await writeScoresAsJuror(fixture, {
      p1: { a: 10, b: 20 },
      p2: { a: 15, b: 25 },
    });
    await adminClient
      .from("periods")
      .update({ is_locked: true })
      .eq("id", fixture.periodId);

    // Create tenant-admin: admin of the period's org (org-scoped membership)
    await deleteUserByEmail(TENANT_EMAIL).catch(() => {});
    const { data: tenantData, error: tenantErr } = await adminClient.auth.admin.createUser({
      email: TENANT_EMAIL,
      password: SHARED_PASS,
      email_confirm: true,
    });
    expect(tenantErr, `createUser(tenant): ${tenantErr?.message}`).toBeNull();
    const { error: tenantMemberErr } = await adminClient.from("memberships").insert({
      user_id: tenantData!.user!.id,
      organization_id: E2E_PERIODS_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: false,
    });
    expect(tenantMemberErr, `membership(tenant): ${tenantMemberErr?.message}`).toBeNull();

    // Create super-admin: organization_id = null signals super-admin in VERA
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

    // Sign both users in; their JWTs carry a real auth.uid() so RPCs resolve correctly
    const tenantToken = await signInWithPassword(TENANT_EMAIL, SHARED_PASS);
    tenantClient = makeUserClient(tenantToken);

    const superToken = await signInWithPassword(SUPER_EMAIL, SHARED_PASS);
    superClient = makeUserClient(superToken);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
    await deleteUserByEmail(TENANT_EMAIL).catch(() => {});
    await deleteUserByEmail(SUPER_EMAIL).catch(() => {});
  });

  test("tenant-admin requests unlock → pending unlock_requests row created", async () => {
    if (!fixture) throw new Error("Fixture not set up");

    const { data, error } = await tenantClient.rpc("rpc_admin_request_unlock", {
      p_period_id: fixture.periodId,
      p_reason: "E5 unlock test — tenant admin request",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: request, error: queryErr } = await adminClient
      .from("unlock_requests")
      .select("id, period_id, status, reason")
      .eq("period_id", fixture.periodId)
      .eq("status", "pending")
      .single();

    expect(queryErr).toBeNull();
    expect(request?.status).toBe("pending");
    expect(request?.reason).toContain("E5 unlock test");
  });

  test("super-admin approves unlock → period.is_locked becomes false", async () => {
    if (!fixture) throw new Error("Fixture not set up");

    const { data: requests } = await adminClient
      .from("unlock_requests")
      .select("id")
      .eq("period_id", fixture.periodId)
      .eq("status", "pending");

    expect(requests?.length).toBeGreaterThan(0);
    const requestId = requests?.[0].id;
    expect(requestId).toBeTruthy();

    const { data, error } = await superClient.rpc("rpc_super_admin_resolve_unlock", {
      p_request_id: requestId,
      p_decision: "approved",
      p_note: "E5 unlock test — super admin approval",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: period, error: periodErr } = await adminClient
      .from("periods")
      .select("is_locked")
      .eq("id", fixture.periodId)
      .single();

    expect(periodErr).toBeNull();
    expect(period?.is_locked).toBe(false);

    const { data: request, error: requestErr } = await adminClient
      .from("unlock_requests")
      .select("status")
      .eq("period_id", fixture.periodId)
      .eq("status", "approved")
      .single();

    expect(requestErr).toBeNull();
    expect(request?.status).toBe("approved");
  });

  test("super-admin rejects unlock → period remains locked, request marked rejected", async () => {
    if (!fixture) throw new Error("Fixture not set up");

    // Re-lock the period for the rejection test
    await adminClient
      .from("periods")
      .update({ is_locked: true })
      .eq("id", fixture.periodId);

    const { error: reqErr } = await tenantClient.rpc("rpc_admin_request_unlock", {
      p_period_id: fixture.periodId,
      p_reason: "E5 unlock test — second request for rejection test",
    });
    expect(reqErr).toBeNull();

    const { data: requests } = await adminClient
      .from("unlock_requests")
      .select("id")
      .eq("period_id", fixture.periodId)
      .eq("status", "pending");

    expect(requests?.length).toBeGreaterThan(0);
    const requestId = requests?.[0].id;
    expect(requestId).toBeTruthy();

    const { data, error } = await superClient.rpc("rpc_super_admin_resolve_unlock", {
      p_request_id: requestId,
      p_decision: "rejected",
      p_note: "E5 unlock test — super admin rejection",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: period, error: periodErr } = await adminClient
      .from("periods")
      .select("is_locked")
      .eq("id", fixture.periodId)
      .single();

    expect(periodErr).toBeNull();
    expect(period?.is_locked).toBe(true);

    const { data: request, error: requestErr } = await adminClient
      .from("unlock_requests")
      .select("status")
      .eq("period_id", fixture.periodId)
      .eq("status", "rejected")
      .single();

    expect(requestErr).toBeNull();
    expect(request?.status).toBe("rejected");
  });
});
