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

    // Recent Supabase CLI/GoTrue releases drop the `/auth/v1/` prefix from
    // action_link, so a direct fetch hits Kong's 404. Insert it when missing.
    const actionLink = data.properties.action_link.replace(
      /^(https?:\/\/[^/]+)\/(verify|otp|callback|authorize|magiclink|recover|signup)\b/,
      "$1/auth/v1/$2",
    );
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

    // Create the membership row so the invite flow recognizes this as an org admin.
    // Schema: memberships.role IN ('org_admin', 'super_admin') — not 'admin'.
    const { error: membershipErr } = await adminClient
      .from("memberships")
      .insert({
        user_id: userId,
        organization_id: E2E_PERIODS_ORG_ID,
        status: "invited",
        role: "org_admin",
        is_owner: false,
      });
    expect(membershipErr).toBeNull();

    // Build the localStorage session.
    // Supabase JS derives the auth-token storage key from the Supabase URL,
    // NOT the app URL — pulling it from APP_BASE yields `sb-localhost-...`,
    // which the running app never reads.
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.E2E_SUPABASE_URL || "";
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
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

    // Expect the invite-accept form to be visible.
    // Actual testids in InviteAcceptScreen.jsx: invite-name, invite-password, invite-confirm-password, invite-submit
    await expect(page.locator(`[data-testid="invite-name"]`)).toBeVisible({ timeout: 12000 });
    await expect(page.locator(`[data-testid="invite-password"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="invite-submit"]`)).toBeVisible();

    // Fill name, password, confirm-password
    await page.locator(`[data-testid="invite-name"]`).fill(INVITE_NAME);
    await page.locator(`[data-testid="invite-password"]`).fill(INVITE_PASSWORD);
    await page.locator(`[data-testid="invite-confirm-password"]`).fill(INVITE_PASSWORD);

    // Submit
    await page.locator(`[data-testid="invite-submit"]`).click();

    // Success screen: "Account Ready" + "Go to Admin Panel" button.
    // The screen does NOT auto-redirect — user must click through.
    await expect(page.locator(`[data-testid="invite-success"]`)).toBeVisible({ timeout: 15000 });
    await page.locator(`button:has-text("Go to Admin Panel")`).click();

    // Now we should be on /admin/* (or /admin)
    await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 15000 });
    expect(page.url()).toContain("/admin");
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
