import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export abstract class BasePom {
  constructor(public readonly page: Page) {}

  byTestId(id: string): Locator {
    return this.page.locator(`[data-testid="${id}"]`);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async expectUrl(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }
}
