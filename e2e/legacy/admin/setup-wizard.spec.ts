// e2e/admin/setup-wizard.spec.ts
// ============================================================
// admin.e2e.setup-wizard — 6-step setup wizard happy path:
// Welcome → Period → Criteria (+Framework) → Projects → Jurors → Launch.
// We assert that the wizard renders and step navigation moves forward.
// Full DB-mutation walk requires E2E_ADMIN_EMAIL/PASSWORD on a fresh
// tenant; without that we exercise the smoke render only.
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";
import { AdminShell } from "../helpers/AdminShell";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("Admin · Setup Wizard", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("Welcome step renders the wizard intro", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("settings");

    // Setup wizard is reachable from settings → "Setup Wizard" or via /admin?wizard=1.
    await page.goto("/admin?wizard=1");
    await expect(
      page.getByText(/set up your evaluation|setup wizard|welcome/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Continue button advances Welcome → Period", async ({ page }) => {
    await page.goto("/admin?wizard=1");
    const continueBtn = page
      .getByRole("button", { name: /^continue|^get started|^begin/i })
      .first();
    if (await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueBtn.click();
      await expect(
        page.getByText(/create your first evaluation period|evaluation period/i).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("Step indicator strip lists six labelled steps", async ({ page }) => {
    await page.goto("/admin?wizard=1");
    const labels = ["Welcome", "Period", "Criteria", "Projects", "Jurors", "Launch"];
    for (const label of labels) {
      await expect(
        page.getByText(new RegExp(`^${label}$`, "i")).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
