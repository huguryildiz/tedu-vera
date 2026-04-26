/**
 * E2E: Reviews-related admin write paths — Phase 1 Task 1.2.
 *
 * The plan asked for `rpc_admin_edit_score` persistence + audit tests, but
 * VERA does NOT expose a "single-score edit" RPC. The actual workflow is:
 *
 *   1. Admin force-closes a juror's edit mode (rpc_admin_force_close_juror_edit_mode)
 *   2. Admin requests an unlock for a locked period (rpc_admin_request_unlock)
 *   3. Super admin approves/rejects the request (rpc_super_admin_resolve_unlock)
 *   4. Juror re-submits via rpc_jury_upsert_score (audited as juror.score.edited)
 *
 * Steps 1–3 are the admin write paths exposed via the Reviews/Periods UI and
 * are the ones premium SaaS test coverage must verify. This spec covers them.
 *
 * Step 4 (juror-side resubmit + audit) is already exercised by
 * e2e/admin/reviews.spec.ts and the broader scoringFixture-based suites.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  adminClient,
  deleteUserByEmail,
  setJurorEditMode,
  resetJurorAuth,
} from "../helpers/supabaseAdmin";
import { assertAuditEntry } from "../helpers/auditHelpers";
import {
  setupOutcomeFixture,
  teardownOutcomeFixture,
  type OutcomeFixture,
} from "../helpers/outcomeFixture";
import { EVAL_PERIOD_ID, EVAL_JURORS, E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_DEMO_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";
const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

async function signInWithPassword(
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) failed ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.access_token as string;
}

function makeUserClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ADMIN_EMAIL = "e2e-reviews-admin@vera-eval.app";
const SUPER_EMAIL = "e2e-reviews-super@vera-eval.app";
const PASS = "E2eReviewsPass!2026";

test.describe("reviews — admin write paths + audit", () => {
  test.describe.configure({ mode: "serial" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adminAuthClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let superAuthClient: any;
  let adminUserId: string;
  let superUserId: string;
  let outcomeFixture: OutcomeFixture | null = null;

  test.beforeAll(async () => {
    // Create org_admin
    await deleteUserByEmail(ADMIN_EMAIL).catch(() => {});
    const { data: a, error: aErr } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: PASS,
      email_confirm: true,
    });
    expect(aErr, `createUser admin: ${aErr?.message}`).toBeNull();
    adminUserId = a!.user!.id;
    await adminClient.from("memberships").insert({
      user_id: adminUserId,
      organization_id: E2E_PERIODS_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: false,
    });
    const adminToken = await signInWithPassword(ADMIN_EMAIL, PASS);
    adminAuthClient = makeUserClient(adminToken);

    // Create super_admin
    await deleteUserByEmail(SUPER_EMAIL).catch(() => {});
    const { data: s, error: sErr } = await adminClient.auth.admin.createUser({
      email: SUPER_EMAIL,
      password: PASS,
      email_confirm: true,
    });
    expect(sErr, `createUser super: ${sErr?.message}`).toBeNull();
    superUserId = s!.user!.id;
    await adminClient.from("memberships").insert({
      user_id: superUserId,
      organization_id: null,
      status: "active",
      role: "super_admin",
      is_owner: false,
    });
    const superToken = await signInWithPassword(SUPER_EMAIL, PASS);
    superAuthClient = makeUserClient(superToken);
  });

  test.afterAll(async () => {
    await teardownOutcomeFixture(outcomeFixture);
    outcomeFixture = null;
    await deleteUserByEmail(ADMIN_EMAIL).catch(() => {});
    await deleteUserByEmail(SUPER_EMAIL).catch(() => {});
  });

  // e2e.admin.reviews.audit.force_close_edit_mode
  test("force-close juror edit mode → audit row written with juror+period payload", async () => {
    const jurorId = EVAL_JURORS[2].id; // distinct from reviews.spec.ts to avoid collisions
    const periodId = EVAL_PERIOD_ID;

    // Put the juror into edit mode first so force-close has something to undo
    await setJurorEditMode(jurorId, periodId, {
      final_submitted_at: new Date().toISOString(),
      edit_enabled: true,
      edit_reason: "phase-1 audit test setup",
      edit_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const { data, error } = await adminAuthClient.rpc(
      "rpc_admin_force_close_juror_edit_mode",
      { p_juror_id: jurorId, p_period_id: periodId },
    );
    expect(error, `force-close error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // DB-side state confirms the close happened
    const { data: row } = await adminClient
      .from("juror_period_auth")
      .select("edit_enabled, edit_reason")
      .eq("juror_id", jurorId)
      .eq("period_id", periodId)
      .single();
    expect(row?.edit_enabled).toBe(false);
    expect(row?.edit_reason).toBeNull();

    // Audit row must reflect the force-close — uses the helper foundation
    await assertAuditEntry({
      eventType: "data.juror.edit_mode.force_closed",
      targetId: jurorId,
      actorId: adminUserId,
      orgId: E2E_PERIODS_ORG_ID,
      withinSeconds: 60,
      payloadIncludes: { close_source: "admin_force", juror_id: jurorId, period_id: periodId },
    });

    await resetJurorAuth(jurorId, periodId);
  });

  // e2e.admin.reviews.audit.unlock_request_create
  test("unlock-request create → audit row written with reason + period_name", async () => {
    // Need a locked period that actually has scores; setupOutcomeFixture
    // builds exactly that — locks the period and seeds one score sheet.
    outcomeFixture = await setupOutcomeFixture({
      criteriaWeights: [{ key: "C1", weight: 100, max: 10 }],
      outcomeMappings: [{ outcomeCode: "OA", criterionKey: "C1", weight: 1.0 }],
      scores: [{ key: "C1", value: 8 }],
      namePrefix: "P1.2 unlock",
    });

    const reason = "Phase 1 unlock-request audit verification";
    const { data, error } = await adminAuthClient.rpc(
      "rpc_admin_request_unlock",
      { p_period_id: outcomeFixture.periodId, p_reason: reason },
    );
    expect(error, `request_unlock error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.request_id).toBeTruthy();

    await assertAuditEntry({
      eventType: "unlock_request.create",
      targetId: data.request_id as string,
      actorId: adminUserId,
      orgId: E2E_PERIODS_ORG_ID,
      withinSeconds: 60,
      payloadIncludes: { reason, period_id: outcomeFixture.periodId },
    });
  });

  // e2e.admin.reviews.audit.unlock_request_resolve
  test("super admin approves unlock → audit row written + period unlocked", async () => {
    // Reuse the request created by the previous test
    const { data: pending } = await adminClient
      .from("unlock_requests")
      .select("id, period_id")
      .eq("organization_id", E2E_PERIODS_ORG_ID)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(pending?.length, "previous test should have left one pending request").toBeGreaterThan(0);
    const requestId = pending![0].id as string;
    const periodId = pending![0].period_id as string;

    const { data, error } = await superAuthClient.rpc(
      "rpc_super_admin_resolve_unlock",
      { p_request_id: requestId, p_decision: "approved", p_note: "phase-1 ok" },
    );
    expect(error, `resolve_unlock error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // Period must now be unlocked
    const { data: pr } = await adminClient
      .from("periods")
      .select("is_locked")
      .eq("id", periodId)
      .single();
    expect(pr?.is_locked).toBe(false);

    await assertAuditEntry({
      eventType: "unlock_request.resolve",
      targetId: requestId,
      actorId: superUserId,
      orgId: E2E_PERIODS_ORG_ID,
      withinSeconds: 60,
      payloadIncludes: { decision: "approved" },
    });
  });

  // e2e.admin.reviews.rbac.force_close_unauthenticated
  test("RBAC: anonymous client cannot call rpc_admin_force_close_juror_edit_mode", async () => {
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await anonClient.rpc(
      "rpc_admin_force_close_juror_edit_mode",
      { p_juror_id: EVAL_JURORS[2].id, p_period_id: EVAL_PERIOD_ID },
    );
    expect(error, "anon caller must be rejected").not.toBeNull();
  });
});
