// e2e/admin/entry-token-lifecycle.spec.ts
// ============================================================
// admin.e2e.entry-token-lifecycle — Create entry token + copy URL +
// revoke. Entry tokens guard the public /eval route.
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";
import { AdminShell } from "../helpers/AdminShell";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe.configure({ mode: "serial" });

test.describe("Admin · Entry Token Lifecycle", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  );

  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard read/write so the "Copy URL" button can be exercised.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("Create entry token", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("entry-control");

    await page
      .getByRole("button", { name: /create token|generate token|new token/i })
      .first()
      .click();

    const drawer = shell.drawer();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    await drawer
      .getByRole("button", { name: /create|generate|save/i })
      .first()
      .click();

    await expect(
      page
        .getByText(/token created|active|valid until/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Copy entry URL writes to clipboard", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("entry-control");

    const copyBtn = page
      .getByRole("button", { name: /copy url|copy link|copy/i })
      .first();
    await expect(copyBtn).toBeVisible({ timeout: 5_000 });
    await copyBtn.click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/\/eval/);
  });

  test("Revoke entry token", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("entry-control");

    const revokeBtn = page
      .getByRole("button", { name: /revoke/i })
      .first();
    await expect(revokeBtn).toBeVisible({ timeout: 5_000 });
    await revokeBtn.click();

    await page
      .getByRole("button", { name: /^(revoke|confirm)$/i })
      .first()
      .click();

    await expect(
      page.getByText(/revoked|inactive/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
