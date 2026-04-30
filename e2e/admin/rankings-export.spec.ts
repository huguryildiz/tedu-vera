import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { RankingsPom } from "../poms/RankingsPom";
import { readCSV, readXLSX } from "../helpers/parseExport";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  writeScoresAsJuror,
  finalizeJurors,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * Required column names in the Rankings export header.
 * These are the columns that VERA's Rankings page must always produce —
 * any rename or removal here is a regression caught by these tests.
 *
 * Note: criteria-derived columns (e.g. "Design (10)") are dynamic and
 * not asserted here; they are covered by the C4 scoring-correctness spec.
 */
const REQUIRED_EXPORT_HEADERS = ["Rank", "Project Title", "Team Members"];

test.describe("rankings export", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  ) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const rankings = new RankingsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await page.goto("/admin/rankings");
    await rankings.waitForReady();
    return rankings;
  }

  test("KPI strip visible on page load", async ({ page }) => {
    const rankings = await signInAndGoto(page);
    await expect(rankings.kpiStrip()).toBeVisible();
  });

  test("export panel opens on button click", async ({ page }) => {
    const rankings = await signInAndGoto(page);
    await rankings.openExportPanel();
    await expect(rankings.exportPanel()).toHaveClass(/show/);
  });

  test("CSV export → file downloaded → header columns correct", async ({
    page,
  }) => {
    const rankings = await signInAndGoto(page);
    await rankings.openExportPanel();
    await rankings.selectFormat("csv");

    const download = await rankings.clickDownloadAndCapture();
    const filePath = await download.path();
    expect(filePath, "download path must be non-null").toBeTruthy();

    const { headers } = readCSV(filePath!);
    expect(headers.length, "CSV header must have at least one column").toBeGreaterThan(0);

    for (const col of REQUIRED_EXPORT_HEADERS) {
      expect(headers, `CSV header must include "${col}"`).toContain(col);
    }
  });

  test("XLSX export → file downloaded → header columns correct", async ({
    page,
  }) => {
    const rankings = await signInAndGoto(page);
    await rankings.openExportPanel();
    // XLSX is the default format; selecting it explicitly for test clarity
    await rankings.selectFormat("xlsx");

    const download = await rankings.clickDownloadAndCapture();
    const filePath = await download.path();
    expect(filePath, "download path must be non-null").toBeTruthy();

    const { headers } = readXLSX(filePath!);
    expect(headers.length, "XLSX must have at least one header column").toBeGreaterThan(0);

    for (const col of REQUIRED_EXPORT_HEADERS) {
      expect(headers, `XLSX header must include "${col}"`).toContain(col);
    }
  });
});

/**
 * E4 — Export row integrity.
 *
 * Uses an isolated scoring fixture (scoringFixture) so assertions are
 * independent of the demo-seed data. Two fixture projects are scored with
 * known values; tests verify the XLSX export reflects them exactly.
 *
 * E4-2 (deliberately-break) mutates the DB scores and re-exports, proving
 * the export is data-driven — not cached from a prior render.
 */
