// src/admin/analytics/analyticsDatasets.js
// Pure dataset builder functions (no React, no JSX).
// Extracted from AnalyticsTab.jsx — structural refactor only.

import { mean, stdDev, outcomeValues, fmt1, fmt2, buildBoxplotStats } from "../../shared/stats";
import { CHART_COPY } from "../../charts";

// ── Derived helpers ──────────────────────────────────────────
export function buildOutcomes(criteria) {
  return (criteria || []).map((c) => ({
    id: c.id,
    key: c.key ?? c.id,
    label: c.shortLabel || c.label,
    max: c.max,
    rubric: c.rubric || [],
    code: (c.outcomes || []).join("/"),
  }));
}

export const getCriterionColor = (id, fallback, criteria = []) =>
  (criteria || []).find((c) => c.id === id)?.color || fallback;

export const formatOutcomeCodes = (code) =>
  String(code || "")
    .split("/")
    .map((c) => c.trim())
    .filter(Boolean)
    .join(" / ");

export const outcomeCodeLine = (code) => {
  const formatted = formatOutcomeCodes(code);
  return formatted ? `(${formatted})` : "";
};

// ── Derived stat helpers ─────────────────────────────────────
// Overall normalized average (%) across all criteria and all submission rows.
export function computeOverallAvg(submittedData, outcomes = []) {
  const rows = submittedData || [];
  if (!rows.length) return null;
  const allPcts = rows.flatMap((r) =>
    outcomes.map((o) => {
      const v = Number(r[o.key]);
      return o.max > 0 && Number.isFinite(v) ? (v / o.max) * 100 : null;
    }).filter((v) => v !== null)
  );
  return allPcts.length ? fmt1(mean(allPcts)) : null;
}

export function buildAttainmentStatusDataset({
  submittedData = [],
  activeOutcomes = [],
  threshold = 70,
  priorPeriodStats = null,
  outcomeLookup = null,
} = {}) {
  const hasPrior = !!(priorPeriodStats?.currentTrend && priorPeriodStats?.prevTrend);

  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) outcomeMap.set(code, { criterionKey: c.key ?? c.id, criterionId: c.id, max: c.max });
    }
  }

  const rows = [];
  for (const [code, { criterionKey, criterionId, max }] of outcomeMap) {
    const vals = outcomeValues(submittedData || [], criterionKey);
    let attRate = null;
    if (vals.length) {
      const above = vals.filter((v) => max > 0 && (v / max) * 100 >= threshold).length;
      attRate = Math.round((above / vals.length) * 100);
    }

    const status =
      attRate == null ? "No data" :
      attRate >= threshold ? "Met" :
      attRate >= 60 ? "Borderline" :
      "Not Met";

    let delta = null;
    if (hasPrior && max > 0) {
      const cur = priorPeriodStats.currentTrend.criteriaAvgs?.[criterionId];
      const prev = priorPeriodStats.prevTrend.criteriaAvgs?.[criterionId];
      if (cur != null && prev != null) {
        delta = Math.round(((cur - prev) / max) * 100);
      }
    }

    const desc = outcomeLookup?.[code]?.desc_en || outcomeLookup?.[code]?.desc_tr || code;
    const baseRow = [code, desc, attRate, status];
    rows.push(hasPrior ? [...baseRow, delta] : baseRow);
  }

  const ORDER = { "Met": 0, "Borderline": 1, "Not Met": 2, "No data": 3 };
  rows.sort((a, b) => {
    const od = ORDER[a[3]] - ORDER[b[3]];
    if (od !== 0) return od;
    return (b[2] ?? -1) - (a[2] ?? -1);
  });

  const headers = hasPrior
    ? ["Outcome", "Description", "Attainment Rate (%)", "Status", "Δ vs Prior Period (%)"]
    : ["Outcome", "Description", "Attainment Rate (%)", "Status"];

  const metCount = rows.filter((r) => r[3] === "Met").length;
  const totalCount = rows.filter((r) => r[2] != null).length;

  return {
    sheet: "Attainment Status",
    title: "Outcome Attainment Status",
    note: "Per-outcome attainment rate with threshold status",
    headers,
    rows,
    summary: { metCount, totalCount },
  };
}

// ── Dataset builder pure functions ───────────────────────────
// All builders are pure functions (no component closure) — safe to call
// outside the component and easy to unit test independently.

