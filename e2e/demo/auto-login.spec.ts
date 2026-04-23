// e2e/demo/auto-login.spec.ts
// ============================================================
// demo.e2e.auto-login — /demo → DemoAdminLoader → /demo/admin
// auto-login. Requires VITE_DEMO_ADMIN_EMAIL / PASSWORD on the
// Vite dev server (set in .env.e2e.local or .env.local).
// ============================================================

import { test, expect } from "@playwright/test";
import { DemoHelper } from "../helpers/DemoHelper";

const HAS_DEMO =
  Boolean(process.env.VITE_DEMO_ADMIN_EMAIL) &&
  Boolean(process.env.VITE_DEMO_ADMIN_PASSWORD);

test.describe("Demo · Auto-login", () => {
  test.skip(
    !HAS_DEMO,
    "Skipped: VITE_DEMO_ADMIN_EMAIL / VITE_DEMO_ADMIN_PASSWORD not set"
  );

  test("/demo lands on /demo/admin after auto-login", async ({ page }) => {
    const demo = new DemoHelper(page);
    await demo.gotoDemo();
    await demo.waitForAutoLogin();
    await demo.assertDemoUrl();
  });

  test("Demo admin shell shows Overview tab", async ({ page }) => {
    const demo = new DemoHelper(page);
    await demo.gotoDemo();
    await demo.waitForAutoLogin();

    await expect(
      page.getByRole("tab", { name: /overview/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("DemoAdminLoader shows progress while signing in", async ({ page }) => {
    await page.goto("/demo");
    // The loader renders some loading copy before the redirect happens.
    // Either the loading copy is visible briefly, or we already landed
    // on /demo/admin (auto-login was instant).
    const loadingHint = page.getByText(/loading|signing in|preparing/i).first();
    const onAdmin = page.getByRole("tab", { name: /overview/i });
    await expect(loadingHint.or(onAdmin)).toBeVisible({ timeout: 15_000 });
  });
});