test.describe("export row integrity", () => {
  test.describe.configure({ mode: "serial" });

  // P1: a=25, b=40 → raw sum = 65
  // P2: a=10, b=20 → raw sum = 30
  const P1_TOTAL = 65;
  const P2_TOTAL = 30;

  let e4Fixture: ScoringFixture;

  test.beforeAll(async () => {
    e4Fixture = await setupScoringFixture({ aMax: 30, bMax: 70, namePrefix: "E4 Export" });
    await writeScoresAsJuror(e4Fixture, { p1: { a: 25, b: 40 }, p2: { a: 10, b: 20 } });
    await finalizeJurors(e4Fixture);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(e4Fixture);
  });

  async function gotoRankingsForE4(page: Page) {
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
    await shell.selectPeriod(e4Fixture.periodId);
    await page.goto("/admin/rankings");
    const rankings = new RankingsPom(page);
    await rankings.waitForReady();
    await expect(page.getByTestId(`rankings-row-score-${e4Fixture.p1Id}`)).toBeVisible();
    await expect(page.getByTestId(`rankings-row-score-${e4Fixture.p2Id}`)).toBeVisible();
    return { rankings, shell };
  }

  test("E4-1: XLSX export — all project totals match DB score sums", async ({ page }) => {
    const { rankings } = await gotoRankingsForE4(page);

    await rankings.openExportPanel();
    await rankings.selectFormat("xlsx");
    const download = await rankings.clickDownloadAndCapture();
    const filePath = await download.path();
    expect(filePath, "download path must be non-null").toBeTruthy();

    const { headers, rows } = readXLSX(filePath!);
    const avgCol = headers.find((h) => /^Average\b/i.test(h));
    expect(avgCol, `XLSX must expose Average column; got: ${headers.join(", ")}`).toBeTruthy();
    const rankCol = headers.find((h) => /^rank$/i.test(h));
    expect(rankCol, "XLSX must expose Rank column").toBeTruthy();

    const p1Row = rows.find((r) => String(r["Project Title"] ?? "").includes("C4 P1"));
    const p2Row = rows.find((r) => String(r["Project Title"] ?? "").includes("C4 P2"));
    expect(p1Row, "C4 P1 must appear in XLSX export").toBeTruthy();
    expect(p2Row, "C4 P2 must appear in XLSX export").toBeTruthy();

    expect(Number(p1Row![avgCol!])).toBe(P1_TOTAL);
    expect(Number(p2Row![avgCol!])).toBe(P2_TOTAL);

    // P1 (65) ranks above P2 (30) — lower rank number = higher placement
    expect(Number(p1Row![rankCol!])).toBeLessThan(Number(p2Row![rankCol!]));
  });

  test("E4-2: deliberately-break — mutating DB score invalidates prior export total", async ({ page }) => {
    const { rankings, shell } = await gotoRankingsForE4(page);

    // Proof 1: capture correct total before mutation
    await rankings.openExportPanel();
    await rankings.selectFormat("xlsx");
    const dl1 = await rankings.clickDownloadAndCapture();
    const path1 = await dl1.path();
    expect(path1, "pre-mutation download path must be non-null").toBeTruthy();
    const { headers: h1, rows: r1 } = readXLSX(path1!);
    const avgCol1 = h1.find((hdr) => /^Average\b/i.test(hdr))!;
    const p1Before = Number(r1.find((r) => String(r["Project Title"] ?? "").includes("C4 P1"))![avgCol1]);
    expect(p1Before).toBe(P1_TOTAL); // proof 1: export was correct before mutation

    // Mutate: change p1 scores so total drops to 5+5=10
    await writeScoresAsJuror(e4Fixture, { p1: { a: 5, b: 5 }, p2: { a: 10, b: 20 } });

    // Re-navigate and re-select the fixture period to load fresh data
    await page.goto("/admin/rankings");
    await shell.selectPeriod(e4Fixture.periodId);
    await rankings.waitForReady();
    await expect(page.getByTestId(`rankings-row-score-${e4Fixture.p1Id}`)).toBeVisible();

    // Proof 2 + 3: stale value gone; new value reflects mutation
    await rankings.openExportPanel();
    await rankings.selectFormat("xlsx");
    const dl2 = await rankings.clickDownloadAndCapture();
    const path2 = await dl2.path();
    expect(path2, "post-mutation download path must be non-null").toBeTruthy();
    const { headers: h2, rows: r2 } = readXLSX(path2!);
    const avgCol2 = h2.find((hdr) => /^Average\b/i.test(hdr))!;
    const p1After = Number(r2.find((r) => String(r["Project Title"] ?? "").includes("C4 P1"))![avgCol2]);
    expect(p1After).not.toBe(P1_TOTAL); // proof 2: stale total is gone
    expect(p1After).toBe(10);           // proof 3: new export reflects mutation
  });
});
