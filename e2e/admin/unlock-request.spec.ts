import { test, expect } from "@playwright/test";
import {
  setupScoringFixture,
  teardownScoringFixture,
  writeScoresAsJuror,
  ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient } from "../helpers/supabaseAdmin";

// SKIPPED: rpc_admin_request_unlock uses auth.uid() to verify the caller is an
// admin of the target org. Calling it via adminClient (service role) returns
// auth.uid() = NULL, so the membership check fails and the RPC returns
// {ok: false, error_code: 'unauthorized'}. To make this spec meaningful, it
// must be rewritten to (a) create a real tenant-admin user, (b) sign them in
// via supabase.auth.signInWithPassword to get a JWT, and (c) call the RPC
// with that JWT in the Authorization header. The current shape that just
// service-role's the RPC cannot exercise the real authorization path.
test.describe.skip("unlock-request flow", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture | null = null;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({ namePrefix: "E5 Unlock Request" });
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  test("tenant-admin requests unlock → pending unlock_requests row created", async () => {
    if (!fixture) throw new Error("Fixture not set up");

    // First, seed scores so the RPC check passes (requires non-empty period)
    await writeScoresAsJuror(fixture, {
      p1: { a: 10, b: 20 },
      p2: { a: 15, b: 25 },
    });

    // Tenant-admin requests unlock
    const { data, error } = await adminClient.rpc("rpc_admin_request_unlock", {
      p_period_id: fixture.periodId,
      p_reason: "E5 unlock test — tenant admin request",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // Verify unlock_requests row was created in pending status
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

    // Get the pending unlock request
    const { data: requests } = await adminClient
      .from("unlock_requests")
      .select("id")
      .eq("period_id", fixture.periodId)
      .eq("status", "pending");

    expect(requests?.length).toBeGreaterThan(0);
    const requestId = requests?.[0].id;
    expect(requestId).toBeTruthy();

    // Super-admin approves it
    const { data, error } = await adminClient.rpc("rpc_super_admin_resolve_unlock", {
      p_request_id: requestId,
      p_decision: "approved",
      p_note: "E5 unlock test — super admin approval",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // Verify period.is_locked is now false
    const { data: period, error: periodErr } = await adminClient
      .from("periods")
      .select("is_locked")
      .eq("id", fixture.periodId)
      .single();

    expect(periodErr).toBeNull();
    expect(period?.is_locked).toBe(false);

    // Verify unlock_requests row is now 'approved'
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

    // Request unlock again
    const { error: reqErr } = await adminClient.rpc("rpc_admin_request_unlock", {
      p_period_id: fixture.periodId,
      p_reason: "E5 unlock test — second request for rejection test",
    });
    expect(reqErr).toBeNull();

    // Get the new pending request
    const { data: requests } = await adminClient
      .from("unlock_requests")
      .select("id")
      .eq("period_id", fixture.periodId)
      .eq("status", "pending");

    const requestId = requests?.[0].id;
    expect(requestId).toBeTruthy();

    // Super-admin rejects it
    const { data, error } = await adminClient.rpc("rpc_super_admin_resolve_unlock", {
      p_request_id: requestId,
      p_decision: "rejected",
      p_note: "E5 unlock test — super admin rejection",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(true);

    // Verify period.is_locked is still true
    const { data: period, error: periodErr } = await adminClient
      .from("periods")
      .select("is_locked")
      .eq("id", fixture.periodId)
      .single();

    expect(periodErr).toBeNull();
    expect(period?.is_locked).toBe(true);

    // Verify unlock_requests row is now 'rejected'
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
