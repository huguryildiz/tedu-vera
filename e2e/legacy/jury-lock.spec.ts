// e2e/jury-lock.spec.ts
// ============================================================
// jury.e2e.02 — Semester locked → lock banner visible, inputs disabled.
//
// Assumes E2E demo DB has the target semester locked
// (edit_allowed = false, lock_active = true for the test juror).
//
// Required env vars:
//   E2E_JUROR_NAME       — juror identity name
//   E2E_JUROR_DEPT       — juror institution/department
//   E2E_JUROR_PIN        — 4-digit PIN
//   E2E_SEMESTER_NAME    — semester name to select (must be locked)
//   E2E_LOCKED=true      — opt-in flag confirming demo DB is locked
// ============================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_JUROR_NAME = process.env.E2E_JUROR_NAME  || "";
const TEST_JUROR_DEPT = process.env.E2E_JUROR_DEPT  || "";
const TEST_JUROR_PIN  = process.env.E2E_JUROR_PIN   || "";
const SEMESTER_NAME   = process.env.E2E_SEMESTER_NAME || "";
const ADMIN_PASSWORD  = process.env.E2E_ADMIN_PASSWORD || "";
const SUPABASE_URL    = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const RPC_SECRET      = process.env.VITE_RPC_SECRET || "";

let runtimePin = TEST_JUROR_PIN;
let runtimeSemesterId = "";
let runtimeSemesterName = SEMESTER_NAME;
let runtimeJurorName = TEST_JUROR_NAME;
let runtimeJurorDept = TEST_JUROR_DEPT;

function makeSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveSemesterId(supabase) {
  const active = await supabase.rpc("rpc_get_active_semester");
  if (active.error) throw active.error;
  const row = active.data?.[0];
  if (row?.name) runtimeSemesterName = String(row.name);
  return row?.id || "";
}

async function setupLockedSemester() {
  const supabase = makeSupabase();
  runtimeSemesterId = await resolveSemesterId(supabase);
  if (!runtimeSemesterId) return;

  const jurors = await supabase.rpc("rpc_admin_list_jurors", {
    p_admin_password: ADMIN_PASSWORD,
    p_semester_id: runtimeSemesterId,
    p_rpc_secret: RPC_SECRET,
  });
  if (jurors.error) throw jurors.error;
  const juror = (jurors.data || []).find((j) =>
    String(j.juror_name || "").trim().toLowerCase() === String(TEST_JUROR_NAME).trim().toLowerCase()
    && String(j.juror_inst || "").trim().toLowerCase() === String(TEST_JUROR_DEPT || "").trim().toLowerCase()
  ) || (jurors.data || []).find((j) =>
    String(j.juror_name || "").trim().toLowerCase() === String(TEST_JUROR_NAME).trim().toLowerCase()
  );
  if (!juror?.juror_id) throw new Error("jury-lock setup: juror not found");
  runtimeJurorName = String(juror.juror_name || TEST_JUROR_NAME);
  runtimeJurorDept = String(juror.juror_inst || TEST_JUROR_DEPT || "");

  const reset = await supabase.rpc("rpc_admin_reset_juror_pin", {
    p_semester_id: runtimeSemesterId,
    p_juror_id: juror.juror_id,
    p_admin_password: ADMIN_PASSWORD,
    p_rpc_secret: RPC_SECRET,
  });
  if (reset.error) throw reset.error;
  const newPin = reset.data?.[0]?.pin_plain_once;
  if (!newPin) throw new Error("jury-lock setup: PIN reset did not return pin_plain_once");
  runtimePin = String(newPin);

  const verify = await supabase.rpc("rpc_verify_juror_pin", {
    p_semester_id: runtimeSemesterId,
    p_juror_name: runtimeJurorName,
    p_juror_inst: runtimeJurorDept,
    p_pin: runtimePin,
  });
  if (verify.error) throw verify.error;
  if (!verify.data?.[0]?.ok) throw new Error("jury-lock setup: reset PIN verification failed");

  const lock = await supabase.rpc("rpc_admin_set_semester_eval_lock", {
    p_semester_id: runtimeSemesterId,
    p_enabled: true,
    p_admin_password: ADMIN_PASSWORD,
    p_rpc_secret: RPC_SECRET,
  });
  if (lock.error) throw lock.error;
}

async function teardownLockedSemester() {
  if (!runtimeSemesterId) return;
  const supabase = makeSupabase();
  const unlock = await supabase.rpc("rpc_admin_set_semester_eval_lock", {
    p_semester_id: runtimeSemesterId,
    p_enabled: false,
    p_admin_password: ADMIN_PASSWORD,
    p_rpc_secret: RPC_SECRET,
  });
  if (unlock.error) throw unlock.error;
}

test.describe("Jury lock behavior", () => {
  test.skip(
    !TEST_JUROR_NAME || !ADMIN_PASSWORD || !RPC_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "Skipped: lock setup requires juror, admin password, RPC secret and Supabase env values"
  );

  test.beforeAll(async () => {
    await setupLockedSemester();
  });

  test.afterAll(async () => {
    await teardownLockedSemester();
  });

  test("jury.e2e.02 locked semester shows lock banner and disabled inputs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start evaluation/i }).click();

    // InfoStep
    await page.getByLabel(/full name/i).fill(runtimeJurorName);
    await page.getByLabel(/institution \/ department/i).fill(runtimeJurorDept || "EE");
    await page.getByRole("button", { name: /start evaluation/i }).click();

    // PinStep
    const digits = runtimePin.split("");
    for (let i = 0; i < digits.length; i++) {
      await page.getByLabel(`Digit ${i + 1} of 4`).fill(digits[i]);
    }
    await page.getByRole("button", { name: /verify pin/i }).click();

    // Pin reveal / semester picker can appear based on account state.
    const pinSavedCheckbox = page.getByLabel(/i have noted \/ saved my pin/i);
    if (await pinSavedCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await pinSavedCheckbox.check();
      await page.getByRole("button", { name: /^continue/i }).first().click({ force: true });
    }

    const semesterBtn = page.getByRole("button", { name: new RegExp(runtimeSemesterName, "i") });
    if (await semesterBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await semesterBtn.click();
    }

    // EvalStep — lock banner must be visible
    await expect(
      page.getByRole("status").filter({ hasText: /locked/i })
        .or(page.getByText(/locked/i).first())
    ).toBeVisible({ timeout: 10_000 });

    // Score inputs must be disabled
    const scoreInput = page.getByLabel(/score for/i).first();
    await expect(scoreInput).toBeVisible({ timeout: 5_000 });
    await expect(scoreInput).toBeDisabled();
  });
});
