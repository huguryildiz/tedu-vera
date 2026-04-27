import { test, expect } from "@playwright/test";
import {
  setupScoringFixture,
  teardownScoringFixture,
  generateEntryToken,
  ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient, seedJurorSession } from "../helpers/supabaseAdmin";
import { JuryPom } from "../poms/JuryPom";
import { JuryEvalPom } from "../poms/JuryEvalPom";
import { JuryCompletePom } from "../poms/JuryCompletePom";

const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

test.describe("jury final-submit-and-lock flow", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture | null = null;
  let entryToken: string | null = null;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({ namePrefix: "E5 Final Submit" });
    entryToken = await generateEntryToken(fixture.periodId);
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  test("juror completes evaluation → final_submitted_at is set", async ({ page }) => {
    if (!fixture || !entryToken) throw new Error("Fixture not set up");

    // Suppress all jury SpotlightTour steps so they never block interactions
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("dj_tour_done", "1");
        sessionStorage.setItem("dj_tour_eval", "1");
        sessionStorage.setItem("dj_tour_rubric", "1");
        sessionStorage.setItem("dj_tour_confirm", "1");
        sessionStorage.setItem("dj_tour_pin", "1");
        sessionStorage.setItem("spotlight_tour_completed", "1");
        sessionStorage.setItem("tour_completed", "1");
        (window as any).disableSpotlightTour = true;
      } catch {}
    });

    const jury = new JuryPom(page);

    // Navigate to eval gate with the fixture's entry token (not the hardcoded e2e-jury-token)
    await page.goto(`${APP_BASE}/demo/eval?t=${encodeURIComponent(entryToken)}`);
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();

    // Fill identity using fixture-provided values for juror 0
    await jury.fillIdentity(fixture.jurorNames[0], fixture.jurorAffiliations[0]);

    // Capture pin_plain_once from rpc_jury_authenticate before submitting identity
    let authResponse: Record<string, unknown> | null = null;
    page.on("response", async (response) => {
      if (response.url().includes("rpc_jury_authenticate")) {
        try {
          authResponse = await response.json();
        } catch {
          // response already consumed or not JSON
        }
      }
    });

    await jury.submitIdentity();

    // Give the response listener a moment to capture the payload
    await page.waitForTimeout(200);

    // pin_hash = null in fixture → RPC auto-generates PIN and navigates to pin-reveal
    await jury.waitForPinRevealStep();

    // Click "Begin Evaluation" to proceed past the PIN reveal screen
    await jury.clickBeginEvaluation();

    // Progress step
    await jury.waitForProgressStep();
    await jury.progressAction().click();

    // Evaluate step — score all projects across all segments
    const evalPom = new JuryEvalPom(page);
    await evalPom.waitForEvalStep();

    const segments = page.locator(".dj-seg");
    const segCount = await segments.count();
    const iterations = segCount > 0 ? segCount : 1;

    for (let s = 0; s < iterations; s++) {
      if (segCount > 0) {
        await segments.nth(s).click();
        await expect(page.locator(".dj-group-bar-num")).toContainText(`${s + 1}/`, {
          timeout: 10_000,
        });
        await page.waitForTimeout(200);
      }

      const inputs = evalPom.allScoreInputs();
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        await input.fill("5");
        input.blur().catch(() => {});
      }
    }

    // Wait for blur RPCs to settle before checking the all-complete banner
    await page.waitForTimeout(1500);

    await page
      .locator('[data-testid="jury-eval-all-complete-banner"]')
      .waitFor({ timeout: 15_000 });

    // Submit → confirm → complete screen
    await evalPom.clickSubmit();
    await evalPom.clickConfirmSubmit();

    const complete = new JuryCompletePom(page);
    await complete.waitForCompleteStep();

    // Verify DB: final_submitted_at is stamped
    const { data: auth, error: authErr } = await adminClient
      .from("juror_period_auth")
      .select("final_submitted_at")
      .eq("juror_id", fixture.jurorId)
      .eq("period_id", fixture.periodId)
      .single();

    expect(authErr).toBeNull();
    expect(auth?.final_submitted_at).toBeTruthy();
    expect(new Date(auth?.final_submitted_at || "").getTime()).toBeGreaterThan(0);
  });

  test("final_submitted_at persists — juror cannot re-submit", async () => {
    if (!fixture) throw new Error("Fixture not set up");

    // Direct DB assertion: submission state survives after the test ends.
    // The UI read-only enforcement is covered by EvalStep unit tests.
    const { data: auth, error } = await adminClient
      .from("juror_period_auth")
      .select("final_submitted_at")
      .eq("juror_id", fixture.jurorId)
      .eq("period_id", fixture.periodId)
      .single();

    expect(error).toBeNull();
    expect(auth?.final_submitted_at).toBeTruthy();
    expect(new Date(auth?.final_submitted_at || "").getTime()).toBeGreaterThan(0);
  });

  test("post-submit upsert returns final_submit_required and score is unchanged", async () => {
    // Why this test exists: rpc_jury_upsert_score (sql/migrations/005_rpcs_jury.sql:557-559)
    // returns error_code='final_submit_required' when final_submitted_at is set and
    // edit_enabled stays at its default (false). The mechanism is critical for juror
    // score immutability post-submission, and edit-mode.spec.ts only covers the
    // *positive* (admin-enabled) and *expired-window* paths. This test fills the
    // default-state-reject gap that the post-submit lock contract depends on.
    if (!fixture) throw new Error("Fixture not set up");

    // Pre-state: final_submitted_at is already set by the prior test. Confirm
    // edit_enabled is false (the default) so the gate fires for the right
    // reason — not because the window expired.
    const { data: pre } = await adminClient
      .from("juror_period_auth")
      .select("edit_enabled, final_submitted_at")
      .eq("juror_id", fixture.jurorId)
      .eq("period_id", fixture.periodId)
      .single();
    expect(pre?.edit_enabled ?? false).toBe(false);
    expect(pre?.final_submitted_at).toBeTruthy();

    // Capture the existing score values before the rejected attempt so we can
    // assert immutability afterwards.
    const { data: scoresBefore } = await adminClient
      .from("score_sheets")
      .select("id, score_sheet_items(criterion_id, score_value)")
      .eq("juror_id", fixture.jurorId)
      .eq("project_id", fixture.p1Id);
    const sheetIdBefore = scoresBefore?.[0]?.id;
    const valuesBefore = (scoresBefore?.[0]?.score_sheet_items ?? []).map(
      (it: { criterion_id: string; score_value: number }) => ({
        criterion_id: it.criterion_id,
        score_value: it.score_value,
      })
    );
    expect(sheetIdBefore, "score sheet must exist from the submit flow").toBeTruthy();
    expect(valuesBefore.length, "at least one score item expected").toBeGreaterThan(0);

    // Mint a fresh session token directly (we don't have the original one
    // from the UI flow, and rpc_jury_upsert_score validates session_token_hash).
    const sessionToken = await seedJurorSession(fixture.jurorId, fixture.periodId);

    // Attempt to overwrite scores with a totally different value via the RPC.
    const tamperingScores = [
      { key: fixture.criteriaAKey, value: 1 },
      { key: fixture.criteriaBKey, value: 1 },
    ];

    const { data, error } = await adminClient.rpc("rpc_jury_upsert_score", {
      p_period_id: fixture.periodId,
      p_project_id: fixture.p1Id,
      p_juror_id: fixture.jurorId,
      p_session_token: sessionToken,
      p_scores: tamperingScores,
      p_comment: "post-submit tampering attempt",
    });

    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(false);
    expect(data?.error_code).toBe("final_submit_required");

    // Idempotency: a second call still rejects (no leak from first attempt).
    const second = await adminClient.rpc("rpc_jury_upsert_score", {
      p_period_id: fixture.periodId,
      p_project_id: fixture.p1Id,
      p_juror_id: fixture.jurorId,
      p_session_token: sessionToken,
      p_scores: tamperingScores,
      p_comment: null,
    });
    expect(second.data?.ok).toBe(false);
    expect(second.data?.error_code).toBe("final_submit_required");

    // Confirm the original scores are untouched.
    const { data: scoresAfter } = await adminClient
      .from("score_sheets")
      .select("id, score_sheet_items(criterion_id, score_value)")
      .eq("juror_id", fixture.jurorId)
      .eq("project_id", fixture.p1Id);
    const valuesAfter = (scoresAfter?.[0]?.score_sheet_items ?? []).map(
      (it: { criterion_id: string; score_value: number }) => ({
        criterion_id: it.criterion_id,
        score_value: it.score_value,
      })
    );

    // Sort both for stable comparison since order is not guaranteed.
    const sortByCrit = (
      a: { criterion_id: string },
      b: { criterion_id: string }
    ) => a.criterion_id.localeCompare(b.criterion_id);
    valuesBefore.sort(sortByCrit);
    valuesAfter.sort(sortByCrit);

    expect(valuesAfter).toEqual(valuesBefore);
  });
});