export function buildOutcomeByGroupDataset(dashboardStats, outcomes = []) {
  const groups = (dashboardStats || []).filter((s) => s.count > 0);
  const headers = [
    "Title",
    ...outcomes.flatMap((o) => [`${o.label} Avg`, `${o.label} (%)`]),
  ];
  const rows = groups.map((g) => {
    const cells = outcomes.flatMap((o) => {
      const avgRaw = Number(g.avg?.[o.key] ?? 0);
      const pct = o.max > 0 ? (avgRaw / o.max) * 100 : 0;
      return [fmt2(avgRaw), fmt1(pct)];
    });
    return [g.title || g.name || "—", ...cells];
  });
  return {
    sheet: "Outcome Achievement",
    title: CHART_COPY.outcomeByGroup.title,
    note: CHART_COPY.outcomeByGroup.note,
    headers,
    rows,
  };
}

export function buildProgrammeAveragesDataset(submittedData, outcomes = []) {
  const rows = submittedData || [];
  const headers = ["Outcome", "Max", "Avg (raw)", "Avg (%)", "Std. deviation (σ) (%) [sample]", "N"];
  const dataRows = outcomes.map((o) => {
    const vals   = outcomeValues(rows, o.key);
    const avgRaw = vals.length ? mean(vals) : 0;
    const pct    = o.max > 0 ? (avgRaw / o.max) * 100 : 0;
    const sd     = vals.length > 1 ? (stdDev(vals, true) / o.max) * 100 : 0;
    return [o.label, o.max, fmt2(avgRaw), fmt1(pct), fmt1(sd), vals.length];
  });
  return {
    sheet: "Programme-Level Averages",
    title: CHART_COPY.programmeAverages.title,
    note: CHART_COPY.programmeAverages.note,
    headers,
    rows: dataRows,
  };
}

export function buildTrendDataset(trendData, periodOptions, selectedIds, outcomes = []) {
  const dataMap = new Map((trendData || []).map((row) => [row.periodId, row]));
  const orderIndex = new Map((periodOptions || []).map((s, i) => [s.id, i]));
  const ordered = (periodOptions || [])
    .filter((s) => (selectedIds || []).includes(s.id))
    .sort((a, b) => (orderIndex.get(b.id) ?? 0) - (orderIndex.get(a.id) ?? 0));

  // DB columns are fixed (technical/written/oral/teamwork) — map by key
  const DB_KEY_MAP = { technical: "avgTechnical", design: "avgWritten", delivery: "avgOral", teamwork: "avgTeamwork" };
  const headers = ["Period", "N", ...outcomes.map((o) => `${o.label} (%)`)];
  const pct = (raw, max) => (Number.isFinite(raw) && max > 0 ? fmt1((raw / max) * 100) : null);

  const rows = ordered.map((s) => {
    const row = dataMap.get(s.id);
    const cells = outcomes.map((o) => {
      const dbKey = DB_KEY_MAP[o.key];
      const raw = dbKey ? row?.[dbKey] : undefined;
      return pct(raw, o.max);
    });
    return [s.period_name || row?.periodName || "—", row?.nEvals ?? 0, ...cells];
  });
  return {
    sheet: "Attainment Trend",
    title: CHART_COPY.periodTrend.title,
    note: CHART_COPY.periodTrend.note,
    headers,
    rows,
  };
}

export function buildJurorConsistencyDataset(dashboardStats, submittedData, outcomes = []) {
  const groups = (dashboardStats || []).filter((s) => s.count > 0);
  const rows   = submittedData || [];
  const headers = ["Title", ...outcomes.map((o) => o.label)];

  const buildMatrix = (metric) =>
    groups.map((g) => {
      const cells = outcomes.map((o) => {
        const vals = rows
          .filter((r) => r.projectId === g.id)
          .map((r) => Number(r[o.key]))
          .filter((v) => Number.isFinite(v));
        if (!vals.length) return null;
        const m = mean(vals);
        if (metric === "n") return vals.length;
        if (metric === "mean") return fmt1(o.max > 0 ? (m / o.max) * 100 : 0);
        if (metric === "sd") return fmt2(stdDev(vals, true));
        if (metric === "cv") {
          if (vals.length < 2 || !m) return null;
          return fmt1((stdDev(vals, true) / m) * 100);
        }
        return null;
      });
      return [g.title || g.name || "—", ...cells];
    });

  return {
    sheet: "Juror Consistency",
    title: CHART_COPY.jurorConsistency.title,
    note: CHART_COPY.jurorConsistency.note,
    headers,
    rows: buildMatrix("cv"),
    extra: [
      { title: "Mean (%) by Title x Criterion", headers, rows: buildMatrix("mean") },
      { title: "Std. deviation (σ) by Title x Criterion", headers, rows: buildMatrix("sd") },
      { title: "N (Juror Count) by Title x Criterion", headers, rows: buildMatrix("n") },
    ],
  };
}

