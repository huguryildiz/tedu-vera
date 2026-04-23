// e2e/admin-results.spec.ts
// ============================================================
// admin.e2e.02 — Admin can navigate to Rankings tab and see ranking content.
//
// Required env vars:
//   E2E_ADMIN_EMAIL      — admin email
//   E2E_ADMIN_PASSWORD   — admin panel password
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "./helpers/LoginPage";

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("Admin rankings view", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLoginRoute();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("admin.e2e.02 rankings tab renders content", async ({ page }) => {
    // Open Scores dropdown (ScoresDropdown is a button, not role="tab")
    await page.getByRole("button", { name: /scores/i }).click();

    // Select Rankings from the listbox that opens
    await page.getByRole("option", { name: /rankings/i }).click();

    // Rankings content loaded: toolbar meta shows "Showing N of N" or empty state
    await expect(
      page.locator(".rankings-toolbar-meta, .empty-msg").first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
