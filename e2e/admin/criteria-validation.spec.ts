/**
 * Phase 1 Task 1.4 — Criteria & mapping DB-level validation.
 *
 * The plan called for "total weight ≠ 100 → RPC throws" and "rubric band
 * min > max → RPC throws". Reading the actual `rpc_admin_save_period_criteria`
 * (sql/migrations/009_audit.sql:546) shows that:
 *
 *   - Weight is DERIVED server-side from max_score, not user-supplied. There
 *     is no "total weight" parameter to validate.
 *   - Rubric bands are stored as opaque JSONB; the RPC does not interpret
 *     min/max relations.
 *
 * Those two scenarios therefore translate to backend gaps (not test gaps) and
 * are recorded in phase-1-completion-report.md. This spec covers the
 * validations the RPC ACTUALLY enforces, plus the audit-trail integration:
 *
 *   - period_id required / not found
 *   - non-array criteria payload rejected
 *   - mapping rejects criterion from a different period (cross-period guard)
 *   - mapping rejects invalid coverage_type
 *   - mapping rejects when period is locked
 *   - criteria.save writes audit row with before/after diff
 *   - mapping.upsert writes audit row with payload metadata
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { assertAuditEntry } from "../helpers/auditHelpers";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_DEMO_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";
const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

async function signInWithPassword(email: string, password: string): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn failed ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.access_token as string;
}

function makeUserClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ADMIN_EMAIL = "e2e-criteria-admin@vera-eval.app";
const PASS = "E2eCriteriaPass!2026";
const uniqueSuffix = (): string =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

test.describe("criteria & mapping validation + audit", () => {
  test.describe.configure({ mode: "serial" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userClient: any;
  let adminUserId: string;
  let scopedPeriodIds: string[] = [];

  test.beforeAll(async () => {
    await deleteUserByEmail(ADMIN_EMAIL).catch(() => {});
    const { data: u, error } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: PASS,
      email_confirm: true,
    });
    expect(error).toBeNull();
    adminUserId = u!.user!.id;
    await adminClient.from("memberships").insert({
      user_id: adminUserId,
      organization_id: E2E_PERIODS_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: false,
    });
    const token = await signInWithPassword(ADMIN_EMAIL, PASS);
    userClient = makeUserClient(token);
  });

  test.afterAll(async () => {
    // Unlock + delete every period this spec created (ignore failures)
    for (const pid of scopedPeriodIds) {
      try {
        await adminClient.from("periods").update({ is_locked: false }).eq("id", pid);
        await adminClient.from("periods").delete().eq("id", pid);
      } catch {
        /* noop */
      }
    }
    await deleteUserByEmail(ADMIN_EMAIL).catch(() => {});
  });

  async function createPeriod(): Promise<string> {
    const { data, error } = await adminClient
      .from("periods")
      .insert({
        organization_id: E2E_PERIODS_ORG_ID,
        name: `P1.4 Crit ${uniqueSuffix()}`,
        is_locked: false,
        season: "Spring",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`createPeriod failed: ${error?.message}`);
    scopedPeriodIds.push(data.id as string);
    return data.id as string;
  }

  // e2e.admin.criteria.validation.period_id_required
  test("savePeriodCriteria with null period_id → period_id_required", async () => {
    const { error } = await userClient.rpc("rpc_admin_save_period_criteria", {
      p_period_id: null,
      p_criteria: [],
    });
    expect(error?.message).toMatch(/period_id_required/);
  });

  // e2e.admin.criteria.validation.must_be_array
  test("savePeriodCriteria with non-array payload → criteria_must_be_array", async () => {
    const periodId = await createPeriod();
    const { error } = await userClient.rpc("rpc_admin_save_period_criteria", {
      p_period_id: periodId,
      p_criteria: { key: "wrong" }, // object, not array
    });
    expect(error?.message).toMatch(/criteria_must_be_array/);
  });

  // e2e.admin.criteria.validation.cross_period_mapping_rejected
  test("upsert mapping with criterion from a different period → criterion_not_in_period", async () => {
    const periodAId = await createPeriod();
    const periodBId = await createPeriod();

    // Seed one criterion + one outcome in each period
    const { data: critA } = await adminClient
      .from("period_criteria")
      .insert({
        period_id: periodAId,
        key: `kA_${uniqueSuffix()}`,
        label: "A",
        max_score: 10,
        weight: 100,
        sort_order: 0,
      })
      .select("id")
      .single();
    const { data: outB } = await adminClient
      .from("period_outcomes")
      .insert({
        period_id: periodBId,
        code: `OB_${uniqueSuffix()}`,
        label: "OB",
        sort_order: 0,
      })
      .select("id")
      .single();

    const { error } = await userClient.rpc(
      "rpc_admin_upsert_period_criterion_outcome_map",
      {
        p_period_id: periodBId,
        p_period_criterion_id: critA!.id,    // criterion belongs to A
        p_period_outcome_id: outB!.id,       // outcome belongs to B
        p_coverage_type: "direct",
      },
    );
    expect(error?.message).toMatch(/criterion_not_in_period/);
  });

  // e2e.admin.criteria.validation.invalid_coverage_type
  test("upsert mapping with invalid coverage_type → invalid_coverage_type", async () => {
    const periodId = await createPeriod();
    const { data: crit } = await adminClient
      .from("period_criteria")
      .insert({
        period_id: periodId,
        key: `cv_${uniqueSuffix()}`,
        label: "CV",
        max_score: 10,
        weight: 100,
        sort_order: 0,
      })
      .select("id")
      .single();
    const { data: out } = await adminClient
      .from("period_outcomes")
      .insert({
        period_id: periodId,
        code: `CVO_${uniqueSuffix()}`,
        label: "CV",
        sort_order: 0,
      })
      .select("id")
      .single();

    const { error } = await userClient.rpc(
      "rpc_admin_upsert_period_criterion_outcome_map",
      {
        p_period_id: periodId,
        p_period_criterion_id: crit!.id,
        p_period_outcome_id: out!.id,
        p_coverage_type: "supplemental", // not in ('direct','indirect')
      },
    );
    expect(error?.message).toMatch(/invalid_coverage_type/);
  });

  // e2e.admin.criteria.validation.locked_period_rejects_save
  test("savePeriodCriteria on a locked period → period_locked", async () => {
    const periodId = await createPeriod();
    await adminClient
      .from("periods")
      .update({ is_locked: true, activated_at: new Date().toISOString() })
      .eq("id", periodId);

    const { error } = await userClient.rpc("rpc_admin_save_period_criteria", {
      p_period_id: periodId,
      p_criteria: [
        { key: "after_lock", label: "L", blurb: "", max: 10, color: "#fff", rubric: [] },
      ],
    });
    expect(error?.message).toMatch(/period_locked/);

    // re-unlock so afterAll cleanup can delete it cleanly
    await adminClient.from("periods").update({ is_locked: false }).eq("id", periodId);
  });

  // e2e.admin.criteria.audit.save_writes_audit_row
  test("savePeriodCriteria writes a criteria.save audit row with before/after diff", async () => {
    const periodId = await createPeriod();
    const ckey = `ka_${uniqueSuffix()}`;
    const { data, error } = await userClient.rpc("rpc_admin_save_period_criteria", {
      p_period_id: periodId,
      p_criteria: [
        { key: ckey, label: "A", blurb: "", max: 10, color: "#aaa", rubric: [] },
      ],
    });
    expect(error, `save error: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const row = await assertAuditEntry({
      eventType: "criteria.save",
      targetId: periodId,
      actorId: adminUserId,
      orgId: E2E_PERIODS_ORG_ID,
      withinSeconds: 60,
      payloadIncludes: { criteriaCount: 1 },
    });
    // diff.after must record the new criterion's max_score
    const after = row.diff?.after as Record<string, unknown> | undefined;
    expect(after, "diff.after must be present on criteria.save").toBeTruthy();
    expect(after![`${ckey}_max_score`]).toBe(10);
  });

  // e2e.admin.criteria.audit.mapping_upsert_writes_audit_row
  test("upsert mapping writes a mapping.upsert audit row with period+criterion+outcome ids", async () => {
    const periodId = await createPeriod();
    const { data: crit } = await adminClient
      .from("period_criteria")
      .insert({
        period_id: periodId,
        key: `mk_${uniqueSuffix()}`,
        label: "M",
        max_score: 10,
        weight: 100,
        sort_order: 0,
      })
      .select("id")
      .single();
    const { data: out } = await adminClient
      .from("period_outcomes")
      .insert({
        period_id: periodId,
        code: `MO_${uniqueSuffix()}`,
        label: "MO",
        sort_order: 0,
      })
      .select("id")
      .single();

    const { data: mapRow, error } = await userClient.rpc(
      "rpc_admin_upsert_period_criterion_outcome_map",
      {
        p_period_id: periodId,
        p_period_criterion_id: crit!.id,
        p_period_outcome_id: out!.id,
        p_coverage_type: "direct",
      },
    );
    expect(error).toBeNull();
    const mapId = (mapRow as { id?: string } | null)?.id;
    expect(mapId, "mapping insert must return an id").toBeTruthy();

    await assertAuditEntry({
      eventType: "mapping.upsert",
      targetId: mapId!,
      actorId: adminUserId,
      orgId: E2E_PERIODS_ORG_ID,
      withinSeconds: 60,
      payloadIncludes: {
        period_id: periodId,
        period_criterion_id: crit!.id,
        period_outcome_id: out!.id,
        coverage_type: "direct",
      },
    });
  });
});
