import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  writeMatrixScores,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("analytics page", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  ) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
      } catch {}
    });
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await page.goto("/admin/analytics");
    return shell;
  }

  test("page renders — chart container visible", async ({ page }) => {
    await signInAndGoto(page);
    await expect(page.locator('[data-testid="analytics-chart-container"]')).toBeVisible();
  });

  test("nav item navigates to analytics", async ({ page }) => {
    const shell = await signInAndGoto(page);
    await expect(shell.navItem("analytics")).toBeVisible();
    await expect(page).toHaveURL(/analytics/);
  });
});

/**
 * E3 — Analytics data accuracy.
 *
 * Seeds an isolated period with two criteria (aMax=100, bMax=100) mapped 1:1 to
 * two outcomes, then writes a deterministic 2-juror × 2-project score matrix:
 *
 *             Juror 1           Juror 2
 *   Project 1  a=80 b=50         a=75 b=90
 *   Project 2  a=90 b=60         a=85 b=95
 *
 * Analytics attainment cards are computed per outcome code by collecting every
 * score_sheet_items.score_value for the mapped criterion, dividing by that
 * criterion's max (×100 %), and counting the fraction ≥ threshold (70 %).
 * With the matrix above:
 *   - Outcome A (mapped to criterion A): values [80, 75, 90, 85] → 4/4 ≥ 70 → 100 %
 *   - Outcome B (mapped to criterion B): values [50, 90, 60, 95] → 2/4 ≥ 70 → 50 %
 * So the "X of Y outcomes met" strip reads "1 of 2" (A met at 100 %, B not met
 * at 50 % since < 60 %).
 */
test.describe("analytics data accuracy (E3)", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      namePrefix: "E3 Analytics",
      aMax: 100,
      bMax: 100,
      outcomes: true,
      jurors: 2,
    });
    await writeMatrixScores(fixture, [
      { p1: { a: 80, b: 50 }, p2: { a: 90, b: 60 } },
      { p1: { a: 75, b: 90 }, p2: { a: 85, b: 95 } },
    ]);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  async function signInAndGoto(page: Page): Promise<void> {
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
    // Pin the fixture period explicitly — another session creating a newer
    // period would otherwise win pickDefaultPeriod.
    await shell.selectPeriod(fixture.periodId);
    await page.goto("/admin/analytics");
    await expect(page.locator('[data-testid="analytics-chart-container"]')).toBeVisible();
  }

  test("attainment card shows expected rate for outcome mapped to criterion A", async ({ page }) => {
    await signInAndGoto(page);
    const card = page.getByTestId(`analytics-att-card-${fixture.outcomeACode}`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-att-rate", "100");
    await expect(card).toHaveAttribute("data-att-status", "met");
  });

  test("attainment card shows expected rate for outcome mapped to criterion B", async ({ page }) => {
    await signInAndGoto(page);
    const card = page.getByTestId(`analytics-att-card-${fixture.outcomeBCode}`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-att-rate", "50");
    // 50% < 60% → not-met (statusClass "status-not-met" → "not-met" suffix)
    await expect(card).toHaveAttribute("data-att-status", "not-met");
  });

  test("outcomes-met summary strip matches attainment card count (1 of 2)", async ({ page }) => {
    await signInAndGoto(page);
    const summary = page.getByTestId("analytics-outcomes-met-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("data-met-count", "1");
    await expect(summary).toHaveAttribute("data-total-count", "2");
  });
});
