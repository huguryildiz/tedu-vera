/**
 * E2E: setup-wizard step-level DB writes — P1-A2 (W15)
 *
 * Companion to setup-wizard-submit.spec.ts (which drives the full UI flow).
 * This spec is API-level — no browser UI: an authenticated org-admin user
 * exercises each wizard step's underlying write path via the same Supabase
 * surface the wizard hits, and we assert via the service-role admin client
 * that the row landed in the DB.
 *
 * Step → write path mapping (verified against src/shared/api/admin/*.js):
 *   step 2 (createPeriod)        → INSERT INTO periods (PostgREST)
 *   step 3 (savePeriodCriteria)  → rpc_admin_save_period_criteria
 *   step 4 (createProject)       → INSERT INTO projects (PostgREST)
 *   step 5 (createJuror)         → INSERT INTO jurors (PostgREST)
 *
 * A separate WIZARD email is used so this spec can run alongside
 * setup-wizard-submit.spec.ts without colliding on the same auth user.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, deleteUserByEmail } from "../helpers/supabaseAdmin";
import { E2E_WIZARD_ORG_ID } from "../fixtures/seed-ids";

// ── Supabase connection ───────────────────────────────────────────────────────

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_DEMO_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

// ── Auth helpers (mirrored from settings-save.spec.ts) ────────────────────────

async function signInWithPassword(email: string, password: string): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) failed ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body.access_token) throw new Error(`No access_token for ${email}`);
  return body.access_token as string;
}

function makeUserClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Test identity ─────────────────────────────────────────────────────────────

const WIZARD_EMAIL = "e2e-wizard-steps@vera-eval.app";
const WIZARD_PASSWORD = "E2eWizardSteps!2026";

const SUFFIX = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("setup-wizard step-level DB writes", () => {
  test.describe.configure({ mode: "serial" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wizardClient: any;

  // State carried between serial tests
  let periodId = "";
  let jurorId = "";
  const periodName = `E2E Wizard Steps ${SUFFIX}`;
  const projectTitle = `E2E Wizard Project ${SUFFIX}`;
  const jurorName = `E2E Wizard Juror ${SUFFIX}`;
  const jurorEmail = `e2e-wizard-juror-${SUFFIX}@e2e.local`;

  test.beforeAll(async () => {
    // Periods cleanup — unlock first because block_locked_period_delete trigger
    // rejects DELETE on locked rows (same pattern as setup-wizard-submit.spec.ts).
    const { data: priorPeriods } = await adminClient
      .from("periods")
      .select("id")
      .eq("organization_id", E2E_WIZARD_ORG_ID);
    if (priorPeriods?.length) {
      const ids = priorPeriods.map((p) => p.id);
      await adminClient.from("periods").update({ is_locked: false }).in("id", ids);
      await adminClient.from("periods").delete().in("id", ids);
    }

    // Reset setup_completed_at so the wizard org appears un-onboarded again
    await adminClient
      .from("organizations")
      .update({ setup_completed_at: null })
      .eq("id", E2E_WIZARD_ORG_ID);

    // Recreate the wizard auth user
    await deleteUserByEmail(WIZARD_EMAIL).catch(() => {});
    const { data, error } = await adminClient.auth.admin.createUser({
      email: WIZARD_EMAIL,
      password: WIZARD_PASSWORD,
      email_confirm: true,
    });
    expect(error, `createUser(wizard-steps): ${error?.message}`).toBeNull();
    const userId = data!.user!.id;

    const { error: memberErr } = await adminClient.from("memberships").insert({
      user_id: userId,
      organization_id: E2E_WIZARD_ORG_ID,
      status: "active",
      role: "org_admin",
      is_owner: true,
    });
    expect(memberErr, `membership(wizard-steps): ${memberErr?.message}`).toBeNull();

    // Authenticate as the wizard user — this is what drives RLS for the writes
    const token = await signInWithPassword(WIZARD_EMAIL, WIZARD_PASSWORD);
    wizardClient = makeUserClient(token);
  });

  test.afterAll(async () => {
    // Periods cleanup again (unlock first)
    const { data: leftover } = await adminClient
      .from("periods")
      .select("id")
      .eq("organization_id", E2E_WIZARD_ORG_ID);
    if (leftover?.length) {
      const ids = leftover.map((p) => p.id);
      await adminClient.from("periods").update({ is_locked: false }).in("id", ids);
      await adminClient.from("periods").delete().in("id", ids);
    }

    // Clean up the juror created in T4 (lives at org level, not under the period)
    if (jurorId) {
      await adminClient.from("jurors").delete().eq("id", jurorId);
    } else {
      // Defensive sweep by name in case T4 inserted but never stored the id
      await adminClient
        .from("jurors")
        .delete()
        .eq("organization_id", E2E_WIZARD_ORG_ID)
        .eq("juror_name", jurorName);
    }

    await adminClient
      .from("organizations")
      .update({ setup_completed_at: null })
      .eq("id", E2E_WIZARD_ORG_ID);

    await deleteUserByEmail(WIZARD_EMAIL).catch(() => {});
  });

  // ── T1 — step 2: createPeriod ──────────────────────────────────────────────
  test("step 2 — createPeriod writes period to DB", async () => {
    const { data, error } = await wizardClient
      .from("periods")
      .insert({
        organization_id: E2E_WIZARD_ORG_ID,
        name: periodName,
        season: "Spring",
      })
      .select("id, name, organization_id, season")
      .single();
    expect(error, `insert periods error: ${error?.message}`).toBeNull();
    expect(data?.id).toBeTruthy();
    periodId = data!.id;

    // Service-role read confirms the row really persisted (bypasses RLS)
    const { data: row, error: rowErr } = await adminClient
      .from("periods")
      .select("id, name, organization_id, season")
      .eq("id", periodId)
      .single();
    expect(rowErr).toBeNull();
    expect(row?.organization_id).toBe(E2E_WIZARD_ORG_ID);
    expect(row?.name).toBe(periodName);
    expect(row?.season).toBe("Spring");
  });

  // ── T2 — step 3: savePeriodCriteria ────────────────────────────────────────
  test("step 3 — savePeriodCriteria writes period_criteria to DB", async () => {
    expect(periodId, "T1 must have created a period").toBeTruthy();

    // Payload mirrors the shape in src/shared/api/admin/periods.js → the RPC reads
    // { key, label, color, max, blurb, rubric }.
    const criteriaPayload = [
      {
        key: "c1",
        label: "E2E Criterion One",
        color: "#3b82f6",
        max: 60,
        blurb: "Test criterion one description",
        rubric: [{ label: "Pass", min_score: 0, max_score: 60 }],
      },
      {
        key: "c2",
        label: "E2E Criterion Two",
        color: "#22c55e",
        max: 40,
        blurb: "Test criterion two description",
        rubric: [{ label: "Pass", min_score: 0, max_score: 40 }],
      },
    ];

    const { data, error } = await wizardClient.rpc("rpc_admin_save_period_criteria", {
      p_period_id: periodId,
      p_criteria: criteriaPayload,
    });
    expect(error, `save_period_criteria error: ${error?.message}`).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(2);

    // Verify via service-role
    const { data: rows, error: rowsErr } = await adminClient
      .from("period_criteria")
      .select("key, label, max_score, weight")
      .eq("period_id", periodId)
      .order("sort_order", { ascending: true });
    expect(rowsErr).toBeNull();
    expect(rows?.length).toBe(2);
    expect(rows?.[0].key).toBe("c1");
    expect(rows?.[0].label).toBe("E2E Criterion One");
    expect(Number(rows?.[0].max_score)).toBe(60);
    expect(rows?.[1].key).toBe("c2");
    expect(Number(rows?.[1].max_score)).toBe(40);
    // weights normalize to percentages summing to 100 (60+40 = 100 → 60% + 40%)
    const totalWeight = (rows ?? []).reduce((s, r) => s + Number(r.weight), 0);
    expect(Math.round(totalWeight)).toBe(100);
  });

  // ── T3 — step 4: createProject ─────────────────────────────────────────────
  test("step 4 — createProject writes project to DB", async () => {
    expect(periodId, "T1 must have created a period").toBeTruthy();

    const { data, error } = await wizardClient
      .from("projects")
      .insert({
        period_id: periodId,
        title: projectTitle,
        members: [],
      })
      .select("id, title, period_id")
      .single();
    expect(error, `insert projects error: ${error?.message}`).toBeNull();
    expect(data?.id).toBeTruthy();
    const projectId = data!.id;

    const { data: row, error: rowErr } = await adminClient
      .from("projects")
      .select("id, title, period_id")
      .eq("id", projectId)
      .single();
    expect(rowErr).toBeNull();
    expect(row?.period_id).toBe(periodId);
    expect(row?.title).toBe(projectTitle);
  });

  // ── T4 — step 5: createJuror ───────────────────────────────────────────────
  test("step 5 — createJuror writes juror to DB", async () => {
    const { data, error } = await wizardClient
      .from("jurors")
      .insert({
        organization_id: E2E_WIZARD_ORG_ID,
        juror_name: jurorName,
        affiliation: "E2E Wizard University",
        email: jurorEmail,
      })
      .select("id, juror_name, organization_id, affiliation, email")
      .single();
    expect(error, `insert jurors error: ${error?.message}`).toBeNull();
    expect(data?.id).toBeTruthy();
    jurorId = data!.id;

    const { data: row, error: rowErr } = await adminClient
      .from("jurors")
      .select("id, juror_name, organization_id, affiliation, email")
      .eq("id", jurorId)
      .single();
    expect(rowErr).toBeNull();
    expect(row?.organization_id).toBe(E2E_WIZARD_ORG_ID);
    expect(row?.juror_name).toBe(jurorName);
    expect(row?.affiliation).toBe("E2E Wizard University");
    expect(row?.email).toBe(jurorEmail);
  });
});
