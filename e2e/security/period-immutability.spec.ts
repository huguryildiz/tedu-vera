import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { adminClient } from "../helpers/supabaseAdmin";

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

    if (!periods?.length) {
      // Skip if no unlocked periods exist (valid test dependency)
      test.skip();
      return;
    }

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

    if (!periods?.length) {
      // Skip if no unlocked periods exist (valid test dependency)
      test.skip();
      return;
    }

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

async function findClosedPeriodWithCleanSlot(): Promise<{
  periodId: string;
  projectId: string;
  jurorId: string;
} | null> {
  const { data: closedPeriods } = await adminClient
    .from("periods")
    .select("id, organization_id")
    .not("closed_at", "is", null)
    .limit(10);
  if (!closedPeriods?.length) return null;

  for (const period of closedPeriods) {
    const { data: projects } = await adminClient
      .from("projects")
      .select("id")
      .eq("period_id", period.id)
      .limit(5);
    if (!projects?.length) continue;

    const { data: jurors } = await adminClient
      .from("jurors")
      .select("id")
      .eq("organization_id", period.organization_id)
      .limit(20);
    if (!jurors?.length) continue;

    for (const project of projects) {
      const { data: existingSheets } = await adminClient
        .from("score_sheets")
        .select("juror_id")
        .eq("project_id", project.id);

      const alreadyScored = new Set(
        (existingSheets ?? []).map((s: { juror_id: string }) => s.juror_id),
      );
      const cleanJuror = jurors.find((j: { id: string }) => !alreadyScored.has(j.id));
      if (!cleanJuror) continue;

      return { periodId: period.id, projectId: project.id, jurorId: cleanJuror.id };
    }
  }
  return null;
}

test.describe("closed period score write protection (enforced)", () => {
  test("RLS: tenant-admin REST insert into closed period is filtered (no row written)", async ({
    request,
  }) => {
    const slot = await findClosedPeriodWithCleanSlot();
    if (!slot) {
      // Skip if no closed period with clean scoring slot exists (valid test dependency)
      test.skip();
      return;
    }

    const jwt = await getTenantJwt(request);
    const res = await request.post(`${SUPABASE_URL}/rest/v1/score_sheets`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      data: {
        period_id: slot.periodId,
        project_id: slot.projectId,
        juror_id: slot.jurorId,
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
      .eq("period_id", slot.periodId)
      .eq("project_id", slot.projectId)
      .eq("juror_id", slot.jurorId);
    expect(check?.length ?? 0).toBe(0);
  });

  // ── RPC path (SECURITY DEFINER bypasses RLS; must self-enforce) ────────────
  test("RPC: rpc_jury_upsert_score returns error_code=period_closed", async () => {
    // Find any juror_period_auth row for a closed period so the session check
    // passes and execution reaches the period_closed guard.
    const { data: closedPeriods } = await adminClient
      .from("periods")
      .select("id")
      .not("closed_at", "is", null)
      .limit(10);
    if (!closedPeriods?.length) {
      // Skip if no closed periods exist (valid test dependency)
      test.skip();
      return;
    }

    let authRow: { juror_id: string; period_id: string; session_token_hash: string | null } | null = null;
    for (const p of closedPeriods) {
      const { data: rows } = await adminClient
        .from("juror_period_auth")
        .select("juror_id, period_id, session_token_hash, session_expires_at, is_blocked, final_submitted_at")
        .eq("period_id", p.id)
        .limit(1);
      if (rows?.length) {
        const r = rows[0] as {
          juror_id: string;
          period_id: string;
          session_token_hash: string | null;
          session_expires_at: string | null;
          is_blocked: boolean;
          final_submitted_at: string | null;
        };
        // Need a row we can drive past the session gates cleanly.
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
      // Skip if no suitable closed-period auth row found (valid test dependency)
      test.skip();
      return;
    }

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
    if (!openPeriods?.length) {
      // Skip if no open periods exist (valid test dependency)
      test.skip();
      return;
    }

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
      // Skip if no suitable open-period auth row found (valid test dependency)
      test.skip();
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
