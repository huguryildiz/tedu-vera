import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";
import { JuryEvalPom } from "../poms/JuryEvalPom";
import { JuryCompletePom } from "../poms/JuryCompletePom";
import { readRubricScores, deleteScoreSheetsForJurorPeriod } from "../helpers/supabaseAdmin";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Dedicated jurors pre-seeded in demo DB with PIN "9999"
const EVAL_JURORS = [
  { id: "b3aa250b-3049-4788-9c68-5fa0e8aec86a", name: "E2E Eval Render" },
  { id: "bbbbbbbb-e2e0-4000-b000-000000000001", name: "E2E Eval Blur" },
  { id: "bbbbbbbb-e2e0-4000-b000-000000000002", name: "E2E Eval Submit" },
];
const EVAL_PERIOD_ID = "a0d6f60d-ece4-40f8-aca2-955b4abc5d88";

test.describe("jury evaluate flow", () => {
  test.describe.configure({ mode: "serial" });

  // ID of the juror used exclusively by DB-validating C1 tests.
  const BLUR_JUROR_ID = "bbbbbbbb-e2e0-4000-b000-000000000001";

  test.beforeEach(async ({ request }) => {
    for (const { id } of EVAL_JURORS) {
      await request.patch(
        `${SUPABASE_URL}/rest/v1/juror_period_auth?juror_id=eq.${id}&period_id=eq.${EVAL_PERIOD_ID}`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          data: { failed_attempts: 0, locked_until: null, final_submitted_at: null, session_token_hash: null },
        },
      );
    }
    // Clean score_sheets only for the Blur juror used in C1 DB-validating tests,
    // so assertions on score_value always see a fresh write rather than stale rows.
    // score_sheet_items cascade-deletes automatically. Helper temporarily clears
    // activated_at so the block_score_sheet_delete trigger does not fire.
    await deleteScoreSheetsForJurorPeriod(BLUR_JUROR_ID, EVAL_PERIOD_ID);
  });

  async function navigateToEval(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
    jurorName: string,
  ) {
    // Suppress all jury SpotlightTour steps so they never block interactions.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("dj_tour_done", "1");
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
    await jury.fillIdentity(jurorName, "E2E Test Affiliation");
    await jury.submitIdentity();
    await jury.waitForPinStep();
    await jury.fillPin("9999");
    await jury.submitPin();
    await jury.waitForProgressStep();
    await jury.progressAction().click();
    return new JuryEvalPom(page);
  }

  test("eval step renders score inputs", async ({ page }) => {
    const evalPom = await navigateToEval(page, "E2E Eval Render");
    await evalPom.waitForEvalStep();
    const count = await evalPom.allScoreInputs().count();
    expect(count).toBeGreaterThan(0);
  });

  test("blur after score fill triggers autosave status", async ({ page }) => {
    const evalPom = await navigateToEval(page, "E2E Eval Blur");
    await evalPom.waitForEvalStep();
    const firstInput = evalPom.allScoreInputs().first();
    await firstInput.fill("7");
    await firstInput.blur();
    await expect(evalPom.saveStatus()).toBeVisible();
  });

  test("all projects scored → all-complete banner visible", async ({ page }) => {
    // Uses E2E Eval Submit juror (1 project) so fillAllScores covers all criteria.
    const evalPom = await navigateToEval(page, "E2E Eval Submit");
    await evalPom.waitForEvalStep();
    await evalPom.fillAllScores("5");
    await expect(evalPom.allCompleteBanner()).toBeVisible({ timeout: 5_000 });
  });

  test("fill all scores → confirm submission → complete screen", async ({ page }) => {
    const evalPom = await navigateToEval(page, "E2E Eval Submit");
    await evalPom.waitForEvalStep();
    await evalPom.fillAllScores("5");
    await evalPom.clickSubmit();
    await expect(evalPom.confirmSubmitBtn()).toBeVisible();
    await evalPom.clickConfirmSubmit();
    const complete = new JuryCompletePom(page);
    await complete.waitForCompleteStep();
    await complete.expectCompletionScreen();
  });

  // ── C1: DB round-trip validation ───────────────────────────────────────────

  test("onBlur → score_sheets DB row exists with correct value", async ({ page }) => {
    const evalPom = await navigateToEval(page, "E2E Eval Blur");
    await evalPom.waitForEvalStep();

    const firstInput = evalPom.allScoreInputs().first();
    await firstInput.fill("7");
    await firstInput.blur();

    // Wait for autosave cycle: saving pill appears then clears
    await expect(evalPom.saveStatusSaving()).toBeVisible({ timeout: 5_000 });
    await expect(evalPom.saveStatusSaving()).not.toBeVisible({ timeout: 8_000 });

    const jurorId = EVAL_JURORS.find((j) => j.name === "E2E Eval Blur")!.id;
    const rows = await readRubricScores(jurorId, EVAL_PERIOD_ID);

    expect(rows.length).toBeGreaterThan(0);
    const allItems = rows.flatMap((r: any) => r.score_sheet_items ?? []);
    expect(allItems.some((i: any) => Number(i.score_value) === 7)).toBe(true);
  });

  test("visibilitychange save → score_sheets DB row exists", async ({ page }) => {
    const evalPom = await navigateToEval(page, "E2E Eval Blur");
    await evalPom.waitForEvalStep();

    const firstInput = evalPom.allScoreInputs().first();
    await firstInput.fill("8");
    // Deliberately do NOT blur — visibilitychange should trigger the save instead.

    // Simulate tab becoming hidden: override visibilityState then dispatch the event.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Wait for the writeGroup RPC call to complete (triggered by visibilitychange).
    await page.waitForResponse(
      (r) =>
        r.url().includes("rest/v1/rpc/rpc_jury_upsert_score") &&
        r.status() === 200
    );

    const jurorId = EVAL_JURORS.find((j) => j.name === "E2E Eval Blur")!.id;
    const rows = await readRubricScores(jurorId, EVAL_PERIOD_ID);

    expect(rows.length).toBeGreaterThan(0);
    const allItems = rows.flatMap((r: any) => r.score_sheet_items ?? []);
    expect(allItems.some((i: any) => Number(i.score_value) === 8)).toBe(true);
  });

  test("deduplication: identical blur does not trigger a second RPC call", async ({ page }) => {
    const evalPom = await navigateToEval(page, "E2E Eval Blur");
    await evalPom.waitForEvalStep();

    let rpcCallCount = 0;
    await page.route("**/rest/v1/rpc/rpc_jury_upsert_score**", async (route) => {
      rpcCallCount++;
      await route.continue();
    });

    const firstInput = evalPom.allScoreInputs().first();

    // First blur — should trigger upsertScore (lastWrittenRef is empty).
    await firstInput.fill("6");
    await firstInput.blur();
    await expect(evalPom.saveStatusSaving()).toBeVisible({ timeout: 5_000 });
    await expect(evalPom.saveStatusSaving()).not.toBeVisible({ timeout: 8_000 });

    // Second blur with same value — lastWrittenRef key unchanged, RPC skipped.
    const countBeforeSecondBlur = rpcCallCount;
    await firstInput.fill("6");
    await firstInput.blur();

    // If deduplication works, the save status should NOT appear (no RPC = no save state).
    // Wait briefly to ensure the app has processed the blur, then verify the indicator never showed.
    await expect(evalPom.saveStatusSaving()).not.toBeVisible({ timeout: 2_000 });

    expect(rpcCallCount).toBe(countBeforeSecondBlur);
  });
});
