import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class ReviewsPom extends BasePom {
  table(): Locator {
    return this.byTestId("reviews-table");
  }

  rows(): Locator {
    return this.table().locator("tbody tr");
  }

  // .jb-name inside col-juror gives just the name, not the affiliation
  jurorNameCells(): Locator {
    return this.table().locator("td.col-juror .jb-name");
  }

  projectTitleCells(): Locator {
    return this.table().locator("td.col-project .proj-title-text");
  }

  // Two FilterButton instances exist (desktop header + mobile toolbar); first() targets desktop
  filterBtn(): Locator {
    return this.page.getByRole("button", { name: /Filter/ }).first();
  }

  filterPanel(): Locator {
    return this.page.locator("div.filter-panel");
  }

  jurorSelectTrigger(): Locator {
    return this.page.locator('button[aria-label="Juror"]');
  }

  projectSelectTrigger(): Locator {
    return this.page.locator('button[aria-label="Project"]');
  }

  async waitForReady(): Promise<void> {
    await expect(this.table()).toBeVisible();
  }

  async openFilterPanel(): Promise<void> {
    await this.filterBtn().click();
    await expect(this.filterPanel()).toHaveClass(/show/);
  }

  async selectJurorFilter(name: string): Promise<void> {
    await this.jurorSelectTrigger().click();
    await this.page
      .locator('[role="listbox"][aria-label="Juror"]')
      .getByText(name, { exact: true })
      .click();
  }

  async selectProjectFilter(title: string): Promise<void> {
    await this.projectSelectTrigger().click();
    await this.page
      .locator('[role="listbox"][aria-label="Project"]')
      .getByText(title, { exact: true })
      .click();
  }
}
