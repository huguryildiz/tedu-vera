import { adminClient } from "./supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

/**
 * Scoring fixture for C4 scoring-correctness tests.
 *
 * Creates a fully isolated period with its own criteria, projects, juror, and
 * juror_period_auth row, then locks the period so it auto-selects as the admin
 * default (pickDefaultPeriod prefers published/locked with most recent
 * activated_at).
 *
 * VERA's getProjectSummary computes totalAvg as the unweighted raw sum of
 * score_sheet_items.score_value across all criteria, averaged across jurors.
 * period_criteria.weight is stored but NOT used by the ranking pipeline —
 * max_score is the effective scaling factor. Tests must pick score values that
 * yield the expected raw sum, not values that assume weight-multiplier math.
 */

export interface ScoringFixture {
  periodId: string;
  periodName: string;
  criteriaAId: string;
  criteriaAKey: string;
  criteriaBId: string;
  criteriaBKey: string;
  p1Id: string;
  p2Id: string;
  /** First juror — kept as `jurorId` for backward compatibility with C4 tests. */
  jurorId: string;
  /** All juror rows created by setupScoringFixture (length === opts.jurors). */
  jurorIds: string[];
  /** Outcome snapshot rows created when `outcomes: true`. Undefined otherwise. */
  outcomeAId?: string;
  outcomeACode?: string;
  outcomeBId?: string;
  outcomeBCode?: string;
}

export interface SetupScoringFixtureOpts {
  aMax?: number;
  bMax?: number;
  aWeight?: number;
  bWeight?: number;
  namePrefix?: string;
  /** Number of jurors to seed. Default 1. C4 tests rely on the default; E3 uses 2. */
  jurors?: number;
  /**
   * When true, seed two `period_outcomes` (PO_A, PO_B) and map them 1:1 to
   * criteria A/B via `period_criterion_outcome_maps`. Required for analytics
   * attainment card tests.
   */
  outcomes?: boolean;
}

export interface ProjectScores {
  a: number;
  b: number;
}

/**
 * Per-juror, per-project scoring cell for multi-juror fixtures.
 * - `a` / `b` omitted → item not inserted (yields a "partial" cell state).
 * - `status` defaults to "submitted".
 */
export interface MatrixCell {
  a?: number;
  b?: number;
  status?: "submitted" | "in_progress" | "draft";
}

/**
 * Pattern entry for writeMatrixScores — one entry per juror in fixture.jurorIds.
 * Set a project to `null` (or omit) to leave the juror×project cell empty
 * (no score_sheet row inserted).
 */
export interface MatrixJurorPattern {
  p1?: MatrixCell | null;
  p2?: MatrixCell | null;
}

