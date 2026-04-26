import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class JurorsPom extends BasePom {
  async waitForReady(): Promise<void> {
    await expect(this.createBtn()).toBeVisible();
  }

  createBtn(): Locator {
    return this.byTestId("jurors-create-btn");
  }

  // Add drawer
  drawerName(): Locator { return this.byTestId("jurors-drawer-name"); }
  drawerAffiliation(): Locator { return this.byTestId("jurors-drawer-affiliation"); }
  drawerEmail(): Locator { return this.byTestId("jurors-drawer-email"); }
  drawerError(): Locator { return this.byTestId("jurors-drawer-error"); }
  drawerSave(): Locator { return this.byTestId("jurors-drawer-save"); }
  drawerCancel(): Locator { return this.byTestId("jurors-drawer-cancel"); }

  // Edit drawer
  editDrawerName(): Locator { return this.byTestId("jurors-edit-drawer-name"); }
  editDrawerAffiliation(): Locator { return this.byTestId("jurors-edit-drawer-affiliation"); }
  editDrawerEmail(): Locator { return this.byTestId("jurors-edit-drawer-email"); }
  editDrawerError(): Locator { return this.byTestId("jurors-edit-drawer-error"); }
  editDrawerSave(): Locator { return this.byTestId("jurors-edit-drawer-save"); }
  editDrawerCancel(): Locator { return this.byTestId("jurors-edit-drawer-cancel"); }

  // Delete modal
  deleteNameInput(): Locator { return this.byTestId("jurors-delete-name-input"); }
  deleteCancel(): Locator { return this.byTestId("jurors-delete-cancel"); }
  deleteConfirm(): Locator { return this.byTestId("jurors-delete-confirm"); }

  private async jurorIdForRow(name: string): Promise<string> {
    const row = this.page.locator("tr").filter({ hasText: name });
    const kebab = row.locator("[data-testid^='jurors-row-kebab-']").first();
    const testid = await kebab.getAttribute("data-testid");
    return testid!.replace("jurors-row-kebab-", "");
  }

  async openCreateDrawer(): Promise<void> {
    await this.createBtn().click();
    await expect(this.drawerName()).toBeVisible();
  }

  async fillCreateForm(name: string, affiliation: string, email: string): Promise<void> {
    await this.drawerName().fill(name);
    await this.drawerAffiliation().fill(affiliation);
    await this.drawerEmail().fill(email);
  }

  async saveCreate(): Promise<void> {
    await this.drawerSave().click();
    await expect(this.drawerSave()).not.toBeVisible({ timeout: 10000 });
  }

  async clickEditForJuror(name: string): Promise<void> {
    const id = await this.jurorIdForRow(name);
    await this.page
      .locator("tr")
      .filter({ hasText: name })
      .locator("[data-testid^='jurors-row-kebab-']")
      .first()
      .click();
    await this.byTestId(`jurors-row-edit-${id}`).first().click();
  }

  async clickDeleteForJuror(name: string): Promise<void> {
    const id = await this.jurorIdForRow(name);
    await this.page
      .locator("tr")
      .filter({ hasText: name })
      .locator("[data-testid^='jurors-row-kebab-']")
      .first()
      .click();
    await this.byTestId(`jurors-row-delete-${id}`).first().click();
  }

  async fillEditName(name: string): Promise<void> {
    const input = this.editDrawerName();
    await input.clear();
    await input.fill(name);
  }

  async saveEdit(): Promise<void> {
    await this.editDrawerSave().click();
    await expect(this.editDrawerSave()).not.toBeVisible({ timeout: 10000 });
  }

  async confirmDelete(name: string): Promise<void> {
    await this.deleteNameInput().fill(name);
    await this.deleteConfirm().click();
  }

  jurorRow(name: string): Locator {
    return this.page.locator("tr").filter({ hasText: name }).first();
  }

  async expectJurorRowVisible(name: string): Promise<void> {
    await expect(this.jurorRow(name)).toBeVisible();
  }

  async expectJurorRowGone(name: string): Promise<void> {
    await expect(this.page.locator("tr").filter({ hasText: name })).toHaveCount(0);
  }
}
