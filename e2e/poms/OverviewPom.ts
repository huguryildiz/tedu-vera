import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

/**
 * PoM for the admin Overview page (/admin/overview).
 *
 * KPI cards, Live Feed, Top Projects, Needs Attention, and Group Completion
 * each expose a `data-testid` plus a numeric `data-value`/`data-pct` so tests
 * can assert against the exact computed value rather than parse text.
 */
export class OverviewPom extends BasePom {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto("/admin/overview");
    await expect(this.kpiActiveJurors()).toBeVisible({ timeout: 15_000 });
    // Initial render may paint kpi.totalJ=0 before useAdminData finishes fetching
    // jurors/scores for the active period. Poll until the KPI exposes a non-zero
    // total (or until 15s elapse) so subsequent assertions read the post-fetch
    // value, not the loading-state placeholder.
    await expect
      .poll(
        async () => Number((await this.kpiActiveJurors().getAttribute("data-value")) ?? 0),
        { timeout: 15_000, intervals: [200, 500, 1000] },
      )
      .toBeGreaterThan(0);
  }

  // ── KPI cards ────────────────────────────────────────────────

  kpiActiveJurors(): Locator {
    return this.byTestId("overview-kpi-active-jurors");
  }
  kpiProjects(): Locator {
    return this.byTestId("overview-kpi-projects");
  }
  kpiCompletion(): Locator {
    return this.byTestId("overview-kpi-completion");
  }
  kpiAverageScore(): Locator {
    return this.byTestId("overview-kpi-average-score");
  }

  async readKpiValue(card: Locator): Promise<number | null> {
    const raw = await card.getAttribute("data-value");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  async kpiActiveJurorsValue(): Promise<number | null> {
    return this.readKpiValue(this.kpiActiveJurors());
  }
  async kpiProjectsValue(): Promise<number | null> {
    return this.readKpiValue(this.kpiProjects());
  }
  async kpiCompletionPct(): Promise<number | null> {
    return this.readKpiValue(this.kpiCompletion());
  }
  async kpiAverageScoreValue(): Promise<number | null> {
    return this.readKpiValue(this.kpiAverageScore());
  }

  async readKpiBreakdown(): Promise<{
    completed: number;
    editing: number;
    ready: number;
    inProgress: number;
    notStarted: number;
  }> {
    const card = this.kpiActiveJurors();
    const num = async (attr: string): Promise<number> => {
      const raw = await card.getAttribute(attr);
      const n = Number(raw ?? 0);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      completed:  await num("data-completed"),
      editing:    await num("data-editing"),
      ready:      await num("data-ready"),
      inProgress: await num("data-inprogress"),
      notStarted: await num("data-notstarted"),
    };
  }

  // ── Live Feed ─────────────────────────────────────────────────

  liveFeed(): Locator {
    return this.byTestId("overview-live-feed");
  }
  liveFeedItem(idx: number): Locator {
    return this.byTestId(`overview-live-feed-item-${idx}`);
  }
  async liveFeedCount(): Promise<number> {
    const raw = await this.liveFeed().getAttribute("data-count");
    return Number(raw ?? 0);
  }

  // ── Group Completion bars ────────────────────────────────────

  completionList(): Locator {
    return this.byTestId("overview-completion-list");
  }
  completionRow(rank: number): Locator {
    return this.byTestId(`overview-completion-row-${rank}`);
  }
  async completionRowPct(rank: number): Promise<number | null> {
    const raw = await this.completionRow(rank).getAttribute("data-pct");
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  async completionCount(): Promise<number> {
    const raw = await this.completionList().getAttribute("data-count");
    return Number(raw ?? 0);
  }

  // ── Top Projects ──────────────────────────────────────────────

  topProjectsTbody(): Locator {
    return this.byTestId("overview-top-projects-tbody");
  }
  topProjectRow(rank: number): Locator {
    return this.byTestId(`overview-top-projects-row-${rank}`);
  }
  async topProjectsCount(): Promise<number> {
    const raw = await this.topProjectsTbody().getAttribute("data-count");
    return Number(raw ?? 0);
  }
  async topProjectAvg(rank: number): Promise<number | null> {
    const raw = await this.topProjectRow(rank).getAttribute("data-total-avg");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // ── Needs Attention ──────────────────────────────────────────

  needsAttentionList(): Locator {
    return this.byTestId("overview-needs-attention-list");
  }
  needsAttentionItem(type: string): Locator {
    return this.byTestId(`overview-needs-attention-item-${type}`);
  }
  async needsAttentionCount(): Promise<number> {
    const list = this.needsAttentionList();
    if ((await list.count()) === 0) return 0;
    const raw = await list.getAttribute("data-count");
    return Number(raw ?? 0);
  }
}
