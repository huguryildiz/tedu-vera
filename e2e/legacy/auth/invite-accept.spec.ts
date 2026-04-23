// e2e/auth/invite-accept.spec.ts
// ============================================================
// auth.e2e.invite-accept — Tenant-admin invite link → InviteAcceptScreen
// renders, accepts a new password, and (with a real token) lands the
// user on /admin. Without a real token the screen shows the invalid
// invite state, which we still verify renders correctly.
// ============================================================

import { test, expect } from "@playwright/test";

const INVITE_TOKEN = process.env.E2E_INVITE_TOKEN || "";

test.describe("Auth · Invite accept", () => {
  test("Invite accept screen renders for an obviously invalid token", async ({ page }) => {
    await page.goto("/invite/accept?token=invalid-test-token");
    // The page either shows the form (token format check passes) or the
    // "Invalid invite" empty-state. Both render predictable copy.
    await expect(
      page
        .getByText(/invite|invitation|accept/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test.describe("With a valid invite token", () => {
    test.skip(!INVITE_TOKEN, "Skipped: E2E_INVITE_TOKEN not set");

    test("Accepting an invite sets a password and routes to admin", async ({ page }) => {
      await page.goto(`/invite/accept?token=${encodeURIComponent(INVITE_TOKEN)}`);

      const passwordInput = page
        .getByLabel(/^password$/i)
        .or(page.locator('input[type="password"]').first());
      await expect(passwordInput).toBeVisible({ timeout: 10_000 });
      await passwordInput.fill("Str0ng!Pass2026");

      const confirmInput = page
        .getByLabel(/confirm password/i)
        .or(page.locator('input[type="password"]').nth(1));
      await confirmInput.fill("Str0ng!Pass2026");

      await page
        .getByRole("button", { name: /accept|complete|set password/i })
        .first()
        .click();

      await page.waitForURL(/\/admin|\/complete-profile/, { timeout: 15_000 });
      // After invite acceptance the user either lands on /admin (membership
      // exists) or completes their profile first.
      const onAdmin = /\/admin/.test(page.url());
      const onComplete = /\/complete-profile/.test(page.url());
      expect(onAdmin || onComplete).toBeTruthy();
    });
  });
});
