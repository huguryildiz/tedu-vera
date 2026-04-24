import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class ProjectsPom extends BasePom {
  addBtn(): Locator { return this.byTestId("projects-add-btn").first(); }

  // Create drawer
  drawerTitle(): Locator { return this.byTestId("project-drawer-title"); }
  drawerMember(index: number): Locator { return this.byTestId(`project-drawer-member-${index}`); }
  drawerSave(): Locator { return this.byTestId("project-drawer-save"); }
  drawerCancel(): Locator { return this.byTestId("project-drawer-cancel"); }

  // Edit drawer
  editDrawerTitle(): Locator { return this.byTestId("project-edit-drawer-title"); }
  editDrawerSave(): Locator { return this.byTestId("project-edit-drawer-save"); }
  editDrawerCancel(): Locator { return this.byTestId("project-edit-drawer-cancel"); }

  // Row + kebab
  projectRow(title: string): Locator {
    return this.page.locator(`[data-testid="project-row"][data-project-title="${title}"]`);
  }
  rowKebab(title: string): Locator {
    return this.projectRow(title).locator('[data-testid="project-row-kebab"]');
  }
  menuEdit(): Locator { return this.byTestId("project-menu-edit"); }
  menuDelete(): Locator { return this.byTestId("project-menu-delete"); }

  // Delete modal
  deleteInput(): Locator { return this.byTestId("project-delete-confirm-input"); }
  deleteConfirmBtn(): Locator { return this.byTestId("project-delete-confirm"); }
  deleteCancelBtn(): Locator { return this.byTestId("project-delete-cancel"); }

  async waitForReady(): Promise<void> {
    await expect(this.addBtn()).toBeVisible();
  }

  async openCreateDrawer(): Promise<void> {
    await this.addBtn().click();
    await expect(this.drawerTitle()).toBeVisible();
  }

  async fillCreateForm(title: string, firstMember: string): Promise<void> {
    await this.drawerTitle().fill(title);
    await this.drawerMember(0).fill(firstMember);
  }

  async saveCreate(): Promise<void> {
    await this.drawerSave().click();
    await expect(this.drawerTitle()).not.toBeVisible({ timeout: 10000 });
  }

  async openKebabFor(title: string): Promise<void> {
    await this.rowKebab(title).click();
    await expect(this.menuEdit()).toBeVisible();
  }

  async clickEditFor(title: string): Promise<void> {
    await this.openKebabFor(title);
    await this.menuEdit().click();
    await expect(this.editDrawerTitle()).toBeVisible();
  }

  async clickDeleteFor(title: string): Promise<void> {
    await this.openKebabFor(title);
    await this.menuDelete().click();
    await expect(this.deleteInput()).toBeVisible();
  }

  async saveEdit(): Promise<void> {
    await this.editDrawerSave().click();
    await expect(this.editDrawerTitle()).not.toBeVisible({ timeout: 10000 });
  }

  async confirmDelete(title: string): Promise<void> {
    await this.deleteInput().fill(title);
    await this.deleteConfirmBtn().click();
    await expect(this.deleteInput()).not.toBeVisible({ timeout: 10000 });
  }

  async expectProjectVisible(title: string): Promise<void> {
    await expect(this.projectRow(title)).toBeVisible();
  }

  async expectProjectGone(title: string): Promise<void> {
    await expect(this.projectRow(title)).toHaveCount(0, { timeout: 10000 });
  }

  // Import CSV
  importBtn(): Locator { return this.byTestId("projects-import-btn"); }
  importFileInput(): Locator { return this.byTestId("projects-import-file"); }
  importSubmitBtn(): Locator { return this.byTestId("projects-import-submit"); }
  importSuccessScreen(): Locator { return this.byTestId("projects-import-success"); }
  importDoneBtn(): Locator { return this.byTestId("projects-import-done"); }

  async openImportModal(): Promise<void> {
    await this.importBtn().click();
    await expect(this.importFileInput()).toBeAttached();
  }

  async uploadCsvInMemory(csvContent: string, filename = "projects.csv"): Promise<void> {
    await this.importFileInput().setInputFiles({
      name: filename,
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });
  }

  async submitImport(): Promise<void> {
    await this.importSubmitBtn().click();
    await expect(this.importSuccessScreen()).toBeVisible({ timeout: 15000 });
  }

  async closeImportModal(): Promise<void> {
    await this.importDoneBtn().click();
    await expect(this.importSuccessScreen()).not.toBeVisible({ timeout: 10000 });
  }
}
