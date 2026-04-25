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

        // Suppress the admin onboarding tour (SpotlightTour) before React mounts.
        // Without this, every fresh-context screenshot captures the welcome
        // overlay instead of the page content.
        await page.addInitScript(() => {
          try {
            localStorage.setItem("vera.admin_tour_done", "1");
          } catch {}
        });

        // Step 1 — trigger auto-login. Visiting /demo (or any /demo/admin/*
        // route while logged out) shows DemoAdminLoader, which signs in with
        // the demo admin and then `window.location.replace("/demo/admin")`.
        // We MUST land on /demo/admin first because the loader hardcodes that
        // redirect target — going directly to the deep link drops the path.
        await page.goto(`${APP_BASE}/demo/admin`);
        await expect(page.locator('[data-testid="admin-shell-root"]')).toBeVisible({
          timeout: 30_000,
        });

        // Step 2 — auth session is now in storage; navigate to the actual
        // route. AdminRouteLayout renders directly without bouncing through
        // DemoAdminLoader.
        if (route.path !== "/demo/admin") {
          await page.goto(`${APP_BASE}${route.path}`);
          await expect(page.locator('[data-testid="admin-shell-root"]')).toBeVisible({
            timeout: 20_000,
          });
        }

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
