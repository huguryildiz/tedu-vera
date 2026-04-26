import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class AdminShellPom extends BasePom {
  root(): Locator {
    return this.byTestId("admin-shell-root");
  }

  sidebar(): Locator {
    return this.byTestId("admin-shell-sidebar");
  }

  signOutButton(): Locator {
    return this.byTestId("admin-shell-signout");
  }

  navItem(key: string): Locator {
    return this.byTestId(`admin-shell-nav-${key}`);
  }

  async expectOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/\/admin(\/|$)/);
    await expect(this.root()).toBeVisible();
    await expect(this.sidebar()).toBeVisible();
  }

  async clickNav(key: string): Promise<void> {
    await this.navItem(key).click();
  }

  async signOut(): Promise<void> {
    await this.signOutButton().click();
  }

  navOrganizations(): Locator {
    return this.byTestId("admin-shell-nav-organizations");
  }

  async expectOrganizationsNavHidden(): Promise<void> {
    await expect(this.navOrganizations()).toHaveCount(0);
  }

  periodSelectorTrigger(): Locator {
    return this.byTestId("period-selector-trigger");
  }

  periodPopoverItem(periodId: string): Locator {
    return this.byTestId(`period-popover-item-${periodId}`);
  }

  periodPopoverSearchInput(): Locator {
    return this.page.getByPlaceholder("Search periods…");
  }

  /**
   * Selects a period from the period selector popover.
   *
   * The popover only renders the pinned period + the 5 most-recent periods by
   * default. When a fixture-created period is not in that subset (common when
   * many periods exist), pass `searchTerm` (typically the period name) — this
   * method types into the search input so the popover renders ALL matching
   * results before clicking the item.
   */
  async selectPeriod(periodId: string, searchTerm?: string): Promise<void> {
    await this.periodSelectorTrigger().click();
    const item = this.periodPopoverItem(periodId);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
    if (searchTerm) {
      await this.periodPopoverSearchInput().fill(searchTerm);
    }
    await item.click({ timeout: 5_000 });
  }
}
