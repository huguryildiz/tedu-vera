import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class ResetPasswordPom extends BasePom {
  passwordInput(): Locator {
    return this.byTestId("reset-password");
  }

  confirmInput(): Locator {
    return this.byTestId("reset-confirm");
  }

  submitBtn(): Locator {
    return this.byTestId("reset-submit");
  }

  successMsg(): Locator {
    return this.byTestId("reset-success");
  }

  async fillAndSubmit(password: string): Promise<void> {
    await this.passwordInput().fill(password);
    await this.confirmInput().fill(password);
    await this.submitBtn().click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.successMsg()).toBeVisible({ timeout: 10000 });
  }
}
