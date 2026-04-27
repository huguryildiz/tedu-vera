import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";
import { readJurorAuth, resetJurorAuth } from "../helpers/supabaseAdmin";
import { EVAL_JURORS, EVAL_PERIOD_ID, LOCKED_JUROR_ID } from "../fixtures/seed-ids";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

test.describe("jury lock screen", () => {
  test.describe.configure({ mode: "serial" });

  test("blocked juror sees locked screen after PIN submit", async ({ page, request }) => {
    // The seed pins locked_until to "now() + 1 hour" at seed time, which goes
    // stale on long-lived databases. Force lockout into the future against the
    // juror that the rpc_jury_authenticate lookup will actually match
    // (name + affiliation + period's organization_id), so the test is robust
    // to environment drift between CI's fresh stack and shared demo DBs.
    const lookup = await request.get(
      `${SUPABASE_URL}/rest/v1/juror_period_auth?period_id=eq.${EVAL_PERIOD_ID}&select=juror_id,jurors!inner(juror_name,affiliation)&jurors.juror_name=eq.E2E%20Locked%20Juror&jurors.affiliation=eq.E2E%20Test%20Affiliation`,
      {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      },
    );
    const lookupBody = await lookup.json();
    const targetJurorId: string = lookupBody?.[0]?.juror_id || LOCKED_JUROR_ID;
    const lockedUntilIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const lockRes = await request.patch(
      `${SUPABASE_URL}/rest/v1/juror_period_auth?juror_id=eq.${targetJurorId}&period_id=eq.${EVAL_PERIOD_ID}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: {
          failed_attempts: 3,
          locked_until: lockedUntilIso,
          locked_at: new Date().toISOString(),
        },
      },
    );
    expect(lockRes.ok()).toBeTruthy();

    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Locked Juror", "E2E Test Affiliation");
    await jury.submitIdentity();
    // Lockout (locked_until set in seed) is detected by rpc_jury_authenticate
    // at identity submit time; the redirect to /jury/locked fires immediately,
    // so the PIN entry step is never shown.
    await jury.waitForLockedStep();
    await expect(jury.lockedScreen()).toBeVisible();
  });

  // ── C3: PIN lifecycle ───────────────────────────────────────────────────────

  test("3 failed PIN attempts → locked screen + DB state", async ({ page, request }) => {
    // Pre-set failed_attempts to 2 in the DB, then drive a single wrong-PIN
    // attempt through the UI. This proves the 3rd attempt is the lockout
    // trigger (RPC raises failed_attempts to 3 and stamps locked_until)
    // without fighting the input-clearing race that occurs between two
    // consecutive in-band UI attempts (PinScreen's clear-effect watches
    // [state.pinError] and does not re-fire when two consecutive attempts
    // return the same error code, leaving inputs in a stale state and
    // making the 2nd attempt unreliable on CI).
    const jurorId = EVAL_JURORS[0].id;
    await resetJurorAuth(jurorId, EVAL_PERIOD_ID);
    await request.patch(
      `${SUPABASE_URL}/rest/v1/juror_period_auth?juror_id=eq.${jurorId}&period_id=eq.${EVAL_PERIOD_ID}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: { failed_attempts: 2, locked_until: null },
      },
    );

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

    // Attempt 3 — wrong PIN against pre-populated failed_attempts=2 → lockout.
    await jury.fillPin("0000");
    await jury.submitPin();
    await jury.waitForLockedStep();
    await expect(jury.lockedScreen()).toBeVisible();

    const auth = await readJurorAuth(jurorId, EVAL_PERIOD_ID);
    expect(auth.failed_attempts).toBe(3);
    expect(new Date(auth.locked_until!).getTime()).toBeGreaterThan(Date.now());
  });
});
