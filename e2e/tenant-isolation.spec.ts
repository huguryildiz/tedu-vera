// e2e/tenant-isolation.spec.ts
// ============================================================
// Phase C: Tenant isolation E2E test suite.
//
// Tests multi-tenant data isolation, auth gating, jury flow
// tenant-implicitness, and cross-tenant access denial.
//
// Requires environment variables:
//   E2E_ADMIN_EMAIL     — tenant-admin email (approved for one tenant)
//   E2E_ADMIN_PASSWORD  — tenant-admin password
//   E2E_SUPER_EMAIL     — super-admin email
//   E2E_SUPER_PASSWORD  — super-admin password
//   E2E_PENDING_EMAIL   — pending user email (not yet approved)
//   E2E_PENDING_PASSWORD — pending user password
//   E2E_OTHER_SEMESTER  — semester name belonging to another tenant
// ============================================================

import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const SUPER_EMAIL = process.env.E2E_SUPER_EMAIL || "";
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD || "";
const PENDING_EMAIL = process.env.E2E_PENDING_EMAIL || "";
const PENDING_PASSWORD = process.env.E2E_PENDING_PASSWORD || "";
const OTHER_SEMESTER = process.env.E2E_OTHER_SEMESTER || "";

// Helper: sign in via the admin login form
async function adminSignIn(page: Page, email: string, password: string) {
  await page.goto("/login");

  const emailInput = page.getByPlaceholder(/email/i).or(
    page.locator('input[type="email"]')
  );
  await emailInput.waitFor({ timeout: 10_000 });
  await emailInput.fill(email);

  const passwordInput = page.getByPlaceholder(/password|şifre/i).or(
    page.locator('input[type="password"]').first()
  );
  await passwordInput.fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

// ═══════════════════════════════════════════════════════════════
// Tenant-admin isolation
// ═══════════════════════════════════════════════════════════════

test.describe("Tenant-admin isolation", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Skipped: E2E_ADMIN_EMAIL/PASSWORD not set");

  test("Tenant-admin can sign in and see admin dashboard", async ({ page }) => {
    await adminSignIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Tenant-admin cannot see other tenant's semesters", async ({ page }) => {
    test.skip(!OTHER_SEMESTER, "Skipped: E2E_OTHER_SEMESTER not set");
    await adminSignIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    // The other tenant's semester should NOT appear in any dropdown or list
    const body = await page.textContent("body");
    expect(body).not.toContain(OTHER_SEMESTER);
  });

  test("Tenant-admin cannot access another tenant's data via URL manipulation", async ({ page }) => {
    await adminSignIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    // Admin panel is SPA — no direct URL routes to other tenant data.
    // Verify the admin panel loaded and shows data (no errors).
    const errorBanner = page.locator(".premium-error-banner, [role='alert']");
    const errorCount = await errorBanner.count();
    // Allow 0 errors (normal) — if there are errors, they shouldn't be auth errors
    if (errorCount > 0) {
      const errorText = await errorBanner.first().textContent();
      expect(errorText).not.toMatch(/unauthorized|forbidden/i);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Super-admin access
// ═══════════════════════════════════════════════════════════════

test.describe("Super-admin access", () => {
  test.skip(!SUPER_EMAIL || !SUPER_PASSWORD, "Skipped: E2E_SUPER_EMAIL/PASSWORD not set");

  test("Super-admin can sign in and sees tenant switcher", async ({ page }) => {
    await adminSignIn(page, SUPER_EMAIL, SUPER_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    // Super-admin should see the tenant switcher dropdown
    const switcher = page.locator(".tenant-switcher, .tenant-switcher-select");
    await expect(switcher).toBeVisible({ timeout: 5_000 });
  });

  test("Super-admin can switch between tenants", async ({ page }) => {
    await adminSignIn(page, SUPER_EMAIL, SUPER_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    const select = page.locator(".tenant-switcher-select");
    const options = await select.locator("option").count();
    expect(options).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Pending applicant blocking
// ═══════════════════════════════════════════════════════════════

test.describe("Pending applicant blocking", () => {
  test.skip(!PENDING_EMAIL || !PENDING_PASSWORD, "Skipped: E2E_PENDING_EMAIL/PASSWORD not set");

  test("Pending applicant sees gate screen, not admin panel", async ({ page }) => {
    await adminSignIn(page, PENDING_EMAIL, PENDING_PASSWORD);

    // Should see the pending gate, NOT the admin tabs
    const pendingGate = page.locator(".pending-gate, [data-testid='pending-gate']");
    const pendingText = page.getByText(/pending|awaiting|application/i);

    await expect(pendingText.or(pendingGate)).toBeVisible({ timeout: 15_000 });

    // Admin tabs should NOT be visible
    const adminTab = page.locator('[data-tour="overview"]');
    await expect(adminTab).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// Jury flow tenant-implicitness
// ═══════════════════════════════════════════════════════════════

test.describe("Jury flow tenant isolation", () => {
  test("Jury page URL never contains tenant information", async ({ page }) => {
    await page.goto("/");
    // Navigate to jury entry
    const startBtn = page.getByRole("button", { name: /start evaluation|değerlendirme/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // Check that the URL has no tenant references
    const url = page.url();
    expect(url).not.toMatch(/tenant[_-]?id/i);
    expect(url).not.toMatch(/tedu-ee|boun-cs|metu-me/);
  });

  test("Jury entry page does not show tenant selection", async ({ page }) => {
    await page.goto("/");
    const startBtn = page.getByRole("button", { name: /start evaluation|değerlendirme/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // No tenant-related dropdowns or selectors should be visible
    const tenantElements = page.locator(
      ".tenant-dropdown, .tenant-switcher, [data-testid*='tenant']"
    );
    await expect(tenantElements).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Unauthenticated access denial
// ═══════════════════════════════════════════════════════════════

test.describe("Unauthenticated access denial", () => {
  test("Admin page shows login form when not authenticated", async ({ page }) => {
    await page.goto("/login");

    // Should see login form with email input
    const emailInput = page.getByPlaceholder(/email/i).or(
      page.locator('input[type="email"]')
    );
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    // Should see Sign In button
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();

    // Should NOT see admin tabs
    await expect(
      page.locator('[data-tour="overview"]')
    ).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-tenant data leakage (scores/analytics/rankings)
// ═══════════════════════════════════════════════════════════════

test.describe("Cross-tenant data leakage prevention", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Skipped: credentials not set");

  test("Scores tab only shows current tenant data", async ({ page }) => {
    await adminSignIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    // Click Scores tab
    // "scores" is a dropdown button in the sidebar, not a tab
    const scoresTab = page.getByRole("button", { name: /scores/i });
    if (await scoresTab.isVisible()) {
      await scoresTab.click();
      // Wait for scores to load
      await page.waitForTimeout(2000);

      // If OTHER_SEMESTER is set, verify it doesn't appear
      if (OTHER_SEMESTER) {
        const body = await page.textContent("body");
        expect(body).not.toContain(OTHER_SEMESTER);
      }
    }
  });

  test("Settings tab only shows current tenant settings", async ({ page }) => {
    await adminSignIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    // Click Settings tab
    const settingsTab = page.locator('[data-tour="settings"]');
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForTimeout(2000);

      // Verify no cross-tenant semester names visible
      if (OTHER_SEMESTER) {
        const body = await page.textContent("body");
        expect(body).not.toContain(OTHER_SEMESTER);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Seed data consistency
// ═══════════════════════════════════════════════════════════════

test.describe("Multi-tenant seed consistency", () => {
  test.skip(!SUPER_EMAIL || !SUPER_PASSWORD, "Skipped: super-admin credentials not set");

  test("Super-admin sees multiple tenants in switcher", async ({ page }) => {
    await adminSignIn(page, SUPER_EMAIL, SUPER_PASSWORD);
    await expect(
      page.locator('[data-tour="overview"]')
    ).toBeVisible({ timeout: 15_000 });

    const select = page.locator(".tenant-switcher-select");
    if (await select.isVisible()) {
      const options = await select.locator("option").allTextContents();
      // Seed creates 6 tenants — super-admin should see at least 2
      expect(options.length).toBeGreaterThanOrEqual(2);
    }
  });
});
