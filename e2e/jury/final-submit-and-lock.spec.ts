import { test, expect } from "@playwright/test";
import {
  setupScoringFixture,
  teardownScoringFixture,
  writeScoresAsJuror,
  ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient, seedJurorSession, setJurorEditMode } from "../helpers/supabaseAdmin";
import { JuryPom } from "../poms/JuryPom";

const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

test.describe("jury final-submit-and-lock flow", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture | null = null;

  test.beforeAll(async () => {
    fixture = await setupScoringFixture({ namePrefix: "E5 Final Submit" });
    // Seed scores so the juror has something to submit
    await writeScoresAsJuror(fixture, {
      p1: { a: 20, b: 30 },
      p2: { a: 15, b: 25 },
    });
  });

  test.afterAll(async () => {
    await teardownScoringFixture(fixture);
  });

  test("juror completes evaluation → clicks final-submit → final_submitted_at is set", async ({
    page,
  }) => {
    if (!fixture) throw new Error("Fixture not set up");

    // Seed a juror session token
    const sessionToken = await seedJurorSession(fixture.jurorId, fixture.periodId);

    // Navigate to jury flow entry point
    const jury = new JuryPom(page);
    await jury.goto();

    // Step through identity → period → pin → progress
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();

    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Final Submit", "E2E Test");
    await jury.submitIdentity();

    await jury.waitForPeriodStep();
    await jury.selectPeriod();

    // Skip PIN step (not required for demo flow)
    // If we hit PIN step, submit it
    try {
      await jury.waitForPinStep({ timeout: 2000 });
      await jury.fillPin("0000");
      await jury.submitPin();
    } catch {
      // No PIN step — continue
    }

    // Wait for progress check step
    await jury.waitForProgressCheckStep();
    await jury.proceedFromProgressCheck();

    // Should now be in evaluate step
    await jury.waitForEvaluateStep();

    // Fill scores for all projects/criteria
    // This is a simplified fill — the exact selector depends on the Jury UI
    const scoreInputs = page.locator("[data-testid*='score-input']");
    const count = await scoreInputs.count();
    for (let i = 0; i < count; i++) {
      const input = scoreInputs.nth(i);
      // Fill with a test value
      await input.fill("50");
    }

    // Click the final-submit button
    const finalSubmitBtn = page.locator(`[data-testid="jury-final-submit"]`);
    if (await finalSubmitBtn.isVisible({ timeout: 2000 })) {
      await finalSubmitBtn.click();

      // Confirm if there's a confirmation dialog
      const confirmBtn = page.locator(`[data-testid="jury-submit-confirm"]`);
      if (await confirmBtn.isVisible({ timeout: 2000 })) {
        await confirmBtn.click();
      }
    }

    // Wait for success/locked state
    await jury.waitForDoneStep({ timeout: 15000 });

    // Verify DB: final_submitted_at is NOT NULL
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

  test("re-visiting the evaluation shows submitted/locked state (read-only)", async ({
    page,
  }) => {
    if (!fixture) throw new Error("Fixture not set up");

    // Re-navigate to the jury flow
    const jury = new JuryPom(page);
    await jury.goto();

    // Step through the same flow
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();

    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Final Submit", "E2E Test");
    await jury.submitIdentity();

    await jury.waitForPeriodStep();
    await jury.selectPeriod();

    // Skip PIN if not required
    try {
      await jury.waitForPinStep({ timeout: 2000 });
      await jury.fillPin("0000");
      await jury.submitPin();
    } catch {
      // No PIN step
    }

    await jury.waitForProgressCheckStep();
    await jury.proceedFromProgressCheck();

    // Should see evaluate step with read-only UI
    await jury.waitForEvaluateStep();

    // Verify score inputs are disabled (read-only)
    const scoreInputs = page.locator("[data-testid*='score-input']");
    const firstInput = scoreInputs.first();
    const isDisabled = await firstInput.isDisabled();
    expect(isDisabled).toBe(true);

    // Final submit button should not be visible
    const finalSubmitBtn = page.locator(`[data-testid="jury-final-submit"]`);
    await expect(finalSubmitBtn).not.toBeVisible();

    // Should show a "submitted" or "locked" banner
    const submittedBanner = page.locator(`[data-testid="jury-submitted-banner"]`);
    await expect(submittedBanner).toBeVisible();
  });
});
