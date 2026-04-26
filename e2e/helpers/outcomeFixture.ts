import type { Page } from "@playwright/test";
import { adminClient } from "./supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

/**
 * Outcome attainment fixture for E1 math-correctness tests.
 *
 * Builds a fully isolated period with criteria, outcomes, criterion→outcome
 * mappings, one juror, one project, and one submitted score sheet. The period
 * is locked at the end so the configuration matches the real "analytics can
 * read this period" state.
 *
 * `readAttainment(page, periodId)` invokes the real production function
 * `getOutcomeAttainmentTrends` from
 * [src/shared/api/admin/scores.js:259-345](src/shared/api/admin/scores.js#L259-L345)
 * inside the admin page context via `page.evaluate` — the attainment math runs
 * against the same module the production UI uses, so a regression in scores.js
 * propagates to these tests.
 *
 * Schema note: two `weight` fields exist.
 *   - `period_criteria.weight`   → stored, NOT used by attainment math
 *   - `period_criterion_outcome_maps.weight` → used by attainment math
 * The fixture lets callers configure both independently.
 */

export interface CriterionSpec {
  key: string;
  weight: number;   // period_criteria.weight (metadata; NOT used in attainment)
  max: number;      // period_criteria.max_score (divisor in attainment math)
}

export interface MappingSpec {
  outcomeCode: string;
  criterionKey: string;
  weight: number;                          // period_criterion_outcome_maps.weight (used in math)
  coverage_type?: "direct" | "indirect";   // default "direct"
}

export interface ScoreSpec {
  key: string;      // criterion key
  value: number;    // score_sheet_items.score_value
}

export interface SetupOutcomeFixtureOpts {
  criteriaWeights: CriterionSpec[];
  outcomeMappings: MappingSpec[];
  scores: ScoreSpec[];
  namePrefix?: string;
}

export interface OutcomeFixture {
  periodId: string;
  orgId: string;
  jurorId: string;
  projectId: string;
  scoreSheetId: string;
  /** criterionKey → period_criteria.id */
  criteriaIds: Record<string, string>;
  /** outcomeCode → period_outcomes.id */
  outcomeIds: Record<string, string>;
  /** `${outcomeCode}::${criterionKey}` → period_criterion_outcome_maps.id */
  mappingIds: Record<string, string>;
}

const uniqueSuffix = (): string => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
const mappingKey = (outcomeCode: string, criterionKey: string): string => `${outcomeCode}::${criterionKey}`;

