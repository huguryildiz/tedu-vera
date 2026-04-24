import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";
import { JuryEvalPom } from "../poms/JuryEvalPom";
import {
  resetJurorAuth,
  readRubricScores,
} from "../helpers/supabaseAdmin";
import { EVAL_PERIOD_ID, EVAL_JURORS } from "../fixtures/seed-ids";

// Dedicated juror for reload-persistence tests. Uses "E2E Eval Blur" because
// resetJurorAuth + score_sheet cleanup share that juror with evaluate.spec
// and share the same F1-compliant reset pattern.
const RESUME_JUROR = EVAL_JURORS[1]; // E2E Eval Blur
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

test.describe("jury resume", () => {
  test.describe.configure({ mode: "serial" });

  test('returning juror sees "Welcome Back" on progress step', async ({
    page,
  }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Juror", "E2E Test");
    await jury.submitIdentity();
    await jury.waitForPinStep();
    await jury.fillPin("9999");
    await jury.submitPin();
    await jury.waitForProgressStep();
    await expect(jury.progressTitle()).toHaveText("Welcome Back");
  });

  // ── E5: page.reload() persistence ──────────────────────────────────────────
  test.describe("browser refresh persistence", () => {
    test.beforeEach(async ({ request }) => {
      // Reset juror state (F1: includes session_token_hash: null via
      // resetJurorAuth, plus edit flags) and clear prior score_sheets so a
      // blur-write assertion sees a fresh row.
      await resetJurorAuth(RESUME_JUROR.id, EVAL_PERIOD_ID);
      await request.delete(
        `${SUPABASE_URL}/rest/v1/score_sheets?juror_id=eq.${RESUME_JUROR.id}&period_id=eq.${EVAL_PERIOD_ID}`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: "return=minimal",
          },
        },
      );
    });

    async function installTourBypass(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem("dj_tour_done", "1");
          sessionStorage.setItem("dj_tour_eval", "1");
          sessionStorage.setItem("dj_tour_rubric", "1");
          sessionStorage.setItem("dj_tour_confirm", "1");
        } catch {}
      });
    }

    async function authToProgress(
      page: Parameters<Parameters<typeof test>[1]>[0]["page"],
      jurorName: string,
    ) {
      const jury = new JuryPom(page);
      await jury.waitForArrivalStep();
      await jury.clickBeginSession();
      await jury.waitForIdentityStep();
      await jury.fillIdentity(jurorName, "E2E Org");
      await jury.submitIdentity();
      await jury.waitForPinStep();
      await jury.fillPin("9999");
      await jury.submitPin();
      await jury.waitForProgressStep();
      return jury;
    }

    test("reload restarts UI at arrival — DB-backed session state survives and re-auth returns to progress", async ({ page }) => {
      // The jury UI flow intentionally restarts from arrival on reload (step
      // state is not persisted in localStorage). This test pins that contract
      // and also verifies the server-side session (juror_period_auth row)
      // survives a reload so re-authenticating lands directly on progress
      // — proving DB state, not UI state, is the source of truth.
      await installTourBypass(page);
      const jury = new JuryPom(page);
      await jury.goto();
      await authToProgress(page, RESUME_JUROR.name);
      await expect(jury.progressTitle()).toBeVisible();

      await page.reload();

      // Contract: reload lands on /demo/jury/arrival, not /demo/jury/progress.
      await page.waitForURL(/\/demo\/jury\/arrival/, { timeout: 10_000 });
      await expect(jury.arrivalBeginBtn()).toBeVisible();

      // Re-auth (identity+PIN) must land back on progress, proving the DB-side
      // session (juror_period_auth + score_sheets) wasn't wiped by the reload.
      await authToProgress(page, RESUME_JUROR.name);
      await expect(jury.progressTitle()).toBeVisible();
    });

    test("eval step — reload + re-auth restores persisted score value from server", async ({ page }) => {
      await installTourBypass(page);
      const jury = new JuryPom(page);
      await jury.goto();
      await authToProgress(page, RESUME_JUROR.name);
      await jury.progressAction().click();

      const evalPom = new JuryEvalPom(page);
      await evalPom.waitForEvalStep();

      const firstInput = evalPom.allScoreInputs().first();
      await firstInput.fill("7");
      await firstInput.blur();

      // Wait for autosave to hit the DB (saving pill appears then clears).
      await expect(evalPom.saveStatusSaving()).toBeVisible({ timeout: 5_000 });
      await expect(evalPom.saveStatusSaving()).not.toBeVisible({ timeout: 8_000 });

      // Server-side confirmation: a score_sheet_item with value 7 now exists.
      const rowsBefore = await readRubricScores(RESUME_JUROR.id, EVAL_PERIOD_ID);
      expect(rowsBefore.length).toBeGreaterThan(0);
      const itemsBefore = rowsBefore.flatMap((r: any) => r.score_sheet_items ?? []);
      expect(itemsBefore.some((i: any) => Number(i.score_value) === 7)).toBe(true);

      await page.reload();

      // UI restarts at arrival — re-authenticate and navigate back to eval.
      await authToProgress(page, RESUME_JUROR.name);
      await jury.progressAction().click();
      await evalPom.waitForEvalStep();

      // The persisted DB value should be rehydrated into the input —
      // proving the juror can pick up where they left off on any new device.
      const value = await evalPom.allScoreInputs().first().inputValue();
      expect(value).toBe("7");
    });
  });
});
