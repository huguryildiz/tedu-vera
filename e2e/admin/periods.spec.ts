import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PeriodsPom } from "../poms/PeriodsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_PERIODS_ORG_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
const E2E_LIFECYCLE_ORG_ID = "d4e5f6a7-b8c9-0123-def0-234567890123";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("periods crud", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(page: Parameters<Parameters<typeof test>[1]>[0]["page"], orgId = E2E_PERIODS_ORG_ID) {
    await page.addInitScript((id) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", id);
      } catch {}
    }, orgId);

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

  async function signInAndGotoLifecycle(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    return signInAndGoto(page, E2E_LIFECYCLE_ORG_ID);
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

  test("lifecycle — live period can be closed", async ({ page }) => {
    // One-shot: period ends up closed (re-opening requires super-admin approval).
    // If re-running against the same DB, re-seed the E2E Lifecycle Org with a new Published period.
    const periods = await signInAndGotoLifecycle(page);
    const name = "E2E Lifecycle Period";

    await periods.expectRowVisible(name);

    // Guard: skip gracefully if this test already consumed the period in a previous run
    const alreadyClosed = await periods.statusPill(name).evaluate((el) => el.textContent?.toLowerCase().includes("closed")).catch(() => false);
    if (alreadyClosed) { test.skip(); return; }
    // Seeded period has no scores → status is "Published" (Live requires hasScores=true)
    await periods.expectStatus(name, "Published");

    // Open close dialog
    await periods.clickCloseFor(name);

    // Confirm button is disabled until name is typed exactly
    await expect(periods.closeConfirmBtn()).toBeDisabled();
    await periods.confirmClose(name);

    // Verify status changes to Closed
    await periods.expectStatus(name, "Closed");
  });
});
