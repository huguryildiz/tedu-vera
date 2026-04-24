import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { OutcomesPom } from "../poms/OutcomesPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const PERIOD_ID = "cccccccc-0005-4000-c000-000000000005";

const SUFFIX = "B7OUT";
const OUTCOME_CODE = `ZZ.${SUFFIX}`;
const OUTCOME_LABEL = `E2E Test Outcome ${SUFFIX}`;

test.describe("outcomes", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGotoOutcomes(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", "f7340e37-9349-4210-8d6b-073a5616bf49");
      } catch {}
    });
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const outcomes = new OutcomesPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("outcomes");
    await outcomes.waitForReady();
    await shell.selectPeriod(PERIOD_ID);
    await page.waitForLoadState("networkidle");
    return { shell, outcomes };
  }

  test("outcomes page loads and add button is visible", async ({ page }) => {
    const { outcomes } = await signInAndGotoOutcomes(page);
    await expect(outcomes.addBtn()).toBeVisible({ timeout: 10000 });
    const count = await outcomes.outcomeRows().count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("add button opens drawer", async ({ page }) => {
    const { outcomes } = await signInAndGotoOutcomes(page);
    await outcomes.openAddDrawer();
    await expect(outcomes.drawer()).toBeVisible();
  });

  test("fill and save — drawer closes", async ({ page }) => {
    const { outcomes } = await signInAndGotoOutcomes(page);
    await outcomes.openAddDrawer();
    await outcomes.fillAndSave(OUTCOME_CODE, OUTCOME_LABEL);
    await expect(outcomes.drawer()).not.toBeVisible({ timeout: 10000 });
  });
});
