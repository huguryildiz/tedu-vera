import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { RankingsPom } from "../poms/RankingsPom";
import { readXLSX } from "../helpers/parseExport";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  writeScoresAsJuror,
  finalizeJurors,
  reweightFixture,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * C4 — scoring math correctness.
 *
 * VERA's getProjectSummary computes totalAvg as the unweighted raw sum of
 * score_sheet_items.score_value across a juror's sheet, averaged across jurors.
 * period_criteria.weight is stored in the snapshot but NOT used in the ranking
 * pipeline — max_score is the effective scaling factor. Fixture values are
 * chosen so the expected totalAvg equals raw sum with one juror.
 */
test.describe("scoring correctness — criteria weight → ranking math", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({ aMax: 30, bMax: 70 });
    // P1 maxes criterion A, P2 maxes criterion B — asymmetric ranking.
    await writeScoresAsJuror(fixture, {
      p1: { a: 30, b: 3 },
      p2: { a: 3, b: 70 },
    });
    await finalizeJurors(fixture);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  async function signInAndGoto(page: Page): Promise<RankingsPom> {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {
        // localStorage unavailable — let the app handle fallback
      }
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();

    await page.goto("/admin/rankings");
    const rankings = new RankingsPom(page);
    await rankings.waitForReady();
    // Select after navigating to rankings. A full page.goto remounts the admin
    // layout and drops in-memory selectedPeriodId, so selecting before route
    // navigation lets parallel fixtures win pickDefaultPeriod again.
    await shell.selectPeriod(fixture.periodId, fixture.periodName);
    return rankings;
  }

  test("asymmetric weight (A max=30, B max=70) produces expected ranking", async ({ page }) => {
    await signInAndGoto(page);

    const p1Score = page.getByTestId(`rankings-row-score-${fixture.p1Id}`);
    const p2Score = page.getByTestId(`rankings-row-score-${fixture.p2Id}`);
    await expect(p1Score).toBeVisible({ timeout: 15_000 });
    await expect(p2Score).toBeVisible({ timeout: 15_000 });

    // Raw sum per VERA's pivotItems: P1 = 30 + 3 = 33, P2 = 3 + 70 = 73.
    // Displayed as .toFixed(1).
    await expect(p1Score).toHaveText("33.0");
    await expect(p2Score).toHaveText("73.0");

    // DOM order: P2 (73) must render before P1 (33) in the ranking table body.
    const p1Row = page.getByTestId(`rankings-row-${fixture.p1Id}`);
    const p2Row = page.getByTestId(`rankings-row-${fixture.p2Id}`);
    const p1Box = await p1Row.boundingBox();
    const p2Box = await p2Row.boundingBox();
    expect(p1Box, "P1 row must render").toBeTruthy();
    expect(p2Box, "P2 row must render").toBeTruthy();
    expect(p2Box!.y, "P2 must appear above P1 in ranking order").toBeLessThan(p1Box!.y);
  });

  test("XLSX export total matches DB raw score sum", async ({ page }) => {
    const rankings = await signInAndGoto(page);
    // Ensure both fixture rows rendered before triggering export — the export
    // serializes filteredRows, so opening the panel too early yields an empty sheet.
    await expect(page.getByTestId(`rankings-row-score-${fixture.p1Id}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`rankings-row-score-${fixture.p2Id}`)).toBeVisible({ timeout: 15_000 });

    await rankings.openExportPanel();
    await rankings.selectFormat("xlsx");
    const download = await rankings.clickDownloadAndCapture();
    const filePath = await download.path();
    expect(filePath, "download path must be non-null").toBeTruthy();

    const { headers, rows } = readXLSX(filePath!);
    // Rankings export labels the total column "Average (<totalMax>)".
    const totalColumn = headers.find((h) => /^Average\b/i.test(h));
    expect(
      totalColumn,
      `XLSX must expose an "Average (...)" column; got: ${headers.join(", ")}`,
    ).toBeTruthy();

    const p1Row = rows.find((r) => String(r["Project Title"] ?? "").includes("C4 P1"));
    const p2Row = rows.find((r) => String(r["Project Title"] ?? "").includes("C4 P2"));
    expect(p1Row, "C4 P1 row must appear in XLSX export").toBeTruthy();
    expect(p2Row, "C4 P2 row must appear in XLSX export").toBeTruthy();

    // Numeric comparison: XLSX getValue emits Number(toFixed(2)) so 33 / 73 are numbers.
    expect(Number(p1Row![totalColumn!])).toBe(33);
    expect(Number(p2Row![totalColumn!])).toBe(73);
  });

  test("equal weight (A=50, B=50) with symmetric scores produces a tie", async ({ page }) => {
    await reweightFixture(fixture, 50, 50);
    // Swap scores so raw sums match: P1 = 50 + 3 = 53, P2 = 3 + 50 = 53.
    await writeScoresAsJuror(fixture, {
      p1: { a: 50, b: 3 },
      p2: { a: 3, b: 50 },
    });

    await signInAndGoto(page);

    const p1Score = page.getByTestId(`rankings-row-score-${fixture.p1Id}`);
    const p2Score = page.getByTestId(`rankings-row-score-${fixture.p2Id}`);
    await expect(p1Score).toBeVisible({ timeout: 15_000 });
    await expect(p2Score).toBeVisible({ timeout: 15_000 });

    // Tie: both projects display 53.0.
    await expect(p1Score).toHaveText("53.0");
    await expect(p2Score).toHaveText("53.0");
  });
});