export function buildRubricAchievementDataset(submittedData, outcomes = []) {
  const rows = submittedData || [];
  const classify = (v, rubric) => {
    if (!Number.isFinite(v)) return null;
    for (const band of rubric) {
      if (v >= band.min && v <= band.max) return band.level.toLowerCase();
    }
    return null;
  };
  const headers = [
    "Outcome",
    "Total",
    "Excellent (count)",
    "Excellent (%)",
    "Good (count)",
    "Good (%)",
    "Developing (count)",
    "Developing (%)",
    "Insufficient (count)",
    "Insufficient (%)",
  ];
  const dataRows = outcomes.map((o) => {
    const rubric = o.rubric || [];
    // Derive band keys from config — not hardcoded — so renaming a level auto-adapts.
    const bandKeys = rubric.map((b) => b.level.toLowerCase());
    const vals = rows.map((r) => Number(r[o.key])).filter((v) => Number.isFinite(v));
    const counts = Object.fromEntries(bandKeys.map((k) => [k, 0]));
    vals.forEach((v) => {
      const k = classify(v, rubric);
      if (k && k in counts) counts[k] += 1;
    });
    const total = vals.length || 0;
    const pct = (n) => (total ? (n / total) * 100 : 0);
    // Always output in fixed band order for Excel column consistency
    const excellent   = counts["excellent"]   ?? 0;
    const good        = counts["good"]        ?? 0;
    const developing  = counts["developing"]  ?? 0;
    const insufficient = counts["insufficient"] ?? 0;
    return [
      o.label,
      total,
      excellent,
      fmt1(pct(excellent)),
      good,
      fmt1(pct(good)),
      developing,
      fmt1(pct(developing)),
      insufficient,
      fmt1(pct(insufficient)),
    ];
  });

  return {
    sheet: "Rubric Achievement Dist.",
    title: CHART_COPY.achievementDistribution.title,
    note: CHART_COPY.achievementDistribution.note,
    headers,
    rows: dataRows,
  };
}

export function buildOutcomeMappingDataset(outcomes = [], outcomeLookup = null) {
  const headers = ["Criteria", "Outcome Code(s)", "Outcome Label(s)"];
  const rows = [];
  const merges = [];
  const alignments = [];
  let rowIndex = 0;
  outcomes.forEach((o) => {
    // outcomes field stores array of outcome codes in criteria_config
    // For config-derived OUTCOMES, o.code is a slash-joined string of display codes
    const ids = Array.isArray(o.outcomes) ? o.outcomes : [];
    const codes = ids.length > 0 ? ids : (o.code ? String(o.code).split("/").map((c) => c.trim()).filter(Boolean) : []);
    const label = o.label;
    const count = Math.max(1, codes.length);
    if (!codes.length) {
      rows.push([label, "—", "—"]);
      alignments.push({ start: rowIndex, end: rowIndex, col: 0, valign: "center" });
    } else {
      codes.forEach((code, idx) => {
        let text = "—";
        const entry = outcomeLookup?.[code];
        if (entry) {
          text = entry.desc_en || entry.desc_tr || "—";
        }
        const displayCode = entry?.code || code;
        rows.push([idx === 0 ? label : "", displayCode, text]);
        if (idx === 0) {
          alignments.push({ start: rowIndex, end: rowIndex + count - 1, col: 0, valign: "center" });
        }
      });
    }
    if (count > 1) {
      merges.push({ start: rowIndex, end: rowIndex + count - 1, col: 0 });
    }
    rowIndex += count;
  });
  return {
    sheet: "Coverage Matrix",
    title: "Coverage Matrix",
    note: "Criteria-to-outcome references used in analytics.",
    headers,
    rows,
    merges,
    alignments,
  };
}

const OUTCOME_TREND_COLORS = [
  "#6366F1", "#EC4899", "#14B8A6", "#F97316",
  "#8B5CF6", "#06B6D4", "#F43F5E", "#10B981",
];

/**
 * Transforms getOutcomeAttainmentTrends() output into Recharts-compatible rows.
 *
 * @param {object[]} outcomeTrendData — output of getOutcomeAttainmentTrends()
 * @param {object[]} periodOptions  — period list [{ id, period_name, startDate }]
 * @param {string[]} selectedIds      — selected period IDs
 * @returns {{ rows: object[], outcomeMeta: object[] }}
 *   rows: one entry per period with {period, "{code}_att", "{code}_avg"} keys (null for missing)
 *   outcomeMeta: [{ code, label, color, attKey, avgKey }]
 */