const uniqueSuffix = (): string => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export async function setupScoringFixture(
  opts: SetupScoringFixtureOpts = {},
): Promise<ScoringFixture> {
  const aMax = opts.aMax ?? 30;
  const bMax = opts.bMax ?? 70;
  const aWeight = opts.aWeight ?? aMax;
  const bWeight = opts.bWeight ?? bMax;
  const jurorCount = Math.max(1, opts.jurors ?? 1);
  const suffix = uniqueSuffix();
  const periodName = `${opts.namePrefix ?? "C4 Scoring"} ${suffix}`;
  const aKey = `c4_a_${suffix}`;
  const bKey = `c4_b_${suffix}`;

  // Step 1 — create period unlocked so criteria & projects inserts are allowed
  // by the block_period_*_on_locked triggers.
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
    throw new Error(`setupScoringFixture period insert failed: ${periodErr?.message}`);
  }
  const periodId = period.id as string;

  // Step 2 — two criteria with sort_order so we can resolve A vs B
  const { data: criteria, error: critErr } = await adminClient
    .from("period_criteria")
    .insert([
      {
        period_id: periodId,
        key: aKey,
        label: "Criterion A",
        max_score: aMax,
        weight: aWeight,
        sort_order: 0,
      },
      {
        period_id: periodId,
        key: bKey,
        label: "Criterion B",
        max_score: bMax,
        weight: bWeight,
        sort_order: 1,
      },
    ])
    .select("id, sort_order");
  if (critErr || !criteria) {
    throw new Error(`setupScoringFixture criteria insert failed: ${critErr?.message}`);
  }
  const criteriaAId = criteria.find((c) => c.sort_order === 0)?.id as string | undefined;
  const criteriaBId = criteria.find((c) => c.sort_order === 1)?.id as string | undefined;
  if (!criteriaAId || !criteriaBId) {
    throw new Error("setupScoringFixture: could not resolve criteria IDs from insert");
  }

  // Step 3 — two projects; project_no auto-assigned by assign_project_no trigger
  const { data: projects, error: projErr } = await adminClient
    .from("projects")
    .insert([
      { period_id: periodId, title: `C4 P1 ${suffix}`, members: [] },
      { period_id: periodId, title: `C4 P2 ${suffix}`, members: [] },
    ])
    .select("id, title");
  if (projErr || !projects) {
    throw new Error(`setupScoringFixture projects insert failed: ${projErr?.message}`);
  }
  const p1Id = projects.find((p) => p.title.startsWith("C4 P1"))?.id as string | undefined;
  const p2Id = projects.find((p) => p.title.startsWith("C4 P2"))?.id as string | undefined;
  if (!p1Id || !p2Id) {
    throw new Error("setupScoringFixture: could not resolve project IDs from insert");
  }

  // Step 4 — jurors (org-scoped). Names suffixed with index so both
  // backward-compat (single juror) and multi-juror paths produce stable rows.
  const jurorRows = Array.from({ length: jurorCount }, (_, idx) => ({
    organization_id: E2E_PERIODS_ORG_ID,
    juror_name: jurorCount === 1
      ? `C4 Judge ${suffix}`
      : `E3 Judge ${idx + 1} ${suffix}`,
    affiliation: jurorCount === 1 ? "C4 Test Affiliation" : `E3 Test Affiliation ${idx + 1}`,
  }));
  const { data: jurors, error: jurorErr } = await adminClient
    .from("jurors")
    .insert(jurorRows)
    .select("id, juror_name");
  if (jurorErr || !jurors || jurors.length !== jurorCount) {
    throw new Error(`setupScoringFixture juror insert failed: ${jurorErr?.message}`);
  }
  // Resolve by name so a PostgREST return-order reshuffle can't swap J1 ↔ J2.
  const jurorIds: string[] = jurorRows.map((row) => {
    const match = jurors.find((j) => j.juror_name === row.juror_name);
    if (!match) {
      throw new Error(`setupScoringFixture: could not resolve juror row for ${row.juror_name}`);
    }
    return match.id as string;
  });
  const jurorId = jurorIds[0];

  // Step 5 — juror_period_auth for each juror (F1 rule: session_token_hash explicitly null)
  const { error: authErr } = await adminClient
    .from("juror_period_auth")
    .insert(
      jurorIds.map((id) => ({
        juror_id: id,
        period_id: periodId,
        pin_hash: null,
        session_token_hash: null,
        failed_attempts: 0,
        locked_until: null,
        final_submitted_at: null,
      })),
    );
  if (authErr) {
    throw new Error(`setupScoringFixture juror_period_auth insert failed: ${authErr.message}`);
  }

  // Step 6 — optional outcome snapshot + criterion→outcome maps.
  let outcomeAId: string | undefined;
  let outcomeBId: string | undefined;
  const outcomeACode = `PO_A_${suffix}`;
  const outcomeBCode = `PO_B_${suffix}`;
  if (opts.outcomes) {
    const { data: outcomes, error: outcomeErr } = await adminClient
      .from("period_outcomes")
      .insert([
        { period_id: periodId, code: outcomeACode, label: "E3 Outcome A", sort_order: 0, coverage_type: "direct" },
        { period_id: periodId, code: outcomeBCode, label: "E3 Outcome B", sort_order: 1, coverage_type: "direct" },
      ])
      .select("id, sort_order");
    if (outcomeErr || !outcomes) {
      throw new Error(`setupScoringFixture period_outcomes insert failed: ${outcomeErr?.message}`);
    }
    outcomeAId = outcomes.find((o) => o.sort_order === 0)?.id as string;
    outcomeBId = outcomes.find((o) => o.sort_order === 1)?.id as string;
    const { error: mapErr } = await adminClient
      .from("period_criterion_outcome_maps")
      .insert([
        { period_id: periodId, period_criterion_id: criteriaAId, period_outcome_id: outcomeAId, coverage_type: "direct", weight: 1 },
        { period_id: periodId, period_criterion_id: criteriaBId, period_outcome_id: outcomeBId, coverage_type: "direct", weight: 1 },
      ]);
    if (mapErr) {
      throw new Error(`setupScoringFixture period_criterion_outcome_maps insert failed: ${mapErr.message}`);
    }
  }

  // Step 7 — lock period + set activated_at so pickDefaultPeriod auto-selects it
  const { error: lockErr } = await adminClient
    .from("periods")
    .update({
      is_locked: true,
      activated_at: new Date().toISOString(),
    })
    .eq("id", periodId);
  if (lockErr) {
    throw new Error(`setupScoringFixture period lock failed: ${lockErr.message}`);
  }

  return {
    periodId,
    periodName,
    criteriaAId,
    criteriaAKey: aKey,
    criteriaBId,
    criteriaBKey: bKey,
    p1Id,
    p2Id,
    jurorId,
    jurorIds,
    outcomeAId,
    outcomeACode: opts.outcomes ? outcomeACode : undefined,
    outcomeBId,
    outcomeBCode: opts.outcomes ? outcomeBCode : undefined,
  };
}

