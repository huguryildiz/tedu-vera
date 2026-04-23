// e2e/admin/jurors-crud.spec.ts
// ============================================================
// admin.e2e.jurors-crud — Add juror via drawer, edit affiliation,
// remove via modal. Tenant-admin scope.
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";
import { AdminShell } from "../helpers/AdminShell";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe.configure({ mode: "serial" });

test.describe("Admin · Jurors CRUD", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  );

  const jurorName = `E2E Juror ${Date.now()}`;
  const jurorAff = "E2E Department";
  const jurorAffEdited = "E2E Dept · Updated";

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("Add juror via drawer", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("jurors");

    await page.getByRole("button", { name: /add juror|new juror/i }).first().click();
    const drawer = shell.drawer();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    await drawer.getByLabel(/full name|name/i).first().fill(jurorName);
    await drawer.getByLabel(/affiliation|institution|department/i).first().fill(jurorAff);

    await drawer.getByRole("button", { name: /save|add|create/i }).first().click();

    await expect(page.getByText(jurorName).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Edit juror affiliation", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("jurors");

    const row = page.getByRole("row").filter({ hasText: jurorName }).first();
    await row.getByRole("button", { name: /more|edit|menu/i }).first().click();
    await page.getByRole("menuitem", { name: /edit/i }).first().click();

    const drawer = shell.drawer();
    const affInput = drawer.getByLabel(/affiliation|institution|department/i).first();
    await affInput.fill(jurorAffEdited);
    await drawer.getByRole("button", { name: /save|update/i }).first().click();

    await expect(page.getByText(jurorAffEdited).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Remove juror via confirmation modal", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("jurors");

    const row = page.getByRole("row").filter({ hasText: jurorName }).first();
    await row.getByRole("button", { name: /more|menu|delete/i }).first().click();
    await page.getByRole("menuitem", { name: /remove|delete/i }).first().click();

    await page
      .getByRole("button", { name: /^(remove|delete|confirm)$/i })
      .first()
      .click();

    await expect(page.getByText(jurorName)).toHaveCount(0, { timeout: 10_000 });
  });
});
