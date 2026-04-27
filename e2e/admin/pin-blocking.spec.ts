import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PinBlockingPom } from "../poms/PinBlockingPom";
import { JuryPom } from "../poms/JuryPom";
import { adminClient, readJurorAuth, resetJurorAuth } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID, EVAL_JURORS, EVAL_PERIOD_ID, LOCKED_JUROR_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const PERIOD_ID = EVAL_PERIOD_ID;

test.describe("pin-blocking", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Ensure the seed juror is locked before each test so repeat-each runs stay stable
    await adminClient
      .from("juror_period_auth")
      .update({
        failed_attempts: 3,
        locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        locked_at: new Date().toISOString(),
        is_blocked: false,
      })
      .eq("juror_id", LOCKED_JUROR_ID)
      .eq("period_id", PERIOD_ID);
  });

  async function signInAndGotoPinBlocking(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const pinBlocking = new PinBlockingPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await page.waitForURL(/\/admin/, { timeout: 15_000 });
    await shell.expectOnDashboard();
    await shell.clickNav("pin-blocking");
    await shell.selectPeriod(PERIOD_ID);
    await page.waitForLoadState("networkidle");
    await pinBlocking.waitForReady();
    return { shell, pinBlocking };
  }

  test("locked juror unlock button is visible", async ({ page }) => {
    const { pinBlocking } = await signInAndGotoPinBlocking(page);
    await expect(pinBlocking.unlockBtn(LOCKED_JUROR_ID)).toBeVisible({ timeout: 10000 });
  });

  test("clicking unlock opens the PIN modal", async ({ page }) => {
    const { pinBlocking } = await signInAndGotoPinBlocking(page);
    await expect(pinBlocking.unlockBtn(LOCKED_JUROR_ID)).toBeVisible({ timeout: 10000 });
    await pinBlocking.clickUnlock(LOCKED_JUROR_ID);
    await expect(pinBlocking.modal()).toBeVisible();
    await pinBlocking.closeModal();
  });

  // ── C3: DB round-trip validation ────────────────────────────────────────────

  test("admin unlock → failed_attempts and locked_until reset in DB", async ({ page }) => {
    // Ensure juror is fully locked with a counter + future locked_until
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await adminClient
      .from("juror_period_auth")
      .update({ is_blocked: true, locked_at: new Date().toISOString(), failed_attempts: 3, locked_until: future })
      .eq("juror_id", LOCKED_JUROR_ID)
      .eq("period_id", PERIOD_ID);

    const { pinBlocking } = await signInAndGotoPinBlocking(page);
    await expect(pinBlocking.unlockBtn(LOCKED_JUROR_ID)).toBeVisible({ timeout: 10000 });
    await pinBlocking.clickUnlock(LOCKED_JUROR_ID);
    await expect(pinBlocking.modal()).toBeVisible();
    await pinBlocking.closeModal();

    const auth = await readJurorAuth(LOCKED_JUROR_ID, PERIOD_ID);
    expect(auth.failed_attempts).toBe(0);
    expect(auth.locked_until).toBeNull();
  });

  test("expired locked_until → PIN attempt accepted", async ({ page }) => {
    const jurorId = EVAL_JURORS[0].id;
    await resetJurorAuth(jurorId, EVAL_PERIOD_ID);
    // Simulate a lockout that has already expired (2 min in the past)
    const past = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await adminClient
      .from("juror_period_auth")
      .update({ failed_attempts: 3, locked_until: past })
      .eq("juror_id", jurorId)
      .eq("period_id", EVAL_PERIOD_ID);

    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("dj_tour_done", "1");
        sessionStorage.setItem("dj_tour_pin_step", "1");
        sessionStorage.setItem("dj_tour_eval", "1");
        sessionStorage.setItem("dj_tour_rubric", "1");
        sessionStorage.setItem("dj_tour_confirm", "1");
      } catch {}
    });

    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Eval Render", "E2E Test Affiliation");
    await jury.submitIdentity();
    await jury.waitForPinStep();
    await jury.fillPin("9999");
    await jury.submitPin();
    await jury.waitForProgressStep();
  });
});
