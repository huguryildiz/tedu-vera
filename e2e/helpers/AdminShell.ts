// e2e/helpers/AdminShell.ts
// ============================================================
// Page object for the admin shell after login: navigation between
// tabs/sections, opening drawers, closing drawers.
// ============================================================

import { expect, type Page, type Locator } from "@playwright/test";

export type AdminSection =
  | "overview"
  | "rankings"
  | "analytics"
  | "heatmap"
  | "reviews"
  | "jurors"
  | "projects"
  | "periods"
  | "criteria"
  | "outcomes"
  | "entry-control"
  | "pin-blocking"
  | "audit-log"
  | "organizations"
  | "settings";

export class AdminShell {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForReady(): Promise<void> {
    await expect(
      this.page.getByRole("tab", { name: /overview/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  async gotoSection(section: AdminSection): Promise<void> {
    const labelMap: Record<AdminSection, RegExp> = {
      overview: /^overview$/i,
      rankings: /^rankings$/i,
      analytics: /^analytics$/i,
      heatmap: /^heatmap$/i,
      reviews: /^reviews$/i,
      jurors: /^jurors$/i,
      projects: /^projects$/i,
      periods: /^periods$/i,
      criteria: /^criteria$/i,
      outcomes: /^outcomes$/i,
      "entry-control": /entry[-\s]?control/i,
      "pin-blocking": /pin[-\s]?blocking/i,
      "audit-log": /audit/i,
      organizations: /organizations|tenants/i,
      settings: /^settings$/i,
    };

    const re = labelMap[section];
    const tab = this.page.getByRole("tab", { name: re });
    if (await tab.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tab.click();
      return;
    }

    // Some sections (rankings/analytics/heatmap/reviews) live behind the Scores dropdown.
    const scoresBtn = this.page.getByRole("button", { name: /^scores$/i });
    if (await scoresBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await scoresBtn.click();
      const opt = this.page.getByRole("option", { name: re });
      if (await opt.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await opt.click();
        return;
      }
    }

    // Fallback: any visible button matching the section name.
    await this.page.getByRole("button", { name: re }).first().click();
  }

  drawer(): Locator {
    return this.page.locator('[role="dialog"], .premium-drawer, [data-testid$="-drawer"]').first();
  }

  async openDrawer(name: RegExp): Promise<Locator> {
    await this.page.getByRole("button", { name }).first().click();
    const drawer = this.drawer();
    await expect(drawer).toBeVisible({ timeout: 5_000 });
    return drawer;
  }

  async closeDrawer(): Promise<void> {
    const closeBtn = this.page
      .getByRole("button", { name: /close|cancel|kapat|iptal/i })
      .first();
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click();
      return;
    }
    await this.page.keyboard.press("Escape");
  }
}