/**
 * Submits score sheets for both fixture projects on behalf of the fixture juror.
 * Uses upsert so callers can re-score after mutating fixture state.
 */
export async function writeScoresAsJuror(
  fixture: ScoringFixture,
  scores: { p1: ProjectScores; p2: ProjectScores },
): Promise<void> {
  const now = new Date().toISOString();

  const { data: sheets, error: sheetErr } = await adminClient
    .from("score_sheets")
    .upsert(
      [
        {
          period_id: fixture.periodId,
          project_id: fixture.p1Id,
          juror_id: fixture.jurorId,
          status: "submitted",
          started_at: now,
          last_activity_at: now,
        },
        {
          period_id: fixture.periodId,
          project_id: fixture.p2Id,
          juror_id: fixture.jurorId,
          status: "submitted",
          started_at: now,
          last_activity_at: now,
        },
      ],
      { onConflict: "juror_id,project_id" },
    )
    .select("id, project_id");
  if (sheetErr || !sheets) {
    throw new Error(`writeScoresAsJuror sheets upsert failed: ${sheetErr?.message}`);
  }
  const p1Sheet = sheets.find((s) => s.project_id === fixture.p1Id);
  const p2Sheet = sheets.find((s) => s.project_id === fixture.p2Id);
  if (!p1Sheet || !p2Sheet) {
    throw new Error("writeScoresAsJuror: could not resolve score sheets from upsert");
  }

  const { error: itemsErr } = await adminClient
    .from("score_sheet_items")
    .upsert(
      [
        { score_sheet_id: p1Sheet.id, period_criterion_id: fixture.criteriaAId, score_value: scores.p1.a },
        { score_sheet_id: p1Sheet.id, period_criterion_id: fixture.criteriaBId, score_value: scores.p1.b },
        { score_sheet_id: p2Sheet.id, period_criterion_id: fixture.criteriaAId, score_value: scores.p2.a },
        { score_sheet_id: p2Sheet.id, period_criterion_id: fixture.criteriaBId, score_value: scores.p2.b },
      ],
      { onConflict: "score_sheet_id,period_criterion_id" },
    );
  if (itemsErr) {
    throw new Error(`writeScoresAsJuror items upsert failed: ${itemsErr.message}`);
  }
}

