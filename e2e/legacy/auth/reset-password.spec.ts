// e2e/auth/reset-password.spec.ts
// ============================================================
// auth.e2e.reset-password — Visiting the reset-password screen
// without a valid recovery token shows the "Invalid Reset Link"
// state. With a real token (E2E_RESET_TOKEN) we exercise the
// password set form and verify it submits.
// ============================================================

import { test, expect } from "@playwright/test";

const RESET_TOKEN = process.env.E2E_RESET_TOKEN || "";

test.describe("Auth · Reset password", () => {
  test("Reset link without recovery session shows invalid state", async ({ page }) => {
    await page.goto("/reset-password");
    // ResetPasswordScreen renders the "Invalid Reset Link" card when
    // there is no recovery session active (no #access_token hash).
    await expect(
      page
        .getByText(/invalid reset link|request a new reset link/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test.describe("With a valid recovery session", () => {
    test.skip(!RESET_TOKEN, "Skipped: E2E_RESET_TOKEN not set");

    test("Submitting a new password completes the reset", async ({ page }) => {
      await page.goto(`/reset-password#access_token=${encodeURIComponent(RESET_TOKEN)}&type=recovery`);

      const newPass = page.getByLabel(/^new password$/i);
      await expect(newPass).toBeVisible({ timeout: 10_000 });
      await newPass.fill("Str0ng!Pass2026");

      await page.getByLabel(/confirm password/i).fill("Str0ng!Pass2026");

      await page
        .getByRole("button", { name: /update password|reset password|save/i })
        .first()
        .click();

      // After a successful reset the user is either redirected to /login
      // or shown a confirmation message — accept both.
      await expect(
        page
          .getByText(/password updated|password reset|sign in/i)
          .first()
          .or(page.getByRole("button", { name: /sign in/i }))
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
