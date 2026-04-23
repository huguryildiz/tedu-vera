// e2e/admin/periods-crud.spec.ts
// ============================================================
// admin.e2e.periods-crud — Add period + add semester + publish + close.
// Periods are top-level academic terms; semesters live inside them.
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";
import { AdminShell } from "../helpers/AdminShell";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe.configure({ mode: "serial" });

test.describe("Admin · Periods CRUD", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  );

  const periodName = `E2E Period ${Date.now()}`;
  const semesterName = `${periodName} · Spring`;

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("Add period via drawer", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("periods");

    await page.getByRole("button", { name: /add period|new period|create period/i }).first().click();
    const drawer = shell.drawer();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    await drawer.getByLabel(/name|title/i).first().fill(periodName);

    const yearInput = drawer.getByLabel(/year|academic year/i);
    if (await yearInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await yearInput.fill(String(new Date().getFullYear()));
    }

    await drawer.getByRole("button", { name: /save|create/i }).first().click();
    await expect(page.getByText(periodName).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Add semester to period", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("periods");

    const row = page.getByRole("row").filter({ hasText: periodName }).first();
    await row.getByRole("button", { name: /add semester|more|menu/i }).first().click();

    // Some flows put "Add Semester" inside the kebab menu, others expose it directly.
    const addSem = page.getByRole("menuitem", { name: /add semester/i });
    if (await addSem.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await addSem.click();
    }

    const drawer = shell.drawer();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    await drawer.getByLabel(/name|title/i).first().fill(semesterName);
    await drawer.getByRole("button", { name: /save|create|add/i }).first().click();

    await expect(page.getByText(semesterName).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Publish period", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("periods");

    const row = page.getByRole("row").filter({ hasText: periodName }).first();
    await row.getByRole("button", { name: /publish|menu|more/i }).first().click();
    const publishItem = page.getByRole("menuitem", { name: /publish/i });
    if (await publishItem.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await publishItem.click();
    }

    await page
      .getByRole("button", { name: /^(publish|confirm)$/i })
      .first()
      .click();

    await expect(
      page.getByText(/published/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Close period", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("periods");

    const row = page.getByRole("row").filter({ hasText: periodName }).first();
    await row.getByRole("button", { name: /close|menu|more/i }).first().click();
    const closeItem = page.getByRole("menuitem", { name: /close/i });
    if (await closeItem.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeItem.click();
    }

    await page
      .getByRole("button", { name: /^(close|confirm)$/i })
      .first()
      .click();

    await expect(
      page.getByText(/closed/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
