// Realtime — period state change propagates to a second admin tab.
//
// Architecture spec § 3.6 ("E2E only for journeys that span at least three of:
// auth, RPC, RLS, Realtime, Edge Function, autosave, browser storage"). This
// is the canonical Realtime two-context pattern other admin pages will copy:
//
//   Context A (Tab A) — admin viewing /admin/periods, subscribed to Realtime
//                       on the periods table via the page's existing live-
//                       updates wiring.
//   Context B         — service-role admin client mutates periods.is_locked
//                       directly in the DB (simulates "another admin
//                       published from another tab").
//
// We assert that Tab A's periods row reflects the change without a manual
// refresh.
//
// BUG CLASS this catches:
//   1. The page's Realtime subscription not subscribing on mount, or
//      unsubscribing prematurely on a layout re-render. Tab A would show
//      stale state until a manual refresh.
//   2. The Realtime publication on the `periods` table being dropped from
//      002_tables.sql. Manifests as zero events arriving — caught here.
//   3. The page's UPDATE handler ignoring is_locked transitions because of
//      a stale closure over the row list (forgot dependency in useEffect).
//
// NOT covered here (lives elsewhere):
//   • Cross-tenant Realtime isolation — pgTAP RLS files cover that the
//     subscription only delivers rows the caller can SELECT.
//   • The publication membership itself — also covered in pgTAP.

import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { PeriodsPom } from "../poms/PeriodsPom";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

async function signInAndOpenPeriods(page: Page) {
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

test.describe("periods realtime — two-context state propagation", () => {
  test.describe.configure({ mode: "serial" });

  let periodId = "";
  const periodName = `E2E Realtime ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  test.beforeAll(async () => {
    // Seed an unlocked draft period under the periods E2E org. Tab A will
    // observe it as "Draft …", Tab B will flip is_locked=true via RPC, and
    // Tab A's row should re-render as Published.
    const { data, error } = await adminClient
      .from("periods")
      .insert({
        organization_id: E2E_PERIODS_ORG_ID,
        name: periodName,
        season: "Spring",
        is_locked: false,
        criteria_name: "E2E Realtime Criteria",
      })
      .select("id")
      .single();
    expect(error, `seed period failed: ${error?.message}`).toBeNull();
    periodId = data!.id as string;

    // Add the minimum content the readiness gate requires; a dropped
    // criterion or project would force the publish RPC to return
    // readiness_failed and skew the Realtime test into a UI message check.
    const suffix = periodId.slice(0, 8);
    await adminClient.from("period_criteria").insert({
      period_id: periodId,
      key: `e2e_rt_${suffix}`,
      label: "E2E Realtime Criterion",
      max_score: 100,
      weight: 100,
      sort_order: 0,
      rubric_bands: [{ label: "Pass", min_score: 0, max_score: 100 }],
    });
    await adminClient.from("projects").insert({
      period_id: periodId,
      title: `E2E Realtime Project ${suffix}`,
      members: [],
    });
  });

  test.afterAll(async () => {
    if (periodId) {
      // Always unlock + clear closed_at so cascade-delete can run.
      try {
        await adminClient
          .from("periods")
          .update({ is_locked: false, closed_at: null })
          .eq("id", periodId);
      } catch {}
      try { await adminClient.from("periods").delete().eq("id", periodId); } catch {}
    }
  });

  test("admin tab observes period publish triggered by another context", async ({ browser }) => {
    if (!periodId) throw new Error("Fixture period not seeded");

    // ── Context A: open /admin/periods and confirm initial Draft state ─────
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    try {
      const periodsA = await signInAndOpenPeriods(pageA);
      await periodsA.expectRowVisible(periodName);

      // Status starts as Draft (or "Draft Ready" / "Setup needed" — any
      // pre-publish state is fine; we just need a stable starting point so
      // we know the post-publish transition is the assertion-of-interest).
      const initialStatus = await periodsA.statusPill(periodName).textContent();
      expect(
        initialStatus?.toLowerCase().includes("publish"),
        `pre-condition: status should not start as Published (was '${initialStatus}')`,
      ).toBeFalsy();

      // ── Context B: flip is_locked=true on the seeded period ─────────────
      // We use the rpc_admin_publish_period RPC (rather than a direct
      // is_locked UPDATE) so the trigger ordering and the "publish" event
      // shape match real production traffic.
      const { data: pubResp, error: pubErr } = await adminClient.rpc("rpc_admin_publish_period", {
        p_period_id: periodId,
      });
      expect(pubErr, `publish RPC error: ${pubErr?.message}`).toBeNull();
      // The RPC may return readiness_failed in fixture-light tenants; treat
      // either branch as the start of the propagation race. If readiness
      // failed, fall back to a direct DB flip so we still exercise the
      // Realtime path the test is about.
      if (!pubResp?.ok) {
        await adminClient
          .from("periods")
          .update({ is_locked: true, activated_at: new Date().toISOString() })
          .eq("id", periodId);
      }

      // ── Context A: status pill flips to Published WITHOUT a manual reload ──
      // The page's existing Realtime channel on `periods` should deliver the
      // UPDATE. We wait up to 15s; faster propagation is normal.
      await expect(
        periodsA.statusPill(periodName),
        "status pill should re-render as Published via Realtime, no refresh",
      ).toContainText("Published", { ignoreCase: true, timeout: 15_000 });
    } finally {
      await ctxA.close();
    }
  });
});
