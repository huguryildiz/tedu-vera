import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { OverviewPom } from "../poms/OverviewPom";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupOverviewFixture,
  teardownOverviewFixture,
  type OverviewFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * Phase 2.1 — Overview KPI numerical correctness.
 *
 * Source-of-truth formulas live in
 * `.claude/internal/plans/test-quality-upgrade/phase-2-overview-kpi-formulas.md`.
 * Every assertion below is grounded in `OverviewPage.jsx` lines 118–222.
 *
 * Fixture knobs (12 jurors, 6 projects):
 *   completedJurors = 5  → kpi.completed = 5, kpi.pct = round(5/12*100) = 42
 *   editingJurors   = 2  → kpi.editing   = 2
 *   seenJurors      = 10 → kpi.neverSeen = 2
 *   scoredPerProject (per project) = [12, 9, 6, 3, 0, 6]
 *
 * Every score cell is 50 on each criterion (max=50/each, totalMax=100), so
 *   kpi.avg = 50 + 50 = 100 (per submitted sheet)
 *   completed-juror sheets = 5 jurors × {N projects each scored} → all rows
 *     have total=100, average=100.0
 */

const J = 12;
const P = 6;
const COMPLETED = 5;
const EDITING = 2;
const SEEN = 10;
const SCORED_PER_PROJECT = [12, 9, 6, 3, 0, 6];

async function signInAndOpenOverview(page: Page, fixture: OverviewFixture): Promise<OverviewPom> {
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
  const overview = new OverviewPom(page);
  // Navigate to overview; pickDefaultPeriod may auto-select the wrong period
  // when scoring fixtures (+1h) or other overview fixtures (+2h) are active.
  await page.goto("/admin/overview");
  await expect(overview.kpiActiveJurors()).toBeVisible({ timeout: 15_000 });
  // Explicitly select the fixture period to be immune to inter-worker races.
  await shell.selectPeriod(fixture.periodId, fixture.periodName);
  // Wait until the KPI card reflects BOTH the correct period ID and the fixture
  // juror count in the same render. Polling on juror count alone is insufficient
  // when another period coincidentally has the same count — the stale data from
  // the wrong period would make the poll resolve early.
  await expect
    .poll(
      async () => {
        const card = overview.kpiActiveJurors();
        const periodId = await card.getAttribute("data-period-id");
        const value = Number((await card.getAttribute("data-value")) ?? 0);
        return periodId === fixture.periodId && value === fixture.jurorIds.length;
      },
      { timeout: 15_000, intervals: [200, 500, 1000] },
    )
    .toBe(true);
  return overview;
}

