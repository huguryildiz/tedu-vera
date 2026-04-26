import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { adminClient } from "../helpers/supabaseAdmin";
import {
  setupOutcomeFixture,
  teardownOutcomeFixture,
  readAttainment,
  deleteMapping,
  type OutcomeFixture,
} from "../helpers/outcomeFixture";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * P0-E4 — Outcomes CRUD + mapping persist + cascade attainment.
 *
 * OutcomesPage requires a period.framework_id to render the outcome table;
 * test periods are created without a framework. All writes go through
 * production RPC wrappers via page.evaluate (same path as the UI's
 * usePeriodOutcomes.commitDraft), preserving RLS + audit coverage.
 * DB assertions verify state; UI assertions on the outcome table are skipped
 * due to the framework gate (noted inline per test).
 *
 * Test cases:
 *   1. Create outcome via admin RPC; assert period_outcomes row exists.
 *   2. Edit outcome label via admin RPC; assert DB row updated.
 *   3. Delete outcome — cascade: all period_criterion_outcome_maps rows removed.
 *   4. Mapping persist: upsert 2 maps via admin RPC; assert 2 DB rows.
 *   5. Cascade attainment: mapping + scores → attainment matches formula;
 *      remove one mapping → attainment recomputes correctly.
 */

interface OutcomesMappingFixture {
  periodId: string;
  /** logical key ("C1") → period_criteria.id */
  criteriaIds: Record<string, string>;
  /** outcome code ("OA") → period_outcomes.id */
  outcomeIds: Record<string, string>;
}

const uniqueSuffix = (): string =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

