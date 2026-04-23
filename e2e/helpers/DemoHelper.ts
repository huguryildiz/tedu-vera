// e2e/helpers/DemoHelper.ts
// ============================================================
// Page object for the demo environment routes (/demo + /demo/admin).
// DemoAdminLoader uses VITE_DEMO_ADMIN_EMAIL/PASSWORD to auto-login
// then forwards to /demo/admin.
// ============================================================

import { expect, type Page } from "@playwright/test";

export class DemoHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoDemo(): Promise<void> {
    await this.page.goto("/demo");
  }

  async waitForAutoLogin(): Promise<void> {
    // DemoAdminLoader signs in with demo creds and routes to /demo/admin.
    await this.page.waitForURL(/\/demo\/admin/, { timeout: 20_000 });
    await expect(
      this.page.getByRole("tab", { name: /overview/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  async assertDemoUrl(): Promise<void> {
    expect(this.page.url()).toMatch(/\/demo(\/|$)/);
  }
}
