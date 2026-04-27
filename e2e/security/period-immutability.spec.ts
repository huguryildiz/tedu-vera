import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { adminClient } from "../helpers/supabaseAdmin";
import {
  setupScoringFixture,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

// Period structural immutability:
//   trigger_block_periods_on_locked_mutate fires as BEFORE UPDATE on any period
//   where is_locked = true and a structural column (name, season, description,
//   start_date, end_date, framework_id, organization_id) changes.
//   The trigger raises ERRCODE='check_violation'. Service role is subject to
//   this trigger because current_user_is_super_admin() checks auth.uid(), which
//   is NULL for service role → returns false → trigger runs.
//
// Closed-period score write protection (enforced as of secure_score_writes_closed_period_guard):
//   - score_sheets{,_items} INSERT/UPDATE policies now include `closed_at IS NULL`.
//   - rpc_jury_upsert_score returns error_code='period_closed' when closed_at IS NOT NULL.
//   Service role bypasses RLS by design (breakglass), so enforcement is verified
//   via a tenant-admin JWT (REST path) and a direct RPC call (SECURITY DEFINER path).

const SUPABASE_URL =
  process.env.VITE_DEMO_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON_KEY =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const TENANT_EMAIL = "tenant-admin@vera-eval.app";
const TENANT_PASSWORD = "TenantAdmin2026!";

async function getTenantJwt(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY },
    data: { email: TENANT_EMAIL, password: TENANT_PASSWORD },
  });
  const body = await res.json();
  return body.access_token as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structural immutability
// ─────────────────────────────────────────────────────────────────────────────

