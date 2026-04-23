// e2e/helpers/JuryFlow.ts
// ============================================================
// Page object for the jury entry + identity + period selection flow.
// Wraps the multi-step transitions from /eval through identity/PIN.
// ============================================================

import { expect, type Page, type Locator } from "@playwright/test";

export class JuryFlow {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoEntry(): Promise<void> {
    await this.page.goto("/");
    await this.page
      .getByRole("button", { name: /start evaluation|değerlendirme/i })
      .click();
  }

  async enterToken(token: string): Promise<void> {
    const tokenInput = this.page
      .getByLabel(/entry token|access token/i)
      .or(this.page.getByPlaceholder(/token/i).first());
    if (await tokenInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tokenInput.fill(token);
      await this.page.getByRole("button", { name: /continue|verify|enter/i }).first().click();
    }
  }

  async fillIdentity(name: string, dept: string): Promise<void> {
    await this.page.getByLabel(/full name/i).fill(name);
    await this.page.getByLabel(/institution \/ department/i).fill(dept);
    await this.page.getByRole("button", { name: /start evaluation/i }).click();
  }

  async choosePeriod(slugOrName: string): Promise<void> {
    const periodBtn = this.page.getByRole("button", {
      name: new RegExp(slugOrName, "i"),
    });
    await expect(periodBtn).toBeVisible({ timeout: 5_000 });
    await periodBtn.click();
  }

  async enterPin(pin: string): Promise<void> {
    const digits = pin.split("");
    for (let i = 0; i < digits.length; i++) {
      await this.page.getByLabel(`Digit ${i + 1} of 4`).fill(digits[i]);
    }
    await this.page.getByRole("button", { name: /verify pin/i }).click();
  }

  async confirmPinSaved(): Promise<void> {
    const pinSavedCheckbox = this.page.getByLabel(
      /i have noted \/ saved my pin/i
    );
    if (await pinSavedCheckbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await pinSavedCheckbox.check();
      await this.page
        .getByRole("button", { name: /^continue/i })
        .first()
        .click({ force: true });
    }
  }

  scoreInput(): Locator {
    return this.page.getByLabel(/score for/i).first();
  }

  async expectEvaluationScreen(): Promise<void> {
    await expect(this.scoreInput()).toBeVisible({ timeout: 10_000 });
  }
}
