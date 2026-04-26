import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class HeatmapPom extends BasePom {
  grid(): Locator {
    return this.byTestId("heatmap-grid");
  }

  cell(jurorId: string, projectId: string): Locator {
    return this.byTestId(`heatmap-cell-${jurorId}-${projectId}`);
  }

  jurorAvg(jurorId: string): Locator {
    return this.byTestId(`heatmap-juror-avg-${jurorId}`);
  }

  projectAvg(projectId: string): Locator {
    return this.byTestId(`heatmap-project-avg-${projectId}`);
  }

  overallAvg(): Locator {
    return this.byTestId("heatmap-overall-avg");
  }

  async goto(): Promise<void> {
    await this.page.goto("/admin/heatmap");
    await expect(this.grid()).toBeVisible();
  }

  async firstCellScore(): Promise<number | null> {
    const raw = await this.page
      .locator('[data-testid^="heatmap-cell-"][data-cell-score]')
      .first()
      .getAttribute("data-cell-score");
    return raw == null ? null : Number(raw);
  }

  async cellColor(jurorId: string, projectId: string): Promise<string> {
    return this.cell(jurorId, projectId).evaluate(
      (el) => globalThis.getComputedStyle(el as HTMLElement).backgroundColor,
    );
  }
}
