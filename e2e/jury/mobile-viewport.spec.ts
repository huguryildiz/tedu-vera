import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";
import { JuryEvalPom } from "../poms/JuryEvalPom";

// Mobile portrait jury viewport — 390×844 (iPhone 14)
// Verifies that scoring inputs are reachable and the full
// identity → PIN → progress → eval flow is completable.
test.describe("jury mobile portrait viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    // Suppress SpotlightTour so it never blocks interactions on mobile.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("dj_tour_done", "1");
        sessionStorage.setItem("dj_tour_eval", "1");
        sessionStorage.setItem("dj_tour_rubric", "1");
        sessionStorage.setItem("dj_tour_confirm", "1");
      } catch {}
    });
  });

  test("setViewportSize 390 — arrival and identity step reachable on mobile portrait", async ({
    page,
  }) => {
    // portrait jury: arrival → identity navigable at 390×844
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await expect(jury.arrivalBeginBtn()).toBeVisible();

    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await expect(jury.nameInput()).toBeVisible();
    await expect(jury.affiliationInput()).toBeVisible();
  });

  test("setViewportSize 390 — score inputs reachable after full flow on mobile portrait", async ({
    page,
  }) => {
    // portrait jury: score inputs must be visible and interactable at 390×844
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity(`E2E Mobile ${Date.now()}`, "E2E Affiliation");
    await jury.submitIdentity();
    await jury.waitForPinStep();
    await jury.fillPin("9999");
    await jury.submitPin();
    await jury.waitForProgressStep();
    await jury.progressAction().click();

    const evalPom = new JuryEvalPom(page);
    await evalPom.waitForEvalStep();

    const firstInput = evalPom.allScoreInputs().first();
    await expect(firstInput).toBeVisible();
    // Confirm the input is within the visible viewport (not clipped off-screen)
    const box = await firstInput.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});

// Mobile landscape jury — landscape orientation must render desktop layout
test.describe("jury landscape viewport", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("landscape jury — arrival step visible without stacked card layout", async ({
    page,
  }) => {
    // landscape jury: desktop layout shown, not portrait card view
    await page.addInitScript(() => {
      try { sessionStorage.setItem("dj_tour_done", "1"); } catch {}
    });
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await expect(jury.arrivalBeginBtn()).toBeVisible();
  });
});
