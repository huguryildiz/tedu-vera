// e2e/admin/audit-log-view.spec.ts
// ============================================================
// admin.e2e.audit-log-view — Audit log page renders + filter
// controls work. Smoke-level: we don't seed events, only verify
// page chrome and filter inputs respond.
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";
import { AdminShell } from "../helpers/AdminShell";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("Admin · Audit Log", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Skipped: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set"
  );

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
    await login.expectAdminDashboard();
  });

  test("Audit log page renders", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("audit-log");

    await expect(
      page
        .getByRole("heading", { name: /audit (log|trail)/i })
        .or(page.getByText(/audit log/i).first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Audit log exposes filter controls", async ({ page }) => {
    const shell = new AdminShell(page);
    await shell.gotoSection("audit-log");

    const search = page
      .getByPlaceholder(/search|filter/i)
      .or(page.getByLabel(/search|filter/i))
      .first();
    if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await search.fill("e2e-filter-probe");
      // The filter input must accept text without throwing.
      await expect(search).toHaveValue("e2e-filter-probe");
    } else {
      // Fallback: at minimum the filter region is rendered.
      await expect(
        page.getByRole("button", { name: /filter|reset/i }).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
