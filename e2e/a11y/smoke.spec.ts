import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const ROUTES = [
  { path: "/admin/rankings", name: "rankings", needsAuth: true },
  { path: "/admin/periods", name: "periods", needsAuth: true },
  { path: "/admin/projects", name: "projects", needsAuth: true },
  { path: "/admin/jurors", name: "jurors", needsAuth: true },
  { path: "/jury/eval", name: "jury-eval", needsAuth: false },
];

for (const route of ROUTES) {
  test(`a11y smoke: ${route.name}`, async ({ page }) => {
    // Log route info
    console.log(`\n========================================`);
    console.log(`Testing accessibility: ${route.name}`);
    console.log(`Route: ${route.path}`);
    console.log(`========================================`);

    if (route.needsAuth) {
      const login = new LoginPom(page);
      const shell = new AdminShellPom(page);
      await login.goto();
      await login.signIn(EMAIL, PASSWORD);
      await shell.expectOnDashboard();
    }

    await page.goto(route.path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules([
        // Document violations as comments here so future runs know why a rule
        // is muted. Common ignorables on a real-world app:
        //   "color-contrast" — if marketing brand colors are intentionally
        //                      below 4.5:1 (raise as a backlog item)
      ])
      .analyze();

    if (results.violations.length > 0) {
      const summaryByRule = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        description: v.description,
      }));
      console.log(`a11y violations on ${route.name}:`, summaryByRule);
    }

    expect(results.violations).toEqual([]);
  });
}
