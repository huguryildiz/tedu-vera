import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import { adminClient } from "../helpers/supabaseAdmin";
import {
  setupScoringFixture,
  writeMatrixScores,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("heatmap page", () => {
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
    await page.goto("/admin/heatmap");
    return shell;
  }

  test("page renders — heatmap grid visible", async ({ page }) => {
    await signInAndGoto(page);
    await expect(page.locator('[data-testid="heatmap-grid"]')).toBeVisible();
  });

  test("nav item navigates to heatmap", async ({ page }) => {
    const shell = await signInAndGoto(page);
    await expect(shell.navItem("heatmap")).toBeVisible();
    await expect(page).toHaveURL(/heatmap/);
  });
});

/**
 * E3 — Heatmap cell state + aggregate data accuracy.
 *
 * Seeds 2 jurors × 2 projects with a deliberate mix of cell states:
 *
 *              P1                       P2
 *   J1   a=80 b=50   scored 130   a=60 (b omitted) partial 60
 *   J2   (no sheet) empty         a=90 b=95         scored 185
 *
 * Expectations (activeTab="all", totalMax = 200):
 *   - cell(J1,P1) scored, score=130
 *   - cell(J1,P2) partial, score=60
 *   - cell(J2,P1) empty (matrixJurors still includes J2 because J2×P2 exists)
 *   - cell(J2,P2) scored, score=185
 *   - P1 project avg = 130 (only scored cells counted → J1 only)
 *   - P2 project avg = 185 (J1 is partial → excluded; J2 scored only)
 *   - J1 row avg = 130 (P2 partial excluded)
 *   - J2 row avg = 185 (P1 empty excluded)
 *   - overall avg = (130 + 185) / 2 = 157.5
 */
test.describe("heatmap data accuracy (E3)", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      namePrefix: "E3 Heatmap",
      aMax: 100,
      bMax: 100,
      jurors: 2,
    });
    await writeMatrixScores(fixture, [
      { p1: { a: 80, b: 50 }, p2: { a: 60 } },     // J1: scored, partial
      { p1: null, p2: { a: 90, b: 95 } },          // J2: empty, scored
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
    await shell.selectPeriod(fixture.periodId);
    await page.goto("/admin/heatmap");
    await expect(page.locator('[data-testid="heatmap-grid"]')).toBeVisible();
  }

  test("cell states match seeded scoring pattern (scored/partial/empty)", async ({ page }) => {
    await signInAndGoto(page);

    const [j1, j2] = fixture.jurorIds;

    const j1p1 = page.getByTestId(`heatmap-cell-${j1}-${fixture.p1Id}`);
    await expect(j1p1).toHaveAttribute("data-cell-state", "scored");
    await expect(j1p1).toHaveAttribute("data-cell-score", "130");

    const j1p2 = page.getByTestId(`heatmap-cell-${j1}-${fixture.p2Id}`);
    await expect(j1p2).toHaveAttribute("data-cell-state", "partial");
    await expect(j1p2).toHaveAttribute("data-cell-score", "60");

    const j2p1 = page.getByTestId(`heatmap-cell-${j2}-${fixture.p1Id}`);
    await expect(j2p1).toHaveAttribute("data-cell-state", "empty");

    const j2p2 = page.getByTestId(`heatmap-cell-${j2}-${fixture.p2Id}`);
    await expect(j2p2).toHaveAttribute("data-cell-state", "scored");
    await expect(j2p2).toHaveAttribute("data-cell-score", "185");
  });

  test("row/column/overall averages match expected aggregation", async ({ page }) => {
    await signInAndGoto(page);
    const [j1, j2] = fixture.jurorIds;

    // Per-juror averages (scored cells only).
    await expect(page.getByTestId(`heatmap-juror-avg-${j1}`)).toHaveAttribute("data-avg", "130.0");
    await expect(page.getByTestId(`heatmap-juror-avg-${j2}`)).toHaveAttribute("data-avg", "185.0");

    // Per-project averages (scored cells only).
    await expect(page.getByTestId(`heatmap-project-avg-${fixture.p1Id}`)).toHaveAttribute("data-avg", "130.0");
    await expect(page.getByTestId(`heatmap-project-avg-${fixture.p2Id}`)).toHaveAttribute("data-avg", "185.0");

    // Overall juror average = mean of per-juror averages.
    await expect(page.getByTestId("heatmap-overall-avg")).toHaveAttribute("data-avg", "157.5");
  });

  test("deliberately-break: mutating a sheet to partial changes its cell state", async ({ page, browser }) => {
    // Phase 1 — initial render confirms scored state.
    await signInAndGoto(page);
    const [j1] = fixture.jurorIds;
    const j1p1 = page.getByTestId(`heatmap-cell-${j1}-${fixture.p1Id}`);
    await expect(j1p1).toHaveAttribute("data-cell-state", "scored");

    // Phase 2 — drop criterion B from the J1×P1 sheet so it becomes partial.
    const { data: sheets, error: sheetErr } = await adminClient
      .from("score_sheets")
      .select("id")
      .eq("juror_id", j1)
      .eq("project_id", fixture.p1Id)
      .limit(1);
    if (sheetErr || !sheets?.length) throw new Error("mutation setup: J1×P1 sheet not found");
    const sheetId = sheets[0].id;
    const { error: delErr } = await adminClient
      .from("score_sheet_items")
      .delete()
      .eq("score_sheet_id", sheetId)
      .eq("period_criterion_id", fixture.criteriaBId);
    if (delErr) throw new Error(`mutation: delete criterion B item failed: ${delErr.message}`);

    // Phase 3 — fresh page session picks up the mutation. Same page instance
    // would reuse cached scores, so use a new context.
    try {
      const freshCtx = await browser.newContext();
      const freshPage = await freshCtx.newPage();
      try {
        await signInAndGoto(freshPage);
        const mutated = freshPage.getByTestId(`heatmap-cell-${j1}-${fixture.p1Id}`);
        await expect(mutated).not.toHaveAttribute("data-cell-state", "scored");
        await expect(mutated).toHaveAttribute("data-cell-state", "partial");
        await expect(mutated).toHaveAttribute("data-cell-score", "80");
      } finally {
        await freshCtx.close();
      }
    } finally {
      // Restore the matrix so subsequent retries / suite runs see clean state.
      await writeMatrixScores(fixture, [
        { p1: { a: 80, b: 50 }, p2: { a: 60 } },
        { p1: null, p2: { a: 90, b: 95 } },
      ]);
    }
  });
});