export async function setupOutcomeFixture(opts: SetupOutcomeFixtureOpts): Promise<OutcomeFixture> {
  const suffix = uniqueSuffix();
  const periodName = `${opts.namePrefix ?? "E1 Outcome"} ${suffix}`;

  // 1. Period (unlocked so child INSERTs pass block_period_*_on_locked triggers)
  const { data: period, error: periodErr } = await adminClient
    .from("periods")
    .insert({
      organization_id: E2E_PERIODS_ORG_ID,
      name: periodName,
      is_locked: false,
      season: "Spring",
    })
    .select("id")
    .single();
  if (periodErr || !period) {
    throw new Error(`setupOutcomeFixture period insert failed: ${periodErr?.message}`);
  }
  const periodId = period.id as string;

  // 2. Criteria — unique key per period (key scoped with suffix to avoid collisions
  //    across concurrent fixture instances within the same org)
  const criteriaRows = opts.criteriaWeights.map((c, idx) => ({
    period_id: periodId,
    key: `${c.key}_${suffix}`,
    label: c.key,
    max_score: c.max,
    weight: c.weight,
    sort_order: idx,
  }));
  const { data: criteria, error: critErr } = await adminClient
    .from("period_criteria")
    .insert(criteriaRows)
    .select("id, key, sort_order");
  if (critErr || !criteria) {
    throw new Error(`setupOutcomeFixture criteria insert failed: ${critErr?.message}`);
  }

  // Map input key ("C1") → inserted id, via sort_order (stable across DB reorders)
  const criteriaIds: Record<string, string> = {};
  for (const c of criteria) {
    const input = opts.criteriaWeights[c.sort_order];
    if (!input) continue;
    criteriaIds[input.key] = c.id as string;
  }

  // 3. Outcomes — derive unique codes from mappings
  const outcomeCodes = Array.from(new Set(opts.outcomeMappings.map((m) => m.outcomeCode)));
  const outcomeRows = outcomeCodes.map((code, idx) => ({
    period_id: periodId,
    code,
    label: code,
    sort_order: idx,
  }));
  const { data: outcomes, error: outErr } = await adminClient
    .from("period_outcomes")
    .insert(outcomeRows)
    .select("id, code");
  if (outErr || !outcomes) {
    throw new Error(`setupOutcomeFixture outcomes insert failed: ${outErr?.message}`);
  }
  const outcomeIds: Record<string, string> = {};
  for (const o of outcomes) outcomeIds[o.code as string] = o.id as string;

  // 4. Criterion→outcome mappings
  const mapRows = opts.outcomeMappings.map((m) => {
    const criterionId = criteriaIds[m.criterionKey];
    const outcomeId = outcomeIds[m.outcomeCode];
    if (!criterionId) throw new Error(`setupOutcomeFixture: unknown criterionKey ${m.criterionKey}`);
    if (!outcomeId) throw new Error(`setupOutcomeFixture: unknown outcomeCode ${m.outcomeCode}`);
    return {
      period_id: periodId,
      period_criterion_id: criterionId,
      period_outcome_id: outcomeId,
      coverage_type: m.coverage_type ?? "direct",
      weight: m.weight,
    };
  });
  const { data: maps, error: mapErr } = await adminClient
    .from("period_criterion_outcome_maps")
    .insert(mapRows)
    .select("id, period_criterion_id, period_outcome_id");
  if (mapErr || !maps) {
    throw new Error(`setupOutcomeFixture mappings insert failed: ${mapErr?.message}`);
  }
  // Reverse-index mapping IDs
  const outcomeCodeById = Object.fromEntries(
    Object.entries(outcomeIds).map(([code, id]) => [id, code])
  );
  const criterionKeyById = Object.fromEntries(
    Object.entries(criteriaIds).map(([key, id]) => [id, key])
  );
  const mappingIds: Record<string, string> = {};
  for (const m of maps) {
    const code = outcomeCodeById[m.period_outcome_id as string];
    const key = criterionKeyById[m.period_criterion_id as string];
    if (code && key) mappingIds[mappingKey(code, key)] = m.id as string;
  }

  // 5. Juror (org-scoped)
  const { data: juror, error: jurorErr } = await adminClient
    .from("jurors")
    .insert({
      organization_id: E2E_PERIODS_ORG_ID,
      juror_name: `E1 Juror ${suffix}`,
      affiliation: "E1 Test Affiliation",
    })
    .select("id")
    .single();
  if (jurorErr || !juror) {
    throw new Error(`setupOutcomeFixture juror insert failed: ${jurorErr?.message}`);
  }
  const jurorId = juror.id as string;

  // 6. juror_period_auth — F1 rule: session_token_hash explicitly null
  const { error: authErr } = await adminClient
    .from("juror_period_auth")
    .insert({
      juror_id: jurorId,
      period_id: periodId,
      pin_hash: null,
      session_token_hash: null,
      failed_attempts: 0,
      locked_until: null,
      final_submitted_at: null,
    });
  if (authErr) {
    throw new Error(`setupOutcomeFixture juror_period_auth insert failed: ${authErr.message}`);
  }

  // 7. Project (project_no auto-assigned)
  const { data: project, error: projErr } = await adminClient
    .from("projects")
    .insert({
      period_id: periodId,
      title: `E1 Project ${suffix}`,
      members: [],
    })
    .select("id")
    .single();
  if (projErr || !project) {
    throw new Error(`setupOutcomeFixture project insert failed: ${projErr?.message}`);
  }
  const projectId = project.id as string;

  // 8. score_sheet (submitted status — attainment math does not filter by status,
  //    but "submitted" mirrors a real evaluation)
  const now = new Date().toISOString();
  const { data: sheet, error: sheetErr } = await adminClient
    .from("score_sheets")
    .insert({
      period_id: periodId,
      project_id: projectId,
      juror_id: jurorId,
      status: "submitted",
      started_at: now,
      last_activity_at: now,
    })
    .select("id")
    .single();
  if (sheetErr || !sheet) {
    throw new Error(`setupOutcomeFixture score_sheet insert failed: ${sheetErr?.message}`);
  }
  const scoreSheetId = sheet.id as string;

  // 9. score_sheet_items — one per score spec
  const itemRows = opts.scores.map((s) => {
    const critId = criteriaIds[s.key];
    if (!critId) throw new Error(`setupOutcomeFixture: score references unknown criterion ${s.key}`);
    return {
      score_sheet_id: scoreSheetId,
      period_criterion_id: critId,
      score_value: s.value,
    };
  });
  if (itemRows.length) {
    const { error: itemsErr } = await adminClient.from("score_sheet_items").insert(itemRows);
    if (itemsErr) {
      throw new Error(`setupOutcomeFixture score_sheet_items insert failed: ${itemsErr.message}`);
    }
  }

  // 10. Lock period (mirrors real active-period state)
  const { error: lockErr } = await adminClient
    .from("periods")
    .update({ is_locked: true, activated_at: new Date().toISOString() })
    .eq("id", periodId);
  if (lockErr) {
    throw new Error(`setupOutcomeFixture period lock failed: ${lockErr.message}`);
  }

  return {
    periodId,
    orgId: E2E_PERIODS_ORG_ID,
    jurorId,
    projectId,
    scoreSheetId,
    criteriaIds,
    outcomeIds,
    mappingIds,
  };
}

