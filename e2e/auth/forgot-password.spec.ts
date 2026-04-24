import { test, expect } from "@playwright/test";
import { ForgotPasswordPom } from "../poms/ForgotPasswordPom";
import { ResetPasswordPom } from "../poms/ResetPasswordPom";
import { LoginPom } from "../poms/LoginPom";
import {
  adminClient,
  buildRecoverySession,
  deleteUserByEmail,
} from "../helpers/supabaseAdmin";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

// Dedicated recovery-test user — isolated from other auth flows so a password
// change here cannot break another spec.
const RECOVERY_SUFFIX = "e5r1";
const RECOVERY_EMAIL = `e5-recovery-${RECOVERY_SUFFIX}@vera-eval.app`;
const RECOVERY_INITIAL_PASSWORD = "E5InitialPass2026!";
const RECOVERY_NEW_PASSWORD = "E5NewResetPass2026!";

test.describe("forgot-password", () => {
  test("page loads — email input and submit button visible", async ({ page }) => {
    const fp = new ForgotPasswordPom(page);
    await fp.goto();
    await expect(fp.emailInput()).toBeVisible();
    await expect(fp.submitBtn()).toBeVisible();
    await expect(fp.successBanner()).not.toBeVisible();
  });

  test("submit button is enabled on page load", async ({ page }) => {
    const fp = new ForgotPasswordPom(page);
    await fp.goto();
    await expect(fp.submitBtn()).toBeEnabled();
  });

  test("submit with valid email shows success banner", async ({ page }) => {
    const fp = new ForgotPasswordPom(page);
    await fp.goto();
    await fp.requestReset(EMAIL);
    await fp.expectSuccessBanner();
    await expect(fp.emailInput()).not.toBeVisible();
  });

  // ── E5: full recovery flow — hash → reset form → new password → login ─────
  test.describe("recovery link full flow", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeAll(async () => {
      await deleteUserByEmail(RECOVERY_EMAIL).catch(() => {});
      const { data, error } = await adminClient.auth.admin.createUser({
        email: RECOVERY_EMAIL,
        password: RECOVERY_INITIAL_PASSWORD,
        email_confirm: true,
      });
      if (error || !data?.user) {
        throw new Error(`createUser failed: ${error?.message}`);
      }
    });

    test.afterAll(async () => {
      await deleteUserByEmail(RECOVERY_EMAIL).catch(() => {});
    });

    test("recovery link → reset password → login with new password", async ({ page }) => {
      // Inject the recovery-hash session into localStorage before the page boots,
      // so the ResetPasswordScreen sees `hasSession` and renders the form.
      // Same ES256 rationale as buildInviteSession — see helpers/supabaseAdmin.ts.
      const { storageKey, sessionValue } = await buildRecoverySession(RECOVERY_EMAIL, APP_BASE);
      await page.addInitScript(
        ({ key, value }: { key: string; value: unknown }) => {
          window.localStorage.setItem(key, JSON.stringify(value));
        },
        { key: storageKey, value: sessionValue },
      );
      await page.goto(`${APP_BASE}/reset-password?type=recovery`);

      const reset = new ResetPasswordPom(page);
      await expect(reset.passwordInput()).toBeVisible({ timeout: 12_000 });
      await reset.fillAndSubmit(RECOVERY_NEW_PASSWORD);
      await reset.expectSuccess();

      // Sign in with the new password. The reset submit already signed the
      // user out of the recovery session, so login must succeed fresh.
      await page.goto(`${APP_BASE}/login`);
      const login = new LoginPom(page);
      await login.signIn(RECOVERY_EMAIL, RECOVERY_NEW_PASSWORD);
      // Accept either a successful login redirect or any non-error auth state.
      // Primary signal: URL leaves /login.
      await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15_000 });
    });
  });
});
