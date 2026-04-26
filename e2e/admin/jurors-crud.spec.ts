import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { JurorsPom } from "../poms/JurorsPom";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_CRITERIA_ORG_ID, E2E_CRITERIA_PERIOD_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON_KEY = process.env.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// Unique suffix prevents collision with the backend's
// UNIQUE(organization_id, juror_name, affiliation) constraint when a previous
// run left residue behind. Bump in the spec if you ever run tests in parallel.
const SUFFIX = "B3E2E";
const JUROR_NAME = `Prof. B3 E2E Juror ${SUFFIX}`;
const JUROR_AFFIL = `E2E University ${SUFFIX}`;
const JUROR_EMAIL = `b3juror-${SUFFIX.toLowerCase()}@e2e.local`;
const JUROR_NAME_EDITED = `Prof. B3 E2E Juror ${SUFFIX} — Edited`;

test.describe("jurors crud", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGotoJurors(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    // Suppress the guided tour + enable remember_me so the Supabase session
    // persists past AuthProvider's post-login clearPersistedSession hook.
    // Point to the dedicated E2E org (has a single unlocked period) so the
    // period_locked trigger never fires during juror CRUD.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem(
          "admin.active_organization_id",
          "f7340e37-9349-4210-8d6b-073a5616bf49",
        );
      } catch {}
    });
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

  test("create — new juror appears in the table", async ({ page }) => {
    const jurors = await signInAndGotoJurors(page);
    await jurors.openCreateDrawer();
    await jurors.fillCreateForm(JUROR_NAME, JUROR_AFFIL, JUROR_EMAIL);
    await jurors.saveCreate();
    await jurors.expectJurorRowVisible(JUROR_NAME);
  });

  test("edit — update juror name reflects in the table", async ({ page }) => {
    const jurors = await signInAndGotoJurors(page);
    await jurors.clickEditForJuror(JUROR_NAME);
    await expect(jurors.editDrawerName()).toBeVisible();
    await jurors.fillEditName(JUROR_NAME_EDITED);
    await jurors.saveEdit();
    await jurors.expectJurorRowVisible(JUROR_NAME_EDITED);
  });

  test("delete — type-to-confirm removes the juror row", async ({ page }) => {
    const jurors = await signInAndGotoJurors(page);
    await jurors.clickDeleteForJuror(JUROR_NAME_EDITED);
    await expect(jurors.deleteNameInput()).toBeVisible();
    await jurors.confirmDelete(JUROR_NAME_EDITED);
    await jurors.expectJurorRowGone(JUROR_NAME_EDITED);
  });

  test("create validation — missing name keeps save disabled", async ({ page }) => {
    const jurors = await signInAndGotoJurors(page);
    await jurors.openCreateDrawer();
    // Fill affiliation + email but skip name — save button should stay disabled.
    await jurors.drawerAffiliation().fill(JUROR_AFFIL);
    await jurors.drawerEmail().fill(JUROR_EMAIL);
    await expect(jurors.drawerSave()).toBeDisabled();
    // Drawer stays open.
    await expect(jurors.drawerCancel()).toBeVisible();
  });
});

// PIN regenerate is API-level only — no UI dependencies — so it lives in its
// own (non-serial) describe block. Otherwise a flake in the serial UI chain
// above (e.g. period locks blocking the edit row action) would skip it.
test.describe("jurors crud — RPC", () => {
  test("PIN regenerate — rpc_juror_reset_pin writes new pin_hash to DB", async () => {
    // rpc_juror_reset_pin checks auth.uid() membership, so we need a real
    // authenticated session. The service-role adminClient is used for setup
    // and assertions; an authed PostgREST client invokes the RPC.
    const tokenResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const tokenJson = await tokenResp.json();
    const accessToken = tokenJson?.access_token as string | undefined;
    expect(accessToken, `password grant failed: ${JSON.stringify(tokenJson)}`).toBeTruthy();

    const adminUserClient: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = Date.now().toString(36);
    const name = `E2E PIN Regen ${suffix}`;
    const { data: jurorRow, error: insErr } = await adminClient
      .from("jurors")
      .insert({
        organization_id: E2E_CRITERIA_ORG_ID,
        juror_name: name,
        affiliation: "E2E PIN University",
        email: `e2e-pin-regen-${suffix}@e2e.local`,
      })
      .select("id")
      .single();
    expect(insErr, `juror insert failed: ${insErr?.message}`).toBeNull();
    const jurorId = jurorRow!.id as string;

    const { error: authErr } = await adminClient
      .from("juror_period_auth")
      .upsert(
        {
          juror_id: jurorId,
          period_id: E2E_CRITERIA_PERIOD_ID,
          pin_hash: null,
        },
        { onConflict: "juror_id,period_id" },
      );
    expect(authErr, `juror_period_auth seed failed: ${authErr?.message}`).toBeNull();

    try {
      const { data: before, error: beforeErr } = await adminClient
        .from("juror_period_auth")
        .select("pin_hash, pin_pending_reveal")
        .eq("juror_id", jurorId)
        .eq("period_id", E2E_CRITERIA_PERIOD_ID)
        .single();
      expect(beforeErr, `pre-read failed: ${beforeErr?.message}`).toBeNull();
      expect(before!.pin_hash).toBeNull();

      const { data: resetResp, error: resetErr } = await adminUserClient.rpc(
        "rpc_juror_reset_pin",
        {
          p_period_id: E2E_CRITERIA_PERIOD_ID,
          p_juror_id: jurorId,
        },
      );
      expect(resetErr, `rpc_juror_reset_pin error: ${resetErr?.message}`).toBeNull();
      const resp = resetResp as { ok?: boolean; pin_plain_once?: string } | null;
      expect(resp?.ok).toBe(true);
      expect(resp?.pin_plain_once).toMatch(/^\d{4}$/);

      const { data: after, error: afterErr } = await adminClient
        .from("juror_period_auth")
        .select("pin_hash, pin_pending_reveal")
        .eq("juror_id", jurorId)
        .eq("period_id", E2E_CRITERIA_PERIOD_ID)
        .single();
      expect(afterErr, `post-read failed: ${afterErr?.message}`).toBeNull();
      expect(after!.pin_hash).not.toBeNull();
      expect(after!.pin_pending_reveal).toBe(resp!.pin_plain_once);
    } finally {
      await adminClient
        .from("juror_period_auth")
        .delete()
        .eq("juror_id", jurorId)
        .eq("period_id", E2E_CRITERIA_PERIOD_ID);
      await adminClient.from("jurors").delete().eq("id", jurorId);
    }
  });
});
