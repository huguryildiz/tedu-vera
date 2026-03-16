// e2e/admin-export.spec.ts
// ============================================================
// admin.e2e.03 — Admin can export rankings to Excel (.xlsx).
//
// Required env vars:
//   E2E_ADMIN_PASSWORD   — admin panel password
// ============================================================

import { test, expect } from "@playwright/test";
import { stat } from "node:fs/promises";

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("Admin export", () => {
  test.skip(!ADMIN_PASSWORD, "Skipped: E2E_ADMIN_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /admin|yönetici/i }).click();

    const passwordInput = page
      .getByPlaceholder(/password|şifre/i)
      .or(page.locator('input[type="password"]'));
    await passwordInput.fill(ADMIN_PASSWORD);
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("tab", { name: /overview/i })
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to Rankings (Scores is a dropdown button, not role="tab")
    await page.getByRole("button", { name: /scores/i }).click();
    await page.getByRole("option", { name: /rankings/i }).click();

    // Wait for Rankings tab to be ready
    await expect(
      page.locator(".rankings-toolbar-meta, .empty-msg").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("admin.e2e.03 Excel export downloads an .xlsx file", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /excel/i }).click(),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.xlsx$/i);

    // File must have non-zero size
    const filePath = await download.path();
    if (filePath) {
      const { size } = await stat(filePath);
      expect(size).toBeGreaterThan(0);
    }
  });
});
