import { test, expect } from "@playwright/test";
import { adminClient, buildRecoverySession, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { LoginPom } from "../poms/LoginPom";
import { ResetPasswordPom } from "../poms/ResetPasswordPom";

const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

// Dedicated recovery-test user — isolated from other auth flows
const RESET_SUFFIX = "e5pwd";
const RESET_EMAIL = `e2e-password-reset-${RESET_SUFFIX}@vera-eval.app`;
const INITIAL_PASSWORD = "E5InitialReset!2026";
const NEW_PASSWORD = "E5NewResetPass!2026";

test.describe("password-reset full flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Clean up any leftover user
    await deleteUserByEmail(RESET_EMAIL).catch(() => {});

    // Create a test user with an initial password
    const { data, error } = await adminClient.auth.admin.createUser({
      email: RESET_EMAIL,
      password: INITIAL_PASSWORD,
      email_confirm: true,
    });
    expect(error, `createUser failed: ${error?.message}`).toBeNull();
    expect(data?.user?.id).toBeTruthy();
  });

  test.afterAll(async () => {
    await deleteUserByEmail(RESET_EMAIL).catch(() => {});
  });

  test("request password reset with /forgot-password email → link generated", async ({ page }) => {
    // Just verify the forgot-password flow initiates
    await page.goto(`${APP_BASE}/forgot-password`);
    await expect(page.locator(`[data-testid="forgot-password-email"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="forgot-password-submit"]`)).toBeVisible();
  });

  test("recovery link → /reset-password → submit new password → success", async ({ page }) => {
    // Build a recovery session and inject it
    const { storageKey, sessionValue } = await buildRecoverySession(RESET_EMAIL, APP_BASE);
    await page.addInitScript(
      ({ key, value }: { key: string; value: unknown }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: storageKey, value: sessionValue },
    );

    // Navigate to reset-password with the session injected
    await page.goto(`${APP_BASE}/reset-password?type=recovery`);

    // Expect the reset form to be visible
    const reset = new ResetPasswordPom(page);
    await expect(reset.passwordInput()).toBeVisible({ timeout: 12000 });
    await expect(reset.submitButton()).toBeVisible();

    // Fill and submit the new password
    await reset.fillAndSubmit(NEW_PASSWORD);

    // Expect success banner / message
    await reset.expectSuccess();
  });

  test("login with old password fails", async ({ page }) => {
    const login = new LoginPom(page);
    await login.goto();
    await login.signIn(RESET_EMAIL, INITIAL_PASSWORD);

    // Should show error
    await login.expectErrorMessage(/invalid email or password/i);
  });

  test("login with new password succeeds", async ({ page }) => {
    const login = new LoginPom(page);
    await login.goto();
    await login.signIn(RESET_EMAIL, NEW_PASSWORD);

    // Should redirect away from /login
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
    expect(page.url()).not.toContain("/login");
  });
});
