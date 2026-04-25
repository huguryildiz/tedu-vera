import { test, expect } from "@playwright/test";

// Demo routes auto-login via DemoAdminLoader — no credentials needed.
// E2E_BASE_URL should point to a running VERA instance (demo env or localhost).
const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

const ROUTES = [
  { path: "/demo/admin/rankings", name: "rankings" },
  { path: "/demo/admin/periods", name: "periods" },
  { path: "/demo/admin/projects", name: "projects" },
  { path: "/demo/admin/jurors", name: "jurors" },
];

const VIEWPORTS = [
  { width: 1440, height: 900, label: "desktop" },
  { width: 390, height: 844, label: "mobile-portrait" },
];

const THEMES = ["light", "dark"];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`visual: ${route.name} ${viewport.label} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);

        // Navigate to demo route — DemoAdminLoader auto-logs in with the demo admin account
        await page.goto(`${APP_BASE}${route.path}`);

        // Wait for the admin shell to be present (not the login page)
        await expect(page.locator('[data-testid="admin-shell-root"]')).toBeVisible({
          timeout: 20_000,
        });

        // Wait for data to load (no loading spinner visible)
        await page.waitForLoadState("networkidle");

        if (theme === "dark") {
          await page.evaluate(() => document.body.classList.add("dark-mode"));
          await page.waitForTimeout(300);
        }

        await expect(page).toHaveScreenshot(
          `${route.name}-${viewport.label}-${theme}.png`,
          { maxDiffPixelRatio: 0.02, fullPage: true },
        );
      });
    }
  }
}
