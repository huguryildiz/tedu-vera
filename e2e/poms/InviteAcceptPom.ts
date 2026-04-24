import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class InviteAcceptPom extends BasePom {
  nameInput(): Locator {
    return this.byTestId("invite-name");
  }

  passwordInput(): Locator {
    return this.byTestId("invite-password");
  }

  confirmPasswordInput(): Locator {
    return this.byTestId("invite-confirm-password");
  }

  submitBtn(): Locator {
    return this.byTestId("invite-submit");
  }

  successMsg(): Locator {
    return this.byTestId("invite-success");
  }

  async fillAndSubmit(name: string, password: string): Promise<void> {
    await this.nameInput().fill(name);
    await this.passwordInput().fill(password);
    await this.confirmPasswordInput().fill(password);
    await this.submitBtn().click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.successMsg()).toBeVisible({ timeout: 10000 });
  }
}
