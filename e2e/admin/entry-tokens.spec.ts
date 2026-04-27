import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { EntryTokensPom } from "../poms/EntryTokensPom";
import { E2E_PERIODS_ORG_ID, EVAL_PERIOD_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("entry tokens", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGotoEntryControl(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const tokens = new EntryTokensPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("entry-control");
    await shell.selectPeriod(EVAL_PERIOD_ID);
    await page.waitForLoadState("networkidle");
    await tokens.waitForReady();
    return tokens;
  }

  test("generate — QR becomes active after generate", async ({ page }) => {
    const tokens = await signInAndGotoEntryControl(page);

    // If a token is already active, revoke it first so we can test generate cleanly.
    const alreadyActive = await tokens.isTokenActive();
    if (alreadyActive) {
      await tokens.revokeToken();
    }

    await tokens.generateToken();
    // Copy and revoke buttons confirm the token is live.
    await expect(tokens.copyBtn()).toBeVisible();
    await expect(tokens.revokeBtn()).toBeVisible();
  });

  test("revoke — token deactivated, generate button remains", async ({ page }) => {
    const tokens = await signInAndGotoEntryControl(page);

    // Ensure there is an active token to revoke (previous test may have left one).
    const alreadyActive = await tokens.isTokenActive();
    if (!alreadyActive) {
      await tokens.generateToken();
    }

    await tokens.revokeToken();
    // After revoke the generate button should still be accessible.
    await expect(tokens.generateBtn()).toBeVisible();
    // Copy / revoke buttons should be gone.
    await expect(tokens.copyBtn()).not.toBeVisible();
    await expect(tokens.revokeBtn()).not.toBeVisible();
  });

  test("revoke modal cancel — token stays active", async ({ page }) => {
    const tokens = await signInAndGotoEntryControl(page);

    // Ensure there is an active token.
    const alreadyActive = await tokens.isTokenActive();
    if (!alreadyActive) {
      await tokens.generateToken();
    }

    await tokens.revokeBtn().click();
    await expect(tokens.revokeModalKeep()).toBeVisible();
    await tokens.revokeModalKeep().click();
    // Modal closed — revoke button still visible.
    await expect(tokens.revokeModalConfirm()).not.toBeVisible();
    await expect(tokens.revokeBtn()).toBeVisible();

    // Clean up: revoke the token so the suite ends without an active token.
    await tokens.revokeToken();
  });
});
