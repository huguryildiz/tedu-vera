import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class JuryEvalPom extends BasePom {
  scoreInput(criterionId: string): Locator {
    return this.byTestId(`jury-eval-score-${criterionId}`);
  }

  allScoreInputs(): Locator {
    return this.page.locator('[data-testid^="jury-eval-score-"]');
  }

  submitBtn(): Locator {
    return this.byTestId("jury-eval-submit");
  }

  confirmSubmitBtn(): Locator {
    return this.byTestId("jury-eval-confirm-submit");
  }

  confirmCancelBtn(): Locator {
    return this.byTestId("jury-eval-confirm-cancel");
  }

  saveStatus(): Locator {
    return this.byTestId("jury-eval-save-status");
  }

  saveStatusSaving(): Locator {
    return this.page.locator('[data-testid="jury-eval-save-status"].saving');
  }

  async waitForEvalStep(): Promise<void> {
    await this.page.waitForURL(/\/demo\/jury\/evaluate/);
    await expect(this.allScoreInputs().first()).toBeVisible({ timeout: 15_000 });
  }

  async fillAllScores(value: string): Promise<void> {
    const segments = this.page.locator(".dj-seg");
    const segCount = await segments.count();
    const iterations = segCount > 0 ? segCount : 1;

    for (let s = 0; s < iterations; s++) {
      if (segCount > 0) {
        await segments.nth(s).click();
        // handleNavigate is async — it flushes a DB write before setCurrent fires.
        // Wait for the group-bar counter to confirm navigation has settled.
        await expect(this.page.locator(".dj-group-bar-num")).toContainText(
          `${s + 1}/`,
          { timeout: 10_000 },
        );
      }
      const count = await this.allScoreInputs().count();
      for (let i = 0; i < count; i++) {
        const input = this.allScoreInputs().nth(i);
        await input.fill(value);
        await input.blur();
      }
    }
  }

  async clickSubmit(): Promise<void> {
    await this.submitBtn().click();
  }

  allCompleteBanner(): Locator {
    return this.byTestId("jury-eval-all-complete-banner");
  }

  backBtn(): Locator {
    return this.byTestId("jury-eval-back-btn");
  }

  async clickBack(): Promise<void> {
    await this.backBtn().click();
  }

  async clickConfirmSubmit(): Promise<void> {
    await this.confirmSubmitBtn().click();
  }
}
