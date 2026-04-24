import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class PinBlockingPom extends BasePom {
  unlockBtn(jurorId: string): Locator {
    return this.byTestId(`pin-blocking-unlock-${jurorId}`);
  }

  modalCloseBtn(): Locator {
    return this.byTestId("pin-blocking-modal-close");
  }

  modal(): Locator {
    // Two modals on page (UnlockAll + UnlockPin); target whichever has .show (currently open)
    return this.page.locator('[data-testid="modal"].show');
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(/\/pin-blocking/, { timeout: 10000 });
    await this.page.waitForLoadState("networkidle");
  }

  async clickUnlock(jurorId: string): Promise<void> {
    await this.unlockBtn(jurorId).click();
    await expect(this.modal()).toBeVisible({ timeout: 8000 });
  }

  async closeModal(): Promise<void> {
    await this.modalCloseBtn().click();
    await expect(this.modal()).not.toBeVisible({ timeout: 5000 });
  }
}
