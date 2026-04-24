import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class RankingsPom extends BasePom {
  kpiStrip(): Locator {
    return this.byTestId("rankings-kpi-strip");
  }

  exportBtn(): Locator {
    return this.byTestId("rankings-export-btn");
  }

  exportPanel(): Locator {
    return this.byTestId("rankings-export-panel");
  }

  async waitForReady(): Promise<void> {
    await expect(this.kpiStrip()).toBeVisible();
  }

  async openExportPanel(): Promise<void> {
    await this.exportBtn().click();
    await expect(this.exportPanel()).toHaveClass(/show/);
  }
}
