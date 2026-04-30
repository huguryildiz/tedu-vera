// Realtime — juror INSERT propagates to a second admin tab.
//
// Architecture spec § 3.6 ("E2E only for journeys that span at least three of:
// auth, RPC, RLS, Realtime, Edge Function, autosave, browser storage"). This
// mirrors periods-realtime.spec.ts for the jurors page:
//
//   Context A (Tab A) — admin viewing /admin/jurors, subscribed to Realtime
//                       on the jurors table via the page's existing live-
//                       updates wiring.
//   Context B         — service-role admin client inserts a jurors row
//                       directly in the DB (simulates "another admin
//                       added a juror from another tab").
//
// We assert that Tab A's juror table reflects the new row without a manual
// refresh.
//
// BUG CLASS this catches:
//   1. The page's Realtime subscription not subscribing on mount, or
//      unsubscribing prematurely on a layout re-render. Tab A would show
//      stale rows until a manual refresh.
//   2. The Realtime publication on the `jurors` table being dropped from
//      002_tables.sql. Manifests as zero events arriving — caught here.
//   3. The page's INSERT handler ignoring new rows because of a stale
//      closure over the row list (forgot dependency in useEffect).
//
// NOT covered here (lives elsewhere):
//   • Cross-tenant Realtime isolation — pgTAP RLS files cover that the
//     subscription only delivers rows the caller can SELECT.
//   • The publication membership itself — also covered in pgTAP.

import { test, expect, type Page } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { JurorsPom } from "../poms/JurorsPom";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_CRITERIA_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

async function signInAndOpenJurors(page: Page) {
  await page.addInitScript((id) => {
    try {
      localStorage.setItem("vera.admin_tour_done", "1");
      localStorage.setItem("admin.remember_me", "true");
      localStorage.setItem("admin.active_organization_id", id);
    } catch {}
    // Opt back into Realtime — usePageRealtime is disabled by default in
    // VITE_E2E mode to avoid racing optimistic CRUD updates. This test
    // specifically exercises Realtime, so we re-enable for this page.
    (window as unknown as { __VERA_E2E_REALTIME__?: boolean }).__VERA_E2E_REALTIME__ = true;
  }, E2E_CRITERIA_ORG_ID);

  const login = new LoginPom(page);
  const shell = new AdminShellPom(page);
  const jurors = new JurorsPom(page);
  await login.goto();
  await login.signIn(EMAIL, PASSWORD);
  await shell.expectOnDashboard();
  await shell.clickNav("jurors");
  await jurors.waitForReady();
  return jurors;
}

test.describe("jurors realtime — two-context state propagation", () => {
  test.describe.configure({ mode: "serial" });
  // Two-tab realtime test does login twice + sets up Realtime subscription +
  // waits for propagation. Under CI load this routinely exceeds 60s.
  test.setTimeout(120_000);

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const jurorName = `E2E Realtime Juror ${suffix}`;

  let createdJurorId: string | null = null;

  test.afterAll(async () => {
    if (createdJurorId) {
      try {
        await adminClient.from("juror_period_auth").delete().eq("juror_id", createdJurorId);
      } catch {}
      try {
        await adminClient.from("jurors").delete().eq("id", createdJurorId);
      } catch {}
    }
    // Defensive cleanup by name in case the id capture missed a prior partial run.
    try {
      await adminClient
        .from("jurors")
        .delete()
        .eq("organization_id", E2E_CRITERIA_ORG_ID)
        .eq("juror_name", jurorName);
    } catch {}
  });

  test("admin tab observes juror insertion triggered by another context", async ({ browser }) => {
    // ── Context A: open /admin/jurors and confirm row not present yet ─────
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    try {
      const jurorsA = await signInAndOpenJurors(pageA);
      await expect(jurorsA.jurorRow(jurorName)).toHaveCount(0);

      // The page lists jurors via listJurorsSummary which joins jurors via
      // juror_period_auth filtered by the page's viewPeriodId. Inserting just
      // a jurors row would fire the Realtime event but the row would not
      // surface in the list. Seed both rows so the row visibly appears.
      // We insert juror_period_auth for every period in the org — whichever
      // period the page is currently viewing will pick up the new juror.
      const { data: periods, error: periodsErr } = await adminClient
        .from("periods")
        .select("id")
        .eq("organization_id", E2E_CRITERIA_ORG_ID);
      expect(periodsErr, `period lookup failed: ${periodsErr?.message}`).toBeNull();
      expect(periods?.length || 0, "expected at least one period in criteria org").toBeGreaterThan(0);

      // ── Context B: insert a juror row directly via service role ─────────
      const { data: insRow, error: insErr } = await adminClient
        .from("jurors")
        .insert({
          organization_id: E2E_CRITERIA_ORG_ID,
          juror_name: jurorName,
          affiliation: "E2E Realtime University",
          email: `e2e-rt-juror-${suffix}@e2e.local`,
        })
        .select("id")
        .single();
      expect(insErr, `seed juror failed: ${insErr?.message}`).toBeNull();
      createdJurorId = insRow!.id as string;

      const authRows = (periods || []).map((p) => ({
        juror_id: createdJurorId!,
        period_id: p.id as string,
      }));
      const { error: authErr } = await adminClient
        .from("juror_period_auth")
        .insert(authRows);
      expect(authErr, `seed juror_period_auth failed: ${authErr?.message}`).toBeNull();

      // ── Context A: row appears via Realtime, no manual refresh ──────────
      await expect(
        jurorsA.jurorRow(jurorName),
        "juror row should render via Realtime, no refresh",
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctxA.close();
    }
  });
});