/**
 * Reads per-outcome attainment (`avg` field) by invoking the real production
 * function `getOutcomeAttainmentTrends` inside an authenticated admin page.
 *
 * Why page.evaluate + dynamic import:
 *   - The Vite dev server serves `/src/shared/api/admin/scores.js` on demand.
 *   - Running inside a signed-in admin page means the supabase client singleton
 *     carries the admin's auth session, so RLS resolves the same way as prod.
 *   - Any regression in scores.js (e.g. `* 100` → `* 200`, weight normalization
 *     drift) surfaces as a test failure — the test is coupled to the real module,
 *     not to a TypeScript replica.
 *
 * Prerequisites: caller must have signed the admin in and navigated to an
 * `/admin/*` route (so Vite has the app bundle loaded and the supabase client
 * has a session). Returns `{ [outcomeCode]: avg }`, omitting outcomes with no
 * contributors. `avg` is pre-rounded to 1 decimal by scores.js.
 */
export async function readAttainment(
  page: Page,
  periodId: string,
): Promise<Record<string, number>> {
  const result = await page.evaluate(async (pid) => {
    // @ts-expect-error Vite dev server resolves this absolute-from-root path at runtime
    const mod = await import("/src/shared/api/admin/scores.js");
    const trends = await mod.getOutcomeAttainmentTrends([pid]);
    const period = Array.isArray(trends) ? trends[0] : null;
    if (!period || !Array.isArray(period.outcomes)) return {};
    const out: Record<string, number> = {};
    for (const o of period.outcomes) {
      if (o && typeof o.code === "string" && typeof o.avg === "number") {
        out[o.code] = o.avg;
      }
    }
    return out;
  }, periodId);
  return result;
}

/**
 * Like {@link readAttainment} but returns the full per-outcome record
 * (`avg` + `attainmentRate`) and tolerates `null` values. Phase 1 edge-case
 * tests need to assert the threshold-driven `attainmentRate` and the
 * "missing score → null" code path that `readAttainment` filters out.
 */
export interface AttainmentRow {
  avg: number | null;
  attainmentRate: number | null;
}

export async function readAttainmentFull(
  page: Page,
  periodId: string,
): Promise<Record<string, AttainmentRow>> {
  const result = await page.evaluate(async (pid) => {
    // @ts-expect-error Vite dev server resolves this absolute-from-root path at runtime
    const mod = await import("/src/shared/api/admin/scores.js");
    const trends = await mod.getOutcomeAttainmentTrends([pid]);
    const period = Array.isArray(trends) ? trends[0] : null;
    const out: Record<string, { avg: number | null; attainmentRate: number | null }> = {};
    if (!period || !Array.isArray(period.outcomes)) return out;
    for (const o of period.outcomes) {
      if (o && typeof o.code === "string") {
        out[o.code] = {
          avg: typeof o.avg === "number" ? o.avg : null,
          attainmentRate:
            typeof o.attainmentRate === "number" ? o.attainmentRate : null,
        };
      }
    }
    return out;
  }, periodId);
  return result;
}

/**
 * Idempotent teardown. Unlocks the period (so block_period_*_on_locked triggers
 * don't reject DELETE cascades on child tables), then deletes the period
 * (CASCADE removes projects, score_sheets, score_sheet_items, period_criteria,
 * period_outcomes, period_criterion_outcome_maps, juror_period_auth rows), then
 * deletes the standalone juror row.
 *
 * Safe to call with null/undefined or a partial fixture — use in afterEach/afterAll.
 */
export async function teardownOutcomeFixture(
  fixture: OutcomeFixture | null | undefined
): Promise<void> {
  if (!fixture) return;

  if (fixture.periodId) {
    try {
      await adminClient
        .from("periods")
        .update({ is_locked: false })
        .eq("id", fixture.periodId);
    } catch {
      // continue — delete below will surface the real failure
    }
    try {
      await adminClient.from("periods").delete().eq("id", fixture.periodId);
    } catch {
      // swallow — partial cleanup is acceptable in afterEach
    }
  }

  if (fixture.jurorId) {
    try {
      await adminClient.from("jurors").delete().eq("id", fixture.jurorId);
    } catch {
      // swallow
    }
  }
}

/**
 * Deletes a single criterion↔outcome mapping while the period is unlocked, then
 * re-locks the period. Used by Test 4 to verify attainment responds to mapping
 * removal.
 */
export async function deleteMapping(
  fixture: OutcomeFixture,
  outcomeCode: string,
  criterionKey: string
): Promise<void> {
  const mapId = fixture.mappingIds[mappingKey(outcomeCode, criterionKey)];
  if (!mapId) throw new Error(`deleteMapping: no mapping found for ${outcomeCode}::${criterionKey}`);

  const { error: unlockErr } = await adminClient
    .from("periods")
    .update({ is_locked: false })
    .eq("id", fixture.periodId);
  if (unlockErr) throw new Error(`deleteMapping unlock failed: ${unlockErr.message}`);

  const { error: delErr } = await adminClient
    .from("period_criterion_outcome_maps")
    .delete()
    .eq("id", mapId);
  if (delErr) throw new Error(`deleteMapping delete failed: ${delErr.message}`);

  const { error: relockErr } = await adminClient
    .from("periods")
    .update({ is_locked: true, activated_at: new Date().toISOString() })
    .eq("id", fixture.periodId);
  if (relockErr) throw new Error(`deleteMapping relock failed: ${relockErr.message}`);

  delete fixture.mappingIds[mappingKey(outcomeCode, criterionKey)];
}
