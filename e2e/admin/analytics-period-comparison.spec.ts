import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupOutcomeFixture,
  teardownOutcomeFixture,
  type OutcomeFixture,
} from "../helpers/outcomeFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * Phase 2.3 — Analytics period comparison.
 *
 * Seeds two distinct periods with the SAME outcome code but different score
 * distributions, then calls `getOutcomeAttainmentTrends([p1, p2])` from inside
 * an authenticated admin page. The dataset must:
 *   - return one entry per period
 *   - show per-period `avg` and `attainmentRate` matching the seeded data
 *   - differ between the two periods (filter-change reproof)
 *
 * Reference: phase-2-analytics-algorithms.md §8 (period comparison dataset).
 */

interface TrendPeriod {
  periodId: string;
  periodName: string;
  outcomes: Array<{
    code: string;
    avg: number | null;
    attainmentRate: number | null;
  }>;
}

async function readTrends(
  page: Page,
  periodIds: string[],
): Promise<TrendPeriod[]> {
  return page.evaluate(async (ids) => {
    // @ts-expect-error Vite dev server resolves at runtime
    const mod = await import("/src/shared/api/admin/scores.js");
    const trends = await mod.getOutcomeAttainmentTrends(ids);
    if (!Array.isArray(trends)) return [];
    return trends.map((t: Record<string, unknown>) => ({
      periodId: String(t.periodId ?? t.period_id ?? ""),
      periodName: String(t.periodName ?? t.period_name ?? ""),
      outcomes: Array.isArray(t.outcomes)
        ? (t.outcomes as Array<Record<string, unknown>>).map((o) => ({
            code: String(o.code),
            avg: typeof o.avg === "number" ? o.avg : null,
            attainmentRate:
              typeof o.attainmentRate === "number" ? o.attainmentRate : null,
          }))
        : [],
    }));
  }, periodIds);
}

async function signInAndOpenAdmin(page: Page): Promise<void> {
  await page.addInitScript((orgId) => {
    try {
      localStorage.setItem("vera.admin_tour_done", "1");
      localStorage.setItem("admin.remember_me", "true");
      localStorage.setItem("admin.active_organization_id", orgId);
    } catch {}
  }, E2E_PERIODS_ORG_ID);
  const login = new LoginPom(page);
  const shell = new AdminShellPom(page);
  await login.goto();
  await login.signIn(EMAIL, PASSWORD);
  await shell.expectOnDashboard();
  await page.goto("/admin/analytics");
}

test.describe("analytics — period comparison (P1 vs P2)", () => {
  test.describe.configure({ mode: "serial" });

  let p1Fixture: OutcomeFixture;
  let p2Fixture: OutcomeFixture;
  // Shared outcome code so the trend dataset overlaps; both periods use the
  // same code "PO_TREND" with the same criterion key "Cx".
  const OUTCOME = "PO_TREND";

  test.beforeAll(async () => {
    // Period 1: low scores → low attainment for OUTCOME
    p1Fixture = await setupOutcomeFixture({
      namePrefix: "Phase 2.3 P1 (low)",
      criteriaWeights: [{ key: "Cx", weight: 100, max: 100 }],
      outcomeMappings: [{ outcomeCode: OUTCOME, criterionKey: "Cx", weight: 1 }],
      scores: [{ key: "Cx", value: 30 }], // 30/100 = 30% → not met
    });

    // Period 2: high scores → high attainment for OUTCOME
    p2Fixture = await setupOutcomeFixture({
      namePrefix: "Phase 2.3 P2 (high)",
      criteriaWeights: [{ key: "Cx", weight: 100, max: 100 }],
      outcomeMappings: [{ outcomeCode: OUTCOME, criterionKey: "Cx", weight: 1 }],
      scores: [{ key: "Cx", value: 95 }], // 95/100 = 95% → met
    });
  });

  test.afterAll(async () => {
    await teardownOutcomeFixture(p1Fixture);
    await teardownOutcomeFixture(p2Fixture);
  });

  // e2e.admin.analytics.period_comparison.dataset_size
  test("trend dataset returns one entry per period", async ({ page }) => {
    await signInAndOpenAdmin(page);
    const rows = await readTrends(page, [p1Fixture.periodId, p2Fixture.periodId]);
    expect(rows.length).toBe(2);
    const ids = rows.map((r) => r.periodId).sort();
    expect(ids).toEqual([p1Fixture.periodId, p2Fixture.periodId].sort());
  });

  // e2e.admin.analytics.period_comparison.distinct_avgs
  test("each period emits its own avg/attainmentRate and the two are not equal", async ({ page }) => {
    await signInAndOpenAdmin(page);
    const rows = await readTrends(page, [p1Fixture.periodId, p2Fixture.periodId]);
    const p1 = rows.find((r) => r.periodId === p1Fixture.periodId);
    const p2 = rows.find((r) => r.periodId === p2Fixture.periodId);
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    const p1Outcome = p1!.outcomes.find((o) => o.code === OUTCOME);
    const p2Outcome = p2!.outcomes.find((o) => o.code === OUTCOME);
    expect(p1Outcome?.avg).not.toBeNull();
    expect(p2Outcome?.avg).not.toBeNull();
    // Low-period (30%) < High-period (95%)
    expect(p1Outcome!.avg!).toBeLessThan(p2Outcome!.avg!);
    // Distinct values reproves period filter changes the dataset.
    expect(p1Outcome!.avg).not.toBe(p2Outcome!.avg);
  });

  // e2e.admin.analytics.period_comparison.attainment_rate_split
  test("attainmentRate of low-score period < high-score period", async ({ page }) => {
    await signInAndOpenAdmin(page);
    const rows = await readTrends(page, [p1Fixture.periodId, p2Fixture.periodId]);
    const lowRate = rows
      .find((r) => r.periodId === p1Fixture.periodId)!
      .outcomes.find((o) => o.code === OUTCOME)!.attainmentRate;
    const highRate = rows
      .find((r) => r.periodId === p2Fixture.periodId)!
      .outcomes.find((o) => o.code === OUTCOME)!.attainmentRate;
    expect(lowRate).not.toBeNull();
    expect(highRate).not.toBeNull();
    // 30% < 70% threshold → not met → attainmentRate = 0
    // 95% ≥ 70% threshold → met → attainmentRate = 100
    expect(lowRate!).toBeLessThan(highRate!);
    expect(highRate!).toBeCloseTo(100, 1);
    expect(lowRate!).toBeCloseTo(0, 1);
  });
});
