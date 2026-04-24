import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePom } from "./BasePom";

export class SettingsPom extends BasePom {
  // Super-admin visible elements
  securityPolicyBtn(): Locator {
    return this.byTestId("settings-security-policy-btn");
  }

  drawer(): Locator {
    // Multiple drawers on page; target whichever has .show (currently open)
    return this.page.locator('[data-testid="drawer"].show');
  }

  // Org-admin visible elements (not used for demo-admin which is super_admin)
  orgNameDisplay(): Locator {
    return this.byTestId("settings-org-name-display");
  }

  orgNameEditBtn(): Locator {
    return this.byTestId("settings-org-name-edit");
  }

  orgNameInput(): Locator {
    return this.byTestId("settings-org-name");
  }

  saveBtn(): Locator {
    return this.byTestId("settings-save");
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(/\/settings/, { timeout: 10000 });
    await this.page.waitForLoadState("networkidle");
  }

  async editOrgName(newName: string): Promise<void> {
    await this.orgNameEditBtn().click();
    await this.orgNameInput().clear();
    await this.orgNameInput().fill(newName);
  }

  async save(): Promise<void> {
    await this.saveBtn().click();
  }

  async expectDisplayName(name: string): Promise<void> {
    await expect(this.orgNameDisplay()).toContainText(name, { timeout: 8000 });
  }
}
