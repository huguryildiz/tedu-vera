import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";

test.describe("jury happy path", () => {
  test.describe.configure({ mode: "serial" });

  const uniqueJurorName = (label: string) => `E2E Happy ${label} ${Date.now()}`;

  test("token verification navigates to identity step", async ({ page }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await expect(jury.nameInput()).toBeVisible();
  });

  test("identity form reveals the generated session PIN", async ({ page }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity(uniqueJurorName("pin-reveal"), "E2E Test");
    await jury.submitIdentity();
    await jury.waitForPinRevealStep();
  });

  test("begin evaluation from PIN reveal navigates to progress step", async ({ page }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity(uniqueJurorName("progress"), "E2E Test");
    await jury.submitIdentity();
    await jury.waitForPinRevealStep();
    await jury.clickBeginEvaluation();
    await jury.waitForProgressStep();
    await expect(jury.progressAction()).toBeVisible();
  });
});
