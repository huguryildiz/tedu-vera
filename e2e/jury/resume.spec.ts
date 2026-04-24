import { test, expect } from "@playwright/test";
import { JuryPom } from "../poms/JuryPom";

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
});
