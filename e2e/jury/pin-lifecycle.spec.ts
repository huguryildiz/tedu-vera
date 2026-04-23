// e2e/jury/pin-lifecycle.spec.ts
// ============================================================
// jury.e2e.pin-lifecycle — First-time juror sees PinReveal step;
// second visit (after PIN saved) requires PIN entry. Smoke flow.
// ============================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { JuryFlow } from "../helpers/JuryFlow";

const TEST_JUROR_NAME  = process.env.E2E_JUROR_NAME  || "";
const TEST_JUROR_DEPT  = process.env.E2E_JUROR_DEPT  || "";
const ADMIN_PASSWORD   = process.env.E2E_ADMIN_PASSWORD || "";
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const RPC_SECRET       = process.env.VITE_RPC_SECRET || "";

let runtimePin = "";

async function resetJurorPin(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const active = await supabase.rpc("rpc_get_active_semester");
  if (active.error) throw active.error;
  const semesterId = active.data?.[0]?.id || null;
  if (!semesterId) return;

  const list = await supabase.rpc("rpc_admin_list_jurors", {
    p_admin_password: ADMIN_PASSWORD,
    p_semester_id: semesterId,
    p_rpc_secret: RPC_SECRET,
  });
  if (list.error) throw list.error;

  const needle = TEST_JUROR_NAME.trim().toLowerCase();
  const juror = (list.data || []).find(
    (j: any) => String(j.juror_name || "").trim().toLowerCase() === needle
  );
  if (!juror?.juror_id) return;

  const reset = await supabase.rpc("rpc_admin_reset_juror_pin", {
    p_semester_id: semesterId,
    p_juror_id: juror.juror_id,
    p_admin_password: ADMIN_PASSWORD,
    p_rpc_secret: RPC_SECRET,
  });
  if (reset.error) throw reset.error;
  runtimePin = String(reset.data?.[0]?.pin_plain_once || "");
}

test.describe("Jury · PIN Lifecycle", () => {
  test.skip(
    !TEST_JUROR_NAME || !ADMIN_PASSWORD || !SUPABASE_URL || !SUPABASE_ANON_KEY || !RPC_SECRET,
    "Skipped: full PIN lifecycle requires juror, admin password, RPC secret, Supabase env"
  );

  test.beforeAll(async () => {
    await resetJurorPin();
  });

  test("First visit reveals PIN to a freshly reset juror", async ({ page }) => {
    const flow = new JuryFlow(page);
    await flow.gotoEntry();
    await flow.fillIdentity(TEST_JUROR_NAME, TEST_JUROR_DEPT || "EE");

    // After a PIN reset the next identity submit lands on PinRevealStep.
    await expect(
      page
        .getByText(/your access pin|save your pin|noted \/ saved my pin/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Subsequent visit requires PIN entry to proceed", async ({ page, context }) => {
    // First visit: capture PIN, mark saved, continue past reveal.
    const flow = new JuryFlow(page);
    await flow.gotoEntry();
    await flow.fillIdentity(TEST_JUROR_NAME, TEST_JUROR_DEPT || "EE");
    await flow.confirmPinSaved();

    // Open a fresh context to simulate a new visit (no jury-resume state).
    const fresh = await context.browser()?.newContext();
    if (!fresh) test.skip(true, "Could not create fresh context");
    const newPage = await fresh!.newPage();

    const flow2 = new JuryFlow(newPage);
    await flow2.gotoEntry();
    await flow2.fillIdentity(TEST_JUROR_NAME, TEST_JUROR_DEPT || "EE");

    // PinStep should appear (4-digit input).
    await expect(
      newPage.getByLabel("Digit 1 of 4")
    ).toBeVisible({ timeout: 10_000 });

    if (runtimePin.length === 4) {
      await flow2.enterPin(runtimePin);
      await expect(
        newPage.getByLabel(/score for/i).first()
          .or(newPage.getByRole("button", { name: /^continue/i }).first())
      ).toBeVisible({ timeout: 10_000 });
    }

    await fresh!.close();
  });
});