async function setupOutcomesMappingFixture(opts: {
  criteria: { key: string; max: number }[];
  outcomes?: { code: string; label: string }[];
  initialMappings?: { outcomeCode: string; criterionKey: string }[];
  namePrefix?: string;
}): Promise<OutcomesMappingFixture> {
  const suffix = uniqueSuffix();
  const periodName = `${opts.namePrefix ?? "E4 Outcomes"} ${suffix}`;

  // Period (unlocked — RPCs that mutate outcomes/mappings assert unlocked)
  const { data: period, error: periodErr } = await adminClient
    .from("periods")
    .insert({
      organization_id: E2E_PERIODS_ORG_ID,
      name: periodName,
      season: "Spring",
      is_locked: false,
    })
    .select("id")
    .single();
  if (periodErr || !period) {
    throw new Error(`fixture period insert failed: ${periodErr?.message}`);
  }
  const periodId = period.id as string;

  // Criteria — keys suffixed to avoid cross-run collisions
  const total = opts.criteria.reduce((s, c) => s + c.max, 0);
  const criteriaRows = opts.criteria.map((c, idx) => ({
    period_id: periodId,
    key: `${c.key}_${suffix}`,
    label: c.key,
    max_score: c.max,
    weight: total > 0 ? (c.max / total) * 100 : 0,
    sort_order: idx,
  }));
  const { data: criteria, error: critErr } = await adminClient
    .from("period_criteria")
    .insert(criteriaRows)
    .select("id, label, sort_order");
  if (critErr || !criteria) {
    throw new Error(`fixture criteria insert failed: ${critErr?.message}`);
  }
  const criteriaIds: Record<string, string> = {};
  for (const row of criteria) {
    const input = opts.criteria[row.sort_order];
    if (!input) continue;
    criteriaIds[input.key] = row.id as string;
  }

  // Optional initial outcomes (seeded directly; CRUD tests use page.evaluate RPCs)
  const outcomeIds: Record<string, string> = {};
  if (opts.outcomes && opts.outcomes.length > 0) {
    const outcomeRows = opts.outcomes.map((o, idx) => ({
      period_id: periodId,
      code: o.code,
      label: o.label,
      sort_order: idx,
    }));
    const { data: outcomes, error: outErr } = await adminClient
      .from("period_outcomes")
      .insert(outcomeRows)
      .select("id, code");
    if (outErr || !outcomes) {
      throw new Error(`fixture outcomes insert failed: ${outErr?.message}`);
    }
    for (const o of outcomes) outcomeIds[o.code as string] = o.id as string;
  }

  // Optional initial mappings
  if (opts.initialMappings && opts.initialMappings.length > 0) {
    const mapRows = opts.initialMappings.map((m) => {
      const cId = criteriaIds[m.criterionKey];
      const oId = outcomeIds[m.outcomeCode];
      if (!cId) throw new Error(`fixture: unknown criterionKey ${m.criterionKey}`);
      if (!oId) throw new Error(`fixture: unknown outcomeCode ${m.outcomeCode}`);
      return {
        period_id: periodId,
        period_criterion_id: cId,
        period_outcome_id: oId,
        coverage_type: "direct" as const,
      };
    });
    const { error: mapErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .insert(mapRows);
    if (mapErr) {
      throw new Error(`fixture mappings insert failed: ${mapErr.message}`);
    }
  }

  return { periodId, criteriaIds, outcomeIds };
}

async function teardownOutcomesMappingFixture(
  fx: OutcomesMappingFixture | null | undefined,
): Promise<void> {
  if (!fx?.periodId) return;
  try {
    await adminClient.from("periods").update({ is_locked: false }).eq("id", fx.periodId);
  } catch {
    /* swallow — delete below surfaces any real failure */
  }
  try {
    await adminClient.from("periods").delete().eq("id", fx.periodId);
  } catch {
    /* swallow — partial cleanup acceptable in afterEach */
  }
}

async function signInAdmin(page: Page): Promise<{ shell: AdminShellPom }> {
  await page.addInitScript((orgId) => {
    try {
      localStorage.setItem("vera.admin_tour_done", "1");
      localStorage.setItem("admin.remember_me", "true");
      localStorage.setItem("admin.active_organization_id", orgId);
    } catch {
      /* localStorage disabled */
    }
  }, E2E_PERIODS_ORG_ID);

  const login = new LoginPom(page);
  const shell = new AdminShellPom(page);
  await login.goto();
  await login.signIn(EMAIL, PASSWORD);
  await shell.expectOnDashboard();
  return { shell };
}

test.describe("outcomes CRUD + mapping persist + cascade attainment", () => {
  test.describe.configure({ mode: "serial" });

  let basicFx: OutcomesMappingFixture | null = null;
  let cascadeFx: OutcomeFixture | null = null;

  test.afterEach(async () => {
    await teardownOutcomesMappingFixture(basicFx);
    basicFx = null;
    await teardownOutcomeFixture(cascadeFx);
    cascadeFx = null;
  });

  test("create outcome via admin RPC → DB row exists", async ({ page }) => {
    basicFx = await setupOutcomesMappingFixture({
      criteria: [
        { key: "C1", max: 50 },
        { key: "C2", max: 50 },
      ],
      namePrefix: "E4 T1",
    });

    // Pre-condition: no outcomes for this period yet
    const { data: pre, error: preErr } = await adminClient
      .from("period_outcomes")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(preErr).toBeNull();
    expect(pre).toHaveLength(0);

    // rpc_admin_create_period_outcome asserts org admin via auth.uid(), so the
    // call must run inside an authenticated browser context.
    await signInAdmin(page);

    const result = await page.evaluate(
      async ({ pid }) => {
        // @ts-expect-error Vite serves /src/* by absolute path at runtime
        const mod = await import("/src/shared/api/admin/outcomes.js");
        try {
          const data = await mod.createPeriodOutcome({
            period_id: pid,
            code: "OA",
            label: "Outcome A",
            sort_order: 0,
          });
          return { ok: true, data };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { pid: basicFx.periodId },
    );
    expect(result.ok, `createPeriodOutcome failed: ${result.error ?? ""}`).toBe(true);

    // DB assertion: exactly one row with the expected code + label
    const { data: rows, error: rowsErr } = await adminClient
      .from("period_outcomes")
      .select("code, label")
      .eq("period_id", basicFx.periodId);
    expect(rowsErr).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].code).toBe("OA");
    expect(rows![0].label).toBe("Outcome A");

    // UI note: OutcomesPage requires period.framework_id to render the outcome
    // table. Test periods have no framework; UI assertion skipped intentionally.
  });

  test("edit outcome label via admin RPC → DB row updated", async ({ page }) => {
    basicFx = await setupOutcomesMappingFixture({
      criteria: [{ key: "C1", max: 50 }],
      outcomes: [{ code: "OA", label: "Original Label" }],
      namePrefix: "E4 T2",
    });

    await signInAdmin(page);

    const outcomeId = basicFx.outcomeIds.OA;
    const result = await page.evaluate(
      async ({ id }) => {
        // @ts-expect-error Vite serves /src/* by absolute path at runtime
        const mod = await import("/src/shared/api/admin/outcomes.js");
        try {
          const data = await mod.updatePeriodOutcome(id, { label: "Updated Label" });
          return { ok: true, data };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { id: outcomeId },
    );
    expect(result.ok, `updatePeriodOutcome failed: ${result.error ?? ""}`).toBe(true);

    // DB assertion: label updated, code unchanged
    const { data: row, error: rowErr } = await adminClient
      .from("period_outcomes")
      .select("code, label")
      .eq("id", outcomeId)
      .single();
    expect(rowErr).toBeNull();
    expect(row!.label).toBe("Updated Label");
    expect(row!.code).toBe("OA");
  });

  test("delete outcome → cascade removes all criterion↔outcome maps", async ({ page }) => {
    basicFx = await setupOutcomesMappingFixture({
      criteria: [
        { key: "C1", max: 50 },
        { key: "C2", max: 50 },
      ],
      outcomes: [{ code: "OA", label: "Outcome A" }],
      initialMappings: [
        { outcomeCode: "OA", criterionKey: "C1" },
        { outcomeCode: "OA", criterionKey: "C2" },
      ],
      namePrefix: "E4 T3",
    });

    // Pre-condition: 2 mapping rows exist for this period
    const { data: pre, error: preErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(preErr).toBeNull();
    expect(pre).toHaveLength(2);

    await signInAdmin(page);

    const outcomeId = basicFx.outcomeIds.OA;
    const result = await page.evaluate(
      async ({ id }) => {
        // @ts-expect-error Vite serves /src/* by absolute path at runtime
        const mod = await import("/src/shared/api/admin/outcomes.js");
        try {
          await mod.deletePeriodOutcome(id);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { id: outcomeId },
    );
    expect(result.ok, `deletePeriodOutcome failed: ${result.error ?? ""}`).toBe(true);

    // DB assertion 1: outcome row deleted
    const { data: outcomeRows, error: outcomeErr } = await adminClient
      .from("period_outcomes")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(outcomeErr).toBeNull();
    expect(outcomeRows).toHaveLength(0);

    // DB assertion 2: cascade — all maps referencing this outcome are deleted.
    // Silent failures here (maps left dangling) would poison analytics joins.
    const { data: mapRows, error: mapErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(mapErr).toBeNull();
    expect(mapRows).toHaveLength(0);
  });

  test("mapping persist: upsert 2 criterion↔outcome maps → DB rows survive", async ({
    page,
  }) => {
    basicFx = await setupOutcomesMappingFixture({
      criteria: [
        { key: "C1", max: 50 },
        { key: "C2", max: 50 },
      ],
      outcomes: [{ code: "OA", label: "Outcome A" }],
      namePrefix: "E4 T4",
    });

    // Pre-condition: no mappings
    const { data: pre, error: preErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(preErr).toBeNull();
    expect(pre).toHaveLength(0);

    await signInAdmin(page);

    const { periodId, criteriaIds, outcomeIds } = basicFx;

    // Upsert C1 → OA
    const res1 = await page.evaluate(
      async ({ pid, cid, oid }) => {
        // @ts-expect-error Vite serves /src/* by absolute path at runtime
        const mod = await import("/src/shared/api/admin/outcomes.js");
        try {
          const data = await mod.upsertPeriodCriterionOutcomeMap({
            period_id: pid,
            period_criterion_id: cid,
            period_outcome_id: oid,
            coverage_type: "direct",
          });
          return { ok: true, data };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { pid: periodId, cid: criteriaIds.C1, oid: outcomeIds.OA },
    );
    expect(res1.ok, `upsert C1→OA failed: ${res1.error ?? ""}`).toBe(true);

    // Upsert C2 → OA
    const res2 = await page.evaluate(
      async ({ pid, cid, oid }) => {
        // @ts-expect-error Vite serves /src/* by absolute path at runtime
        const mod = await import("/src/shared/api/admin/outcomes.js");
        try {
          const data = await mod.upsertPeriodCriterionOutcomeMap({
            period_id: pid,
            period_criterion_id: cid,
            period_outcome_id: oid,
            coverage_type: "direct",
          });
          return { ok: true, data };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { pid: periodId, cid: criteriaIds.C2, oid: outcomeIds.OA },
    );
    expect(res2.ok, `upsert C2→OA failed: ${res2.error ?? ""}`).toBe(true);

    // DB assertion: 2 mapping rows, correct criterion + outcome IDs, direct coverage
    const { data: rows, error: rowsErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("period_criterion_id, period_outcome_id, coverage_type")
      .eq("period_id", periodId);
    expect(rowsErr).toBeNull();
    expect(rows).toHaveLength(2);

    const mappedCriteriaIds = rows!.map((r) => r.period_criterion_id).sort();
    expect(mappedCriteriaIds).toEqual([criteriaIds.C1, criteriaIds.C2].sort());
    expect(rows!.every((r) => r.period_outcome_id === outcomeIds.OA)).toBe(true);
    expect(rows!.every((r) => r.coverage_type === "direct")).toBe(true);
  });

  test("cascade attainment: mapping + scores → attainment matches formula; remove map → recomputes", async ({
    page,
  }) => {
    // C1: score=9/10 (90%), map-weight=0.6 → contribution = 90 × 0.6 = 54
    // C2: score=4/10 (40%), map-weight=0.4 → contribution = 40 × 0.4 = 16
    // Expected OA attainment = (54 + 16) / (0.6 + 0.4) = 70.0
    //
    // After removing C1 mapping:
    // Only C2 remains → (4/10)*100 = 40.0
    cascadeFx = await setupOutcomeFixture({
      criteriaWeights: [
        { key: "C1", weight: 60, max: 10 },
        { key: "C2", weight: 40, max: 10 },
      ],
      outcomeMappings: [
        { outcomeCode: "OA", criterionKey: "C1", weight: 0.6 },
        { outcomeCode: "OA", criterionKey: "C2", weight: 0.4 },
      ],
      scores: [
        { key: "C1", value: 9 },
        { key: "C2", value: 4 },
      ],
      namePrefix: "E4 T5",
    });

    // Sign in so getOutcomeAttainmentTrends (via page.evaluate) has an
    // authenticated supabase session.
    await signInAdmin(page);

    const before = await readAttainment(page, cascadeFx.periodId);
    expect(before["OA"]).toBeCloseTo(70.0, 1);

    // Remove C1 mapping (unlock → delete → relock handled by deleteMapping)
    await deleteMapping(cascadeFx, "OA", "C1");

    const after = await readAttainment(page, cascadeFx.periodId);
    expect(after["OA"]).toBeCloseTo(40.0, 1);

    // Strong invariant: removing the higher-contributing mapping MUST decrease
    // attainment. If the pcom join silently drops out of the math this fails.
    expect(after["OA"]).toBeLessThan(before["OA"]!);
  });
});
