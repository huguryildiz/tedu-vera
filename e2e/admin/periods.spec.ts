import { test, expect, type Page } from "@playwright/test";
import { createHash } from "crypto";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PeriodsPom } from "../poms/PeriodsPom";
import { adminClient } from "../helpers/supabaseAdmin";
import {
  setupScoringFixture,
  teardownScoringFixture,
  writeScoresAsJuror,
  type ScoringFixture,
} from "../helpers/scoringFixture";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_PERIODS_ORG_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
const E2E_LIFECYCLE_ORG_ID = "d4e5f6a7-b8c9-0123-def0-234567890123";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("periods crud", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(page: Parameters<Parameters<typeof test>[1]>[0]["page"], orgId = E2E_PERIODS_ORG_ID) {
    await page.addInitScript((id) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", id);
      } catch {}
    }, orgId);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const periods = new PeriodsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("periods");
    await periods.waitForReady();
    return periods;
  }

  async function signInAndGotoLifecycle(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    return signInAndGoto(page, E2E_LIFECYCLE_ORG_ID);
  }

  test("create — draft period appears in table", async ({ page }) => {
    const periods = await signInAndGoto(page);
    const name = uniqueName("E2E Period");

    await periods.openCreateDrawer();
    await periods.fillCreateForm(name, "Created by E2E");
    await periods.saveDrawer();

    await periods.expectRowVisible(name);

    // Cleanup
    await periods.clickDeleteFor(name);
    await periods.confirmDelete(name);
  });

  test("edit — rename persists", async ({ page }) => {
    const periods = await signInAndGoto(page);
    const original = uniqueName("E2E Period");
    const renamed = `${original}-renamed`;

    // Seed a period to rename
    await periods.openCreateDrawer();
    await periods.fillCreateForm(original);
    await periods.saveDrawer();
    await periods.expectRowVisible(original);

    // Edit
    await periods.clickEditFor(original);
    await periods.drawerName().fill(renamed);
    await periods.saveDrawer();

    await periods.expectRowVisible(renamed);
    await periods.expectRowGone(original);

    // Cleanup
    await periods.clickDeleteFor(renamed);
    await periods.confirmDelete(renamed);
  });

  test("delete — draft period removed after confirmation", async ({ page }) => {
    const periods = await signInAndGoto(page);
    const name = uniqueName("E2E Period");

    await periods.openCreateDrawer();
    await periods.fillCreateForm(name);
    await periods.saveDrawer();
    await periods.expectRowVisible(name);

    await periods.clickDeleteFor(name);

    // Confirm button is disabled until name is typed exactly
    await expect(periods.deleteConfirmBtn()).toBeDisabled();
    await periods.confirmDelete(name);

    await periods.expectRowGone(name);
  });

  test("lifecycle — live period can be closed", async ({ page }) => {
    const fixture = await setupScoringFixture({ namePrefix: "E2E Lifecycle" });
    try {
      const periods = await signInAndGoto(page, E2E_PERIODS_ORG_ID);
      const name = fixture.periodName;

      await periods.expectRowVisible(name);
      await periods.expectStatus(name, "Published");

      await periods.clickCloseFor(name);
      await expect(periods.closeConfirmBtn()).toBeDisabled();
      await periods.confirmClose(name);

      await periods.expectStatus(name, "Closed");
    } finally {
      await adminClient
        .from("periods")
        .update({ is_locked: false, closed_at: null })
        .eq("id", fixture.periodId);
      await teardownScoringFixture(fixture);
    }
  });
});

/**
 * E4 — Period lifecycle: publish gate + closed-write block.
 *
 * E4-3: Creates a "ready" period (criteria_name set, ≥1 weighted criterion with
 * rubric_bands, ≥1 project) via service-role DB insert, then publishes via the
 * admin UI. Asserts the status pill shows "Published" and DB `is_locked=true`.
 *
 * E4-4: Uses scoringFixture (locked period with scores) and closes the period via
 * the admin UI. Then calls rpc_jury_upsert_score with a valid session token and
 * asserts the RPC returns `error_code: "period_closed"`.
 */
