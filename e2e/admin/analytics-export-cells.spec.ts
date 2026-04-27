import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { readXLSXAllSheets, type MultiSheetXLSX } from "../helpers/parseExport";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  writeMatrixScores,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * W17 — Analytics XLSX export, cell-level verification.
 *
 * Trigger: Option B (UI download). The Download button calls
 * `XLSX.writeFile(wb, ...)` (AnalyticsPage.jsx:388), which fires a real
 * browser download captured via `page.waitForEvent("download")`. Option A
 * (page.evaluate of buildAnalyticsWorkbook) was rejected because exportParams
 * requires the full graph populated by useAdminContext + useAnalyticsData
 * (dashboardStats, submittedData, outcomeTrendData, criteriaConfig,
 * outcomeConfig, priorPeriodStats); reconstructing it outside the component
 * would duplicate substantial production logic.
 *
 * Sheet layout produced by addTableSheet (analyticsExport.js:21):
 *   row 0 = [title]
 *   row 1 = [note]      (every analytics dataset emits a note)
 *   row 2 = []
 *   row 3 = headers
 *   row 4..N = data rows
 *   (extra sections appended below with: [], [section.title], [headers], rows...)
 *
 * Score matrix (P × J × C):
 *              J1            J2
 *   P1   C1=8 C2=6     C1=9 C2=7
 *   P2   C1=7 C2=5     C1=8 C2=6
 *
 * Hand-computed expected values (see EXPECTED constant block below).
 */

// ─── Per-(project, criterion) avg across jurors → percentage at max=10 ───
const P1_C1_AVG = 8.5;  // (8+9)/2
const P1_C1_PCT = 85.0;
const P1_C2_AVG = 6.5;  // (6+7)/2
const P1_C2_PCT = 65.0;
const P2_C1_AVG = 7.5;  // (7+8)/2
const P2_C1_PCT = 75.0;
const P2_C2_AVG = 5.5;  // (5+6)/2
const P2_C2_PCT = 55.0;

// ─── Per-criterion stats across all (project, juror) cells ───
const C1_VALS = [8, 9, 7, 8];     // avg=8.0, pct=80%
const C2_VALS = [6, 7, 5, 6];     // avg=6.0, pct=60%
const C1_AVG_RAW = 8.0;
const C1_AVG_PCT = 80.0;
const C2_AVG_RAW = 6.0;
const C2_AVG_PCT = 60.0;
const C_N = 4;

// ─── Per-outcome attainment at threshold=70% (max=10 → score must be ≥ 7) ───
// OA mapped 1:1 → C1: vals=[8,9,7,8] → 4/4 ≥ 7 → 100%
// OB mapped 1:1 → C2: vals=[6,7,5,6] → 1/4 ≥ 7 → 25%
const OA_ATT_RATE = 100;
const OB_ATT_RATE = 25;
const OA_STATUS = "Met";          // attRate ≥ threshold(70)
const OB_STATUS = "Not Met";      // attRate < 60

// ─── Per-(project, criterion) cell heatmap thresholds (≥70%) ───
// P1: C1=85 ≥70 ✓, C2=65 <70 ✗ → belowCount=1
// P2: C1=75 ≥70 ✓, C2=55 <70 ✗ → belowCount=1
const P1_BELOW_COUNT = 1;
const P2_BELOW_COUNT = 1;

