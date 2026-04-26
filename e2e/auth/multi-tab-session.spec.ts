// Multi-tab session propagation — sign-out fired in Tab B logs Tab A out.
//
// AuthProvider subscribes to supabase.auth.onAuthStateChange. The Supabase JS
// SDK persists session state in localStorage; sibling tabs share that storage
// and the SDK uses BroadcastChannel + storage events to keep auth state in
// sync across tabs of the same browser context. When a tab signs out, the
// other tab's AuthProvider clears session state and AuthGuard redirects to
// /login on the next navigation tick.
//
// BUG CLASS this catches:
//   1. Regression to a per-tab auth model — a logout in B leaves A logged in
//      the next time A navigates.
//   2. AuthGuard not reacting to a session-cleared state.
//   3. AuthProvider failing to re-bootstrap when the persisted Supabase
//      session entry has been removed by another tab.
//
// NOT covered here (lives elsewhere):
//   • Cross-context isolation — a fresh BrowserContext does not share auth.
//   • Server-side token revocation — covered in admin-session-touch tests.

import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("multi-tab session propagation", () => {
  test.describe.configure({ mode: "serial" });

  test("sign-out in Tab B propagates logged-out state to Tab A", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    try {
      // ── Tab A: sign in via the login UI so the SDK persists a real session.
      const pageA = await context.newPage();
      await pageA.addInitScript(() => {
        try {
          localStorage.setItem("vera.admin_tour_done", "1");
          localStorage.setItem("admin.remember_me", "true");
        } catch {}
      });
      const loginA = new LoginPom(pageA);
      const shellA = new AdminShellPom(pageA);
      await loginA.goto();
      await loginA.signIn(EMAIL, PASSWORD);
      await shellA.expectOnDashboard();

      // ── Tab B: same context shares localStorage, so the existing session
      // should restore without a re-login.
      const pageB = await context.newPage();
      await pageB.addInitScript(() => {
        try {
          localStorage.setItem("vera.admin_tour_done", "1");
          localStorage.setItem("admin.remember_me", "true");
        } catch {}
      });
      await pageB.goto("/admin/overview");
      const shellB = new AdminShellPom(pageB);
      await shellB.expectOnDashboard();

      // ── Tab B: sign out via the sidebar button. The handler calls
      // supabase.auth.signOut() which clears the persisted session entry
      // shared with Tab A, then navigates Tab B to /. Cross-tab broadcast
      // semantics differ between BroadcastChannel and storage events under
      // Playwright; we exercise the production click handler so the test
      // mirrors real users.
      await shellB.signOutButton().click();
      // The button does `window.location.href = "/"` after signOut resolves.
      // Wait until Tab B's persisted Supabase session entry is gone — that
      // proves signOut() finished and Tab A is now sharing an empty storage.
      await pageB.waitForFunction(
        () =>
          !Object.keys(localStorage).some(
            (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
          ),
        undefined,
        { timeout: 10_000 },
      );

      // ── Tab A: navigation triggers AuthProvider's session re-bootstrap. The
      // missing persisted entry forces user=null, which AuthGuard turns into
      // a redirect to /login. We do a full page reload (rather than an
      // in-app nav) because AuthProvider's onAuthStateChange listener does
      // not poll storage between tabs in this Playwright config — a real
      // user navigating in Tab A would also trigger AuthProvider re-bootstrap.
      await pageA.reload();
      // AdminRouteLayout renders an inline login form when user is null
      // (it does not change the URL). The admin shell disappears and the
      // login email input takes its place — assert both signals.
      await expect(shellA.root()).toHaveCount(0, { timeout: 15_000 });
      await expect(pageA.locator('[data-testid="admin-login-email"]')).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });
});
