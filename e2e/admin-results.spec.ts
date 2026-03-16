// e2e/admin-results.spec.ts
// ============================================================
// admin.e2e.02 — Admin can navigate to Rankings tab and see ranking content.
//
// Required env vars:
//   E2E_ADMIN_PASSWORD   — admin panel password
// ============================================================

import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("Admin rankings view", () => {
  test.skip(!ADMIN_PASSWORD, "Skipped: E2E_ADMIN_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Navigate to admin
    await page.getByRole("button", { name: /admin|yönetici/i }).click();

    // Enter password
    const passwordInput = page
      .getByPlaceholder(/password|şifre/i)
      .or(page.locator('input[type="password"]'));
    await passwordInput.fill(ADMIN_PASSWORD);
    await page.keyboard.press("Enter");

    // Wait for admin tabs to load
    await expect(
      page.getByRole("tab", { name: /overview/i })
    ).toBeVisible({ timeout: 10_000 });
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
