import { test, expect } from "@playwright/test";
import {
  freshJurorEntryFlow,
  juryFlowToPin,
  juryFlowFromPinRevealToProgress,
  juryFlowFromProgressToEvaluate,
  setMobileViewport,
  captureScreenshot,
} from "./_helpers";

// Jury product-tour: 7 tests, 9 PNGs (steps 6 + 7 each emit desktop + mobile-portrait).
// Uses freshJurorEntryFlow() which creates a new juror on every run — daily demo seed reset reverts.

test("jury tour: 01 arrival", async ({ page }) => {
  await freshJurorEntryFlow(page);
  await captureScreenshot(page, "jury/01-arrival.png");
});

test("jury tour: 02 identity", async ({ page }) => {
  await freshJurorEntryFlow(page);
  await page.getByTestId("jury-arrival-begin").click();
  await expect(page.getByTestId("jury-name-input")).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "jury/02-identity.png");
});

test("jury tour: 03 pin entry", async ({ page }) => {
  // Two-pass: fresh jurors land on /pin-reveal; returning jurors (pin_reveal_shown=true) land on /pin.
  // First pass creates the juror and completes pin-reveal, second pass re-enters to reach /pin.
  const jurorName = `Tour Demo Pin ${Date.now()}`;
  await juryFlowToPin(page, jurorName);
  await juryFlowFromPinRevealToProgress(page);
  // Re-enter as same juror → routes to /pin (PIN entry screen).
  await freshJurorEntryFlow(page);
  await page.getByTestId("jury-arrival-begin").click();
  await expect(page.getByTestId("jury-name-input")).toBeVisible();
  await page.getByTestId("jury-name-input").fill(jurorName);
  await page.getByTestId("jury-affiliation-input").fill("Demo University");
  await page.getByTestId("jury-identity-submit").click();
  await page.waitForURL(/\/demo\/jury\/pin$/, { timeout: 15_000 });
  await expect(page.getByTestId("jury-pin-input-0")).toBeVisible({ timeout: 10_000 });
  await captureScreenshot(page, "jury/03-pin.png");
});

test("jury tour: 04 pin reveal", async ({ page }) => {
  await juryFlowToPin(page);
  await page.waitForURL(/\/demo\/jury\/pin-reveal/, { timeout: 15_000 });
  await expect(page.locator("button:has-text('Begin Evaluation')")).toBeVisible({ timeout: 10_000 });
  await captureScreenshot(page, "jury/04-pin-reveal.png");
});

test("jury tour: 05 progress", async ({ page }) => {
  await juryFlowToPin(page);
  await juryFlowFromPinRevealToProgress(page);
  await expect(page.getByTestId("jury-progress-title")).toBeVisible();
  await captureScreenshot(page, "jury/05-progress.png");
});

test("jury tour: 06 evaluate (desktop + mobile)", async ({ page }) => {
  // Desktop capture
  await juryFlowToPin(page);
  await juryFlowFromPinRevealToProgress(page);
  await juryFlowFromProgressToEvaluate(page);
  await captureScreenshot(page, "jury/06-evaluate.png");

  // Mobile capture — fresh context via new juror name
  await setMobileViewport(page);
  await juryFlowToPin(page, `Tour Demo Mobile ${Date.now()}`);
  await juryFlowFromPinRevealToProgress(page);
  await juryFlowFromProgressToEvaluate(page);
  await captureScreenshot(page, "jury/06-evaluate-mobile.png");
});

test("jury tour: 07 complete (desktop + mobile)", async ({ page }) => {
  // Navigate to evaluate step and fill all scores to enable the submit button
  await juryFlowToPin(page);
  await juryFlowFromPinRevealToProgress(page);
  await juryFlowFromProgressToEvaluate(page);

  // Fill every visible score input with a passing score so submit becomes enabled
  const scoreInputs = page.locator("[data-testid^='jury-eval-score-']");
  const count = await scoreInputs.count();
  for (let i = 0; i < count; i++) {
    const input = scoreInputs.nth(i);
    const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "input") {
      await input.fill("80");
      await input.blur();
    }
  }

  // Wait for the submit / next-project action to appear
  await expect(page.getByTestId("jury-eval-submit")).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "jury/07-complete.png");

  // Mobile capture
  await setMobileViewport(page);
  await juryFlowToPin(page, `Tour Demo Complete Mobile ${Date.now()}`);
  await juryFlowFromPinRevealToProgress(page);
  await juryFlowFromProgressToEvaluate(page);

  const mobileScoreInputs = page.locator("[data-testid^='jury-eval-score-']");
  const mobileCount = await mobileScoreInputs.count();
  for (let i = 0; i < mobileCount; i++) {
    const input = mobileScoreInputs.nth(i);
    const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "input") {
      await input.fill("80");
      await input.blur();
    }
  }
  await expect(page.getByTestId("jury-eval-submit")).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "jury/07-complete-mobile.png");
});
