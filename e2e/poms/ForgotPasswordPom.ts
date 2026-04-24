import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class ForgotPasswordPom extends BasePom {
  async goto(): Promise<void> {
    await this.page.goto("/forgot-password");
  }

  emailInput(): Locator {
    return this.byTestId("forgot-email");
  }

  submitBtn(): Locator {
    return this.byTestId("forgot-submit");
  }

  successBanner(): Locator {
    return this.byTestId("forgot-success-banner");
  }

  async requestReset(email: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.submitBtn().click();
  }

  async expectSuccessBanner(): Promise<void> {
    await expect(this.successBanner()).toBeVisible({ timeout: 8000 });
  }
}
