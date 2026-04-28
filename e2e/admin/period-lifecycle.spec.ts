/**
 * Period lifecycle — Create → Publish (Lock) → Close.
 *
 * Dedicated spec for the integrated period lifecycle journey:
 * 1. Seed a "ready" period (criteria_name + weighted criterion + project) via service-role.
 * 2. Navigate to admin /periods.
 * 3. Publish the period via UI → assert status = "Published", DB is_locked = true.
 * 4. Close the period via UI → assert status = "Closed", DB closed_at set.
 */

import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PeriodsPom } from "../poms/PeriodsPom";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("period lifecycle — Create → Publish → Close", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
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

  test("period lifecycle: draft → publish → DB is_locked=true + status=Published", async ({
    page,
  }) => {
    // period lifecycle: create a ready period, publish via UI, verify DB + UI state
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const periodName = `Lifecycle Publish ${suffix}`;
    let periodId = "";

    try {
      const { data: period, error: periodErr } = await adminClient
        .from("periods")
        .insert({
          organization_id: E2E_PERIODS_ORG_ID,
          name: periodName,
          is_locked: false,
          season: "Spring",
          criteria_name: "Lifecycle Criteria",
        })
        .select("id")
        .single();
      expect(periodErr, `period insert failed: ${periodErr?.message}`).toBeNull();
      periodId = period!.id as string;

      await adminClient.from("period_criteria").insert({
        period_id: periodId,
        key: `lc_crit_${suffix}`,
        label: "LC Criterion",
        max_score: 100,
        weight: 100,
        sort_order: 0,
        rubric_bands: [{ label: "Pass", min_score: 0, max_score: 100 }],
      });

      await adminClient.from("projects").insert({
        period_id: periodId,
        title: `LC Project ${suffix}`,
        members: [],
      });

      const periods = await signInAndGoto(page);
      await periods.expectRowVisible(periodName);
      await expect(
        periods.periodRow(periodName).locator(".periods-readiness-badge.ready"),
        "readiness badge must be visible before publish",
      ).toBeVisible({ timeout: 15_000 });

      // lifecycle step: publish
      await periods.clickPublishFor(periodName);
      await periods.confirmPublish();
      await periods.expectStatus(periodName, "Published");

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

  test("period lifecycle: published period close → status=Closed + closed_at set", async ({
    page,
  }) => {
    // period lifecycle: close a published period, verify UI status + DB closed_at
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const periodName = `Lifecycle Close ${suffix}`;
    let periodId = "";

    try {
      const { data: period, error: periodErr } = await adminClient
        .from("periods")
        .insert({
          organization_id: E2E_PERIODS_ORG_ID,
          name: periodName,
          is_locked: true,
          season: "Spring",
          criteria_name: "Lifecycle Close Criteria",
        })
        .select("id")
        .single();
      expect(periodErr, `period insert failed: ${periodErr?.message}`).toBeNull();
      periodId = period!.id as string;

      const periods = await signInAndGoto(page);
      await periods.expectRowVisible(periodName);
      await periods.expectStatus(periodName, "Published");

      // lifecycle step: close
      await periods.clickCloseFor(periodName);
      await periods.confirmClose(periodName);
      await periods.expectStatus(periodName, "Closed");

      const { data: dbPeriod } = await adminClient
        .from("periods")
        .select("closed_at")
        .eq("id", periodId)
        .single();
      expect(dbPeriod?.closed_at, "DB closed_at must be set after close").toBeTruthy();
    } finally {
      if (periodId) {
        try { await adminClient.from("periods").update({ is_locked: false, closed_at: null }).eq("id", periodId); } catch {}
        try { await adminClient.from("periods").delete().eq("id", periodId); } catch {}
      }
    }
  });
});
