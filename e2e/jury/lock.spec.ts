import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";

test.describe("jury lock screen", () => {
  test.describe.configure({ mode: "serial" });

  test("blocked juror sees locked screen after PIN submit", async ({ page }) => {
    const jury = new JuryPom(page);
    await jury.goto();
    await jury.waitForArrivalStep();
    await jury.clickBeginSession();
    await jury.waitForIdentityStep();
    await jury.fillIdentity("E2E Locked Juror", "E2E Test");
    await jury.submitIdentity();
    await jury.waitForPinStep();
    await jury.fillPin("9999");
    await jury.submitPin();
    await jury.waitForLockedStep();
    await expect(jury.lockedScreen()).toBeVisible();
  });
});
