import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
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
});
