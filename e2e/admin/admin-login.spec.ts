import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("admin login", () => {
  test("happy path — valid credentials land on the admin dashboard", async ({ page }) => {
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);

    await login.goto();
    await login.signIn(EMAIL, PASSWORD);

    await shell.expectOnDashboard();
  });

  test("wrong password shows the error banner", async ({ page }) => {
    const login = new LoginPom(page);

    await login.goto();
    await login.signIn(EMAIL, "definitely-not-the-password");

    await login.expectErrorMessage(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("unknown email shows the error banner", async ({ page }) => {
    const login = new LoginPom(page);

    await login.goto();
    await login.signIn("nosuchuser-b2@vera-eval.app", "whatever-pass");

    await login.expectErrorMessage(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
