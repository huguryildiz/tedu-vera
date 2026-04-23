// e2e/helpers/LoginPage.ts
// ============================================================
// Page object for the admin login screen.
// Wraps navigation + email/password sign-in + Google OAuth entry.
// ============================================================

import { expect, type Page, type Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.page.locator("button.nav-signin").click();
    await expect(this.emailInput()).toBeVisible({ timeout: 10_000 });
  }

  async gotoLoginRoute(): Promise<void> {
    await this.page.goto("/login");
    await expect(this.emailInput()).toBeVisible({ timeout: 10_000 });
  }

  emailInput(): Locator {
    return this.page
      .getByPlaceholder(/email/i)
      .or(this.page.locator('input[type="email"]').first());
  }

  passwordInput(): Locator {
    return this.page
      .getByPlaceholder(/password|şifre/i)
      .or(this.page.locator('input[type="password"]').first());
  }

  signInButton(): Locator {
    return this.page.getByRole("button", { name: /^sign in$/i });
  }

  googleButton(): Locator {
    return this.page.getByRole("button", { name: /continue with google/i });
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.signInButton().click();
  }

  async expectAdminDashboard(): Promise<void> {
    // Wait for the admin route first so failures show the actual URL
    await this.page.waitForURL(/\/admin/, { timeout: 15_000 });
    // Admin sidebar uses <button data-tour="overview">, not role="tab"
    await expect(
      this.page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 10_000 });
  }
}
