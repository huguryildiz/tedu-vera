/**
 * W18 — Heatmap XLSX export, sheet-level verification.
 *
 * Trigger: UI download via the Export panel on /admin/heatmap.
 * exportGridXLSX produces: "All Criteria" sheet (includes Juror Progress column)
 * + one tab per criterion (no Juror Progress column).
 *
 * Sheet layout produced by makeSheet (exportXLSX.js):
 *   row 0 = headers   (no title/note/blank prefix — direct data layout)
 *   row 1..N = juror data rows
 *
 * Score matrix (J × P × C):
 *              J1            J2
 *   P1   C_A=8 C_B=6    C_A=9 C_B=7
 *   P2   C_A=7 C_B=5    C_A=8 C_B=6
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { readXLSXAllSheets, type MultiSheetXLSX } from "../helpers/parseExport";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  writeMatrixScores,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("W18: heatmap XLSX export — sheet verification", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;
  let downloadPath: string | null = null;
  let sheets: MultiSheetXLSX | null = null;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      namePrefix: "W18 Heatmap",
      aMax: 10,
      bMax: 10,
      jurors: 2,
    });
    await writeMatrixScores(fixture, [
      { p1: { a: 8, b: 6 }, p2: { a: 7, b: 5 } }, // J1
      { p1: { a: 9, b: 7 }, p2: { a: 8, b: 6 } }, // J2
    ]);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
    if (downloadPath) {
      try { fs.unlinkSync(downloadPath); } catch { /* swallow */ }
    }
  });

  async function signInAndDownload(page: Page): Promise<string> {
    // Intercept the audit Edge Function so a test-env failure doesn't block the download.
    await page.route("**/functions/v1/log-export-event", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

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
    await expect(page.locator('[data-testid="heatmap-grid"]')).toBeVisible({ timeout: 15_000 });
    // Wait for criteria tabs to appear — confirms criteriaConfig is loaded before export.
    await expect(
      page.locator(".hm-criteria-tabs .matrix-tab").filter({ hasText: /Criterion A/i }),
    ).toBeVisible({ timeout: 15_000 });
    // Wait for juror rows to confirm visibleJurors is populated before export triggers.
    await expect(
      page.locator('[data-testid^="heatmap-juror-avg-"]'),
    ).toHaveCount(2, { timeout: 15_000 });

    // Open export panel and wait for the download button to be visible.
    await page.getByRole("button", { name: /^Export$/i }).first().click();
    await expect(page.locator(".export-download-btn")).toBeVisible({ timeout: 5_000 });

    // Trigger download (XLSX is the default format)
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".export-download-btn").click(),
    ]);
    const filePath = await download.path();
    if (!filePath) throw new Error("Download path is null");
    return filePath;
  }

  // Single download in the first test; subsequent tests reuse the parsed workbook.
  test("download workbook + 3 sheets present", async ({ page }) => {
    downloadPath = await signInAndDownload(page);
    sheets = readXLSXAllSheets(downloadPath);
    const names = Object.keys(sheets);
    expect(names).toContain("All Criteria");
    expect(names).toContain("Criterion A (10)");
    expect(names).toContain("Criterion B (10)");
  });

  test("All Criteria sheet has 2 data rows — one per juror", () => {
    if (!sheets) throw new Error("sheets not yet loaded");
    const view = sheets["All Criteria"];
    if (!view) throw new Error('sheet "All Criteria" missing');
    // row[0] = headers; rows[1..] = juror data rows (filter trailing empties)
    const dataRows = view.rows.slice(1).filter((r) => r.some((c) => c !== null && c !== ""));
    expect(dataRows.length).toBe(2);
  });

  test("Criterion A (10) sheet has correct P1 and P2 scores for both jurors", () => {
    if (!sheets) throw new Error("sheets not yet loaded");
    const view = sheets["Criterion A (10)"];
    if (!view) throw new Error('sheet "Criterion A (10)" missing');
    // Headers (row 0): ["Juror", "Affiliation", "<P1 header>", "<P2 header>"]
    // No "Juror Progress" column on criterion tabs (includeStatus=false).
    // Column 2 = P1 score, column 3 = P2 score (groups ordered by group_no ASC).
    const j1Row = view.rows.find(
      (r) => typeof r?.[0] === "string" && (r[0] as string) === fixture.jurorNames[0],
    );
    const j2Row = view.rows.find(
      (r) => typeof r?.[0] === "string" && (r[0] as string) === fixture.jurorNames[1],
    );
    expect(j1Row, "J1 row must be present in Criterion A sheet").toBeTruthy();
    expect(j2Row, "J2 row must be present in Criterion A sheet").toBeTruthy();
    // J1: P1-A=8, P2-A=7
    expect(Number(j1Row![2])).toBe(8);
    expect(Number(j1Row![3])).toBe(7);
    // J2: P1-A=9, P2-A=8
    expect(Number(j2Row![2])).toBe(9);
    expect(Number(j2Row![3])).toBe(8);
  });
});
