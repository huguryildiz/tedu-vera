import { test, expect, type Page } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";
import { JuryEvalPom } from "../poms/JuryEvalPom";
import {
  setupScoringFixture,
  teardownScoringFixture,
  generateEntryToken,
  type ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient, readRubricScores } from "../helpers/supabaseAdmin";

/**
 * P0-E5 — Jury offline → reconnect → autosave flush.
 *
 * Architecture § 1 risk #4 (jury-day reliability): one juror loses
 * connectivity mid-evaluation and recovers. concurrent-jury.spec.ts covers
 * parallel writes from many jurors; this spec covers solo offline recovery.
 *
 * What VERA does today (verified by this spec):
 *
 *   1. Short blips (≤ ~1.5 s) are absorbed transparently. upsertScore wraps
 *      the RPC in withRetry (3 attempts, 500/1000 ms backoff —
 *      see src/shared/api/juryApi.js:53 + src/shared/api/core/retry.js).
 *
 *   2. Longer outages exhaust withRetry. The catch path in writeGroup
 *      (src/jury/shared/useJuryAutosave.js) sets saveStatus="error" and
 *      DOES NOT update lastWrittenRef[pid]. The new snapshot stays in
 *      pendingScoresRef but is never re-emitted automatically — there is no
 *      'online' event listener and no retry queue.
 *
 *   3. Recovery for longer outages happens implicitly on the next
 *      snapshot-changing user action (any blur with a different value, group
 *      navigation, or visibilitychange). Because lastWrittenRef[pid] is
 *      stale, writeGroup re-emits the FULL pending snapshot — including the
 *      values typed while offline — and persists everything in one round
 *      trip.
 *
 * The test below walks all four phases (online → long offline → reconnect →
 * user action) and asserts the DB state at each boundary. A 3-second offline
 * window is used to deliberately exceed withRetry's tolerance so that
 * recovery can ONLY come from the user-action path (phase 4), not from the
 * implicit retry.
 */
