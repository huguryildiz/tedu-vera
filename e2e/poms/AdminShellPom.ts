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

  async selectPeriod(periodId: string): Promise<void> {
    await this.periodSelectorTrigger().click();
    await this.periodPopoverItem(periodId).click();
  }
}
