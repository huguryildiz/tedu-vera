import type { Download, Locator } from "@playwright/test";
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

  exportFormatOption(format: "csv" | "xlsx" | "pdf"): Locator {
    return this.byTestId(`rankings-export-format-${format}`);
  }

  exportDownloadBtn(): Locator {
    return this.byTestId("rankings-export-download-btn");
  }

  async waitForReady(): Promise<void> {
    await expect(this.kpiStrip()).toBeVisible();
  }

  async openExportPanel(): Promise<void> {
    await this.exportBtn().click();
    await expect(this.exportPanel()).toHaveClass(/show/);
  }

  async selectFormat(format: "csv" | "xlsx" | "pdf"): Promise<void> {
    await this.exportFormatOption(format).click();
    await expect(this.exportFormatOption(format)).toHaveClass(/selected/);
  }

  async clickDownloadAndCapture(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.exportDownloadBtn().click(),
    ]);
    return download;
  }
}
