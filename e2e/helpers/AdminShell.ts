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
    await this.page.waitForURL(/\/admin/, { timeout: 15_000 });
    // Admin sidebar uses <button data-tour="..."> elements, not role="tab"
    await expect(
      this.page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 10_000 });
  }

  async gotoSection(section: AdminSection): Promise<void> {
    // All sidebar items have data-tour="<section>" attributes
    const btn = this.page.locator(`[data-tour="${section}"]`);
    if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await btn.click();
      return;
    }
    // Fallback: text-based button match
    await this.page.getByRole("button", { name: new RegExp(section.replace(/-/g, "[-\\s]?"), "i") }).first().click();
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
