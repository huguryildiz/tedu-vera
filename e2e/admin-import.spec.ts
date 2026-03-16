// e2e/admin-import.spec.ts
// ============================================================
// admin.e2e.01 — Admin can import a groups CSV via the Projects panel.
//
// Required env vars:
//   E2E_ADMIN_PASSWORD   — admin panel password
//
// The test uploads a minimal in-memory CSV buffer so no fixture file
// is needed on disk.
// ============================================================

import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

// Minimal valid CSV — single group, will be skipped if group_no already exists
const SAMPLE_CSV = `group_no,project_title,group_students\n999,E2E Test Project,Test Student\n`;

test.describe("Admin CSV import", () => {
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
  });

  test("admin.e2e.01 Import CSV dialog opens and accepts a file", async ({ page }) => {
    // Navigate to Settings tab
    await page.getByRole("tab", { name: /settings|ayarlar/i }).click();

    // Click "Import CSV" button in Projects section
    const importBtn = page.getByRole("button", { name: /import csv/i }).first();
    await expect(importBtn).toBeVisible({ timeout: 5_000 });
    await importBtn.click();

    // Import dialog must open — title is a styled span, not a semantic heading
    await expect(
      page.getByText(/import csv/i).first()
    ).toBeVisible({ timeout: 5_000 });

    // Set file on the hidden input using setInputFiles with buffer
    const fileInput = page.locator('input[type="file"][accept=".csv"]').first();
    await fileInput.setInputFiles({
      name: "test-groups.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV),
    });

    // After file selection the dialog should still be open and show the filename
    // or the dropzone should reflect file selected state — either is acceptable
    await expect(
      page.getByText(/test-groups\.csv/i)
        .or(page.getByText(/1 file/i))
        .or(page.getByRole("button", { name: /importing|cancel/i }).first())
    ).toBeVisible({ timeout: 5_000 });
  });
});
