import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PeriodsPom } from "../poms/PeriodsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_PERIODS_ORG_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("periods crud", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const periods = new PeriodsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("periods");
    await periods.waitForReady();
    return periods;
  }

  test("create — draft period appears in table", async ({ page }) => {
    const periods = await signInAndGoto(page);
    const name = uniqueName("E2E Period");

    await periods.openCreateDrawer();
    await periods.fillCreateForm(name, "Created by E2E");
    await periods.saveDrawer();

    await periods.expectRowVisible(name);

    // Cleanup
    await periods.clickDeleteFor(name);
    await periods.confirmDelete(name);
  });

  test("edit — rename persists", async ({ page }) => {
    const periods = await signInAndGoto(page);
    const original = uniqueName("E2E Period");
    const renamed = `${original}-renamed`;

    // Seed a period to rename
    await periods.openCreateDrawer();
    await periods.fillCreateForm(original);
    await periods.saveDrawer();
    await periods.expectRowVisible(original);

    // Edit
    await periods.clickEditFor(original);
    await periods.drawerName().fill(renamed);
    await periods.saveDrawer();

    await periods.expectRowVisible(renamed);
    await periods.expectRowGone(original);

    // Cleanup
    await periods.clickDeleteFor(renamed);
    await periods.confirmDelete(renamed);
  });

  test("delete — draft period removed after confirmation", async ({ page }) => {
    const periods = await signInAndGoto(page);
    const name = uniqueName("E2E Period");

    await periods.openCreateDrawer();
    await periods.fillCreateForm(name);
    await periods.saveDrawer();
    await periods.expectRowVisible(name);

    await periods.clickDeleteFor(name);

    // Confirm button is disabled until name is typed exactly
    await expect(periods.deleteConfirmBtn()).toBeDisabled();
    await periods.confirmDelete(name);

    await periods.expectRowGone(name);
  });
});
