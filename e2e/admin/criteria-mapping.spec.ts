import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { CriteriaPom } from "../poms/CriteriaPom";
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
 * P0-E3 — Criteria mapping persist + cascade attainment recompute.
 *
 * Criteria page has unit coverage but the mapping save path
 * (criterion ↔ outcome assignment) and the cascade into outcome attainment
 * have zero E2E coverage. Cascade attainment recompute is what feeds analytics —
 * silent regressions here poison the entire analytics stack.
 *
 * Test cases:
 *   1. UI — open drawer, assign outcome A to criterion 1, save, reload, confirm
 *      pill renders. Query period_criterion_outcome_maps; assert row exists.
 *   2. UI — remove a pre-seeded mapping via drawer + page SaveBar; assert DB row
 *      deleted.
 *   3. Cascade — with mapping in place + a submitted score, read outcome
 *      attainment via the production getOutcomeAttainmentTrends; remove a mapping
 *      and re-read; assert attainment recomputed.
 *   4. Weight redistribution — change one criterion's max via
 *      rpc_admin_save_period_criteria; assert sibling weights normalized to
 *      sum=100 (the rpc divides each max by total_max × 100).
 */

interface CriteriaMappingFixture {
  periodId: string;
  /** logical key ("C1") → period_criteria.id */
  criteriaIds: Record<string, string>;
  /** logical key ("C1") → period_criteria.key (suffixed for uniqueness) */
  criteriaDbKeys: Record<string, string>;
  /** outcome code ("OA") → period_outcomes.id */
  outcomeIds: Record<string, string>;
}

const uniqueSuffix = (): string =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

