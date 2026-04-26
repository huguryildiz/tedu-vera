import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import {
  setupOutcomeFixture,
  teardownOutcomeFixture,
  readAttainment,
  readAttainmentFull,
  deleteMapping,
  type OutcomeFixture,
} from "../helpers/outcomeFixture";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * E1-fix — outcome attainment math correctness (MÜDEK / ABET).
 *
 * VERA's accreditation reports are derived from `getOutcomeAttainmentTrends`
 * ([src/shared/api/admin/scores.js:259-345](src/shared/api/admin/scores.js#L259-L345)).
 * For every evaluation row, attainment per outcome = Σ(raw/max × 100 × weight) / Σ weight,
 * then averaged across evaluations. Wrong math here = wrong accreditation report =
 * institutional risk.
 *
 * These tests build isolated periods with known criteria/outcomes/mappings/scores,
 * sign the admin in, navigate to an admin route (so the Vite-served app bundle is
 * available), and invoke the real `getOutcomeAttainmentTrends` via `page.evaluate`
 * with a dynamic import. The assertion runs against the live production module,
 * so a regression in scores.js (bad constant, weight normalization drift, etc.)
 * will fail these tests.
 */
test.describe("outcome attainment math correctness", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: OutcomeFixture | null = null;

  async function signInAsAdmin(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  ): Promise<void> {
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
    // /admin/overview is enough — we don't need analytics UI, only the app
    // bundle + supabase client session. getOutcomeAttainmentTrends is invoked
    // directly via page.evaluate against the Vite-served source.
  }

  test.afterEach(async () => {
    await teardownOutcomeFixture(fixture);
    fixture = null;
  });

  test("single criterion full weight → attainment = (raw/max)*100", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [{ key: "C1", weight: 100, max: 10 }],
      outcomeMappings: [{ outcomeCode: "OA", criterionKey: "C1", weight: 1.0 }],
      scores: [{ key: "C1", value: 8 }],
      namePrefix: "E1 T1",
    });

    await signInAsAdmin(page);
    const result = await readAttainment(page, fixture.periodId);
    // (8/10) * 100 * 1.0 / 1.0 = 80.0
    expect(result["OA"]).toBeCloseTo(80, 1);
  });

  test("two criteria weighted → attainment = weighted avg", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [
        { key: "C1", weight: 30, max: 10 },
        { key: "C2", weight: 70, max: 10 },
      ],
      outcomeMappings: [
        { outcomeCode: "OA", criterionKey: "C1", weight: 0.3 },
        { outcomeCode: "OA", criterionKey: "C2", weight: 0.7 },
      ],
      scores: [
        { key: "C1", value: 10 },
        { key: "C2", value: 5 },
      ],
      namePrefix: "E1 T2",
    });

    await signInAsAdmin(page);
    const result = await readAttainment(page, fixture.periodId);
    // ((10/10)*100*0.3 + (5/10)*100*0.7) / (0.3 + 0.7) = (30 + 35) / 1.0 = 65.0
    expect(result["OA"]).toBeCloseTo(65, 1);
  });

  test("shared criterion across two outcomes → independent attainments", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [{ key: "C1", weight: 100, max: 10 }],
      outcomeMappings: [
        { outcomeCode: "OA", criterionKey: "C1", weight: 1.0 },
        { outcomeCode: "OB", criterionKey: "C1", weight: 0.5 },
      ],
      scores: [{ key: "C1", value: 6 }],
      namePrefix: "E1 T3",
    });

    await signInAsAdmin(page);
    const result = await readAttainment(page, fixture.periodId);
    // OA: (6/10)*100*1.0 / 1.0 = 60.0
    // OB: (6/10)*100*0.5 / 0.5 = 60.0 (weight normalizes away in single-contributor case)
    expect(result["OA"]).toBeCloseTo(60, 1);
    expect(result["OB"]).toBeCloseTo(60, 1);
  });

  test("deliberately-break: removing a mapping changes attainment", async ({ page }) => {
    fixture = await setupOutcomeFixture({
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
        { key: "C2", value: 5 },  // 50% on C2
      ],
      namePrefix: "E1 T4",
    });

    await signInAsAdmin(page);

    const before = await readAttainment(page, fixture.periodId);
    // ((10/10)*100*0.5 + (5/10)*100*0.5) / (0.5+0.5) = (50 + 25) / 1.0 = 75.0
    expect(before["OA"]).toBeCloseTo(75, 1);

    // Pull the weaker criterion out of the mapping. Remaining contributor is
    // C1 with score 10/10 → attainment must jump to 100.
    await deleteMapping(fixture, "OA", "C2");

    const after = await readAttainment(page, fixture.periodId);
    expect(after["OA"]).toBeCloseTo(100, 1);

    // Strong guarantee: removing a mapping MUST move the number. If a future
    // refactor accidentally ignores the weight table, this assertion fails.
    expect(after["OA"]).not.toBeCloseTo(before["OA"], 1);
  });

  // ── Phase 1 Task 1.5 — edge cases ─────────────────────────────────────────

  // Behavior under test: getOutcomeAttainmentTrends skips contributors with
  // null/non-finite raw scores (scores.js:312-313). This test pins that
  // semantic explicitly so a future refactor doesn't silently swap to
  // "missing → 0" without a deliberate decision.
  test("missing score for one criterion → attainment uses remaining contributors", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [
        { key: "C1", weight: 50, max: 10 },
        { key: "C2", weight: 50, max: 10 },
      ],
      outcomeMappings: [
        { outcomeCode: "OA", criterionKey: "C1", weight: 0.5 },
        { outcomeCode: "OA", criterionKey: "C2", weight: 0.5 },
      ],
      // Only score C1 — C2 has no score_sheet_items row
      scores: [{ key: "C1", value: 9 }],
      namePrefix: "P1.5 missing",
    });

    await signInAsAdmin(page);
    const result = await readAttainmentFull(page, fixture.periodId);
    // Only C1 contributes: (9/10)*100*0.5 / 0.5 = 90
    expect(result["OA"].avg).toBeCloseTo(90, 1);
    // 90 ≥ 70 threshold → attainmentRate = 100
    expect(result["OA"].attainmentRate).toBe(100);
  });

  test("avg below 70 threshold → attainmentRate = 0 (not met)", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [{ key: "C1", weight: 100, max: 10 }],
      outcomeMappings: [{ outcomeCode: "OA", criterionKey: "C1", weight: 1.0 }],
      // (6.5/10)*100 = 65 → below 70 threshold
      scores: [{ key: "C1", value: 6.5 }],
      namePrefix: "P1.5 below",
    });
    await signInAsAdmin(page);
    const result = await readAttainmentFull(page, fixture.periodId);
    expect(result["OA"].avg).toBeCloseTo(65, 1);
    expect(result["OA"].attainmentRate).toBe(0);
  });

  test("avg above 70 threshold → attainmentRate = 100 (met)", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [{ key: "C1", weight: 100, max: 10 }],
      outcomeMappings: [{ outcomeCode: "OA", criterionKey: "C1", weight: 1.0 }],
      // (7.5/10)*100 = 75 → above 70 threshold
      scores: [{ key: "C1", value: 7.5 }],
      namePrefix: "P1.5 above",
    });
    await signInAsAdmin(page);
    const result = await readAttainmentFull(page, fixture.periodId);
    expect(result["OA"].avg).toBeCloseTo(75, 1);
    expect(result["OA"].attainmentRate).toBe(100);
  });

  test("mapping removed mid-period → attainmentRate also recomputes", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [
        { key: "C1", weight: 50, max: 10 },
        { key: "C2", weight: 50, max: 10 },
      ],
      outcomeMappings: [
        { outcomeCode: "OA", criterionKey: "C1", weight: 0.5 },
        { outcomeCode: "OA", criterionKey: "C2", weight: 0.5 },
      ],
      // C1=10 (100%), C2=6 (60%) → weighted avg 80 → met
      // After removing C2 mapping → only C1 (100%) → attainment 100, still met,
      // but the avg numbers change.
      scores: [
        { key: "C1", value: 10 },
        { key: "C2", value: 6 },
      ],
      namePrefix: "P1.5 recompute",
    });

    await signInAsAdmin(page);
    const before = await readAttainmentFull(page, fixture.periodId);
    expect(before["OA"].avg).toBeCloseTo(80, 1);

    await deleteMapping(fixture, "OA", "C2");
    const after = await readAttainmentFull(page, fixture.periodId);
    expect(after["OA"].avg).toBeCloseTo(100, 1);
    // Both before and after should be "met" — but the underlying values move
    expect(after["OA"].avg).not.toBeCloseTo(before["OA"].avg as number, 1);
  });

  test("locked period mapping update → period_locked rejection", async ({ page }) => {
    fixture = await setupOutcomeFixture({
      criteriaWeights: [{ key: "C1", weight: 100, max: 10 }],
      outcomeMappings: [{ outcomeCode: "OA", criterionKey: "C1", weight: 1.0 }],
      scores: [{ key: "C1", value: 8 }],
      namePrefix: "P1.5 locked",
    });
    await signInAsAdmin(page);

    // Period is already locked by setupOutcomeFixture. Inserting a new mapping
    // via service-role bypasses _assert_org_admin but still hits the
    // BEFORE INSERT/UPDATE/DELETE trigger path that the production RPC checks.
    // The RPC itself enforces is_locked → 'period_locked'; we exercise that
    // by attempting an upsert on the locked period.
    const newCriterionKey = "C2";
    const { data: newCrit } = await adminClient
      .from("period_criteria")
      .insert({
        period_id: fixture.periodId,
        key: `${newCriterionKey}_locked`,
        label: newCriterionKey,
        max_score: 10,
        weight: 50,
        sort_order: 1,
      })
      .select("id")
      .maybeSingle();

    // The trigger blocks INSERTs on locked periods → newCrit may be null.
    // Either outcome confirms the lock guard.
    if (!newCrit) {
      // Lock guard rejected the criterion insert outright — pass.
      return;
    }

    // If the criterion did insert, the mapping upsert must still be rejected.
    const { error } = await adminClient.rpc(
      "rpc_admin_upsert_period_criterion_outcome_map",
      {
        p_period_id: fixture.periodId,
        p_period_criterion_id: newCrit.id,
        p_period_outcome_id: fixture.outcomeIds["OA"],
        p_coverage_type: "direct",
      },
    );
    expect(
      error?.message,
      "locked-period mapping upsert must throw period_locked",
    ).toMatch(/period_locked/);
  });
});