export function buildOutcomeAttainmentTrendDataset(outcomeTrendData, periodOptions, selectedIds) {
  if (!outcomeTrendData?.length) return { rows: [], outcomeMeta: [] };

  const dataMap = new Map((outcomeTrendData || []).map((row) => [row.periodId, row]));

  // Sort periods chronologically
  const ordered = (periodOptions || [])
    .filter((s) => (selectedIds || []).includes(s.id))
    .sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate) : 0;
      const db = b.startDate ? new Date(b.startDate) : 0;
      return da - db;
    });

  // Collect all outcome codes across all periods, preserving first-seen label
  const codeOrder = [];
  const outcomeLabelMap = {};
  for (const row of outcomeTrendData) {
    for (const o of row.outcomes || []) {
      if (!outcomeLabelMap[o.code]) {
        codeOrder.push(o.code);
        outcomeLabelMap[o.code] = o.label || o.code;
      }
    }
  }
  codeOrder.sort((a, b) => a.localeCompare(b));

  // Build Recharts row per period
  const rows = ordered.map((s) => {
    const row = dataMap.get(s.id);
    const point = { period: s.period_name || s.name || row?.periodName || "—" };
    for (const code of codeOrder) {
      const outcome = row?.outcomes?.find((o) => o.code === code);
      point[`${code}_att`] = outcome?.attainmentRate ?? null;
      point[`${code}_avg`] = outcome?.avg ?? null;
    }
    return point;
  });

  const outcomeMeta = codeOrder.map((code, i) => ({
    code,
    label: outcomeLabelMap[code],
    color: OUTCOME_TREND_COLORS[i % OUTCOME_TREND_COLORS.length],
    attKey: `${code}_att`,
    avgKey: `${code}_avg`,
  }));

  return { rows, outcomeMeta };
}

export function buildThresholdGapDataset({ submittedData = [], activeOutcomes = [], threshold = 70 } = {}) {
  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) {
        outcomeMap.set(code, { criterionKey: c.key ?? c.id, max: c.max });
      }
    }
  }

  const rows = [];
  for (const [code, meta] of outcomeMap) {
    const vals = outcomeValues(submittedData, meta.criterionKey);
    const avgRaw = vals.length ? mean(vals) : null;
    const avgPct = avgRaw != null && meta.max > 0 ? fmt1((avgRaw / meta.max) * 100) : null;
    const gapPct = avgPct != null ? fmt1(avgPct - threshold) : null;
    rows.push([code, code, avgPct, gapPct]);
  }

  rows.sort((a, b) => {
    const gapA = a[3];
    const gapB = b[3];
    if (gapA == null && gapB == null) return 0;
    if (gapA == null) return 1;
    if (gapB == null) return -1;
    return gapA - gapB;
  });

  return {
    sheet: "Threshold Gap",
    title: "Threshold Gap Analysis",
    note: `Deviation from ${threshold}% competency threshold per outcome`,
    headers: ["Outcome", "Description", "Average Score (%)", "Gap vs Threshold (%)"],
    rows,
  };
}

export function buildGroupHeatmapDataset({ dashboardStats = [], activeOutcomes = [], threshold = 70 } = {}) {
  const groups = (dashboardStats || [])
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.group_no ?? Infinity) - (b.group_no ?? Infinity));

  if (!groups.length) {
    return {
      sheet: "Group Heatmap",
      title: "Group Attainment Heatmap",
      note: `Normalized score (%) per outcome per project group — cells below ${threshold}% threshold are flagged`,
      headers: ["Group"],
      rows: [],
    };
  }

  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) {
        outcomeMap.set(code, { criterionKey: c.key ?? c.id, max: c.max });
      }
    }
  }

  const outcomeCodes = Array.from(outcomeMap.keys());
  const headers = ["Group", ...outcomeCodes.map((code) => `${code} (%)`), "Cells Below Threshold"];

  const rows = groups.map((g) => {
    const baseRow = [g.title || g.name || "—"];
    let belowThresholdCount = 0;

    for (const code of outcomeCodes) {
      const meta = outcomeMap.get(code);
      const rawValue = g.avg?.[meta.criterionKey];
      const avgRaw = rawValue != null ? Number(rawValue) : null;
      let pct = null;
      if (avgRaw != null && Number.isFinite(avgRaw) && meta.max > 0) {
        pct = fmt1((avgRaw / meta.max) * 100);
        if (pct < threshold) {
          belowThresholdCount++;
        }
      }
      baseRow.push(pct);
    }

    baseRow.push(belowThresholdCount);
    return baseRow;
  });

  return {
    sheet: "Group Heatmap",
    title: "Group Attainment Heatmap",
    note: `Normalized score (%) per outcome per project group — cells below ${threshold}% threshold are flagged`,
    headers,
    rows,
  };
}