test.describe("admin overview — KPI numerical correctness", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: OverviewFixture;

  test.beforeAll(async () => {
    fixture = await setupOverviewFixture({
      jurors: J,
      projects: P,
      completedJurors: COMPLETED,
      editingJurors: EDITING,
      seenJurors: SEEN,
      scoredPerProject: SCORED_PER_PROJECT,
      scoreValue: 50,
      namePrefix: "Phase 2.1 Overview",
    });
  });

  test.afterAll(async () => {
    await teardownOverviewFixture(fixture);
  });

  // e2e.admin.overview.kpi.active_jurors
  test("KPI Active Jurors equals total jurors assigned", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    expect(await overview.kpiActiveJurorsValue()).toBe(J);
  });

  // e2e.admin.overview.kpi.projects
  test("KPI Projects equals projects in period", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    expect(await overview.kpiProjectsValue()).toBe(P);
  });

  // e2e.admin.overview.kpi.completion_pct
  test("KPI Completion = round(completed / total × 100)", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    const expectedPct = Math.round((COMPLETED / J) * 100);
    expect(await overview.kpiCompletionPct()).toBeCloseTo(expectedPct, 0);
  });

  // e2e.admin.overview.kpi.average_score
  test("KPI Average Score equals .toFixed(1) of completed-juror raw totals", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    // Each submitted sheet has score 50 + 50 = 100. The 5 completed jurors
    // each scored {12, 9, 6, 3, 0, 6}-th projects depending on overlap; but
    // every single submitted score is 100 → average is 100.0.
    const value = await overview.kpiAverageScoreValue();
    expect(value).not.toBeNull();
    expect(value!).toBeCloseTo(100.0, 1);
  });

  // e2e.admin.overview.kpi.juror_breakdown
  test("Active Jurors breakdown matches completed/editing/inProgress/notStarted", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    const b = await overview.readKpiBreakdown();
    expect(b.completed).toBe(COMPLETED);
    expect(b.editing).toBe(EDITING);
    // Completed and editing slots cover indices 0..6; in_progress / ready /
    // notStarted are derived from completedProjects/totalProjects on the
    // remaining 5 jurors. Their assignments: project P1 covered by ALL 12
    // jurors (so j7-j11 have completedProjects ≥ 1 → in_progress).
    const remaining = J - COMPLETED - EDITING;
    expect(b.inProgress + b.ready + b.notStarted).toBe(remaining);
  });

  // e2e.admin.overview.completion.bars_per_project
  test("Group completion bars = round(scored/total × 100) per project, sorted desc", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    expect(await overview.completionCount()).toBe(P);
    // Sorted descending by pct → ranks 1..P map to sorted SCORED_PER_PROJECT
    const sorted = [...SCORED_PER_PROJECT].sort((a, b) => b - a);
    for (let rank = 1; rank <= P; rank++) {
      const expectedPct = Math.round((sorted[rank - 1] / J) * 100);
      const actualPct = await overview.completionRowPct(rank);
      expect(actualPct).toBeCloseTo(expectedPct, 0);
    }
  });

  // e2e.admin.overview.live_feed.top_seven_by_last_seen
  test("Live Feed shows ≤ 7 items ordered by lastSeenMs desc", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    const count = await overview.liveFeedCount();
    expect(count).toBeLessThanOrEqual(7);
    expect(count).toBeGreaterThan(0);
    // First item has the most recent lastSeenAt — fixture sets idx=0 to base
    // (newest), so item-0's data-juror-id should be jurorIds[0].
    const firstId = await overview.liveFeedItem(0).getAttribute("data-juror-id");
    expect(firstId).toBe(fixture.jurorIds[0]);
  });

  // e2e.admin.overview.top_projects.sorted_by_total_avg
  test("Top Projects shows ≤ 5 rows sorted descending by totalAvg", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    const n = await overview.topProjectsCount();
    expect(n).toBeLessThanOrEqual(5);
    // Project at scoredPerProject[4] = 0 has no totalAvg → excluded → at most 5
    const expectedNonNullAvg = SCORED_PER_PROJECT.filter((c) => c > 0).length;
    expect(n).toBe(Math.min(5, expectedNonNullAvg));
    // Each shown row must have totalAvg = 100 (every cell scored 100)
    for (let rank = 1; rank <= n; rank++) {
      const avg = await overview.topProjectAvg(rank);
      expect(avg).not.toBeNull();
      expect(avg!).toBeCloseTo(100.0, 1);
    }
  });

  // e2e.admin.overview.needs_attention.shows_only_nonzero_buckets
  test("Needs Attention surfaces items only for non-zero counts", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    // Fixture: pinBlocked=0, neverSeen=2 (J - SEEN), notStarted varies,
    // editing=2 (so 'editing' item visible), completed=5 ('ok' visible),
    // ready/inProg dependent on score distribution.
    // We can definitively assert: 'unseen' shown (J-SEEN > 0), 'editing' shown,
    // 'ok' shown.
    await expect(overview.needsAttentionItem("unseen")).toBeVisible();
    await expect(overview.needsAttentionItem("editing")).toBeVisible();
    await expect(overview.needsAttentionItem("ok")).toBeVisible();
    // Pin-blocked must be hidden (count=0)
    await expect(overview.needsAttentionItem("blocked")).toHaveCount(0);
  });
});

test.describe("admin overview — empty period state", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: OverviewFixture;

  test.beforeAll(async () => {
    fixture = await setupOverviewFixture({
      jurors: 1,
      projects: 1,
      completedJurors: 0,
      editingJurors: 0,
      seenJurors: 0,
      scoredPerProject: [0],
      namePrefix: "Phase 2.1 Overview Empty",
    });
  });

  test.afterAll(async () => {
    await teardownOverviewFixture(fixture);
  });

  // e2e.admin.overview.empty.kpis_render_dash_or_zero
  test("with no scores, Completion KPI computes 0% and Average renders empty", async ({ page }) => {
    const overview = await signInAndOpenOverview(page, fixture);
    // 1 juror, 0 completed → pct = 0 (kpi.totalJ > 0 path)
    expect(await overview.kpiCompletionPct()).toBe(0);
    // No completed scores → kpi.avg = null → data-value is empty string → null
    expect(await overview.kpiAverageScoreValue()).toBeNull();
  });
});
