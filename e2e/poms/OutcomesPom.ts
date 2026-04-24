import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class OutcomesPom extends BasePom {
  addBtn(): Locator {
    return this.byTestId("outcomes-add-btn");
  }

  addBtnBelow(): Locator {
    return this.byTestId("outcomes-add-btn-below");
  }

  drawerCodeInput(): Locator {
    return this.byTestId("outcomes-drawer-code");
  }

  drawerLabelInput(): Locator {
    return this.byTestId("outcomes-drawer-label");
  }

  drawerSaveBtn(): Locator {
    return this.byTestId("outcomes-drawer-save");
  }

  detailSaveBtn(): Locator {
    return this.byTestId("outcomes-detail-save");
  }

  drawer(): Locator {
    // OutcomesPage renders two drawers (add + detail); .first() targets the add drawer
    return this.byTestId("drawer").first();
  }

  outcomeRows(): Locator {
    return this.page.locator('[data-testid="outcome-row"]');
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(/\/outcomes/, { timeout: 10000 });
    await this.page.waitForLoadState("networkidle");
  }

  async openAddDrawer(): Promise<void> {
    await this.addBtn().click();
    await expect(this.drawer()).toBeVisible({ timeout: 5000 });
  }

  async fillAndSave(code: string, label: string): Promise<void> {
    await this.drawerCodeInput().fill(code);
    await this.drawerLabelInput().fill(label);
    await this.drawerSaveBtn().click();
    await expect(this.drawer()).not.toBeVisible({ timeout: 8000 });
  }
}
