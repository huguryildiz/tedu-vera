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

  // Build per-outcome lookup maps from prior period stats.
  // New shape: priorPeriodStats.{current,prev}Trend.outcomes = [{code, avg, attainmentRate}]
  // (avg already normalized to 0–100%)
  const curByCode = new Map();
  const prevByCode = new Map();
  if (hasPrior) {
    for (const o of priorPeriodStats.currentTrend.outcomes || []) curByCode.set(o.code, o);
    for (const o of priorPeriodStats.prevTrend.outcomes || []) prevByCode.set(o.code, o);
  }

  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) outcomeMap.set(code, { criterionKey: c.key ?? c.id, max: c.max });
    }
  }

  const rows = [];
  for (const [code, { criterionKey, max }] of outcomeMap) {
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
    if (hasPrior) {
      const cur = curByCode.get(code)?.avg;
      const prev = prevByCode.get(code)?.avg;
      if (cur != null && prev != null) delta = Math.round(cur - prev);
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
  const groups = (dashboardStats || [])
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.group_no ?? 0) - (b.group_no ?? 0));
  const headers = [
    "Project Title",
    ...outcomes.flatMap((o) => [`${o.label} Avg`, `${o.label} (%)`]),
  ];
  const rows = groups.map((g) => {
    const label = g.group_no != null ? `P${g.group_no} — ${g.title || g.name || "—"}` : (g.title || g.name || "—");
    const cells = outcomes.flatMap((o) => {
      const avgRaw = Number(g.avg?.[o.key] ?? 0);
      const pct = o.max > 0 ? (avgRaw / o.max) * 100 : 0;
      return [fmt2(avgRaw), fmt1(pct)];
    });
    return [label, ...cells];
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

export function buildJurorConsistencyDataset(dashboardStats, submittedData, outcomes = []) {
  const groups = (dashboardStats || []).filter((s) => s.count > 0);
  const rows   = submittedData || [];
  const headers = ["Project Title", ...outcomes.map((o) => o.label)];

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
      const label = g.group_no != null ? `P${g.group_no} — ${g.title || g.name || "—"}` : (g.title || g.name || "—");
      return [label, ...cells];
    });

  return {
    sheet: "Juror Consistency",
    title: CHART_COPY.jurorConsistency.title,
    note: CHART_COPY.jurorConsistency.note,
    headers,
    rows: buildMatrix("cv"),
    extra: [
      { title: "Mean (%) by Project x Criterion", headers, rows: buildMatrix("mean") },
      { title: "Std. deviation (σ) by Project x Criterion", headers, rows: buildMatrix("sd") },
      { title: "N (Juror Count) by Project x Criterion", headers, rows: buildMatrix("n") },
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

/**
 * Coverage Matrix — outcome × criterion grid, matches the on-screen CoverageMatrix chart.
 *
 * Cell value: "Direct" if criterion.outcomeTypes[code] === "direct"
 *                        or (fallback) criterion.outcomes includes code
 *             "Indirect" if criterion.outcomeTypes[code] === "indirect"
 *             "—" otherwise
 *
 * Tail rows summarize direct/indirect/unmapped counts.
 *
 * @param {object[]} activeCriteria  — criteria from criteriaConfig
 * @param {object[]} activeOutcomes  — outcomes from outcomeConfig (full list with code + label + desc)
 */
export function buildCoverageMatrixDataset(activeCriteria = [], activeOutcomes = []) {
  const criteria = activeCriteria || [];
  const outcomes = activeOutcomes || [];

  const classify = (code, criterion) => {
    if (!criterion) return "none";
    const types = criterion.outcomeTypes || {};
    if (code in types) return types[code] || "direct";
    if ((criterion.outcomes || []).includes(code)) return "direct";
    return "none";
  };
  const label = (type) => (type === "direct" ? "Direct" : type === "indirect" ? "Indirect" : "—");

  const headers = ["Outcome", "Description", ...criteria.map((c) => c.label)];

  let direct = 0;
  let indirect = 0;
  let unmapped = 0;

  const rows = outcomes.map((o) => {
    const types = criteria.map((c) => classify(o.code, c));
    const hasDirect = types.includes("direct");
    const hasIndirect = types.includes("indirect");
    if (hasDirect) direct += 1;
    if (hasIndirect) indirect += 1;
    if (!hasDirect && !hasIndirect) unmapped += 1;
    return [o.code, o.desc_en || o.label || o.desc_tr || "", ...types.map(label)];
  });

  const extra = [
    {
      title: "Coverage Summary",
      headers: ["Metric", "Count"],
      rows: [
        ["Directly assessed", direct],
        ["Indirectly assessed", indirect],
        ["Not mapped", unmapped],
      ],
    },
  ];

  return {
    sheet: "Coverage Matrix",
    title: "Coverage Matrix",
    note: "Which programme outcomes are directly/indirectly assessed by each criterion.",
    headers,
    rows,
    extra,
  };
}

const OUTCOME_TREND_COLORS = [
  "#6366F1", "#EC4899", "#14B8A6", "#F97316",
  "#8B5CF6", "#06B6D4", "#F43F5E", "#10B981",
];

// Sort programme outcome codes naturally so "PO 2" precedes "PO 10.1"
// (default lexicographic ordering would place "PO 10.1" between "PO 1.2" and "PO 2").
// numeric: true treats contiguous digit runs as integers; the dotted parts stay
// stable because the literal "." compares equal across codes.
export function compareOutcomeCodes(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

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
  codeOrder.sort(compareOutcomeCodes);

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

/**
 * Outcome Attainment Rate sheet — matches AttainmentRateChart logic exactly.
 * Per outcome code: % of evaluations scoring ≥ threshold on the mapped criterion.
 */
export function buildAttainmentRateDataset({
  submittedData = [],
  activeOutcomes = [],
  threshold = 70,
  outcomeLookup = null,
} = {}) {
  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) {
        outcomeMap.set(code, { criterionKey: c.key ?? c.id, max: c.max, label: c.label });
      }
    }
  }

  const rows = [];
  for (const [code, meta] of outcomeMap) {
    const desc = outcomeLookup?.[code]?.desc_en || outcomeLookup?.[code]?.desc_tr || meta.label || code;
    const vals = outcomeValues(submittedData, meta.criterionKey);
    if (!vals.length) {
      rows.push([code, desc, null, 0, "No data"]);
      continue;
    }
    const above = vals.filter((v) => meta.max > 0 && (v / meta.max) * 100 >= threshold).length;
    const pct = fmt1((above / vals.length) * 100);
    const status =
      pct >= threshold ? "Met" :
      pct >= 60 ? "Borderline" :
      "Not Met";
    rows.push([code, desc, pct, vals.length, status]);
  }

  rows.sort((a, b) => (b[2] ?? -1) - (a[2] ?? -1));

  return {
    sheet: "Attainment Rate",
    title: "Outcome Attainment Rate",
    note: `Share of evaluations scoring ≥ ${threshold}% per programme outcome`,
    headers: ["Outcome", "Description", "Attainment Rate (%)", "N", "Status"],
    rows,
  };
}

/**
 * Outcome Attainment Trend — transposed export table matching the on-screen heatmap.
 * Rows: two per outcome (Attainment %, Average %) for every unique outcome code.
 * Columns: Outcome · Metric · {period name for each selected period}.
 *
 * This orientation keeps column count bounded by period count (typically 2–8),
 * avoiding the 36-column flat table that forced multi-line header wrapping in PDFs.
 * Periods are ordered chronologically (oldest → newest) to match the heatmap layout.
 */
export function buildOutcomeAttainmentTrendExportDataset(outcomeTrendData, periodOptions, selectedIds) {
  if (!outcomeTrendData?.length) {
    return {
      sheet: "Attainment Trend",
      title: "Outcome Attainment Trend",
      note: "Attainment rate and average score per programme outcome across periods",
      headers: ["Outcome", "Metric"],
      rows: [],
    };
  }

  const dataMap = new Map(outcomeTrendData.map((row) => [row.periodId, row]));
  const ordered = (periodOptions || [])
    .filter((s) => (selectedIds || []).includes(s.id))
    .sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate) : 0;
      const db = b.startDate ? new Date(b.startDate) : 0;
      return da - db;
    });

  const codeOrder = [];
  const labelByCode = {};
  const seenCodes = new Set();
  for (const row of outcomeTrendData) {
    for (const o of row.outcomes || []) {
      if (!seenCodes.has(o.code)) {
        codeOrder.push(o.code);
        seenCodes.add(o.code);
        labelByCode[o.code] = o.label || o.code;
      }
    }
  }
  codeOrder.sort(compareOutcomeCodes);

  const periodHeaders = ordered.map((s) => {
    const row = dataMap.get(s.id);
    return s.period_name || row?.periodName || s.name || "—";
  });

  const headers = ["Outcome", "Metric", ...periodHeaders];

  const rows = [];
  for (const code of codeOrder) {
    const label = labelByCode[code];
    const display = label && label !== code ? `${code} — ${label}` : code;
    const attCells = ordered.map((s) => {
      const o = dataMap.get(s.id)?.outcomes?.find((x) => x.code === code);
      return o?.attainmentRate ?? null;
    });
    const avgCells = ordered.map((s) => {
      const o = dataMap.get(s.id)?.outcomes?.find((x) => x.code === code);
      return o?.avg ?? null;
    });
    rows.push([display, "Attainment (%)", ...attCells]);
    rows.push(["", "Average (%)", ...avgCells]);
  }

  // Final row: N per period — one number per period column
  const nRow = ["N (evaluations)", "", ...ordered.map((s) => dataMap.get(s.id)?.nEvals ?? 0)];

  return {
    sheet: "Attainment Trend",
    title: "Outcome Attainment Trend",
    note: "Attainment rate and average score per programme outcome across periods",
    headers,
    rows: [...rows, nRow],
  };
}

