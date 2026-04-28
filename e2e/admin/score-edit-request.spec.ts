import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { JurorsPom } from "../poms/JurorsPom";
import {
  setupScoringFixture,
  teardownScoringFixture,
  finalizeJurors,
} from "../helpers/scoringFixture";
import { readJurorAuth } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

/**
 * Admin UI — reopen evaluation (EnableEditingModal)
 *
 * Validates the full admin-UI path for reopening a completed juror's
 * evaluation window: kebab → "Reopen Evaluation" → modal → fill reason +
 * duration → submit → DB row reflects edit_enabled = true.
 *
 * Risk: admin could accidentally block or fail to reopen a juror who needs
 * to correct scores on evaluation day; this spec proves the end-to-end path
 * works and the DB row is correctly set.
 */
test.describe("Admin reopen-evaluation flow", () => {
  test("admin reopens completed juror via EnableEditingModal; DB reflects edit_enabled", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const fixture = await setupScoringFixture({ jurors: 1, namePrefix: "EditFlow" });
    const jurorId = fixture.jurorIds[0];

    try {
      // Make the juror appear as "completed" so the kebab shows "Reopen Evaluation"
      await finalizeJurors(fixture);

      // Pre-assert: edit_enabled is false before admin acts
      const before = await readJurorAuth(jurorId, fixture.periodId);
      expect(before.edit_enabled).toBe(false);

      // Navigate admin to the jurors page for the fixture org
      await page.addInitScript(
        ({ orgId }) => {
          localStorage.setItem("vera.admin_tour_done", "1");
          localStorage.setItem("admin.remember_me", "true");
          localStorage.setItem("admin.active_organization_id", orgId);
        },
        { orgId: E2E_PERIODS_ORG_ID }
      );

      const login = new LoginPom(page);
      const shell = new AdminShellPom(page);
      const jurors = new JurorsPom(page);

      await login.goto();
      await login.signIn(EMAIL, PASSWORD);
      await shell.expectOnDashboard();
      await shell.clickNav("jurors");
      await jurors.waitForReady();

      const jurorName = fixture.jurorNames[0];
      await jurors.expectJurorRowVisible(jurorName);

      // Open kebab → click "Reopen Evaluation"
      await jurors.clickReopenForJuror(jurorName);

      // Modal should appear — duration input and reason textarea visible
      await expect(jurors.eemDurationInput()).toBeVisible({ timeout: 8_000 });
      await expect(jurors.eemReasonTextarea()).toBeVisible();

      // Enable button disabled until form is valid
      await expect(jurors.eemEnableBtn()).toBeDisabled();

      // Fill in a valid reason (≥5 chars) and leave default duration (30 min)
      await jurors.eemReasonTextarea().fill("Correcting criterion mismatch on evaluation day");

      // Enable button should now be active
      await expect(jurors.eemEnableBtn()).toBeEnabled({ timeout: 3_000 });

      // Submit
      await jurors.eemEnableBtn().click();

      // Modal closes on success (enable button disappears)
      await expect(jurors.eemEnableBtn()).not.toBeVisible({ timeout: 15_000 });

      // DB assertion: edit_enabled = true, edit_reason set, edit_expires_at in future
      const after = await readJurorAuth(jurorId, fixture.periodId);
      expect(after.edit_enabled).toBe(true);
      expect(after.edit_reason).toBeTruthy();
      expect(new Date(after.edit_expires_at!).getTime()).toBeGreaterThan(Date.now());
    } finally {
      await teardownScoringFixture(fixture);
    }
  });

  test("EnableEditingModal blocks submission when reason is too short", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const fixture = await setupScoringFixture({ jurors: 1, namePrefix: "EditVal" });
    const jurorId = fixture.jurorIds[0];

    try {
      await finalizeJurors(fixture);

      await page.addInitScript(
        ({ orgId }) => {
          localStorage.setItem("vera.admin_tour_done", "1");
          localStorage.setItem("admin.remember_me", "true");
          localStorage.setItem("admin.active_organization_id", orgId);
        },
        { orgId: E2E_PERIODS_ORG_ID }
      );

      const login = new LoginPom(page);
      const shell = new AdminShellPom(page);
      const jurors = new JurorsPom(page);

      await login.goto();
      await login.signIn(EMAIL, PASSWORD);
      await shell.expectOnDashboard();
      await shell.clickNav("jurors");
      await jurors.waitForReady();

      const jurorName = fixture.jurorNames[0];
      await jurors.expectJurorRowVisible(jurorName);
      await jurors.clickReopenForJuror(jurorName);

      await expect(jurors.eemDurationInput()).toBeVisible({ timeout: 8_000 });

      // Reason too short (< 5 chars) — button must stay disabled
      await jurors.eemReasonTextarea().fill("hi");
      await expect(jurors.eemEnableBtn()).toBeDisabled();

      // Cancel — DB must be unchanged
      await jurors.eemCancelBtn().click();
      await expect(jurors.eemEnableBtn()).not.toBeVisible({ timeout: 5_000 });

      const auth = await readJurorAuth(jurorId, fixture.periodId);
      expect(auth.edit_enabled).toBe(false);
    } finally {
      await teardownScoringFixture(fixture);
    }
  });
});
