/**
 * E2E smoke: Landing page CTA navigation — P2-1 (W18)
 *
 * Verifies the three primary navigation buttons on the landing page
 * route to the expected destinations. No auth, no DB mutations.
 */

import { test, expect } from "@playwright/test";

test.describe("landing page CTA navigation", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Suppress tour/onboarding overlays and skip any splash animation
    await page.addInitScript(() => {
      localStorage.setItem("vera.admin_tour_done", "1");
    });
    await page.goto("/");
    // Wait for masthead to mount
    await page.waitForSelector(".ed-masthead", { timeout: 10_000 });
  });

  test("Sign In nav button navigates to /login", async ({ page }) => {
    await page.click('[data-testid="admin-landing-signin"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test("Enter Code nav button navigates to /eval", async ({ page }) => {
    await page.click(".ed-mast-btn--code");
    await expect(page).toHaveURL(/\/eval/);
  });

  test("Tour the admin panel button navigates to /demo", async ({ page }) => {
    await page.click(".ed-cta-secondary");
    await expect(page).toHaveURL(/\/demo/);
  });
});
