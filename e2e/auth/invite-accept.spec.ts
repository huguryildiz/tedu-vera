import { test, expect } from "@playwright/test";
import { InviteAcceptPom } from "../poms/InviteAcceptPom";
import {
  buildInviteSession,
  deleteUserByEmail,
} from "../helpers/supabaseAdmin";

// Unique suffix — bump if prior run left residue
const SUFFIX = "B7INV";
const INVITE_EMAIL = `e2e-b7-invite-${SUFFIX.toLowerCase()}@test.local`;
const INVITE_NAME = "E2E B7 Invited User";
const INVITE_PASSWORD = "E2eB7Strong!Pass#1";
const APP_BASE = "http://localhost:5174";

/**
 * Injects an invite session into localStorage, then navigates to /invite/accept.
 *
 * Why localStorage injection (not URL hash):
 *   The dev server uses the prod Supabase project; the E2E admin client uses
 *   the demo project. A URL hash with a demo-issued JWT is validated by
 *   _getSessionFromURL() against prod Auth-v1 → 403 → "Invite Unavailable".
 *   localStorage injection bypasses Auth-v1: _recoverAndRefresh() checks
 *   token expiry by timestamp only (no network call), so a non-expired demo
 *   JWT is accepted without a cross-project validation request.
 *
 * Why addInitScript (not evaluate + reload):
 *   page.evaluate runs after page scripts have started; GoTrueClient's
 *   _initialize() may have already read localStorage before the session is
 *   injected. addInitScript runs before any page script, so the session is
 *   present when _recoverAndRefresh() first checks localStorage on goto.
 *
 * Why the deadlock was fixed in AuthProvider:
 *   _recoverAndRefresh fires SIGNED_IN inside the initializePromise lock
 *   chain. The previous handleAuthChange called fetchMemberships() →
 *   getSession() → supabase.auth.getUser() (no JWT) → await initializePromise
 *   → deadlock. AuthProvider now skips fetchMemberships on /invite/accept
 *   (the form only needs the session, not memberships).
 */
async function navigateWithInviteSession(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"]
) {
  const { storageKey, sessionValue } = await buildInviteSession(INVITE_EMAIL, APP_BASE);
  await page.addInitScript(
    ({ key, value }: { key: string; value: unknown }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: sessionValue }
  );
  await page.goto(`${APP_BASE}/invite/accept`);
}

test.describe("invite-accept", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Clean up any leftover user from a previous run
    await deleteUserByEmail(INVITE_EMAIL).catch(() => {});
  });

  test.afterAll(async () => {
    await deleteUserByEmail(INVITE_EMAIL).catch(() => {});
  });

  test("invite page loads from action_link and shows form", async ({ page }) => {
    await navigateWithInviteSession(page);
    const invite = new InviteAcceptPom(page);
    await expect(invite.nameInput()).toBeVisible({ timeout: 12000 });
    await expect(invite.passwordInput()).toBeVisible();
    await expect(invite.submitBtn()).toBeVisible();
  });

  test("fill name+password and submit shows success", async ({ page }) => {
    // Delete so buildInviteSession can generate a fresh invite for the same email
    await deleteUserByEmail(INVITE_EMAIL).catch(() => {});
    await navigateWithInviteSession(page);
    const invite = new InviteAcceptPom(page);
    await expect(invite.nameInput()).toBeVisible({ timeout: 12000 });
    await invite.fillAndSubmit(INVITE_NAME, INVITE_PASSWORD);
    await invite.expectSuccess();
  });
});
