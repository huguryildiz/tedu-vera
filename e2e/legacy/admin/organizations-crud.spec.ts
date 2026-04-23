// e2e/admin/organizations-crud.spec.ts
// ============================================================
// admin.e2e.organizations-crud — Create + edit + delete organization
// flow. Requires a super-admin account (only super-admins see the
// Organizations tab and can mutate it).
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";
import { AdminShell } from "../helpers/AdminShell";

const SUPER_EMAIL = process.env.E2E_SUPER_EMAIL || "";
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD || "";

test.describe.configure({ mode: "serial" });

test.describe("Admin · Organizations CRUD", () => {
  test.skip(
    !SUPER_EMAIL || !SUPER_PASSWORD,
    "Skipped: E2E_SUPER_EMAIL / E2E_SUPER_PASSWORD not set"
  );

  const orgName = `E2E Org ${Date.now()}`;
  const renamed = `${orgName} Renamed`;

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(SUPER_EMAIL, SUPER_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("Create organization via drawer", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("organizations");

    await page.getByRole("button", { name: /add organization|new organization|create/i }).first().click();

    const drawer = shell.drawer();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    await drawer.getByLabel(/name|title/i).first().fill(orgName);

    const slugField = drawer.getByLabel(/slug/i);
    if (await slugField.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await slugField.fill(`e2e-org-${Date.now()}`);
    }

    await drawer.getByRole("button", { name: /create|save/i }).first().click();

    await expect(page.getByText(orgName).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Edit organization name", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("organizations");

    const row = page.getByRole("row").filter({ hasText: orgName }).first();
    await row.getByRole("button", { name: /more|edit|menu/i }).first().click();

    const editItem = page
      .getByRole("menuitem", { name: /edit/i })
      .or(page.getByRole("button", { name: /^edit$/i }))
      .first();
    await editItem.click();

    const drawer = shell.drawer();
    const nameInput = drawer.getByLabel(/name|title/i).first();
    await nameInput.fill(renamed);
    await drawer.getByRole("button", { name: /save|update/i }).first().click();

    await expect(page.getByText(renamed).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Delete organization via confirm", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("organizations");

    const row = page.getByRole("row").filter({ hasText: renamed }).first();
    await row.getByRole("button", { name: /more|delete|menu/i }).first().click();
    await page.getByRole("menuitem", { name: /delete|remove/i }).first().click();

    // ConfirmDialog (or inline confirm panel) — confirm button label varies.
    await page
      .getByRole("button", { name: /^(delete|remove|confirm)$/i })
      .first()
      .click();

    await expect(page.getByText(renamed)).toHaveCount(0, { timeout: 10_000 });
  });
});
