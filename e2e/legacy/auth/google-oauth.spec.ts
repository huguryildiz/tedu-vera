// e2e/auth/google-oauth.spec.ts
// ============================================================
// auth.e2e.google-oauth — "Continue with Google" button is rendered
// on the admin login screen and the click handoff invokes Supabase
// OAuth (we mock the SDK call to avoid leaving the test env).
// ============================================================

import { test, expect } from "@playwright/test";
import { LoginPage } from "../helpers/LoginPage";

test.describe("Auth · Google OAuth", () => {
  test("Login screen renders the Google OAuth button", async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLoginRoute();
    await expect(login.googleButton()).toBeVisible({ timeout: 5_000 });
  });

  test("Clicking Google OAuth triggers Supabase signInWithOAuth", async ({ page }) => {
    // Intercept the OAuth redirect at the SDK layer: stub the call
    // before the page boots so the network request never leaves the test.
    await page.addInitScript(() => {
      // @ts-expect-error — test-only window flag
      window.__oauthInvoked = 0;
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        if (/auth\/v1\/authorize/i.test(url)) {
          // @ts-expect-error
          window.__oauthInvoked += 1;
          return new Response(JSON.stringify({ url: "about:blank" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return originalFetch(input, init);
      };
    });

    const login = new LoginPage(page);
    await login.gotoLoginRoute();
    await expect(login.googleButton()).toBeVisible({ timeout: 5_000 });
    await login.googleButton().click();

    // Either the SDK fired authorize (intercepted above) or the page
    // navigated away to Google's domain — both confirm the handoff.
    await expect
      .poll(async () => {
        const flag = await page.evaluate(
          // @ts-expect-error
          () => Number(window.__oauthInvoked || 0)
        );
        return flag > 0 || /google|accounts\./.test(page.url());
      }, { timeout: 5_000 })
      .toBeTruthy();
  });
});
