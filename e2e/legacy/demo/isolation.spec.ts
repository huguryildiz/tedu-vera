// e2e/demo/isolation.spec.ts
// ============================================================
// demo.e2e.isolation — Demo environment must not leak production
// data. We assert that:
//   1. /demo/* routes use the demo Supabase URL (different from prod).
//   2. Production-only tenant slugs do not appear in demo admin shell.
// ============================================================

import { test, expect } from "@playwright/test";
import { DemoHelper } from "../helpers/DemoHelper";

const HAS_DEMO =
  Boolean(process.env.VITE_DEMO_ADMIN_EMAIL) &&
  Boolean(process.env.VITE_DEMO_ADMIN_PASSWORD);

const PROD_TENANT_NEEDLE = process.env.E2E_PROD_TENANT_NEEDLE || "";
const PROD_SUPABASE_HOST = (() => {
  const url = process.env.VITE_SUPABASE_URL || "";
  try { return new URL(url).hostname; } catch { return ""; }
})();
const DEMO_SUPABASE_HOST = (() => {
  const url = process.env.VITE_DEMO_SUPABASE_URL || "";
  try { return new URL(url).hostname; } catch { return ""; }
})();

test.describe("Demo · Isolation", () => {
  test.skip(
    !HAS_DEMO,
    "Skipped: VITE_DEMO_ADMIN_EMAIL / VITE_DEMO_ADMIN_PASSWORD not set"
  );

  test("Demo network traffic targets the demo Supabase host", async ({ page }) => {
    test.skip(
      !PROD_SUPABASE_HOST || !DEMO_SUPABASE_HOST || PROD_SUPABASE_HOST === DEMO_SUPABASE_HOST,
      "Skipped: prod and demo Supabase hosts not distinguishable"
    );

    const seenHosts = new Set<string>();
    page.on("request", (req) => {
      try {
        const host = new URL(req.url()).hostname;
        if (host.endsWith("supabase.co") || host.endsWith("supabase.in")) {
          seenHosts.add(host);
        }
      } catch { /* ignore */ }
    });

    const demo = new DemoHelper(page);
    await demo.gotoDemo();
    await demo.waitForAutoLogin();

    // We must have hit demo at least once, and never hit prod.
    expect([...seenHosts]).toContain(DEMO_SUPABASE_HOST);
    expect([...seenHosts]).not.toContain(PROD_SUPABASE_HOST);
  });

  test("Demo admin shell does not surface a production-only tenant", async ({ page }) => {
    test.skip(!PROD_TENANT_NEEDLE, "Skipped: E2E_PROD_TENANT_NEEDLE not set");

    const demo = new DemoHelper(page);
    await demo.gotoDemo();
    await demo.waitForAutoLogin();

    const body = await page.textContent("body");
    expect(body || "").not.toContain(PROD_TENANT_NEEDLE);
  });

  test("Routes outside /demo do not auto-login as demo admin", async ({ page }) => {
    await page.goto("/admin");
    // Either we see the login form (not signed in) or a non-demo session.
    // We never expect to land on /demo/admin from a bare /admin visit.
    expect(page.url()).not.toMatch(/\/demo\/admin/);
  });
});
