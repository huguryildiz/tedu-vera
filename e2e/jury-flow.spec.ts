// e2e/jury-flow.spec.ts
// ============================================================
// Jury identity form — E2E smoke tests.
//
// These tests run against a live dev server connected to the
// staging Supabase project (E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY).
//
// PIN-dependent steps are kept in a separate describe block so
// they can be skipped when test credentials are not configured.
// ============================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_JUROR_NAME  = process.env.E2E_JUROR_NAME  || "";
const TEST_JUROR_DEPT  = process.env.E2E_JUROR_DEPT  || "";
const TEST_JUROR_PIN   = process.env.E2E_JUROR_PIN   || "";
const SEMESTER_NAME    = process.env.E2E_SEMESTER_NAME || "";
const ADMIN_PASSWORD   = process.env.E2E_ADMIN_PASSWORD || "";
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const RPC_SECRET       = process.env.VITE_RPC_SECRET || "";

let runtimeJurorPin = TEST_JUROR_PIN;

async function ensureJuryPinReady() {
  if (!TEST_JUROR_NAME || !SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_PASSWORD || !RPC_SECRET) return;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const active = await supabase.rpc("rpc_get_active_semester");
  if (active.error) throw active.error;
  const semesterId = active.data?.[0]?.id || null;
  if (!semesterId) return;

  const jurorList = await supabase.rpc("rpc_admin_list_jurors", {
    p_admin_password: ADMIN_PASSWORD,
    p_semester_id: semesterId,
    p_rpc_secret: RPC_SECRET,
  });
  if (jurorList.error) throw jurorList.error;

  const nameNeedle = String(TEST_JUROR_NAME).trim().toLowerCase();
  const deptNeedle = String(TEST_JUROR_DEPT || "").trim().toLowerCase();
  const juror = (jurorList.data || []).find((j) =>
    String(j.juror_name || "").trim().toLowerCase() === nameNeedle
    && (!deptNeedle || String(j.juror_inst || "").trim().toLowerCase() === deptNeedle)
  ) || (jurorList.data || []).find((j) =>
    String(j.juror_name || "").trim().toLowerCase() === nameNeedle
  );
  if (!juror?.juror_id) return;

  const reset = await supabase.rpc("rpc_admin_reset_juror_pin", {
    p_semester_id: semesterId,
    p_juror_id: juror.juror_id,
    p_admin_password: ADMIN_PASSWORD,
    p_rpc_secret: RPC_SECRET,
  });
  if (reset.error) throw reset.error;

  const nextPin = reset.data?.[0]?.pin_plain_once;
  if (nextPin) runtimeJurorPin = String(nextPin);
}

test.describe("Jury identity form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Navigate to the jury form
    await page.getByRole("button", { name: /start evaluation/i }).click();
  });

  test("Start button is disabled when fields are empty", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /start evaluation/i });
    await expect(startBtn).toBeDisabled();
  });

  test("Start button is enabled when both fields are filled", async ({ page }) => {
    await page.getByLabel(/full name/i).fill("Test Juror");
    await page.getByLabel(/institution \/ department/i).fill("EE");
    const startBtn = page.getByRole("button", { name: /start evaluation/i });
    await expect(startBtn).toBeEnabled();
  });

  test("Name field accepts text input", async ({ page }) => {
    const nameInput = page.getByLabel(/full name/i);
    await nameInput.fill("Jane Smith");
    await expect(nameInput).toHaveValue("Jane Smith");
  });
});

// ── jury.e2e.01 — Full flow: identity → PIN → semester → eval screen ──────

test.describe("Full jury evaluation flow", () => {
  test.skip(
    !TEST_JUROR_NAME || !TEST_JUROR_PIN || !SEMESTER_NAME,
    "Skipped: E2E_JUROR_NAME / E2E_JUROR_PIN / E2E_SEMESTER_NAME not set"
  );

  test.beforeAll(async () => {
    await ensureJuryPinReady();
  });

  test("jury.e2e.01 juror reaches evaluation screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start evaluation/i }).click();

    // InfoStep
    await page.getByLabel(/full name/i).fill(TEST_JUROR_NAME);
    await page.getByLabel(/institution \/ department/i).fill(TEST_JUROR_DEPT || "EE");
    await page.getByRole("button", { name: /start evaluation/i }).click();

    // Flow can branch: semester/pin/pin_reveal/progress_check.
    // Drive the UI until evaluation inputs are visible.
    for (let stepGuard = 0; stepGuard < 8; stepGuard++) {
      const scoreInput = page.getByLabel(/score for/i).first();
      if (await scoreInput.isVisible({ timeout: 600 }).catch(() => false)) break;

      const pinSavedCheckbox = page.getByLabel(/i have noted \/ saved my pin/i);
      if (await pinSavedCheckbox.isVisible({ timeout: 600 }).catch(() => false)) {
        await pinSavedCheckbox.check();
        await page.getByRole("button", { name: /^continue/i }).first().click({ force: true });
        continue;
      }

      const pinDigit1 = page.getByLabel("Digit 1 of 4");
      if (await pinDigit1.isVisible({ timeout: 600 }).catch(() => false)) {
        const digits = runtimeJurorPin.split("");
        for (let i = 0; i < digits.length; i++) {
          await page.getByLabel(`Digit ${i + 1} of 4`).fill(digits[i]);
        }
        await page.getByRole("button", { name: /verify pin/i }).click();
        continue;
      }

      const semesterBtn = page.getByRole("button", { name: new RegExp(SEMESTER_NAME, "i") });
      if (await semesterBtn.isVisible({ timeout: 600 }).catch(() => false)) {
        await semesterBtn.click();
        continue;
      }

      const continueBtn = page.getByRole("button", { name: /^continue/i });
      if (await continueBtn.isVisible({ timeout: 600 }).catch(() => false)) {
        await continueBtn.first().click({ force: true });
        continue;
      }

      await page.waitForTimeout(300);
    }

    // EvalStep — at least one score input must be visible
    await expect(
      page.getByLabel(/score for/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Jury PIN flow (legacy smoke) ─────────────────────────────────────────

test.describe("Jury PIN flow", () => {
  test.skip(
    !TEST_JUROR_NAME || !TEST_JUROR_PIN,
    "Skipped: E2E_JUROR_NAME / E2E_JUROR_PIN not set"
  );

  test.beforeAll(async () => {
    await ensureJuryPinReady();
  });

  test("Known juror reaches PIN step after identity submit", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start evaluation/i }).click();

    await page.getByLabel(/full name/i).fill(TEST_JUROR_NAME);
    await page.getByLabel(/institution \/ department/i).fill(TEST_JUROR_DEPT);
    await page.getByRole("button", { name: /start evaluation/i }).click();

    // After identity submit with a known juror, a PIN step should appear
    // (either PinStep "Enter your access PIN" or PinRevealStep "Your Access PIN")
    await expect(page.getByText(/your access pin/i)).toBeVisible({ timeout: 10_000 });
  });
});
