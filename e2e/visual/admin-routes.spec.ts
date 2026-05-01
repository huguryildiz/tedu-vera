import { test, expect } from "@playwright/test";

// Demo routes auto-login via DemoAdminLoader — no credentials needed.
// Public routes navigate directly with no auth step.
// E2E_BASE_URL should point to a running VERA instance (demo env or localhost).
const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

type RouteEntry =
  | { path: string; name: string; type: "demo" }
  | { path: string; name: string; type: "public"; waitFor: string };

const ROUTES: RouteEntry[] = [
  // Demo auto-login routes (DemoAdminLoader sets auth then navigates to target)
  { path: "/demo/admin/rankings",  name: "rankings",       type: "demo" },
  { path: "/demo/admin/periods",   name: "periods",        type: "demo" },
  { path: "/demo/admin/projects",  name: "projects",       type: "demo" },
  { path: "/demo/admin/jurors",    name: "jurors",         type: "demo" },

  // P2-6 key screens — demo admin
  { path: "/demo/admin/overview",  name: "admin-overview", type: "demo" },
  // /demo/jury/evaluate requires an active jury session; snapshots whatever
  // state the demo env serves (token gate or score grid).
  { path: "/demo/jury/evaluate",   name: "score-grid",     type: "demo" },

  // P2-6 key screens — public (no auth)
  { path: "/",      name: "landing",    type: "public", waitFor: ".landing-nav" },
  { path: "/login", name: "login",      type: "public", waitFor: "form" },
  { path: "/eval",  name: "jury-gate",  type: "public", waitFor: ".eval-entry, form, [data-testid]" },
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

        // Inject animation-killing CSS at document_start so every keyframe
        // and transition (including @property-driven --acr-angle and
        // .reveal-section scroll-in transitions) is dead from the first paint.
        // Without this, fullPage capture's progressive scroll fires
        // IntersectionObservers at different positions between stability
        // passes and the screenshot never settles.
        await page.addInitScript(() => {
          const style = document.createElement("style");
          style.textContent = `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
            .reveal-section, .reveal-section .reveal-child, .landing-steps {
              opacity: 1 !important;
              transform: none !important;
            }
          `;
          (document.head || document.documentElement).appendChild(style);
        });

        if (route.type === "demo") {
          // Step 1 — trigger auto-login. DemoAdminLoader signs in with the
          // demo admin and then window.location.replace("/demo/admin").
          // We MUST land on /demo/admin first because the loader hardcodes
          // that redirect target — going directly to a deep link drops the path.
          await page.goto(`${APP_BASE}/demo/admin`);
          await expect(page.locator('[data-testid="admin-shell-root"]')).toBeVisible({
            timeout: 30_000,
          });

          // Step 2 — auth session is now in storage; navigate to the target.
          if (route.path !== "/demo/admin") {
            await page.goto(`${APP_BASE}${route.path}`);
            // Admin routes show the shell; jury/public demo routes don't —
            // just wait for networkidle below.
            if (route.path.startsWith("/demo/admin/")) {
              await expect(page.locator('[data-testid="admin-shell-root"]')).toBeVisible({
                timeout: 20_000,
              });
            }
          }
        } else {
          // Public route — navigate directly, no auth needed.
          await page.goto(`${APP_BASE}${route.path}`);
          await page.waitForSelector(route.waitFor, { timeout: 20_000 });
        }

        // Wait for data to load (no loading spinner visible)
        await page.waitForLoadState("networkidle");

        if (theme === "dark") {
          await page.evaluate(() => document.body.classList.add("dark-mode"));
          await page.waitForTimeout(300);
        }

        // Force every IntersectionObserver-driven reveal into its end state
        // so fullPage capture's progressive scroll can't trigger a class
        // change mid-screenshot.
        await page.evaluate(() => {
          document
            .querySelectorAll(".reveal-section, .landing-steps")
            .forEach((el) => el.classList.add("is-visible"));
        });
        await page.waitForTimeout(150);

        await expect(page).toHaveScreenshot(
          `${route.name}-${viewport.label}-${theme}.png`,
          { maxDiffPixelRatio: 0.02, fullPage: true },
        );
      });
    }
  }
}
