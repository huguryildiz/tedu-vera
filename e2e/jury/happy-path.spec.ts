import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";

test.describe("jury happy path", () => {
  test.describe.configure({ mode: "serial" });

  test("token verification navigates to identity step", async ({ page }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await expect(jury.nameInput()).toBeVisible();
  });

  test("identity form navigates to PIN step", async ({ page }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Juror", "E2E Test");
    await jury.submitIdentity();
    await jury.waitForPinStep();
    await expect(jury.pinInput(0)).toBeVisible();
  });

  test("correct PIN navigates to progress step", async ({ page }) => {
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
    await expect(jury.progressAction()).toBeVisible();
  });
});
