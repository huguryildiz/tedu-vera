// src/shared/api/admin/scores.js
// Admin score data, summaries, and settings.
// Reads from score_sheets + score_sheet_items (dynamic criteria, no hardcoded keys).

import { supabase } from "../core/client";
import { formatMembers } from "../fieldMapping";

// Safety cap for unbounded scoring queries. Real periods are well under
// this (~500 projects × ~10 jurors = 5k rows). If we ever hit it, the
// console warning surfaces the need for server-side aggregation.
const SCORE_QUERY_CAP = 20000;
const warnIfCapped = (label, rows) => {
  if (rows && rows.length >= SCORE_QUERY_CAP) {
    // eslint-disable-next-line no-console
    console.warn(`[${label}] hit row cap (${SCORE_QUERY_CAP}); consider server-side aggregation`);
  }
};

/**
 * Pivots score_sheet_items rows into a flat { [criterionKey]: value } object.
 * @param {Array} items - score_sheet_items rows with joined period_criteria
 * @returns {{ scores: object, total: number }}
 */
function pivotItems(items) {
  const scores = {};
  let total = 0;
  (items || []).forEach((item) => {
    const key = item.period_criteria?.key || item.criterion_key;
    if (!key) return;
    const val = item.score_value != null ? Number(item.score_value) : null;
    scores[key] = val;
    if (val != null) total += val;
  });
  return { scores, total };
}

/**
 * Returns all score rows for a period with project and juror info.
 * Scores are dynamic — keyed by period_criteria.key (not hardcoded columns).
 */
