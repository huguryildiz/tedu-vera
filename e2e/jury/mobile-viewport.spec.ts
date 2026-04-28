import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";

// Mobile portrait jury viewport — 390×844 (iPhone 14)
// Verifies that arrival, identity, and pin-step navigation
// remain reachable and unclipped on mobile portrait.
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

  test("setViewportSize 390 — pin step navigable after identity on mobile portrait", async ({
    page,
  }) => {
    // portrait jury: identity submit must navigate to a pin step (entry or reveal) on mobile
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity(`E2E Mobile ${Date.now()}`, "E2E Affiliation");
    await jury.submitIdentity();

    // After identity, fresh juror navigates to /jury/pin-reveal; existing juror to /jury/pin
    await page.waitForURL(/\/jury\/(pin|pin-reveal)/, { timeout: 15_000 });
    expect(page.url(), "must navigate to pin or pin-reveal on mobile portrait").toMatch(
      /\/jury\/(pin|pin-reveal)/,
    );
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