export function buildThresholdGapDataset({ submittedData = [], activeOutcomes = [], threshold = 70 } = {}) {
  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) {
        outcomeMap.set(code, { criterionKey: c.key ?? c.id, max: c.max, label: c.label ?? c.key ?? c.id });
      }
    }
  }

  const rows = [];
  for (const [code, { criterionKey, max, label }] of outcomeMap) {
    const vals = outcomeValues(submittedData, criterionKey);
    if (!vals.length) { rows.push([code, label, null, null]); continue; }
    const aboveThreshold = vals.filter((v) => (v / max) * 100 >= threshold).length;
    const attRate = fmt1((aboveThreshold / vals.length) * 100);
    const gap = fmt1(attRate - threshold);
    rows.push([code, label, attRate, gap >= 0 ? `+${gap}%` : `${gap}%`]);
  }

  rows.sort((a, b) => {
    const gapA = parseFloat(a[3]);
    const gapB = parseFloat(b[3]);
    if (isNaN(gapA) && isNaN(gapB)) return 0;
    if (isNaN(gapA)) return 1;
    if (isNaN(gapB)) return -1;
    return gapB - gapA;
  });

  return {
    sheet: "Threshold Gap",
    title: "Threshold Gap Analysis",
    note: `Deviation from ${threshold}% competency threshold per outcome`,
    headers: ["Outcome", "Criterion", "Attainment Rate (%)", "Gap vs Threshold"],
    rows,
  };
}

