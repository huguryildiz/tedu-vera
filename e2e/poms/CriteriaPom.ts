import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class CriteriaPom extends BasePom {
  addBtn(): Locator {
    return this.byTestId("criteria-add-btn");
  }

  drawerNameInput(): Locator {
    return this.byTestId("criteria-drawer-name");
  }

  drawerWeightInput(): Locator {
    return this.byTestId("criteria-drawer-weight");
  }

  drawerRubricTab(): Locator {
    return this.byTestId("criteria-drawer-tab-rubric");
  }

  drawerSaveBtn(): Locator {
    return this.byTestId("criteria-drawer-save");
  }

  drawer(): Locator {
    // CriteriaPage renders two drawers (edit + starter); .first() targets the add/edit one
    return this.byTestId("drawer").first();
  }

  criteriaRows(): Locator {
    return this.page.locator('[data-testid="criteria-row"]');
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(/\/criteria/, { timeout: 10000 });
    await this.page.waitForLoadState("networkidle");
  }

  async openAddDrawer(): Promise<void> {
    await this.addBtn().click();
    await expect(this.drawer()).toBeVisible({ timeout: 5000 });
  }

  async fillAndSave(name: string, weight: string): Promise<void> {
    await this.drawerNameInput().fill(name);
    await this.drawerWeightInput().fill(weight);
    // Clicking the Rubric tab auto-seeds default bands (required to pass validation)
    await this.drawerRubricTab().click();
    await this.drawerSaveBtn().click();
    await expect(this.drawer()).not.toBeVisible({ timeout: 8000 });
  }
}
