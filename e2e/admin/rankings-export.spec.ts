import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { RankingsPom } from "../poms/RankingsPom";
import { readCSV, readXLSX } from "../helpers/parseExport";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

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
