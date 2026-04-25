import { test, expect } from "@playwright/test";
import {
  adminClient,
  buildInviteSession,
  deleteUserByEmail,
} from "../helpers/supabaseAdmin";
import { E2E_WIZARD_ORG_ID } from "../fixtures/seed-ids";
import { LoginPom } from "../poms/LoginPom";

const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

// Unique suffix for setup-wizard test
const WIZARD_SUFFIX = "e5wiz";
const WIZARD_EMAIL = `e2e-wizard-admin-${WIZARD_SUFFIX}@vera-eval.app`;
const WIZARD_NAME = "E2E Setup Wizard Admin";
const WIZARD_PASSWORD = "E2eWizardPass!2026";

// SKIPPED: spec was authored against speculative testids that don't match the
// actual SetupWizard implementation. Testids that exist (PeriodStep,
// JurorsStep, CompletionStep) use names like `wizard-period-create` and
// `wizard-step-jurors-next`, not the `wizard-next-step-N` / `wizard-finalize`
// pattern this spec assumes. A real spec would need to walk through each step
// (Period → Criteria → Outcomes → Jurors → Completion) using the real testids
// AND handle the multi-step state machine. Re-enable after rewriting against
// the actual wizard component tree.
test.describe.skip("setup-wizard complete flow", () => {
  test.describe.configure({ mode: "serial" });

  let userId: string;

  test.beforeAll(async () => {
    await deleteUserByEmail(WIZARD_EMAIL).catch(() => {});

    // Create the invite user
    const { data, error } = await adminClient.auth.admin.createUser({
      email: WIZARD_EMAIL,
      password: WIZARD_PASSWORD,
      email_confirm: true,
    });
    expect(error).toBeNull();
    userId = data?.user?.id || "";
    expect(userId).toBeTruthy();

    // Create a membership row for the wizard org
    const { error: membershipErr } = await adminClient
      .from("memberships")
      .insert({
        user_id: userId,
        organization_id: E2E_WIZARD_ORG_ID,
        status: "active",
        role: "admin",
        is_owner: true,
      });
    expect(membershipErr).toBeNull();
  });

  test.afterAll(async () => {
    await deleteUserByEmail(WIZARD_EMAIL).catch(() => {});
  });

  test("login to wizard org, complete all 5 setup steps → setup_completed_at populated", async ({
    page,
  }) => {
    // Log in as the setup wizard admin
    const login = new LoginPom(page);
    await login.goto();
    await login.signIn(WIZARD_EMAIL, WIZARD_PASSWORD);

    // Should redirect to /admin/overview
    await page.waitForURL((url) => url.pathname.includes("/admin/"), { timeout: 15000 });

    // Check if setup wizard modal/drawer is visible
    // The wizard likely opens automatically if setup_completed_at IS NULL
    await expect(page.locator(`[data-testid="setup-wizard"]`)).toBeVisible({ timeout: 12000 });

    // Step 1: Period creation
    // Look for the period name input and fill it
    const periodNameInput = page.locator(`[data-testid="wizard-period-name"]`);
    if (await periodNameInput.isVisible()) {
      await periodNameInput.fill(`E2E Setup Period ${Date.now()}`);
      await page.locator(`[data-testid="wizard-next-step-1"]`).click();
    }

    // Step 2: Criteria setup
    // Add a criterion if the form is visible
    const criteriaAddBtn = page.locator(`[data-testid="wizard-add-criterion"]`);
    if (await criteriaAddBtn.isVisible()) {
      await criteriaAddBtn.click();
      const criteriaNameInput = page.locator(`[data-testid="wizard-criterion-label"]`);
      await criteriaNameInput.fill("E2E Test Criterion");
      const criteriaMaxInput = page.locator(`[data-testid="wizard-criterion-max"]`);
      await criteriaMaxInput.fill("100");
      await page.locator(`[data-testid="wizard-next-step-2"]`).click();
    }

    // Step 3: Outcomes setup (optional)
    const outcomesAddBtn = page.locator(`[data-testid="wizard-add-outcome"]`);
    if (await outcomesAddBtn.isVisible()) {
      await outcomesAddBtn.click();
      const outcomeInput = page.locator(`[data-testid="wizard-outcome-label"]`);
      await outcomeInput.fill("E2E Test Outcome");
      await page.locator(`[data-testid="wizard-next-step-3"]`).click();
    } else {
      // Skip if no outcome step
      const skipBtn = page.locator(`[data-testid="wizard-skip-outcomes"]`);
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }
    }

    // Step 4: Jurors setup
    const jurorAddBtn = page.locator(`[data-testid="wizard-add-juror"]`);
    if (await jurorAddBtn.isVisible()) {
      await jurorAddBtn.click();
      const jurorNameInput = page.locator(`[data-testid="wizard-juror-name"]`);
      await jurorNameInput.fill("E2E Test Juror");
      const jurorAffiliationInput = page.locator(`[data-testid="wizard-juror-affiliation"]`);
      await jurorAffiliationInput.fill("E2E Test Org");
      await page.locator(`[data-testid="wizard-next-step-4"]`).click();
    }

    // Step 5: Finalize
    const finalizeBtn = page.locator(`[data-testid="wizard-finalize"]`);
    if (await finalizeBtn.isVisible()) {
      await finalizeBtn.click();
    }

    // After finalization, the wizard should close
    await expect(page.locator(`[data-testid="setup-wizard"]`)).not.toBeVisible({ timeout: 10000 });

    // Verify DB: organizations.setup_completed_at should be NOT NULL
    const { data: org, error: orgErr } = await adminClient
      .from("organizations")
      .select("setup_completed_at")
      .eq("id", E2E_WIZARD_ORG_ID)
      .single();

    expect(orgErr).toBeNull();
    expect(org?.setup_completed_at).toBeTruthy();
    expect(new Date(org?.setup_completed_at || "").getTime()).toBeGreaterThan(0);
  });
});
