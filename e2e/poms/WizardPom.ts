import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class WizardPom extends BasePom {
  // Stepper
  stepper(): Locator {
    return this.byTestId("wizard-stepper");
  }

  step(n: number): Locator {
    return this.byTestId(`wizard-step-${n}`);
  }

  // Welcome step
  welcomeContinueBtn(): Locator {
    return this.byTestId("wizard-welcome-continue");
  }

  welcomeSkipBtn(): Locator {
    return this.byTestId("wizard-welcome-skip");
  }

  // Period step
  periodNameInput(): Locator {
    return this.byTestId("wizard-period-name");
  }

  periodCreateBtn(): Locator {
    return this.byTestId("wizard-period-create");
  }

  periodBackBtn(): Locator {
    return this.byTestId("wizard-period-back");
  }

  // Completion step
  completionCard(): Locator {
    return this.byTestId("wizard-completion");
  }

  completionDashboardBtn(): Locator {
    return this.byTestId("wizard-completion-dashboard");
  }

  async waitForReady(): Promise<void> {
    await expect(this.stepper()).toBeVisible();
    // Auth context (activeOrganization) must be loaded before interacting —
    // otherwise handleSkip fires with a null org id and sessionStorage key is
    // never written, causing AdminRouteLayout to redirect back to /setup.
    await this.page.waitForLoadState("networkidle");
  }

  async clickGetStarted(): Promise<void> {
    await this.welcomeContinueBtn().click();
    await expect(this.periodNameInput()).toBeVisible();
  }

  async clickBack(): Promise<void> {
    await this.periodBackBtn().click();
    await expect(this.welcomeContinueBtn()).toBeVisible();
  }

  async skipSetup(): Promise<void> {
    await this.welcomeSkipBtn().click();
  }
}
