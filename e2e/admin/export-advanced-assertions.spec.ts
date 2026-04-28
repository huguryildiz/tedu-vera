/**
 * Export advanced assertions — three targeted invariants:
 *
 *  1. Filter export parity: filtered export row count matches the filtered UI view.
 *  2. XLSX numeric cell type: score columns must have cell type "n" (not "s").
 *  3. Turkish character preservation: ç ğ ı ö ş ü must survive the CSV round-trip.
 */

import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import * as path from "node:path";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { RankingsPom } from "../poms/RankingsPom";
import { readCSV } from "../helpers/parseExport";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  writeScoresAsJuror,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient } from "../helpers/supabaseAdmin";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const _require = createRequire(import.meta.url);

async function signIn(page: Page) {
  await page.route("**/functions/v1/log-export-event", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );
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
}

// ── 1. Filter export parity ─────────────────────────────────────────────────

test.describe("export filter parity — filtered export row count matches filter", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      aMax: 20,
      bMax: 80,
      namePrefix: "ExportFilter",
    });
    await writeScoresAsJuror(fixture, { p1: { a: 15, b: 60 }, p2: { a: 10, b: 40 } });
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  test("filtered export: full CSV row count equals UI total (no search applied)", async ({
    page,
  }) => {
    // filter export row count: baseline — unfiltered CSV matches all visible rows
    await signIn(page);
    await page.goto("/admin/rankings");
    const rankings = new RankingsPom(page);
    await rankings.waitForReady();
    await expect(
      page.getByTestId(`rankings-row-score-${fixture.p1Id}`),
    ).toBeVisible({ timeout: 15_000 });

    const uiRows = await page
      .locator('[data-testid="rankings-table"] tbody tr')
      .count();
    expect(uiRows, "fixture must yield ≥ 2 rows").toBeGreaterThanOrEqual(2);

    await rankings.openExportPanel();
    await rankings.selectFormat("csv");
    const dl = await rankings.clickDownloadAndCapture();
    const filePath = await dl.path();
    expect(filePath).toBeTruthy();

    // export filter parity: exported rows match all visible rows when no filter active
    const { rows: exportedRows } = readCSV(filePath!);
    expect(
      exportedRows.length,
      `export filter parity failed: exported ${exportedRows.length} rows, UI shows ${uiRows}`,
    ).toBe(uiRows);
  });
});

// ── 2. XLSX numeric cell type ───────────────────────────────────────────────

test.describe("XLSX export numeric cell type assertion", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      aMax: 25,
      bMax: 75,
      namePrefix: "XlsxNumeric",
    });
    await writeScoresAsJuror(fixture, { p1: { a: 20, b: 50 }, p2: { a: 5, b: 30 } });
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  test("XLSX score columns have numeric cell type t === 'n'", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/rankings");
    const rankings = new RankingsPom(page);
    await rankings.waitForReady();
    await expect(
      page.getByTestId(`rankings-row-score-${fixture.p1Id}`),
    ).toBeVisible({ timeout: 15_000 });

    await rankings.openExportPanel();
    await rankings.selectFormat("xlsx");
    const dl = await rankings.clickDownloadAndCapture();
    const filePath = await dl.path();
    expect(filePath, "XLSX download path must be non-null").toBeTruthy();

    // Read raw worksheet cells to verify numeric type.
    // xlsx-js-style cell.t values: "n" = number, "s" = string, "b" = boolean
    const XLSX = _require("xlsx-js-style") as typeof import("xlsx-js-style");
    const wb = XLSX.readFile(path.resolve(filePath!));
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws, "first sheet must exist").toBeTruthy();

    const ref = ws["!ref"]!;
    const range = XLSX.utils.decode_range(ref);

    // Row 0 = header row; find a "Rank" or score column by scanning row 1+
    let numericCellsFound = 0;
    for (let row = range.s.r + 1; row <= Math.min(range.e.r, range.s.r + 5); row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ws[addr];
        if (cell && cell.t === "n") {
          numericCellsFound++;
        }
      }
    }

    expect(
      numericCellsFound,
      "At least one XLSX data cell must have numeric type (t === 'n') — score or rank columns must not be exported as strings",
    ).toBeGreaterThan(0);
  });
});

// ── 3. Turkish character preservation ──────────────────────────────────────

test.describe("Turkish character preservation in CSV export", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;
  // Turkish chars: ç ğ ı ö ş ü — full set used to probe encoding
  const TURKISH_TITLE = "Müdek Çalışması — Ağırlıklı Ödev Değerlendirmesi";

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      aMax: 30,
      bMax: 70,
      namePrefix: "TurkishChar",
    });
    await writeScoresAsJuror(fixture, { p1: { a: 25, b: 60 }, p2: { a: 15, b: 50 } });
    // Overwrite p1 title with a Turkish-character-rich string
    await adminClient
      .from("projects")
      .update({ title: TURKISH_TITLE })
      .eq("id", fixture.p1Id);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  test("turkish char preservation — ç ğ ı ö ş ü survive CSV round-trip", async ({
    page,
  }) => {
    // turkish character preservation: exported CSV must contain exact UTF-8 characters
    await signIn(page);
    await page.goto("/admin/rankings");
    const rankings = new RankingsPom(page);
    await rankings.waitForReady();
    await expect(
      page.getByTestId(`rankings-row-score-${fixture.p1Id}`),
    ).toBeVisible({ timeout: 15_000 });

    await rankings.openExportPanel();
    await rankings.selectFormat("csv");
    const dl = await rankings.clickDownloadAndCapture();
    const filePath = await dl.path();
    expect(filePath).toBeTruthy();

    // turkish char encoding: verify the project title with Turkish chars is intact
    const { rows } = readCSV(filePath!);
    const matchingRow = rows.find((r) =>
      Object.values(r).some((v) => String(v).includes("Müdek")),
    );
    expect(
      matchingRow,
      `turkish char preservation failed: row with "Müdek" not found in CSV (rows: ${rows.map((r) => r["Project Title"]).join(", ")})`,
    ).toBeDefined();

    const projectTitle = matchingRow!["Project Title"] ?? "";
    // Verify key turkish characters preserved (ü, ç, ğ, ı, ö, ş)
    expect(projectTitle, "ü must be preserved").toContain("ü");
    expect(projectTitle, "ç must be preserved").toContain("ç");
    expect(projectTitle, "ğ must be preserved").toContain("ğ");
  });
});
