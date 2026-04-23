// e2e/admin-login.spec.ts
// ============================================================
// Admin panel — login smoke test.
//
// Requires E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD env vars.
// Skipped automatically when either secret is not available.
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "./helpers/LoginPage";

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("Admin panel login", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");

  test("Admin can log in and see the dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });
});
