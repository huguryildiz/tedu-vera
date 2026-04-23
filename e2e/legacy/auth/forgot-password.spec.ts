// e2e/auth/forgot-password.spec.ts
// ============================================================
// auth.e2e.forgot-password — Smoke test for the forgot-password
// screen: form submission with a syntactically valid email shows
// the "link sent" confirmation copy.
// ============================================================

import { test, expect } from "@playwright/test";

test.describe("Auth · Forgot password", () => {
  test("Submitting the email form shows the success confirmation", async ({ page }) => {
    await page.goto("/forgot-password");

    const emailInput = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]').first());
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill(`e2e_${Date.now()}@example.com`);

    await page
      .getByRole("button", { name: /send reset link|send link|reset password/i })
      .first()
      .click();

    // Expect either a banner ("link sent") or the form replaced with
    // a confirmation card. Both render the same key phrase.
    await expect(
      page
        .getByText(/check your email|link.*sent|sent.*reset/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Forgot password page exposes a back-to-login link", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("button", { name: /back to (sign|login)|sign in/i })
        .or(page.getByRole("link", { name: /sign in|login/i }))
        .first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
