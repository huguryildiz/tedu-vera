import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class PeriodsPom extends BasePom {
  addBtn(): Locator { return this.byTestId("periods-add-btn").first(); }

  // Create/Edit drawer (shared component)
  drawerName(): Locator { return this.byTestId("period-drawer-name"); }
  drawerDescription(): Locator { return this.byTestId("period-drawer-description"); }
  drawerSave(): Locator { return this.byTestId("period-drawer-save"); }
  drawerCancel(): Locator { return this.byTestId("period-drawer-cancel"); }

  // Row & kebab menu (FloatingMenu renders menu items as globally-unique locators while open)
  periodRow(name: string): Locator {
    return this.page.locator(`[data-testid="period-row"][data-period-name="${name}"]`);
  }
  rowKebab(name: string): Locator {
    return this.periodRow(name).locator('[data-testid="period-row-kebab"]');
  }
  menuEdit(): Locator { return this.byTestId("period-menu-edit"); }
  menuDelete(): Locator { return this.byTestId("period-menu-delete"); }

  // Delete modal
  deleteInput(): Locator { return this.byTestId("period-delete-confirm-input"); }
  deleteConfirmBtn(): Locator { return this.byTestId("period-delete-confirm"); }
  deleteCancelBtn(): Locator { return this.byTestId("period-delete-cancel"); }

  async waitForReady(): Promise<void> {
    await expect(this.addBtn()).toBeVisible();
  }

  async openCreateDrawer(): Promise<void> {
    await this.addBtn().click();
    await expect(this.drawerName()).toBeVisible();
  }

  async fillCreateForm(name: string, description?: string): Promise<void> {
    await this.drawerName().fill(name);
    if (description) await this.drawerDescription().fill(description);
  }

  async saveDrawer(): Promise<void> {
    await this.drawerSave().click();
    await expect(this.drawerName()).not.toBeVisible({ timeout: 10000 });
  }

  async openKebabFor(name: string): Promise<void> {
    await this.rowKebab(name).click();
    await expect(this.menuEdit()).toBeVisible();
  }

  async clickEditFor(name: string): Promise<void> {
    await this.openKebabFor(name);
    await this.menuEdit().click();
    await expect(this.drawerName()).toBeVisible();
  }

  async clickDeleteFor(name: string): Promise<void> {
    await this.openKebabFor(name);
    await this.menuDelete().click();
    await expect(this.deleteInput()).toBeVisible();
  }

  async confirmDelete(name: string): Promise<void> {
    await this.deleteInput().fill(name);
    await this.deleteConfirmBtn().click();
    await expect(this.deleteInput()).not.toBeVisible({ timeout: 10000 });
  }

  async expectRowVisible(name: string): Promise<void> {
    await expect(this.periodRow(name)).toBeVisible();
  }

  async expectRowGone(name: string): Promise<void> {
    await expect(this.periodRow(name)).toHaveCount(0, { timeout: 10000 });
  }

  // Publish & Close lifecycle
  statusPill(name: string): Locator {
    return this.page.locator(`[data-testid="period-row"][data-period-name="${name}"] [data-testid="period-status-pill"]`);
  }

  async expectStatus(name: string, text: string): Promise<void> {
    await expect(this.statusPill(name)).toContainText(text, { ignoreCase: true, timeout: 10000 });
  }

  publishConfirmBtn(): Locator { return this.byTestId("period-publish-confirm"); }
  closeInput(): Locator { return this.byTestId("period-close-confirm-input"); }
  closeConfirmBtn(): Locator { return this.byTestId("period-close-confirm"); }

  async clickPublishFor(name: string): Promise<void> {
    await this.openKebabFor(name);
    await this.byTestId("period-menu-publish").click();
    await expect(this.publishConfirmBtn()).toBeVisible();
  }

  async confirmPublish(): Promise<void> {
    await this.publishConfirmBtn().click();
    await expect(this.publishConfirmBtn()).not.toBeVisible({ timeout: 10000 });
  }

  async clickCloseFor(name: string): Promise<void> {
    await this.openKebabFor(name);
    await this.byTestId("period-menu-close").click();
    await expect(this.closeInput()).toBeVisible();
  }

  async confirmClose(name: string): Promise<void> {
    await this.closeInput().fill(name);
    await this.closeConfirmBtn().click();
    await expect(this.closeInput()).not.toBeVisible({ timeout: 10000 });
  }
}
