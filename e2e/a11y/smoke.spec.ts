import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

// P2-7: full per-page axe sweep (~20 routes).
// Non-critical violations are logged and attached as JSON; only critical
// violations fail the test (first-pass discovery mode).
const ROUTES = [
  // Public / auth routes — no login needed
  { path: "/",                    name: "landing",         needsAuth: false },
  { path: "/login",               name: "login",           needsAuth: false },
  { path: "/register",            name: "register",        needsAuth: false },
  { path: "/forgot-password",     name: "forgot-password", needsAuth: false },
  { path: "/eval",                name: "jury-gate",       needsAuth: false },

  // Admin routes — login required
  { path: "/admin/overview",      name: "admin-overview",  needsAuth: true },
  { path: "/admin/rankings",      name: "rankings",        needsAuth: true },
  { path: "/admin/analytics",     name: "analytics",       needsAuth: true },
  { path: "/admin/heatmap",       name: "heatmap",         needsAuth: true },
  { path: "/admin/reviews",       name: "reviews",         needsAuth: true },
  { path: "/admin/jurors",        name: "jurors",          needsAuth: true },
  { path: "/admin/projects",      name: "projects",        needsAuth: true },
  { path: "/admin/periods",       name: "periods",         needsAuth: true },
  { path: "/admin/criteria",      name: "criteria",        needsAuth: true },
  { path: "/admin/outcomes",      name: "outcomes",        needsAuth: true },
  { path: "/admin/entry-control", name: "entry-control",   needsAuth: true },
  { path: "/admin/pin-blocking",  name: "pin-blocking",    needsAuth: true },
  { path: "/admin/audit-log",     name: "audit-log",       needsAuth: true },
  { path: "/admin/organizations", name: "organizations",   needsAuth: true },
  { path: "/admin/settings",      name: "settings",        needsAuth: true },
];

for (const route of ROUTES) {
  test(`a11y smoke: ${route.name}`, async ({ page }) => {
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
        // "color-contrast" — brand colors may intentionally be below 4.5:1; raise as backlog
      ])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    const rest     = results.violations.filter((v) => v.impact !== "critical");

    if (rest.length > 0) {
      const summary = rest
        .map((v) => `  ${v.id} [${v.impact}] ×${v.nodes.length}: ${v.description}`)
        .join("\n");
      console.warn(`a11y non-critical on ${route.name}:\n${summary}`);
      await test.info().attach(`a11y-${route.name}`, {
        contentType: "application/json",
        body: Buffer.from(JSON.stringify(rest, null, 2)),
      });
    }

    expect(critical, `critical a11y violations on ${route.name}`).toHaveLength(0);
  });
}