test.describe("W17: analytics XLSX export — cell-level verification", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;
  let downloadPath: string | null = null;
  let sheets: MultiSheetXLSX | null = null;

  test.beforeAll(async () => {
    // The seeded Spring 2026 period (a0d6f60d…) shares E2E_PERIODS_ORG_ID
    // with the W17 fixture period this spec creates. With both present the
    // analytics trend selector initializes to 2 periods (useAnalyticsData
    // line 54-56) and the export's conditional `headers.length-2 >= 2`
    // becomes true → "Attainment Trend" sheet is included, defeating the
    // spec's "1 period → trend skipped" expectation. localStorage pre-seed
    // alone is insufficient because periodOptions still surfaces both
    // periods through the period dropdown and downstream selectors.
    //
    // Delete the seeded period so this org has only the fixture period
    // for the duration of this spec. Admin shard 1 has its own isolated
    // local Supabase stack, so this delete does not affect jury specs in
    // the auth/jury/security shard (different DB) which still depend on
    // a0d6f60d.
    //
    // Unlock first because the block_periods_on_locked_mutate trigger
    // refuses DELETE on a locked period when current_user_is_super_admin()
    // is false (service-role queries have no auth.uid()).
    await adminClient
      .from("periods")
      .update({ is_locked: false })
      .eq("id", "a0d6f60d-ece4-40f8-aca2-955b4abc5d88");
    await adminClient
      .from("periods")
      .delete()
      .eq("id", "a0d6f60d-ece4-40f8-aca2-955b4abc5d88");

    fixture = await setupScoringFixture({
      namePrefix: "W17 Export",
      aMax: 10,
      bMax: 10,
      outcomes: true,
      jurors: 2,
    });
    await writeMatrixScores(fixture, [
      { p1: { a: 8, b: 6 }, p2: { a: 7, b: 5 } },  // J1
      { p1: { a: 9, b: 7 }, p2: { a: 8, b: 6 } },  // J2
    ]);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
    if (downloadPath) {
      try { fs.unlinkSync(downloadPath); } catch { /* swallow */ }
    }
  });

  async function signInAndDownload(page: Page): Promise<string> {
    // E2E_PERIODS_ORG_ID also hosts the seeded Spring 2026 period (a0d6f60d…),
    // so the org has 2 periods total once setupScoringFixture creates the W17
    // period. The trend-period selector defaults to *all* periods on first
    // load (useAnalyticsData line 54-56) — that would push the headers count
    // past the conditional threshold and cause "Attainment Trend" to be
    // included in the export, defeating the spec's "1 period → trend
    // skipped" expectation.
    //
    // Pre-seed the persisted trend selection with only the fixture period
    // so the analytics page initializes with a single-period trend and the
    // export's conditional excludes the trend sheet.
    await page.addInitScript(
      ({ orgId, periodId }) => {
        try {
          localStorage.setItem("vera.admin_tour_done", "1");
          localStorage.setItem("admin.remember_me", "true");
          localStorage.setItem("admin.active_organization_id", orgId);
          localStorage.setItem(
            "jury_admin_ui_state_v1",
            JSON.stringify({ trend: { periodIds: [periodId] } }),
          );
        } catch {}
      },
      { orgId: E2E_PERIODS_ORG_ID, periodId: fixture.periodId },
    );
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.selectPeriod(fixture.periodId);
    await page.goto("/admin/analytics");

    // Wait for analytics container + an outcome card → confirms submittedData
    // and dashboardStats have been processed (cards are derived from both).
    await expect(page.locator('[data-testid="analytics-chart-container"]')).toBeVisible();
    await expect(
      page.getByTestId(`analytics-att-card-${fixture.outcomeACode}`),
    ).toBeVisible();

    // Open export panel (button text is "Export")
    await page.getByRole("button", { name: /^Export$/i }).first().click();

    // Click Download (XLSX is the default format → button reads "Download Excel")
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".export-download-btn").click(),
    ]);
    const filePath = await download.path();
    if (!filePath) throw new Error("Download path is null");
    return filePath;
  }

  // Single download in the first test; subsequent tests reuse the file.
  test("download workbook + all expected sheets present (trend skipped: 1 period)", async ({ page }) => {
    downloadPath = await signInAndDownload(page);
    sheets = readXLSXAllSheets(downloadPath);
    const names = Object.keys(sheets);

    // 9 sheets — trend conditionally skipped (headers.length-2 < 2 with 1 period)
    expect(names).toEqual(expect.arrayContaining([
      "Attainment Status",
      "Attainment Rate",
      "Threshold Gap",
      "Outcome Achievement",
      "Rubric Achievement Dist.",
      "Programme-Level Averages",
      "Project Heatmap",
      "Juror Consistency",
      "Coverage Matrix",
    ]));
    expect(names).not.toContain("Attainment Trend");

    // Sanity: every present sheet has a title row at A1
    for (const name of names) {
      const view = sheets[name];
      const title = view.cell("A1");
      expect(title, `sheet "${name}" must have non-empty A1 title`).toBeTruthy();
    }
  });

  // ─── Helpers (use after first test populates `sheets`) ─────────────────
  function getSheet(name: string) {
    if (!sheets) throw new Error("sheets not yet loaded");
    const s = sheets[name];
    if (!s) throw new Error(`sheet "${name}" missing`);
    return s;
  }
  // Data rows start at index 4 (title, note, blank, headers, ...rows).
  function dataRows(sheetName: string): unknown[][] {
    return getSheet(sheetName).rows.slice(4);
  }
  function findRowStartingWith(sheetName: string, firstCellNeedle: string): unknown[] {
    const rows = dataRows(sheetName);
    const found = rows.find(
      (r) => typeof r?.[0] === "string" && (r[0] as string).includes(firstCellNeedle),
    );
    if (!found) throw new Error(`no row in "${sheetName}" starts with "${firstCellNeedle}"`);
    return found;
  }

  // ─── Per-section assertions ───────────────────────────────────────────

  test("Attainment Status — OA Met @ 100%, OB Not Met @ 25%", () => {
    const oaRow = findRowStartingWith("Attainment Status", fixture.outcomeACode!);
    const obRow = findRowStartingWith("Attainment Status", fixture.outcomeBCode!);
    // Headers (no prior period): [Outcome, Description, Attainment Rate (%), Status]
    expect(Number(oaRow[2])).toBe(OA_ATT_RATE);
    expect(String(oaRow[3])).toBe(OA_STATUS);
    expect(Number(obRow[2])).toBe(OB_ATT_RATE);
    expect(String(obRow[3])).toBe(OB_STATUS);
  });

  test("Attainment Rate — per-outcome rate + N matches DB", () => {
    const oaRow = findRowStartingWith("Attainment Rate", fixture.outcomeACode!);
    const obRow = findRowStartingWith("Attainment Rate", fixture.outcomeBCode!);
    // Headers: [Outcome, Description, Attainment Rate (%), N, Status]
    expect(Number(oaRow[2])).toBeCloseTo(OA_ATT_RATE, 1);
    expect(Number(oaRow[3])).toBe(C_N);
    expect(String(oaRow[4])).toBe(OA_STATUS);
    expect(Number(obRow[2])).toBeCloseTo(OB_ATT_RATE, 1);
    expect(Number(obRow[3])).toBe(C_N);
    expect(String(obRow[4])).toBe(OB_STATUS);
  });

  test("Threshold Gap — OA gap = +30%, OB gap = -45%", () => {
    const oaRow = findRowStartingWith("Threshold Gap", fixture.outcomeACode!);
    const obRow = findRowStartingWith("Threshold Gap", fixture.outcomeBCode!);
    // Headers: [Outcome, Criterion, Attainment Rate (%), Gap vs Threshold]
    // Gap col is a string like "+30.0%" / "-45.0%" — extract numeric.
    const oaGap = parseFloat(String(oaRow[3]).replace("%", ""));
    const obGap = parseFloat(String(obRow[3]).replace("%", ""));
    expect(oaGap).toBeCloseTo(OA_ATT_RATE - 70, 1);   // +30
    expect(obGap).toBeCloseTo(OB_ATT_RATE - 70, 1);   // -45
  });

  test("Outcome Achievement (by Project) — per-(project, criterion) Avg + %", () => {
    // Headers: [Project Title, "<C1.label> Avg", "<C1.label> (%)", "<C2.label> Avg", "<C2.label> (%)"]
    // Row label format: "P{n} — {title}"
    const p1 = findRowStartingWith("Outcome Achievement", "C4 P1");
    const p2 = findRowStartingWith("Outcome Achievement", "C4 P2");
    expect(Number(p1[1])).toBeCloseTo(P1_C1_AVG, 2);
    expect(Number(p1[2])).toBeCloseTo(P1_C1_PCT, 1);
    expect(Number(p1[3])).toBeCloseTo(P1_C2_AVG, 2);
    expect(Number(p1[4])).toBeCloseTo(P1_C2_PCT, 1);
    expect(Number(p2[1])).toBeCloseTo(P2_C1_AVG, 2);
    expect(Number(p2[2])).toBeCloseTo(P2_C1_PCT, 1);
    expect(Number(p2[3])).toBeCloseTo(P2_C2_AVG, 2);
    expect(Number(p2[4])).toBeCloseTo(P2_C2_PCT, 1);
  });

  test("Rubric Achievement Dist. — total per criterion = 4 (no rubric configured → bands all 0)", () => {
    // Headers: [Outcome, Total, Excellent count, Excellent %, Good count, Good %, Developing count, Developing %, Insufficient count, Insufficient %]
    // Fixture criteria have no rubric bands, so all classifications return null → all band counts 0.
    // The Total cell still tracks vals.length, which is the strong invariant.
    const c1 = findRowStartingWith("Rubric Achievement Dist.", "Criterion A");
    const c2 = findRowStartingWith("Rubric Achievement Dist.", "Criterion B");
    expect(Number(c1[1])).toBe(C1_VALS.length);
    expect(Number(c2[1])).toBe(C2_VALS.length);
    // Spot check: Excellent count == 0 since no rubric bands defined
    expect(Number(c1[2])).toBe(0);
    expect(Number(c2[2])).toBe(0);
  });

  test("Programme-Level Averages — Avg (raw), Avg (%), N per criterion", () => {
    // Headers: [Outcome, Max, Avg (raw), Avg (%), Std. deviation σ (%) [sample], N]
    const c1 = findRowStartingWith("Programme-Level Averages", "Criterion A");
    const c2 = findRowStartingWith("Programme-Level Averages", "Criterion B");
    expect(Number(c1[1])).toBe(10);                          // max
    expect(Number(c1[2])).toBeCloseTo(C1_AVG_RAW, 2);        // avg (raw)
    expect(Number(c1[3])).toBeCloseTo(C1_AVG_PCT, 1);        // avg (%)
    expect(Number(c1[5])).toBe(C_N);                         // N
    expect(Number(c2[1])).toBe(10);
    expect(Number(c2[2])).toBeCloseTo(C2_AVG_RAW, 2);
    expect(Number(c2[3])).toBeCloseTo(C2_AVG_PCT, 1);
    expect(Number(c2[5])).toBe(C_N);
  });

  test("Project Heatmap — per-project criterion % + below-threshold flag count", () => {
    // Headers: [Project Title, "<C1.label>", "<C2.label>", "Cells Below Threshold"]
    const p1 = findRowStartingWith("Project Heatmap", "C4 P1");
    const p2 = findRowStartingWith("Project Heatmap", "C4 P2");
    expect(Number(p1[1])).toBeCloseTo(P1_C1_PCT, 1);
    expect(Number(p1[2])).toBeCloseTo(P1_C2_PCT, 1);
    expect(Number(p1[3])).toBe(P1_BELOW_COUNT);
    expect(Number(p2[1])).toBeCloseTo(P2_C1_PCT, 1);
    expect(Number(p2[2])).toBeCloseTo(P2_C2_PCT, 1);
    expect(Number(p2[3])).toBe(P2_BELOW_COUNT);
  });

  test("Juror Consistency — CV cells finite for both projects × both criteria", () => {
    // Headers: [Project Title, <C1.label>, <C2.label>]
    // CV = (sd_sample / mean) × 100. For 2-juror cells, sd_sample = sqrt((Δ/2)² × 2) = |Δ|/sqrt(2) * something
    // Hand calc P1 C1: vals=[8,9] mean=8.5 sd=0.7071 cv≈8.32 → "8.3"
    //         P1 C2: vals=[6,7] mean=6.5 sd=0.7071 cv≈10.88 → "10.9"
    //         P2 C1: vals=[7,8] mean=7.5 sd=0.7071 cv≈9.43 → "9.4"
    //         P2 C2: vals=[5,6] mean=5.5 sd=0.7071 cv≈12.86 → "12.9"
    const p1 = findRowStartingWith("Juror Consistency", "C4 P1");
    const p2 = findRowStartingWith("Juror Consistency", "C4 P2");
    expect(Number(p1[1])).toBeCloseTo(8.3, 1);
    expect(Number(p1[2])).toBeCloseTo(10.9, 1);
    expect(Number(p2[1])).toBeCloseTo(9.4, 1);
    expect(Number(p2[2])).toBeCloseTo(12.9, 1);
  });

  test("Coverage Matrix — OA→C1=Direct, OB→C2=Direct, off-diagonal = '—'", () => {
    // Headers: [Outcome, Description, "Criterion A", "Criterion B"]
    const oa = findRowStartingWith("Coverage Matrix", fixture.outcomeACode!);
    const ob = findRowStartingWith("Coverage Matrix", fixture.outcomeBCode!);
    expect(String(oa[2])).toBe("Direct");
    expect(String(oa[3])).toBe("—");
    expect(String(ob[2])).toBe("—");
    expect(String(ob[3])).toBe("Direct");

    // Coverage Summary extra section appended below main rows.
    // Find by scanning for "Directly assessed" label cell.
    const allRows = getSheet("Coverage Matrix").rows;
    const directRow = allRows.find(
      (r) => typeof r?.[0] === "string" && (r[0] as string) === "Directly assessed",
    );
    expect(directRow, "Coverage Summary 'Directly assessed' row must be present").toBeTruthy();
    expect(Number(directRow![1])).toBe(2); // both outcomes directly assessed
  });
});
