import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class EntryTokensPom extends BasePom {
  generateBtn(): Locator { return this.byTestId("entry-tokens-generate-btn"); }
  revokeBtn(): Locator { return this.byTestId("entry-tokens-revoke-btn"); }
  copyBtn(): Locator { return this.byTestId("entry-tokens-copy-btn"); }
  downloadBtn(): Locator { return this.byTestId("entry-tokens-download-btn"); }

  // Lock-warn confirmation modal (shown on first generate when period is unlocked)
  lockWarnConfirm(): Locator { return this.byTestId("lock-warn-modal-confirm"); }
  lockWarnCancel(): Locator { return this.byTestId("lock-warn-modal-cancel"); }

  // Revoke modal
  revokeModalKeep(): Locator { return this.byTestId("revoke-modal-keep"); }
  revokeModalConfirm(): Locator { return this.byTestId("revoke-modal-confirm"); }

  async waitForReady(): Promise<void> {
    await expect(this.generateBtn()).toBeVisible();
  }

  async generateToken(): Promise<void> {
    await this.generateBtn().click();
    if (await this.lockWarnConfirm().isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.lockWarnConfirm().click();
    }
    await expect(this.copyBtn()).toBeVisible({ timeout: 20000 });
  }

  async revokeToken(): Promise<void> {
    await this.revokeBtn().click();
    await expect(this.revokeModalConfirm()).toBeVisible();
    await this.revokeModalConfirm().click();
    await expect(this.revokeBtn()).not.toBeVisible({ timeout: 10000 });
  }

  async isTokenActive(): Promise<boolean> {
    return this.revokeBtn().isVisible();
  }
}
