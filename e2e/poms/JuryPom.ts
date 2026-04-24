import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

const ENTRY_URL = "/demo/eval?t=e2e-jury-token";

export class JuryPom extends BasePom {
  tokenInput(): Locator {
    return this.byTestId("jury-token-input");
  }

  verifyBtn(): Locator {
    return this.byTestId("jury-verify-btn");
  }

  nameInput(): Locator {
    return this.byTestId("jury-name-input");
  }

  affiliationInput(): Locator {
    return this.byTestId("jury-affiliation-input");
  }

  identitySubmit(): Locator {
    return this.byTestId("jury-identity-submit");
  }

  pinInput(index: number): Locator {
    return this.byTestId(`jury-pin-input-${index}`);
  }

  pinSubmit(): Locator {
    return this.byTestId("jury-pin-submit");
  }

  progressTitle(): Locator {
    return this.byTestId("jury-progress-title");
  }

  progressAction(): Locator {
    return this.byTestId("jury-progress-action");
  }

  lockedScreen(): Locator {
    return this.byTestId("jury-locked-screen");
  }

  arrivalBeginBtn(): Locator {
    return this.byTestId("jury-arrival-begin");
  }

  async goto(): Promise<void> {
    await this.page.goto(ENTRY_URL);
  }

  async waitForArrivalStep(): Promise<void> {
    await this.page.waitForURL(/\/demo\/jury\/arrival/);
    await expect(this.arrivalBeginBtn()).toBeVisible();
  }

  async clickBeginSession(): Promise<void> {
    await this.arrivalBeginBtn().click();
  }

  async waitForIdentityStep(): Promise<void> {
    await expect(this.nameInput()).toBeVisible();
  }

  async fillIdentity(name: string, affiliation: string): Promise<void> {
    await this.nameInput().fill(name);
    await this.affiliationInput().fill(affiliation);
  }

  async submitIdentity(): Promise<void> {
    await this.identitySubmit().click();
  }

  async waitForPinStep(): Promise<void> {
    await this.page.waitForURL(/\/demo\/jury\/pin/);
    await expect(this.pinInput(0)).toBeVisible();
  }

  async fillPin(pin: string): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await this.pinInput(i).fill(pin[i]);
    }
  }

  async submitPin(): Promise<void> {
    await this.pinSubmit().click();
  }

  async waitForProgressStep(): Promise<void> {
    await this.page.waitForURL(/\/demo\/jury\/progress/);
    await expect(this.progressTitle()).toBeVisible();
  }

  async waitForLockedStep(): Promise<void> {
    await this.page.waitForURL(/\/demo\/jury\/locked/);
    await expect(this.lockedScreen()).toBeVisible();
  }
}