test.describe("periods lifecycle — publish + close write-block", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGotoE4(page: Page) {
    await page.addInitScript((id) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", id);
      } catch {}
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const periods = new PeriodsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("periods");
    await periods.waitForReady();
    return periods;
  }

  test("E4-3: draft period → publish → DB is_locked=true + status=Published", async ({ page }) => {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const periodName = `E4 Publish ${suffix}`;
    let periodId = "";

    try {
      // Seed a "ready" period: criteria_name + 1 weighted criterion with rubric_bands + 1 project
      const { data: period, error: periodErr } = await adminClient
        .from("periods")
        .insert({
          organization_id: E2E_PERIODS_ORG_ID,
          name: periodName,
          is_locked: false,
          season: "Spring",
          criteria_name: "E4 Evaluation Criteria",
        })
        .select("id")
        .single();
      expect(periodErr, `period insert failed: ${periodErr?.message}`).toBeNull();
      periodId = period!.id as string;

      const { error: critErr } = await adminClient.from("period_criteria").insert({
        period_id: periodId,
        key: `e4_crit_${suffix}`,
        label: "E4 Criterion",
        max_score: 100,
        weight: 100,
        sort_order: 0,
        rubric_bands: [{ label: "Pass", min_score: 0, max_score: 100 }],
      });
      expect(critErr, `criterion insert failed: ${critErr?.message}`).toBeNull();

      const { error: projErr } = await adminClient.from("projects").insert({
        period_id: periodId,
        title: `E4 Project ${suffix}`,
        members: [],
      });
      expect(projErr, `project insert failed: ${projErr?.message}`).toBeNull();

      // Navigate and wait for readiness badge
      const periods = await signInAndGotoE4(page);
      await periods.expectRowVisible(periodName);
      await expect(
        periods.periodRow(periodName).locator(".periods-readiness-badge.ready"),
        "readiness badge must be visible before publish button is enabled",
      ).toBeVisible({ timeout: 15_000 });

      // Publish via UI
      await periods.clickPublishFor(periodName);
      await periods.confirmPublish();

      // Assert UI status
      await periods.expectStatus(periodName, "Published");

      // Assert DB
      const { data: dbPeriod } = await adminClient
        .from("periods")
        .select("is_locked")
        .eq("id", periodId)
        .single();
      expect(dbPeriod?.is_locked, "DB is_locked must be true after publish").toBe(true);
    } finally {
      if (periodId) {
        try { await adminClient.from("periods").update({ is_locked: false }).eq("id", periodId); } catch {}
        try { await adminClient.from("periods").delete().eq("id", periodId); } catch {}
      }
    }
  });

  test("E4-4: scored period close → rpc_jury_upsert_score returns period_closed", async ({ page }) => {
    let fixture: ScoringFixture | null = null;
    try {
      fixture = await setupScoringFixture({ namePrefix: "E4 Close" });
      await writeScoresAsJuror(fixture, { p1: { a: 15, b: 35 }, p2: { a: 20, b: 40 } });

      // Establish a valid session token so the RPC reaches the period_closed guard
      const rawToken = `e4-close-token-${Date.now()}`;
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const { error: authErr } = await adminClient
        .from("juror_period_auth")
        .update({ session_token_hash: tokenHash })
        .eq("juror_id", fixture.jurorId)
        .eq("period_id", fixture.periodId);
      expect(authErr, `session_token_hash update failed: ${authErr?.message}`).toBeNull();

      // Navigate to periods page and close the fixture period via UI
      const periods = await signInAndGotoE4(page);
      await periods.expectRowVisible(fixture.periodName);
      await periods.clickCloseFor(fixture.periodName);
      await periods.confirmClose(fixture.periodName);
      await periods.expectStatus(fixture.periodName, "Closed");

      // Call jury score RPC — session is valid but period is closed
      const { data: rpcResult, error: rpcErr } = await adminClient.rpc("rpc_jury_upsert_score", {
        p_period_id: fixture.periodId,
        p_project_id: fixture.p1Id,
        p_juror_id: fixture.jurorId,
        p_session_token: rawToken,
        p_scores: [],
        p_comment: null,
      });
      expect(rpcErr, `RPC must not error at transport level: ${rpcErr?.message}`).toBeNull();
      expect(rpcResult?.error_code, "RPC must return period_closed").toBe("period_closed");
    } finally {
      if (fixture) {
        // Reset closed_at + unlock so teardown cascade-delete is not blocked by triggers
        try {
          await adminClient
            .from("periods")
            .update({ is_locked: false, closed_at: null })
            .eq("id", fixture.periodId);
        } catch {}
        try { await adminClient.from("periods").delete().eq("id", fixture.periodId); } catch {}
        try { await adminClient.from("jurors").delete().eq("id", fixture.jurorId); } catch {}
      }
    }
  });
});
