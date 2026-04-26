import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class AuditPom extends BasePom {
  kpiStrip(): Locator {
    return this.byTestId("audit-kpi-strip");
  }

  searchInput(): Locator {
    return this.byTestId("audit-log-search");
  }

  exportBtn(): Locator {
    return this.byTestId("audit-log-export-btn");
  }

  viewTab(label: string): Locator {
    return this.byTestId(`audit-view-${label.toLowerCase().replace(/ /g, "-")}`);
  }

  rows(): Locator {
    return this.byTestId("audit-row");
  }

  filterToggle(): Locator {
    return this.byTestId("audit-filter-toggle");
  }

  async waitForReady(): Promise<void> {
    await expect(this.kpiStrip()).toBeVisible();
  }

  async openFilter(): Promise<void> {
    await this.filterToggle().click();
    await expect(this.page.locator('[data-testid="audit-filter-category"]')).toBeVisible();
  }

  async clickViewTab(label: string): Promise<void> {
    await this.viewTab(label).click();
    await expect(this.viewTab(label)).toHaveClass(/active/);
  }

  async typeSearch(text: string): Promise<void> {
    await this.searchInput().fill(text);
  }

  pageSizeBtn(n: number): Locator {
    return this.page.locator(".pagination-sizes").getByText(String(n), { exact: true });
  }

  nextPageBtn(): Locator {
    return this.page.getByRole("button", { name: "Next page" });
  }

  pageInfo(): Locator {
    return this.page.locator(".pagination-info");
  }
}