export async function getScores(periodId) {
  const { data, error } = await supabase
    .from("score_sheets")
    .select(`
      id, juror_id, project_id, period_id, comment, status, created_at, updated_at,
      items:score_sheet_items(id, score_value, period_criterion_id, period_criteria(key)),
      project:projects(id, title, members, project_no),
      juror:jurors(id, juror_name, affiliation)
    `)
    .eq("period_id", periodId)
    .limit(SCORE_QUERY_CAP);
  if (error) throw error;
  warnIfCapped("getScores", data);
  return (data || []).map((row) => {
    const { scores, total } = pivotItems(row.items);
    return {
      id: row.id,
      jurorId: row.juror_id,
      juryName: row.juror?.juror_name || "",
      affiliation: row.juror?.affiliation || "",
      projectId: row.project_id,
      projectName: row.project?.title || "",
      groupNo: row.project?.project_no ?? null,
      students: formatMembers(row.project?.members),
      ...scores,
      total,
      status: row.status || "draft",
      comments: row.comment || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Returns jurors with auth and scoring summary for a period.
 */
export async function listJurorsSummary(periodId) {
  // Fetch all three in parallel — none depends on the others
  const [
    { data: authRows, error: authErr },
    { data: sheets, error: sheetErr },
    { data: projects, error: projErr },
  ] = await Promise.all([
    supabase.from("juror_period_auth").select("*, juror:jurors(*)").eq("period_id", periodId),
    supabase.from("score_sheets").select("juror_id, project_id, updated_at").eq("period_id", periodId),
    supabase.from("projects").select("id, title").eq("period_id", periodId),
  ]);
  if (authErr) throw authErr;
  if (sheetErr) throw sheetErr;
  if (projErr) throw projErr;
  const totalProjects = projects?.length || 0;

  const projectTitles = new Map((projects || []).map((p) => [p.id, p.title]));

  // Count score sheets per juror + track most recently updated sheet
  const scoreCounts = {};
  const lastScoredByJuror = {};
  for (const s of sheets || []) {
    scoreCounts[s.juror_id] = (scoreCounts[s.juror_id] || 0) + 1;
    const prev = lastScoredByJuror[s.juror_id];
    if (!prev || s.updated_at > prev.updated_at) {
      lastScoredByJuror[s.juror_id] = s;
    }
  }

  return (authRows || []).map((row) => {
    // Legacy rows with NULL edit_expires_at are treated as inactive.
    // Active edit mode requires both edit_enabled=true and a future expiry.
    // This keeps status derivation aligned with DB gating.
    const editExpiresAt = row.edit_expires_at || "";
    const expiresMs = editExpiresAt ? Date.parse(editExpiresAt) : NaN;
    const editEnabled =
      !!row.edit_enabled && Number.isFinite(expiresMs) && expiresMs > Date.now();

    return {
      jurorId: row.juror_id,
      juryName: row.juror?.juror_name || "",
      affiliation: row.juror?.affiliation || "",
      email: row.juror?.email || "",
      editEnabled,
      editExpiresAt,
      finalSubmittedAt: row.final_submitted_at || "",
      finalSubmitted: Boolean(row.final_submitted_at),
      lastSeenAt: row.last_seen_at || "",
      lastSeenMs: row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0,
      totalProjects,
      completedProjects: scoreCounts[row.juror_id] || 0,
      lockedUntil: row.locked_until,
      isLocked: row.is_blocked || false,
      failedAttempts: row.failed_attempts || 0,
      lastScoredProject: (() => {
        const last = lastScoredByJuror[row.juror_id];
        return last ? (projectTitles.get(last.project_id) || null) : null;
      })(),
    };
  });
}

/**
 * Returns per-project summary with aggregated scores via the
 * `rpc_admin_project_summary` server-side aggregation. Fields are normalized
 * to camelCase + legacy aliases so existing call sites (ProjectsPage,
 * RankingsPage, ProjectScoresDrawer, Export) read the same shape they did
 * when this was JS-side aggregation.
 *
 * Server returns one row per project with both raw (`total_avg`, `total_min`,
 * `total_max`) and normalized (`total_pct`, `std_dev_pct`) values, plus
 * `rank` (deterministic via `RANK() OVER (... NULLS LAST, project_id)`) and
 * `per_criterion` JSONB (`{ key: { avg, max, pct } }`).
 *
 * @param {string} periodId
 * @param {object} [opts]
 * @param {boolean} [opts.onlyFinalized=true] - when true (default, official
 *   view) only includes sheets from jurors with `final_submitted_at IS NOT
 *   NULL`. When false, falls back to `score_sheets.status='submitted'` for
 *   live-monitoring views.
 */
export async function getProjectSummary(periodId, { onlyFinalized = true } = {}) {
  const { data, error } = await supabase.rpc("rpc_admin_project_summary", {
    p_period_id: periodId,
    p_only_finalized: onlyFinalized,
  });
  if (error) throw error;
  return (data || []).map((row) => {
    // Flatten per_criterion { key: { avg, max, pct } } → legacy `avg[key]` (raw mean)
    const perCrit = row.per_criterion || {};
    const avg = {};
    for (const [key, info] of Object.entries(perCrit)) {
      if (info && typeof info === "object") avg[key] = info.avg;
    }
    return {
      // Legacy aliases (do not remove until all call sites migrate)
      id: row.project_id,
      group_no: row.project_no ?? null,
      count: row.juror_count ?? 0,
      avg,
      totalAvg: row.total_avg,
      totalMin: row.total_min,
      totalMax: row.total_max,
      // Pass-through identity fields
      title: row.title,
      members: formatMembers(row.members),
      advisor: row.advisor || "",
      // New server-side aggregations
      totalPct:    row.total_pct,
      stdDevPct:   row.std_dev_pct,
      rank:        row.rank,
      submittedCount: row.submitted_count ?? 0,
      assignedCount:  row.assigned_count ?? 0,
      perCriterion: perCrit,
    };
  });
}

/**
 * Returns per-juror summary for a period via `rpc_admin_juror_summary`.
 * Used by JurorScoresDrawer and (later) JurorsPage live KPI cards.
 *
 * @param {string} periodId
 * @param {object} [opts]
 * @param {boolean} [opts.onlyFinalized=true]
 */
export async function getJurorSummary(periodId, { onlyFinalized = true } = {}) {
  const { data, error } = await supabase.rpc("rpc_admin_juror_summary", {
    p_period_id: periodId,
    p_only_finalized: onlyFinalized,
  });
  if (error) throw error;
  return (data || []).map((row) => ({
    jurorId:          row.juror_id,
    jurorName:        row.juror_name,
    affiliation:      row.affiliation || "",
    scoredCount:      row.scored_count ?? 0,
    assignedCount:    row.assigned_count ?? 0,
    completionPct:    row.completion_pct,
    avgTotal:         row.avg_total,
    avgTotalPct:      row.avg_total_pct,
    stdDevPct:        row.std_dev_pct,
    finalSubmittedAt: row.final_submitted_at || null,
  }));
}

/**
 * Returns the period-wide reference summary via `rpc_admin_period_summary`.
 * Drawers use this to compute "vs avg" deltas without re-iterating
 * project/juror lists client-side.
 *
 * @param {string} periodId
 * @param {object} [opts]
 * @param {boolean} [opts.onlyFinalized=true]
 * @returns {Promise<{
 *   totalMax: number, totalProjects: number, rankedCount: number,
 *   totalJurors: number, finalizedJurors: number,
 *   avgTotalPct: number|null, avgJurorPct: number|null
 * }>}
 */
export async function getPeriodSummary(periodId, { onlyFinalized = true } = {}) {
  const { data, error } = await supabase.rpc("rpc_admin_period_summary", {
    p_period_id: periodId,
    p_only_finalized: onlyFinalized,
  });
  if (error) throw error;
  const row = (data || [])[0] || {};
  return {
    totalMax:        row.total_max ?? 0,
    totalProjects:   row.total_projects ?? 0,
    rankedCount:     row.ranked_count ?? 0,
    totalJurors:     row.total_jurors ?? 0,
    finalizedJurors: row.finalized_jurors ?? 0,
    avgTotalPct:     row.avg_total_pct,
    avgJurorPct:     row.avg_juror_pct,
  };
}

/**
 * Returns per-period criterion averages for trend charts (dynamic criteria).
 */
export async function getOutcomeTrends(periodIds) {
  const results = await Promise.all(
    periodIds.map(async (periodId) => {
      const [{ data: period }, { data: sheets }] = await Promise.all([
        supabase.from("periods").select("id, name").eq("id", periodId).single(),
        supabase
          .from("score_sheets")
          .select("id, items:score_sheet_items(score_value, period_criteria(key))")
          .eq("period_id", periodId),
      ]);

      const pivoted = (sheets || []).map((s) => pivotItems(s.items));
      const count = pivoted.length;

      // Collect all criterion keys
      const allKeys = new Set();
      pivoted.forEach((ps) => Object.keys(ps.scores).forEach((k) => allKeys.add(k)));

      const criteriaAvgs = {};
      allKeys.forEach((key) => {
        const vals = pivoted.map((ps) => ps.scores[key]).filter((v) => v != null);
        criteriaAvgs[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });

      return {
        periodId,
        periodName: period?.name || "",
        criteriaAvgs,
        nEvals: count,
      };
    })
  );
  return results;
}

/**
 * Returns per-period outcome-level attainment rates and average scores.
 * For each period, computes per-evaluation outcome scores using normalized
 * criterion weights, then aggregates into attainmentRate and avg.
 *
 * @param {string[]} periodIds
 * @returns {Promise<Array<{
 *   periodId: string,
 *   periodName: string,
 *   nEvals: number,
 *   outcomes: Array<{ code: string, label: string, avg: number|null, attainmentRate: number|null }>
 * }>>}
 */
export async function getOutcomeAttainmentTrends(periodIds) {
  const THRESHOLD = 70;

  const settled = await Promise.all(
    periodIds.map(async (periodId) => {
      const [periodRes, criteriaRes, mapsRes, outcomesRes, scores] = await Promise.all([
        supabase.from("periods").select("id, name").eq("id", periodId).maybeSingle(),
        supabase.from("period_criteria").select("id, key, max_score").eq("period_id", periodId),
        supabase
          .from("period_criterion_outcome_maps")
          .select("period_criterion_id, weight, period_outcomes(code)")
          .eq("period_id", periodId),
        supabase
          .from("period_outcomes")
          .select("code, label")
          .eq("period_id", periodId)
          .order("sort_order"),
        getScores(periodId),
      ]);

      if (!periodRes.data) return null;

      // criterion id → { key, max }
      const criteriaById = Object.fromEntries(
        (criteriaRes.data || []).map((c) => [c.id, { key: c.key, max: c.max_score }])
      );

      // outcome code → label
      const outcomeLabelMap = Object.fromEntries(
        (outcomesRes.data || []).map((o) => [o.code, o.label])
      );

      // outcome code → [{ key, max, weight }]
      const outcomeContributors = {};
      for (const map of mapsRes.data || []) {
        const code = map.period_outcomes?.code;
        const criterion = criteriaById[map.period_criterion_id];
        if (!code || !criterion) continue;
        const weight = typeof map.weight === "number" ? map.weight : 1;
        (outcomeContributors[code] ||= []).push({ key: criterion.key, max: criterion.max, weight });
      }

      const nEvals = scores.length;

      const outcomes = Object.entries(outcomeContributors).map(([code, contributors]) => {
        const label = outcomeLabelMap[code] ?? code;

        // Per-evaluation normalized weighted score for this outcome
        const evalScores = scores
          .map((evalRow) => {
            let weightedSum = 0;
            let effectiveWeight = 0;
            for (const c of contributors) {
              const raw = evalRow[c.key];
              if (raw == null || !Number.isFinite(Number(raw)) || c.max === 0) continue;
              weightedSum += (Number(raw) / c.max) * 100 * c.weight;
              effectiveWeight += c.weight;
            }
            return effectiveWeight > 0 ? weightedSum / effectiveWeight : null;
          })
          .filter((v) => v !== null);

        if (!evalScores.length) return { code, label, avg: null, attainmentRate: null };

        const avg = evalScores.reduce((s, v) => s + v, 0) / evalScores.length;
        const met = evalScores.filter((v) => v >= THRESHOLD).length;

        return {
          code,
          label,
          avg: Math.round(avg * 10) / 10,
          attainmentRate: Math.round((met / evalScores.length) * 100),
        };
      });

      outcomes.sort((a, b) => a.code.localeCompare(b.code));

      return {
        periodId,
        periodName: periodRes.data?.name || "",
        nEvals,
        outcomes,
      };
    })
  );

  return settled.filter(Boolean);
}

/**
 * Returns cascade counts for delete operations.
 */
export async function getDeleteCounts(targetType, targetId) {
  if (targetType === "period") {
    const [projects, scores, jurorAuth] = await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("period_id", targetId),
      supabase.from("score_sheets").select("id", { count: "exact", head: true }).eq("period_id", targetId),
      supabase.from("juror_period_auth").select("juror_id", { count: "exact", head: true }).eq("period_id", targetId),
    ]);
    return { projects: projects.count || 0, scores: scores.count || 0, jurorAssignments: jurorAuth.count || 0 };
  }
  if (targetType === "project") {
    const { count } = await supabase
      .from("score_sheets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", targetId);
    return { scores: count || 0 };
  }
  if (targetType === "juror") {
    const { count } = await supabase
      .from("score_sheets")
      .select("id", { count: "exact", head: true })
      .eq("juror_id", targetId);
    return { scores: count || 0 };
  }
  return {};
}

/**
 * Returns the sum of max_score for all criteria in a period.
 * Returns null if no criteria are configured for the period.
 */
export async function getPeriodMaxScore(periodId) {
  if (!periodId) return null;
  const { data, error } = await supabase
    .from("period_criteria")
    .select("max_score")
    .eq("period_id", periodId);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data.reduce((s, r) => s + (Number(r.max_score) || 0), 0);
}

/**
 * Returns criteria rows for a period snapshot (from period_criteria table),
 * enriched with mapped outcome codes from period_criterion_outcome_maps
 * (the single source of truth edited on the Outcomes & Mapping page and the
 * Edit Criterion Mapping tab).
 */
export async function listPeriodCriteria(periodId) {
  const [criteriaRes, mapsRes] = await Promise.all([
    supabase
      .from("period_criteria")
      .select("*")
      .eq("period_id", periodId)
      .order("sort_order"),
    supabase
      .from("period_criterion_outcome_maps")
      .select("period_criterion_id, coverage_type, period_outcomes(code)")
      .eq("period_id", periodId),
  ]);
  if (criteriaRes.error) throw criteriaRes.error;
  if (mapsRes.error) throw mapsRes.error;
  const criteria = criteriaRes.data || [];

  // Build maps: criterion_id → [code, ...] and criterion_id → { code: 'direct'|'indirect' }
  const codeMap = {};
  const typeMap = {};
  for (const row of mapsRes.data || []) {
    const code = row.period_outcomes?.code;
    if (!code) continue;
    (codeMap[row.period_criterion_id] ||= []).push(code);
    (typeMap[row.period_criterion_id] ||= {})[code] = row.coverage_type ?? "direct";
  }

  return criteria.map((c) => ({
    ...c,
    outcomes: codeMap[c.id] || [],
    outcomeTypes: typeMap[c.id] || {},
  }));
}

/**
 * Fetch period_outcomes snapshot rows for a given period.
 */
export async function listPeriodOutcomes(periodId) {
  const { data, error } = await supabase
    .from("period_outcomes")
    .select("*")
    .eq("period_id", periodId)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

/**
 * Dispatches delete to appropriate table.
 */
export async function deleteEntity({ targetType, targetId }) {
  if (!targetType || !targetId) throw new Error("targetType and targetId are required.");
  if (targetType === "period") {
    const { error } = await supabase.from("periods").delete().eq("id", targetId);
    if (error) throw error;
    return true;
  }
  if (targetType === "project") {
    const { error } = await supabase.from("projects").delete().eq("id", targetId);
    if (error) throw error;
    return true;
  }
  if (targetType === "juror") {
    const { error } = await supabase.from("jurors").delete().eq("id", targetId);
    if (error) throw error;
    return true;
  }
  throw new Error("Unsupported delete target.");
}
