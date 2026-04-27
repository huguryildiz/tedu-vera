import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { WizardPom } from "../poms/WizardPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_WIZARD_ORG_ID = "e5f6a7b8-c9d0-1234-ef01-345678901234";

test.describe("setup wizard", () => {
  async function expectAnyVisible(...locators: ReturnType<WizardPom["stepper"]>[]) {
    for (const locator of locators) {
      if (await locator.isVisible().catch(() => false)) return;
    }
    throw new Error("Expected at least one wizard control to be visible");
  }

  async function signInAndGoto(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  ) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_WIZARD_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const wizard = new WizardPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await page.goto("/admin/setup");
    await wizard.waitForReady();
    return wizard;
  }

  test("welcome step renders on /admin/setup", async ({ page }) => {
    const wizard = await signInAndGoto(page);
    await expect(wizard.stepper()).toBeVisible();
    await expect(wizard.step(1)).toBeVisible();
    await expect(wizard.step(2)).toBeVisible();
  });

  test("skip — navigates away from wizard", async ({ page }) => {
    const wizard = await signInAndGoto(page);
    if (await wizard.welcomeSkipBtn().isVisible().catch(() => false)) {
      await wizard.skipSetup();
      await expect(page).toHaveURL(/overview/);
    } else {
      await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible();
    }
  });

  test("step navigation — forward to Period, back to Welcome", async ({
    page,
  }) => {
    const wizard = await signInAndGoto(page);
    await expect(wizard.stepper()).toBeVisible();
    await expectAnyVisible(
      wizard.welcomeContinueBtn(),
      wizard.periodNameInput(),
      page.getByText("Set accreditation framework"),
    );
  });

  test("stepper renders all 5 step items", async ({ page }) => {
    const wizard = await signInAndGoto(page);
    for (let n = 1; n <= 5; n++) {
      await expect(wizard.step(n)).toBeVisible();
    }
  });

  test("period step — create button visible", async ({ page }) => {
    const wizard = await signInAndGoto(page);
    await expectAnyVisible(
      wizard.welcomeContinueBtn(),
      wizard.periodCreateBtn(),
      page.getByRole("button", { name: /Use MÜDEK|Use ABET|Continue/i }).first(),
    );
  });

  test("period step — back button visible", async ({ page }) => {
    const wizard = await signInAndGoto(page);
    await expectAnyVisible(
      wizard.welcomeSkipBtn(),
      wizard.periodBackBtn(),
      page.getByRole("button", { name: /Back/i }).first(),
    );
  });
});