/**
 * Project Attainment Heatmap — projects on rows, criteria on columns.
 * Project titles are long and wrap when used as column headers; using them as
 * row labels (with the P<n> code prefix) keeps the table compact and readable.
 * Criterion labels are short and fit cleanly as column headers.
 */
export function buildGroupHeatmapDataset({ dashboardStats = [], activeOutcomes = [], threshold = 70 } = {}) {
  const groups = (dashboardStats || [])
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.group_no ?? Infinity) - (b.group_no ?? Infinity));

  const criteria = activeOutcomes || [];

  if (!groups.length || !criteria.length) {
    return {
      sheet: "Project Heatmap",
      title: "Project Attainment Heatmap",
      note: `Normalized score (%) per criterion per project — cells below ${threshold}% threshold are flagged`,
      headers: ["Project Title"],
      rows: [],
    };
  }

  const groupLabel = (g) => {
    const code = g.group_no != null ? `P${g.group_no}` : null;
    const title = g.title || g.name || "";
    return code ? (title ? `${code} — ${title}` : code) : title || "—";
  };

  const headers = ["Project Title", ...criteria.map((c) => c.label), "Cells Below Threshold"];

  const rows = groups.map((g) => {
    let belowCount = 0;
    const cells = criteria.map((c) => {
      const rawValue = g.avg?.[c.key ?? c.id];
      const avgRaw = rawValue != null ? Number(rawValue) : null;
      if (avgRaw == null || !Number.isFinite(avgRaw) || !(c.max > 0)) return null;
      const pct = fmt1((avgRaw / c.max) * 100);
      if (pct < threshold) belowCount += 1;
      return pct;
    });
    return [groupLabel(g), ...cells, belowCount];
  });

  return {
    sheet: "Project Heatmap",
    title: "Project Attainment Heatmap",
    note: `Normalized score (%) per criterion per project — cells below ${threshold}% threshold are flagged`,
    headers,
    rows,
  };
}