/**
 * Multi-juror matrix scoring for E3 tests.
 * `patterns[jurorIndex]` describes the cells for `fixture.jurorIds[jurorIndex]`.
 *
 * Omitting `a` or `b` on a cell skips that score_sheet_item insert (produces a
 * "partial" cell when paired with a sheet row). Setting a project to `null`
 * creates no score_sheet row at all (produces an "empty" cell). `status`
 * defaults to "submitted".
 *
 * Uses upsert so callers can re-apply a pattern to mutate state mid-test.
 */
export async function writeMatrixScores(
  fixture: ScoringFixture,
  patterns: MatrixJurorPattern[],
): Promise<void> {
  if (patterns.length !== fixture.jurorIds.length) {
    throw new Error(
      `writeMatrixScores: patterns.length=${patterns.length} does not match fixture.jurorIds.length=${fixture.jurorIds.length}`,
    );
  }
  const now = new Date().toISOString();

  interface SheetToUpsert {
    jurorIndex: number;
    projectKey: "p1" | "p2";
    cell: MatrixCell;
  }
  const sheetsToUpsert: SheetToUpsert[] = [];
  for (let ji = 0; ji < patterns.length; ji++) {
    const pat = patterns[ji] ?? {};
    if (pat.p1 != null) sheetsToUpsert.push({ jurorIndex: ji, projectKey: "p1", cell: pat.p1 });
    if (pat.p2 != null) sheetsToUpsert.push({ jurorIndex: ji, projectKey: "p2", cell: pat.p2 });
  }

  if (sheetsToUpsert.length === 0) return;

  const sheetRows = sheetsToUpsert.map(({ jurorIndex, projectKey, cell }) => ({
    period_id: fixture.periodId,
    project_id: projectKey === "p1" ? fixture.p1Id : fixture.p2Id,
    juror_id: fixture.jurorIds[jurorIndex],
    status: cell.status ?? "submitted",
    started_at: now,
    last_activity_at: now,
  }));

  const { data: sheets, error: sheetErr } = await adminClient
    .from("score_sheets")
    .upsert(sheetRows, { onConflict: "juror_id,project_id" })
    .select("id, juror_id, project_id");
  if (sheetErr || !sheets) {
    throw new Error(`writeMatrixScores sheets upsert failed: ${sheetErr?.message}`);
  }
  const sheetIdByJurorProject = new Map<string, string>();
  for (const s of sheets) {
    sheetIdByJurorProject.set(`${s.juror_id}:${s.project_id}`, s.id as string);
  }

  interface ItemToUpsert {
    score_sheet_id: string;
    period_criterion_id: string;
    score_value: number;
  }
  const items: ItemToUpsert[] = [];
  const itemsToDelete: Array<{ sheetId: string; criterionId: string }> = [];
  for (const { jurorIndex, projectKey, cell } of sheetsToUpsert) {
    const jurorId = fixture.jurorIds[jurorIndex];
    const projectId = projectKey === "p1" ? fixture.p1Id : fixture.p2Id;
    const sheetId = sheetIdByJurorProject.get(`${jurorId}:${projectId}`);
    if (!sheetId) throw new Error("writeMatrixScores: could not resolve sheet id after upsert");
    if (cell.a != null) {
      items.push({ score_sheet_id: sheetId, period_criterion_id: fixture.criteriaAId, score_value: cell.a });
    } else {
      itemsToDelete.push({ sheetId, criterionId: fixture.criteriaAId });
    }
    if (cell.b != null) {
      items.push({ score_sheet_id: sheetId, period_criterion_id: fixture.criteriaBId, score_value: cell.b });
    } else {
      itemsToDelete.push({ sheetId, criterionId: fixture.criteriaBId });
    }
  }

  if (items.length > 0) {
    const { error: itemsErr } = await adminClient
      .from("score_sheet_items")
      .upsert(items, { onConflict: "score_sheet_id,period_criterion_id" });
    if (itemsErr) {
      throw new Error(`writeMatrixScores items upsert failed: ${itemsErr.message}`);
    }
  }

  // Delete any items left over from a prior pattern so a juror's cell can
  // transition from "scored" back to "partial" without a full teardown.
  for (const { sheetId, criterionId } of itemsToDelete) {
    await adminClient
      .from("score_sheet_items")
      .delete()
      .eq("score_sheet_id", sheetId)
      .eq("period_criterion_id", criterionId);
  }
}

