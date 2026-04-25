import { test, expect } from "@playwright/test";
import { adminClient, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { buildAdminSession } from "../helpers/oauthSession";
import { E2E_WIZARD_ORG_ID } from "../fixtures/seed-ids";

const APP_BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

const WIZARD_EMAIL = "e2e-wizard-admin@vera-eval.app";
const WIZARD_PASSWORD = "E2eWizardPass!2026";

test.describe("setup-wizard complete flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Delete any periods from previous runs (cascades to criteria, projects, jurors).
    // A previous successful run leaves the period locked (setup_completed_at fires
    // a path that hardens the period). The block_locked_period_delete trigger
    // rejects DELETE with period_locked, so unlock first.
    const { data: periods } = await adminClient
      .from("periods")
      .select("id")
      .eq("organization_id", E2E_WIZARD_ORG_ID);

    if (periods?.length) {
      const ids = periods.map((p) => p.id);
      await adminClient
        .from("periods")
        .update({ is_locked: false })
        .in("id", ids);
      await adminClient
        .from("periods")
        .delete()
        .in("id", ids);
    }

    await adminClient
      .from("organizations")
      .update({ setup_completed_at: null })
      .eq("id", E2E_WIZARD_ORG_ID);

    await deleteUserByEmail(WIZARD_EMAIL).catch(() => {});

    const { data, error } = await adminClient.auth.admin.createUser({
      email: WIZARD_EMAIL,
      password: WIZARD_PASSWORD,
      email_confirm: true,
    });
    expect(error).toBeNull();
    const userId = data?.user?.id ?? "";
    expect(userId).toBeTruthy();

    const { error: membershipErr } = await adminClient.from("memberships").insert({
      user_id: userId,
      organization_id: E2E_WIZARD_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: true,
    });
    expect(membershipErr).toBeNull();
  });

  test.afterAll(async () => {
    await deleteUserByEmail(WIZARD_EMAIL).catch(() => {});

    const { data: periods } = await adminClient
      .from("periods")
      .select("id")
      .eq("organization_id", E2E_WIZARD_ORG_ID);

    if (periods?.length) {
      await adminClient
        .from("periods")
        .delete()
        .in("id", periods.map((p) => p.id));
    }

    await adminClient
      .from("organizations")
      .update({ setup_completed_at: null })
      .eq("id", E2E_WIZARD_ORG_ID);
  });

  test("complete all 5 setup steps → setup_completed_at populated", async ({ page }) => {
    // Suppress admin SpotlightTour before React mounts
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
      } catch {}
    });

    // Inject the wizard user's session so the browser is authenticated.
    // Also clear the wizard's sessionStorage keys (`sw_step_*`, `sw_data_*`)
    // so a previous run's "step 5 done" state doesn't leak into this run and
    // make useSetupWizard auto-resolve to a step that is no longer valid.
    const session = await buildAdminSession(WIZARD_EMAIL, WIZARD_PASSWORD);
    await page.addInitScript(
      ({ key, value, orgId }: { key: string; value: object; orgId: string }) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          sessionStorage.removeItem(`sw_step_${orgId}`);
          sessionStorage.removeItem(`sw_data_${orgId}`);
        } catch {}
      },
      { key: session.storageKey, value: session.sessionValue, orgId: E2E_WIZARD_ORG_ID },
    );

    await page.goto(`${APP_BASE}/demo/admin/setup`);
    // Wait for the page to settle — DemoAdminLoader and buildAdminSession can
    // both fire ad-hoc auth state transitions on first paint, which detaches
    // and re-renders the welcome button. Without this, the click below races
    // the second render.
    await page.waitForLoadState("networkidle");

    // Step 1 — Welcome
    const continueBtn = page.locator('[data-testid="wizard-welcome-continue"]');
    await expect(continueBtn).toBeVisible({ timeout: 20_000 });
    await continueBtn.click();

    // Step 2 — Period creation
    // Advance to step 3 is reactive (useSetupWizard detects new period in sortedPeriods)
    const periodNameInput = page.locator('[data-testid="wizard-period-name"]');
    await expect(periodNameInput).toBeVisible({ timeout: 10_000 });
    await periodNameInput.fill(`E2E Wizard Period ${Date.now()}`);
    await page.locator('[data-testid="wizard-period-create"]').click();

    // Step 3 — Criteria: two sub-phases.
    // (a) phase=criteria → Apply Template & Continue.
    // (b) After apply, hasCriteria flips true → CriteriaStep auto-transitions to
    //     phase=framework ("Set accreditation framework"). This is internal to
    //     step 3 — the parent currentStep is still 3 — so we must skip the
    //     framework picker (or pick MÜDEK) before the wizard advances to step 4.
    const applyTemplateBtn = page.locator('[data-testid="wizard-step-criteria-apply-template"]');
    await expect(applyTemplateBtn).toBeVisible({ timeout: 15_000 });
    await applyTemplateBtn.click();

    // Wait for framework phase, then skip (no testid; click the inline link).
    const skipFrameworkLink = page.getByRole("button", { name: /Skip for now/i });
    await expect(skipFrameworkLink).toBeVisible({ timeout: 15_000 });
    await skipFrameworkLink.click();

    // Step 4 — Projects: use placeholder selectors (no testids on inputs)
    const projectTitleInput = page.getByPlaceholder("Autonomous Warehouse Router");
    await expect(projectTitleInput).toBeVisible({ timeout: 10_000 });
    await projectTitleInput.fill("E2E Test Project");
    await page.getByPlaceholder("Ali Vural, Zeynep Şahin, Ege Tan").fill("E2E Student A, E2E Student B");
    await page.locator('[data-testid="wizard-step-projects-next"]').click();

    // Step 5 — Jurors: fill form and save (no jurors exist yet)
    const jurorNameInput = page.getByPlaceholder("Dr. Ayşe Demir");
    await expect(jurorNameInput).toBeVisible({ timeout: 10_000 });
    await jurorNameInput.fill("E2E Test Juror");
    await page.getByPlaceholder("TED University").fill("E2E Test University");
    await page.locator('[data-testid="wizard-step-jurors-next"]').click();

    // After save + fetchData re-renders to the "jurors already exist" branch,
    // the "Generate Entry Token" button appears
    const launchBtn = page.locator('[data-testid="wizard-step-jurors-launch"]');
    await expect(launchBtn).toBeVisible({ timeout: 15_000 });
    await launchBtn.click();

    // Completion step — readiness check passes (template + 1 project), complete setup
    const completionDiv = page.locator('[data-testid="wizard-completion"]');
    await expect(completionDiv).toBeVisible({ timeout: 20_000 });
    const completeBtn = page.locator('[data-testid="wizard-step-review-complete"]');
    await expect(completeBtn).toBeVisible({ timeout: 15_000 });
    await completeBtn.click();

    // Verify DB: setup_completed_at should be stamped
    await expect
      .poll(
        async () => {
          const { data: org } = await adminClient
            .from("organizations")
            .select("setup_completed_at")
            .eq("id", E2E_WIZARD_ORG_ID)
            .single();
          return org?.setup_completed_at ?? null;
        },
        { timeout: 10_000, intervals: [500] },
      )
      .toBeTruthy();
  });
});