test.describe("period structural immutability (locked-period trigger)", () => {
  let testPeriodId: string | null = null;

  test.afterEach(async () => {
    if (testPeriodId) {
      // Always unlock the period, even if the test failed midway.
      // The trigger allows is_locked changes (it only blocks structural columns).
      await adminClient
        .from("periods")
        .update({ is_locked: false })
        .eq("id", testPeriodId);
      testPeriodId = null;
    }
  });

  test("BEFORE UPDATE trigger blocks structural column change on a locked period", async () => {
    const { data: periods } = await adminClient
      .from("periods")
      .select("id, name")
      .eq("is_locked", false)
      .limit(1);

    expect(periods?.length ?? 0, 'E2E requires at least one unlocked period').toBeGreaterThan(0);

    const { id: periodId, name: originalName } = periods[0];

    // Lock the period so the trigger becomes active.
    // Trigger allows: OLD.is_locked=false → returns immediately (no column check).
    const { error: lockError } = await adminClient
      .from("periods")
      .update({ is_locked: true })
      .eq("id", periodId);
    expect(lockError).toBeNull();

    testPeriodId = periodId; // afterEach will unlock this

    // Attempt a structural column change on the now-locked period.
    // Trigger should raise ERRCODE=23514 (check_violation) → error not null.
    const { data, error } = await adminClient
      .from("periods")
      .update({ name: "IMMUTABILITY-HACKED" })
      .eq("id", periodId)
      .select("name");

    expect(error).not.toBeNull();
    expect(data).toBeNull();

    // Verify the name was not changed in the database.
    const { data: verify } = await adminClient
      .from("periods")
      .select("name")
      .eq("id", periodId)
      .single();

    expect(verify?.name).toBe(originalName);
  });

  // ── Deliberately-break evidence ────────────────────────────────────────────
  // Proves the trigger is scoped to locked periods only, not all updates.
  test("deliberately-break: structural column update on an unlocked period succeeds", async () => {
    const { data: periods } = await adminClient
      .from("periods")
      .select("id, name")
      .eq("is_locked", false)
      .limit(1);

    expect(periods?.length ?? 0, 'E2E requires at least one unlocked period').toBeGreaterThan(0);

    const { id: periodId, name: originalName } = periods[0];
    const testName = `E2E-IMMUTABILITY-BREAK-${Date.now()}`;

    const { data, error } = await adminClient
      .from("periods")
      .update({ name: testName })
      .eq("id", periodId)
      .select("name");

    // Trigger is inactive for unlocked periods — update must succeed.
    expect(error).toBeNull();
    expect(Array.isArray(data) && data[0]?.name).toBe(testName);

    // Restore the original name.
    await adminClient
      .from("periods")
      .update({ name: originalName })
      .eq("id", periodId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Closed-period score write protection — RLS (REST) path
// ─────────────────────────────────────────────────────────────────────────────

test.describe("closed period score write protection (enforced)", () => {
  let closedFixture: ScoringFixture | null = null;

  test.beforeAll(async () => {
    closedFixture = await setupScoringFixture({ namePrefix: "Closed Guard" });
    const { error } = await adminClient
      .from("periods")
      .update({ is_locked: true, closed_at: new Date().toISOString() })
      .eq("id", closedFixture.periodId);
    if (error) throw new Error(`closed fixture setup failed: ${error.message}`);
  });

  test.afterAll(async () => {
    if (closedFixture?.periodId) {
      await adminClient
        .from("periods")
        .update({ is_locked: false, closed_at: null })
        .eq("id", closedFixture.periodId);
    }
    await teardownScoringFixture(closedFixture);
  });

  test("RLS: tenant-admin REST insert into closed period is filtered (no row written)", async ({
    request,
  }) => {
    expect(closedFixture, "closed-period fixture should be initialized").not.toBeNull();
    if (!closedFixture) return;

    const jwt = await getTenantJwt(request);
    const res = await request.post(`${SUPABASE_URL}/rest/v1/score_sheets`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      data: {
        period_id: closedFixture.periodId,
        project_id: closedFixture.p1Id,
        juror_id: closedFixture.jurorId,
        status: "draft",
      },
    });

    // RLS with_check failure → PostgREST returns 201 + empty array (silent filter)
    // or 403. Either is acceptable; the critical property is that no row is written.
    expect([201, 400, 403]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(Array.isArray(body) ? body.length : 0).toBe(0);
    }

    // Verify no row was written by the tenant-JWT attempt.
    const { data: check } = await adminClient
      .from("score_sheets")
      .select("id")
      .eq("period_id", closedFixture.periodId)
      .eq("project_id", closedFixture.p1Id)
      .eq("juror_id", closedFixture.jurorId);
    expect(check?.length ?? 0).toBe(0);
  });

  // ── RPC path (SECURITY DEFINER bypasses RLS; must self-enforce) ────────────
  test("RPC: rpc_jury_upsert_score returns error_code=period_closed", async () => {
    expect(closedFixture, "closed-period fixture should be initialized").not.toBeNull();
    if (!closedFixture) return;

    const { data: rows } = await adminClient
      .from("juror_period_auth")
      .select("juror_id, period_id, session_token_hash")
      .eq("period_id", closedFixture.periodId)
      .eq("juror_id", closedFixture.jurorId)
      .limit(1);
    const authRow = rows?.[0] as { juror_id: string; period_id: string; session_token_hash: string | null } | undefined;
    expect(authRow, "closed fixture should include juror_period_auth").toBeTruthy();
    if (!authRow) return;

    const originalHash = authRow.session_token_hash;
    const knownToken = `e2e-closed-guard-${Date.now()}`;
    const knownHash = createHash("sha256").update(knownToken).digest("hex");

    await adminClient
      .from("juror_period_auth")
      .update({ session_token_hash: knownHash, session_expires_at: null })
      .eq("juror_id", authRow.juror_id)
      .eq("period_id", authRow.period_id);

    try {
      const { data, error } = await adminClient.rpc("rpc_jury_upsert_score", {
        p_period_id: authRow.period_id,
        p_project_id: "00000000-0000-0000-0000-000000000000",
        p_juror_id: authRow.juror_id,
        p_session_token: knownToken,
        p_scores: [],
      });

      expect(error).toBeNull();
      expect((data as { ok: boolean } | null)?.ok).toBe(false);
      expect((data as { error_code: string } | null)?.error_code).toBe("period_closed");
    } finally {
      await adminClient
        .from("juror_period_auth")
        .update({ session_token_hash: originalHash })
        .eq("juror_id", authRow.juror_id)
        .eq("period_id", authRow.period_id);
    }
  });

  // ── Deliberately-break evidence ────────────────────────────────────────────
  // Proves the RPC guard is closed-period-scoped (not always-reject).
  test("deliberately-break: RPC does NOT return period_closed for an open period", async () => {
    const { data: openPeriods } = await adminClient
      .from("periods")
      .select("id")
      .is("closed_at", null)
      .limit(10);
    expect(openPeriods?.length ?? 0, 'E2E requires at least one open period').toBeGreaterThan(0);
    if (!openPeriods?.length) return;

    let authRow: { juror_id: string; period_id: string; session_token_hash: string | null } | null = null;
    for (const p of openPeriods) {
      const { data: rows } = await adminClient
        .from("juror_period_auth")
        .select("juror_id, period_id, session_token_hash, is_blocked, final_submitted_at")
        .eq("period_id", p.id)
        .limit(1);
      if (rows?.length) {
        const r = rows[0] as {
          juror_id: string;
          period_id: string;
          session_token_hash: string | null;
          is_blocked: boolean;
          final_submitted_at: string | null;
        };
        if (!r.is_blocked && !r.final_submitted_at) {
          authRow = {
            juror_id: r.juror_id,
            period_id: r.period_id,
            session_token_hash: r.session_token_hash,
          };
          break;
        }
      }
    }
    if (!authRow) {
      expect(authRow, 'E2E requires an unblocked juror_period_auth row for an open period').not.toBeNull();
      return;
    }

    const originalHash = authRow.session_token_hash;
    const knownToken = `e2e-open-guard-${Date.now()}`;
    const knownHash = createHash("sha256").update(knownToken).digest("hex");

    await adminClient
      .from("juror_period_auth")
      .update({ session_token_hash: knownHash, session_expires_at: null })
      .eq("juror_id", authRow.juror_id)
      .eq("period_id", authRow.period_id);

    try {
      const { data } = await adminClient.rpc("rpc_jury_upsert_score", {
        p_period_id: authRow.period_id,
        p_project_id: "00000000-0000-0000-0000-000000000000",
        p_juror_id: authRow.juror_id,
        p_session_token: knownToken,
        p_scores: [],
      });

      // Open period: error_code must NOT be period_closed. Any other response
      // (ok=true or a different error like missing project) is acceptable here;
      // we only assert the guard is scoped to closed periods.
      const errorCode = (data as { error_code?: string } | null)?.error_code;
      expect(errorCode).not.toBe("period_closed");
    } finally {
      await adminClient
        .from("juror_period_auth")
        .update({ session_token_hash: originalHash })
        .eq("juror_id", authRow.juror_id)
        .eq("period_id", authRow.period_id);
    }
  });
});