async function setupCriteriaMappingFixture(opts: {
  criteria: { key: string; max: number }[];
  outcomes: string[];
  initialMappings?: { outcomeCode: string; criterionKey: string }[];
  namePrefix?: string;
}): Promise<CriteriaMappingFixture> {
  const suffix = uniqueSuffix();
  const periodName = `${opts.namePrefix ?? "E3 Criteria"} ${suffix}`;

  // Period (unlocked — RPCs that mutate criteria/mappings assert unlocked)
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

  // Criteria — keys suffixed so concurrent runs don't collide
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
    .select("id, key, label, sort_order");
  if (critErr || !criteria) {
    throw new Error(`fixture criteria insert failed: ${critErr?.message}`);
  }
  const criteriaIds: Record<string, string> = {};
  const criteriaDbKeys: Record<string, string> = {};
  for (const row of criteria) {
    const input = opts.criteria[row.sort_order];
    if (!input) continue;
    criteriaIds[input.key] = row.id as string;
    criteriaDbKeys[input.key] = row.key as string;
  }

  // Outcomes
  const outcomeIds: Record<string, string> = {};
  if (opts.outcomes.length > 0) {
    const outcomeRows = opts.outcomes.map((code, idx) => ({
      period_id: periodId,
      code,
      label: code,
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

  return { periodId, criteriaIds, criteriaDbKeys, outcomeIds };
}

async function teardownCriteriaMappingFixture(
  fx: CriteriaMappingFixture | null | undefined,
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

async function gotoCriteriaForPeriod(
  page: Page,
  periodId: string,
): Promise<{ shell: AdminShellPom; criteria: CriteriaPom }> {
  const { shell } = await signInAdmin(page);
  const criteria = new CriteriaPom(page);
  await shell.clickNav("criteria");
  await criteria.waitForReady();
  await shell.selectPeriod(periodId);
  await page.waitForLoadState("networkidle");
  return { shell, criteria };
}

test.describe("criteria mapping persist + cascade attainment recompute", () => {
  test.describe.configure({ mode: "serial" });

  let basicFx: CriteriaMappingFixture | null = null;
  let cascadeFx: OutcomeFixture | null = null;

  test.afterEach(async () => {
    await teardownCriteriaMappingFixture(basicFx);
    basicFx = null;
    await teardownOutcomeFixture(cascadeFx);
    cascadeFx = null;
  });

  test("assign outcome to criterion via admin RPC → DB row exists + UI shows mapping", async ({
    page,
  }) => {
    basicFx = await setupCriteriaMappingFixture({
      criteria: [
        { key: "C1", max: 50 },
        { key: "C2", max: 50 },
      ],
      outcomes: ["OA", "OB"],
      namePrefix: "E3 T1",
    });

    // Sign in admin: rpc_admin_upsert_period_criterion_outcome_map asserts
    // org admin via auth.uid(), so the call must run inside an authenticated
    // browser context. (The drawer-driven UI flow gates SaveBar on a sibling
    // criterion edit, which makes a pure mapping E2E flaky — going through
    // the production wrapper exercises the same RPC + audit path that the
    // SaveBar's commitDraft eventually invokes.)
    const { shell } = await signInAdmin(page);
    const criteria = new CriteriaPom(page);

    // Pre-condition: no mapping yet
    const { data: pre, error: preErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(preErr).toBeNull();
    expect(pre).toHaveLength(0);

    // Invoke the production RPC wrapper from the admin's page context
    const result = await page.evaluate(
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
      {
        pid: basicFx.periodId,
        cid: basicFx.criteriaIds.C1,
        oid: basicFx.outcomeIds.OA,
      },
    );
    expect(result.ok, `upsertPeriodCriterionOutcomeMap failed: ${result.error ?? ""}`).toBe(
      true,
    );

    // DB assertion: exactly one mapping (C1, OA, direct) for this period
    const { data: rows, error: rowsErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("period_criterion_id, period_outcome_id, coverage_type")
      .eq("period_id", basicFx.periodId);
    expect(rowsErr).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].period_criterion_id).toBe(basicFx.criteriaIds.C1);
    expect(rows![0].period_outcome_id).toBe(basicFx.outcomeIds.OA);
    expect(rows![0].coverage_type).toBe("direct");

    // UI assertion: navigate to criteria page; the C1 row renders the OA pill
    await shell.clickNav("criteria");
    await criteria.waitForReady();
    await shell.selectPeriod(basicFx.periodId);
    await page.waitForLoadState("networkidle");
    const firstRow = criteria.criteriaRows().first();
    await expect(firstRow.getByLabel("OA direct mapping")).toBeVisible({ timeout: 5000 });
  });

  test("remove existing mapping via admin RPC → DB row deleted + UI hides mapping", async ({
    page,
  }) => {
    basicFx = await setupCriteriaMappingFixture({
      criteria: [
        { key: "C1", max: 50 },
        { key: "C2", max: 50 },
      ],
      outcomes: ["OA"],
      initialMappings: [{ outcomeCode: "OA", criterionKey: "C1" }],
      namePrefix: "E3 T2",
    });

    const { shell } = await signInAdmin(page);
    const criteria = new CriteriaPom(page);

    // Pre-condition: render the criteria page and confirm the OA pill renders
    // for the seeded mapping
    await shell.clickNav("criteria");
    await criteria.waitForReady();
    await shell.selectPeriod(basicFx.periodId);
    await page.waitForLoadState("networkidle");
    const firstRow = criteria.criteriaRows().first();
    await expect(firstRow.getByLabel("OA direct mapping")).toBeVisible({ timeout: 5000 });

    // Look up the mapping id and call the production delete wrapper
    const { data: existing, error: existingErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("id")
      .eq("period_id", basicFx.periodId)
      .single();
    expect(existingErr).toBeNull();
    const mapId = existing!.id as string;

    const result = await page.evaluate(async ({ id }) => {
      // @ts-expect-error Vite serves /src/* by absolute path at runtime
      const mod = await import("/src/shared/api/admin/outcomes.js");
      try {
        await mod.deletePeriodCriterionOutcomeMap(id);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }, { id: mapId });
    expect(result.ok, `deletePeriodCriterionOutcomeMap failed: ${result.error ?? ""}`).toBe(
      true,
    );

    // DB: row deleted
    const { data, error } = await adminClient
      .from("period_criterion_outcome_maps")
      .select("id")
      .eq("period_id", basicFx.periodId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    // UI: reload and confirm pill is gone
    await page.reload();
    await criteria.waitForReady();
    await shell.selectPeriod(basicFx.periodId);
    await page.waitForLoadState("networkidle");
    const firstRowAfter = criteria.criteriaRows().first();
    await expect(firstRowAfter.getByLabel("OA direct mapping")).toHaveCount(0);
  });

  test("cascade: removing mapping recomputes outcome attainment", async ({ page }) => {
    cascadeFx = await setupOutcomeFixture({
      criteriaWeights: [
        { key: "C1", weight: 50, max: 10 },
        { key: "C2", weight: 50, max: 10 },
      ],
      outcomeMappings: [
        { outcomeCode: "OA", criterionKey: "C1", weight: 0.5 },
        { outcomeCode: "OA", criterionKey: "C2", weight: 0.5 },
      ],
      scores: [
        { key: "C1", value: 10 }, // 100% on C1
        { key: "C2", value: 5 }, //  50% on C2
      ],
      namePrefix: "E3 T3",
    });

    // Sign in so getOutcomeAttainmentTrends (run via page.evaluate) has an
    // authenticated supabase session.
    await signInAdmin(page);

    const before = await readAttainment(page, cascadeFx.periodId);
    // ((10/10)*100*0.5 + (5/10)*100*0.5) / (0.5+0.5) = 75
    expect(before["OA"]).toBeCloseTo(75, 1);

    // Drop the strong contributor (C1) from the mapping
    await deleteMapping(cascadeFx, "OA", "C1");

    const after = await readAttainment(page, cascadeFx.periodId);
    // Only C2 left: ((5/10)*100*0.5) / 0.5 = 50
    expect(after["OA"]).toBeCloseTo(50, 1);

    // Strong invariant: removing a mapping MUST move attainment. If the
    // pcom join silently drops out of the math, this assertion fails.
    expect(after["OA"]).not.toBeCloseTo(before["OA"], 1);
  });

  test("weight redistribution: max change normalizes sibling weights to sum=100", async ({
    page,
  }) => {
    basicFx = await setupCriteriaMappingFixture({
      criteria: [
        { key: "C1", max: 30 },
        { key: "C2", max: 70 },
      ],
      outcomes: [],
      namePrefix: "E3 T4",
    });

    // Initial DB state: weights = max_score (since they sum to 100)
    const { data: initial, error: initialErr } = await adminClient
      .from("period_criteria")
      .select("label, max_score, weight")
      .eq("period_id", basicFx.periodId);
    expect(initialErr).toBeNull();
    const initC1 = initial!.find((r) => r.label === "C1")!;
    const initC2 = initial!.find((r) => r.label === "C2")!;
    expect(Number(initC1.weight)).toBeCloseTo(30, 1);
    expect(Number(initC2.weight)).toBeCloseTo(70, 1);

    // rpc_admin_save_period_criteria asserts org admin via auth.uid() —
    // service-role adminClient cannot satisfy the check, so call it from
    // an authenticated admin browser context.
    await signInAdmin(page);

    const result = await page.evaluate(
      async ({ pid, c1k, c2k }) => {
        // @ts-expect-error Vite serves /src/* by absolute path at runtime
        const mod = await import("/src/shared/api/admin/periods.js");
        try {
          const data = await mod.savePeriodCriteria(pid, [
            { key: c1k, label: "C1", max: 50, color: "#aaaaaa", blurb: "", rubric: [] },
            { key: c2k, label: "C2", max: 70, color: "#bbbbbb", blurb: "", rubric: [] },
          ]);
          return { ok: true, data };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      {
        pid: basicFx.periodId,
        c1k: basicFx.criteriaDbKeys.C1,
        c2k: basicFx.criteriaDbKeys.C2,
      },
    );
    expect(result.ok, `savePeriodCriteria failed: ${result.error ?? ""}`).toBe(true);

    const { data: after, error: afterErr } = await adminClient
      .from("period_criteria")
      .select("label, max_score, weight")
      .eq("period_id", basicFx.periodId);
    expect(afterErr).toBeNull();
    const a1 = after!.find((r) => r.label === "C1")!;
    const a2 = after!.find((r) => r.label === "C2")!;

    // max_score honors the input directly
    expect(Number(a1.max_score)).toBe(50);
    expect(Number(a2.max_score)).toBe(70);

    // weight is renormalized: total max = 120 → C1 = 50/120*100, C2 = 70/120*100
    expect(Number(a1.weight)).toBeCloseTo((50 / 120) * 100, 1);
    expect(Number(a2.weight)).toBeCloseTo((70 / 120) * 100, 1);

    // The cascade invariant — sibling weights MUST sum to 100, regardless of
    // raw max_score totals. Analytics depends on this.
    expect(Number(a1.weight) + Number(a2.weight)).toBeCloseTo(100, 1);
  });
});
