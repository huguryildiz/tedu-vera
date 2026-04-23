import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class LoginPom extends BasePom {
  async goto(): Promise<void> {
    await super.goto("/login");
    await expect(this.emailInput()).toBeVisible();
  }

  emailInput(): Locator {
    return this.byTestId("admin-login-email");
  }

  passwordInput(): Locator {
    return this.byTestId("admin-login-password");
  }

  submitButton(): Locator {
    return this.byTestId("admin-login-submit");
  }

  errorBanner(): Locator {
    return this.byTestId("admin-login-error");
  }

  async fillEmail(value: string): Promise<void> {
    await this.emailInput().fill(value);
  }

  async fillPassword(value: string): Promise<void> {
    await this.passwordInput().fill(value);
  }

  async submit(): Promise<void> {
    await this.submitButton().click();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async expectErrorMessage(pattern?: RegExp): Promise<void> {
    const banner = this.errorBanner();
    await expect(banner).toBeVisible();
    if (pattern) {
      await expect(banner).toHaveText(pattern);
    }
  }
}
