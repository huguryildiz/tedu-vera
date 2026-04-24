import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PinBlockingPom } from "../poms/PinBlockingPom";
import { adminClient } from "../helpers/supabaseAdmin";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const PERIOD_ID = "cccccccc-0004-4000-c000-000000000004";
const LOCKED_JUROR_ID = "eeeeeeee-0001-4000-e000-000000000001";

test.describe("pin-blocking", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Ensure the seed juror is locked before each test so repeat-each runs stay stable
    await adminClient
      .from("juror_period_auth")
      .update({ is_blocked: true, locked_at: new Date().toISOString() })
      .eq("juror_id", LOCKED_JUROR_ID)
      .eq("period_id", PERIOD_ID);
  });

  async function signInAndGotoPinBlocking(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", "f7340e37-9349-4210-8d6b-073a5616bf49");
      } catch {}
    });
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const pinBlocking = new PinBlockingPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("pin-blocking");
    await pinBlocking.waitForReady();
    await shell.selectPeriod(PERIOD_ID);
    await page.waitForLoadState("networkidle");
    return { shell, pinBlocking };
  }

  test("locked juror unlock button is visible", async ({ page }) => {
    const { pinBlocking } = await signInAndGotoPinBlocking(page);
    await expect(pinBlocking.unlockBtn(LOCKED_JUROR_ID)).toBeVisible({ timeout: 10000 });
  });

  test("clicking unlock opens the PIN modal", async ({ page }) => {
    const { pinBlocking } = await signInAndGotoPinBlocking(page);
    await expect(pinBlocking.unlockBtn(LOCKED_JUROR_ID)).toBeVisible({ timeout: 10000 });
    await pinBlocking.clickUnlock(LOCKED_JUROR_ID);
    await expect(pinBlocking.modal()).toBeVisible();
    await pinBlocking.closeModal();
  });
});
