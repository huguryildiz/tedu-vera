import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { SettingsPom } from "../poms/SettingsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

// demo-admin@vera-eval.app is super_admin — tests target super-admin-visible sections

test.describe("settings", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGotoSettings(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", "f7340e37-9349-4210-8d6b-073a5616bf49");
      } catch {}
    });
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const settings = new SettingsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("settings");
    await settings.waitForReady();
    return { shell, settings };
  }

  test("settings page loads — security policy button is visible (super admin)", async ({ page }) => {
    const { settings } = await signInAndGotoSettings(page);
    await expect(settings.securityPolicyBtn()).toBeVisible({ timeout: 10000 });
  });

  test("security policy button opens drawer", async ({ page }) => {
    const { settings } = await signInAndGotoSettings(page);
    await expect(settings.securityPolicyBtn()).toBeVisible({ timeout: 10000 });
    await settings.securityPolicyBtn().click();
    await expect(settings.drawer()).toBeVisible({ timeout: 8000 });
  });
});
