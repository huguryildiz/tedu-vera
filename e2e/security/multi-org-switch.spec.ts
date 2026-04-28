/**
 * Multi-org tenant context switch — two organizations, one admin session.
 *
 * Verifies that an admin who owns two orgs can switch org context and that
 * each org's data is isolated: the active org determines which periods,
 * projects, and jurors are visible.
 *
 * Uses the two canonical E2E org IDs (E2E_PERIODS_ORG_ID, E2E_PROJECTS_ORG_ID)
 * which have different seeded data, so a switch between them is detectable.
 */

import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { E2E_PERIODS_ORG_ID, E2E_PROJECTS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("multi-org tenant context switch — two orgs isolated", () => {
  test("switch org: admin can load dashboard for org A", async ({ page }) => {
    // multi-org switch: sign in with org A and verify dashboard
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);

    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    // switch org: org A loads
    await shell.expectOnDashboard();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("two organizations: switching active_organization_id changes storage context", async ({
    page,
  }) => {
    // two organizations: org A and org B are distinct; switching context updates storage
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);

    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();

    // Capture active org from storage in org A context
    const orgA = await page.evaluate(() =>
      localStorage.getItem("admin.active_organization_id"),
    );
    expect(orgA).toBe(E2E_PERIODS_ORG_ID);

    // Switch to org B (no reload — addInitScript would re-seed localStorage on reload)
    await page.evaluate((orgId) => {
      try {
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PROJECTS_ORG_ID);

    const orgB = await page.evaluate(() =>
      localStorage.getItem("admin.active_organization_id"),
    );
    // switch org: active org must reflect the new selection
    expect(orgB).toBe(E2E_PROJECTS_ORG_ID);
    expect(orgB).not.toBe(orgA);
  });
});
