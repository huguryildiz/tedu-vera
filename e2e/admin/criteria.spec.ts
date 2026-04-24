import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { CriteriaPom } from "../poms/CriteriaPom";
import { adminClient } from "../helpers/supabaseAdmin";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const PERIOD_ID = "cccccccc-0004-4000-c000-000000000004";

const SUFFIX = "B7CRT";
const CRIT_NAME = `E2E Criterion ${SUFFIX}`;
const CRIT_WEIGHT = "10";

test.describe("criteria", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Remove any leftover criterion from prior runs so "fill and save" doesn't hit a duplicate
    try {
      await adminClient
        .from("period_criteria")
        .delete()
        .eq("period_id", PERIOD_ID)
        .like("label", `%${SUFFIX}%`);
    } catch {}
  });

  async function signInAndGotoCriteria(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", "f7340e37-9349-4210-8d6b-073a5616bf49");
      } catch {}
    });
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const criteria = new CriteriaPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("criteria");
    await criteria.waitForReady();
    await shell.selectPeriod(PERIOD_ID);
    await page.waitForLoadState("networkidle");
    return { shell, criteria };
  }

  test("criteria page loads and add button is visible", async ({ page }) => {
    const { criteria } = await signInAndGotoCriteria(page);
    await expect(criteria.addBtn()).toBeVisible({ timeout: 10000 });
    const count = await criteria.criteriaRows().count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("add button opens drawer", async ({ page }) => {
    const { criteria } = await signInAndGotoCriteria(page);
    await criteria.openAddDrawer();
    await expect(criteria.drawer()).toBeVisible();
  });

  test("fill and save — drawer closes", async ({ page }) => {
    const { criteria } = await signInAndGotoCriteria(page);
    await criteria.openAddDrawer();
    await criteria.fillAndSave(CRIT_NAME, CRIT_WEIGHT);
    await expect(criteria.drawer()).not.toBeVisible({ timeout: 10000 });
  });

  test("save with no name keeps drawer open (validation)", async ({ page }) => {
    const { criteria } = await signInAndGotoCriteria(page);
    await criteria.openAddDrawer();
    // Fill weight only — empty name triggers client-side validation
    await criteria.drawerWeightInput().fill(CRIT_WEIGHT);
    await criteria.drawerSaveBtn().click();
    // Validation prevents save; drawer must still be visible
    await expect(criteria.drawer()).toBeVisible();
  });
});
