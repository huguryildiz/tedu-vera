import { test, expect } from "@playwright/test";
import { ForgotPasswordPom } from "../poms/ForgotPasswordPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";

test.describe("forgot-password", () => {
  test("page loads — email input and submit button visible", async ({ page }) => {
    const fp = new ForgotPasswordPom(page);
    await fp.goto();
    await expect(fp.emailInput()).toBeVisible();
    await expect(fp.submitBtn()).toBeVisible();
    await expect(fp.successBanner()).not.toBeVisible();
  });

  test("submit button is enabled on page load", async ({ page }) => {
    const fp = new ForgotPasswordPom(page);
    await fp.goto();
    await expect(fp.submitBtn()).toBeEnabled();
  });

  test("submit with valid email shows success banner", async ({ page }) => {
    const fp = new ForgotPasswordPom(page);
    await fp.goto();
    await fp.requestReset(EMAIL);
    await fp.expectSuccessBanner();
    await expect(fp.emailInput()).not.toBeVisible();
  });
});