/**
 * Unlocks the fixture period, rewrites the two criteria with new max/weight,
 * clears prior score sheets (so a fresh writeScoresAsJuror doesn't collide on
 * the UNIQUE(juror_id, project_id) constraint with stale data), then re-locks
 * and refreshes activated_at so the period remains the admin's default pick.
 */
export async function reweightFixture(
  fixture: ScoringFixture,
  aMax: number,
  bMax: number,
  aWeight?: number,
  bWeight?: number,
): Promise<void> {
  const { error: unlockErr } = await adminClient
    .from("periods")
    .update({ is_locked: false })
    .eq("id", fixture.periodId);
  if (unlockErr) {
    throw new Error(`reweightFixture unlock failed: ${unlockErr.message}`);
  }

  // Clear existing sheets (cascades score_sheet_items). Avoids stale scores
  // if a caller only re-scores one project.
  const { error: clearErr } = await adminClient
    .from("score_sheets")
    .delete()
    .eq("period_id", fixture.periodId);
  if (clearErr) {
    throw new Error(`reweightFixture score_sheets clear failed: ${clearErr.message}`);
  }

  const [aRes, bRes] = await Promise.all([
    adminClient
      .from("period_criteria")
      .update({ max_score: aMax, weight: aWeight ?? aMax })
      .eq("id", fixture.criteriaAId),
    adminClient
      .from("period_criteria")
      .update({ max_score: bMax, weight: bWeight ?? bMax })
      .eq("id", fixture.criteriaBId),
  ]);
  if (aRes.error) throw new Error(`reweightFixture criterion A update failed: ${aRes.error.message}`);
  if (bRes.error) throw new Error(`reweightFixture criterion B update failed: ${bRes.error.message}`);

  const { error: relockErr } = await adminClient
    .from("periods")
    .update({
      is_locked: true,
      activated_at: new Date().toISOString(),
    })
    .eq("id", fixture.periodId);
  if (relockErr) {
    throw new Error(`reweightFixture relock failed: ${relockErr.message}`);
  }
}

/**
 * Idempotent teardown. Unlocks the period (so CASCADE-delete doesn't trip the
 * block_period_*_on_locked triggers on child tables), deletes the period
 * (cascading to projects, period_criteria, score_sheets, score_sheet_items,
 * juror_period_auth for that period), then deletes the juror row.
 *
 * Safe to call with an undefined / partial fixture — used as afterAll cleanup.
 */
export async function teardownScoringFixture(
  fixture: ScoringFixture | null | undefined,
): Promise<void> {
  if (!fixture) return;

  if (fixture.periodId) {
    try {
      await adminClient
        .from("periods")
        .update({ is_locked: false })
        .eq("id", fixture.periodId);
    } catch {
      // continue — delete attempt below will surface real failure
    }
    try {
      await adminClient.from("periods").delete().eq("id", fixture.periodId);
    } catch {
      // swallow — partial cleanup is acceptable in afterAll
    }
  }

  const jurorIds = fixture.jurorIds ?? (fixture.jurorId ? [fixture.jurorId] : []);
  if (jurorIds.length) {
    try {
      await adminClient.from("jurors").delete().in("id", jurorIds);
    } catch {
      // swallow
    }
  }
}