test.describe("jury offline → reconnect → autosave flush (P0-E5)", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;
  let entryToken: string;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({
      jurors: 1,
      namePrefix: "OfflineReconnect",
      // Default aMax=30, bMax=70 → score values up to 30 / 70 are valid.
    });
    entryToken = await generateEntryToken(fixture.periodId);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  // Reset fixture state before every test so the auth flow always starts at
  // pin_hash=NULL (auto-generate path) and score_sheets is empty.
  test.beforeEach(async () => {
    const { error: authErr } = await adminClient
      .from("juror_period_auth")
      .update({
        pin_hash: null,
        session_token_hash: null,
        session_expires_at: null,
        failed_attempts: 0,
        locked_until: null,
        final_submitted_at: null,
        edit_enabled: false,
        edit_reason: null,
        edit_expires_at: null,
      })
      .eq("juror_id", fixture.jurorId)
      .eq("period_id", fixture.periodId);
    if (authErr) throw new Error(`reset juror_period_auth failed: ${authErr.message}`);

    const { error: sheetErr } = await adminClient
      .from("score_sheets")
      .delete()
      .eq("juror_id", fixture.jurorId)
      .eq("period_id", fixture.periodId);
    if (sheetErr) throw new Error(`clear score_sheets failed: ${sheetErr.message}`);
  });

  async function navigateToEval(page: Page): Promise<JuryEvalPom> {
    // Suppress all jury SpotlightTour steps so they never block interactions.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("dj_tour_done", "1");
        sessionStorage.setItem("dj_tour_eval", "1");
        sessionStorage.setItem("dj_tour_rubric", "1");
        sessionStorage.setItem("dj_tour_confirm", "1");
        sessionStorage.setItem("dj_tour_pin", "1");
      } catch {}
    });

    const jury = new JuryPom(page);

    // Entry-token gate → arrival → identity (online — auth must succeed).
    await page.goto(`/demo/eval?t=${encodeURIComponent(entryToken)}`);
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity(fixture.jurorNames[0], fixture.jurorAffiliations[0]);
    await jury.submitIdentity();

    // pin_hash starts NULL → rpc_jury_authenticate auto-generates a PIN and
    // navigates to the pin-reveal screen instead of the pin-entry screen.
    await jury.waitForPinRevealStep();
    await jury.clickBeginEvaluation();

    await jury.waitForProgressStep();
    await jury.progressAction().click();

    const evalPom = new JuryEvalPom(page);
    await evalPom.waitForEvalStep();
    return evalPom;
  }

  test("offline write recovers via subsequent user action after reconnect", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    const evalPom = await navigateToEval(page);

    const inputs = evalPom.allScoreInputs();
    const inputCount = await inputs.count();
    expect(
      inputCount,
      "fixture must expose at least 2 score inputs",
    ).toBeGreaterThanOrEqual(2);

    // ── Phase 1 — ONLINE: baseline write of input[0]. ──
    await inputs.nth(0).fill("4");
    await inputs.nth(0).blur();
    await expect(evalPom.saveStatusSaving()).toBeVisible({ timeout: 8_000 });
    await expect(evalPom.saveStatusSaving()).not.toBeVisible({ timeout: 10_000 });

    {
      const rows = await readRubricScores(fixture.jurorId, fixture.periodId);
      const items = rows.flatMap((r: any) => r.score_sheet_items ?? []);
      expect(
        items.map((i: any) => Number(i.score_value)),
        "online baseline write must persist",
      ).toEqual(expect.arrayContaining([4]));
    }

    // ── Phase 2 — OFFLINE: write input[1]. The blur fires writeGroup, which
    //    awaits upsertScore → withRetry. With a 3-second offline window we
    //    deliberately exceed withRetry's ~1.5 s tolerance (3 attempts +
    //    500/1000 ms backoff), so all retries exhaust and the catch path
    //    fires. The new value stays in pendingScoresRef but never reaches
    //    the DB.
    await context.setOffline(true);
    await inputs.nth(1).fill("9");
    await inputs.nth(1).blur();
    await page.waitForTimeout(3_000);

    {
      const rows = await readRubricScores(fixture.jurorId, fixture.periodId);
      const items = rows.flatMap((r: any) => r.score_sheet_items ?? []);
      expect(
        items.some((i: any) => Number(i.score_value) === 9),
        "value typed while offline must NOT have reached the DB",
      ).toBe(false);
    }

    // ── Phase 3 — RECONNECT, no user action yet. There is no 'online' event
    //    listener / retry queue, so the value still does not flush on its
    //    own. Wait long enough that any in-flight retry would have settled.
    await context.setOffline(false);
    await page.waitForTimeout(2_000);

    {
      const rows = await readRubricScores(fixture.jurorId, fixture.periodId);
      const items = rows.flatMap((r: any) => r.score_sheet_items ?? []);
      expect(
        items.some((i: any) => Number(i.score_value) === 9),
        "without user action, withRetry-exhausted offline write does NOT auto-flush after reconnect",
      ).toBe(false);
    }

    // ── Phase 4 — USER ACTION: re-blur the offline input. Because
    //    lastWrittenRef[pid] was never updated (the prior writes failed),
    //    the new snapshot key differs and writeGroup emits the FULL pending
    //    state — including the value typed while offline.
    await inputs.nth(1).click();
    await inputs.nth(1).fill("9");
    await inputs.nth(1).blur();

    await expect(evalPom.saveStatusSaving()).toBeVisible({ timeout: 10_000 });
    await expect(evalPom.saveStatusSaving()).not.toBeVisible({ timeout: 10_000 });

    {
      const rows = await readRubricScores(fixture.jurorId, fixture.periodId);
      const items = rows.flatMap((r: any) => r.score_sheet_items ?? []);
      const values = items.map((i: any) => Number(i.score_value)).sort((a, b) => a - b);
      expect(
        values,
        "after reconnect + user action, both values must be persisted",
      ).toEqual(expect.arrayContaining([4, 9]));
    }
  });
});
