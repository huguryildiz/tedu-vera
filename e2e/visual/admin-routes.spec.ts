import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const ROUTES = [
  { path: "/admin/rankings", name: "rankings" },
  { path: "/admin/periods", name: "periods" },
  { path: "/admin/projects", name: "projects" },
  { path: "/admin/jurors", name: "jurors" },
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
        // Set viewport before navigation
        await page.setViewportSize(viewport);

        // Login once per test
        const login = new LoginPom(page);
        await login.goto();
        await login.signIn(EMAIL, PASSWORD);

        // Verify successful login
        const shell = new AdminShellPom(page);
        await shell.expectOnDashboard();

        // Navigate to route
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        // Apply theme if dark
        if (theme === "dark") {
          await page.evaluate(() => document.body.classList.add("dark-mode"));
          // Wait for dark mode CSS to apply
          await page.waitForTimeout(300);
        }

        // Capture screenshot
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.label}-${theme}.png`, {
          maxDiffPixelRatio: 0.02,
          fullPage: true,
        });
      });
    }
  }
}
