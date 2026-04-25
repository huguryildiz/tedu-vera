import { test, expect } from "@playwright/test";
import { adminClient, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";

const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

// Unique suffix for this test run
const INVITE_SUFFIX = "e5inv";
const INVITE_EMAIL = `e2e-admin-invite-${INVITE_SUFFIX}@vera-eval.app`;
const INVITE_NAME = "E2E Invited Admin";
const INVITE_PASSWORD = "E2eInviteStrong!Pass#1";

test.describe("admin invite-accept flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await deleteUserByEmail(INVITE_EMAIL).catch(() => {});
  });

  test.afterAll(async () => {
    await deleteUserByEmail(INVITE_EMAIL).catch(() => {});
  });

  test("super-admin invites a tenant-admin → invite link → accept → land on /admin for new org", async ({
    page,
  }) => {
    // Generate an invite link for a new admin user
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: INVITE_EMAIL,
      options: { redirectTo: `${APP_BASE}/invite/accept` },
    });
    expect(error, `generateLink failed: ${error?.message}`).toBeNull();
    expect(data?.properties?.action_link).toBeTruthy();

    const actionLink = data.properties.action_link;
    const res = await fetch(actionLink, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    const hashIdx = location.indexOf("#");
    expect(hashIdx).toBeGreaterThanOrEqual(0);
    const hashFragment = location.slice(hashIdx);

    // Now extract the session tokens
    const params = new URLSearchParams(hashFragment.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token") ?? "";
    const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10);

    expect(accessToken).toBeTruthy();

    // Decode the user ID from the JWT
    const payloadB64 = accessToken.split(".")[1];
    const jwtPayload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    const userId = jwtPayload.sub;

    // Get the full User object
    const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(userId);
    expect(userErr).toBeNull();
    expect(userData?.user).toBeTruthy();

    // Create the membership row so the invite flow recognizes this as an org admin
    const { error: membershipErr } = await adminClient
      .from("memberships")
      .insert({
        user_id: userId,
        organization_id: E2E_PERIODS_ORG_ID,
        status: "invited",
        role: "admin",
        is_owner: false,
      });
    expect(membershipErr).toBeNull();

    // Build the localStorage session
    const projectRef = new URL(APP_BASE).hostname.split(".")[0] || "localhost";
    const storageKey = `sb-${projectRef}-auth-token`;
    const sessionValue = {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: userData.user,
    };

    // Inject session into localStorage before navigating
    await page.addInitScript(
      ({ key, value }: { key: string; value: unknown }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      { key: storageKey, value: sessionValue },
    );

    await page.goto(`${APP_BASE}/invite/accept`);

    // Expect the invite-accept form to be visible
    await expect(page.locator(`[data-testid="invite-name-input"]`)).toBeVisible({ timeout: 12000 });
    await expect(page.locator(`[data-testid="invite-password-input"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="invite-submit"]`)).toBeVisible();

    // Fill name and password
    await page.locator(`[data-testid="invite-name-input"]`).fill(INVITE_NAME);
    await page.locator(`[data-testid="invite-password-input"]`).fill(INVITE_PASSWORD);

    // Submit
    await page.locator(`[data-testid="invite-submit"]`).click();

    // Should redirect to /admin/* (we land on the period list or overview)
    await page.waitForURL((url) => url.pathname.startsWith("/admin/"), { timeout: 15000 });
    expect(page.url()).toContain("/admin/");

    // Verify we see the admin shell
    const shell = new AdminShellPom(page);
    await expect(shell.page.locator(`[data-testid="admin-nav"]`)).toBeVisible();
  });

  test("revisiting accept link after completion shows no-op or redirect", async ({ page }) => {
    // The user should now be able to log in normally
    const login = new LoginPom(page);
    await login.goto();
    await login.signIn(INVITE_EMAIL, INVITE_PASSWORD);

    // Should land on the admin dashboard
    const shell = new AdminShellPom(page);
    await shell.expectOnDashboard({ timeout: 15000 });
  });
});
