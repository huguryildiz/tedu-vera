// src/admin/scoreHelpers.js
// ============================================================
// Single source of truth for scoring logic and status metadata.
//
// Cell states:    scored | partial | empty
// Juror states:   completed | ready_to_submit | in_progress | not_started | editing
// ============================================================

import {
  CheckCircle2Icon,
  CheckIcon,
  SendIcon,
  Clock3Icon,
  CircleIcon,
  CircleDotDashedIcon,
  PencilIcon,
} from "@/shared/ui/Icons";
import { rowKey } from "./adminUtils";

// ── Cell state ────────────────────────────────────────────────
// entry: { total, ...criteriaFields } from lookup
// Field list is driven by CRITERIA from config.js — no hardcoded names.

export function getCellState(entry, criteria = []) {
  if (!entry) return "empty";
  const filledCount = criteria.filter((c) => entry[c.id] != null).length;
  if (filledCount === 0) return "empty";
  return filledCount === criteria.length ? "scored" : "partial";
}

// Partial sum from whichever criteria are filled (numeric only).
// Returns 0 if nothing is filled.
export function getPartialTotal(entry, criteria = []) {
  if (!entry) return 0;
  return criteria.reduce(
    (sum, c) => sum + (typeof entry[c.id] === "number" ? entry[c.id] : 0),
    0
  );
}

// ── Juror workflow state ──────────────────────────────────────
// juror:        { key, editEnabled }
// groups:       { id }[]
// lookup:       jurorKey → { projectId → entry }
// jurorFinalMap: Map<jurorKey, boolean>  (has final_submitted_at)

export function getJurorWorkflowState(juror, groups, lookup, jurorFinalMap, criteria = []) {
  if (juror.editEnabled) return "editing";
  const isFinal = jurorFinalMap.get(juror.key) && !juror.editEnabled;
  if (isFinal) return "completed";

  const startedCount = groups.filter((g) => {
    const entry = lookup[juror.key]?.[g.id];
    return getCellState(entry, criteria) !== "empty";
  }).length;
  const scoredCount = groups.filter((g) => {
    const entry = lookup[juror.key]?.[g.id];
    return getCellState(entry, criteria) === "scored";
  }).length;

  if (groups.length > 0 && scoredCount === groups.length) return "ready_to_submit";
  if (startedCount > 0) return "in_progress";
  return "not_started";
}

// ── Juror status meta ─────────────────────────────────────────
// Single shared lookup for labels, icons, and Tailwind color utilities.
// colorClass values are Tailwind text-color classes (e.g. "text-green-700 dark:text-green-400")
// Applied directly to icon elements via className.

// ── Juror workflow states + cell states used by StatusBadge ──
// colorClass values are Tailwind text-color classes (e.g. "text-green-700 dark:text-green-400")
// Applied directly to icon elements via className.
export const jurorStatusMeta = {
  // Juror workflow states
  completed: {
    label:      "Completed",
    icon:       CheckCircle2Icon,
    colorClass: "text-green-700 dark:text-green-400",
    description: "Final submission completed.",
  },
  ready_to_submit: {
    label:      "Ready to Submit",
    icon:       SendIcon,
    colorClass: "text-blue-600 dark:text-blue-400",
    description: "All groups scored.",
  },
  in_progress: {
    label:      "In Progress",
    icon:       Clock3Icon,
    colorClass: "text-amber-600 dark:text-amber-400",
    description: "Scoring has started.",
  },
  not_started: {
    label:      "Not Started",
    icon:       CircleIcon,
    colorClass: "text-slate-300 dark:text-slate-600",
    description: "No scoring activity yet.",
  },
  editing: {
    label:      "Editing",
    icon:       PencilIcon,
    colorClass: "text-violet-600 dark:text-violet-400",
    description: "Editing mode enabled.",
  },
  // Cell states (used in per-group row badges in JurorActivity)
  scored: {
    label:      "Scored",
    icon:       CheckIcon,
    colorClass: "text-green-600 dark:text-green-300",
    description: "All criteria are scored.",
  },
  partial: {
    label:      "Partial",
    icon:       CircleDotDashedIcon,
    colorClass: "text-amber-600 dark:text-amber-400",
    description: "At least one criterion is missing.",
  },
  empty: {
    label:      "Empty",
    icon:       CircleIcon,
    colorClass: "text-slate-300 dark:text-slate-600",
    description: "No score entered yet.",
  },
};

// ── Top-project highlight phrase ──────────────────────────────
// Pure function: derives a qualitative highlight from per-criterion averages.
// Rules (evaluated in priority order):
//   1. totalAvg ≥ 85                       → "Outstanding overall performance"
//   2. All criteria within 10 pct-pt range → "Consistent across all criteria"
//   3. Top criterion >15 pct-pt above next → "High [criterion]"
//   4. Top two criteria both >80 pct       → "Strong [crit1] & [crit2]"
//   5. Fallback                            → "Strongest in [criterion]"
//
// @param {object}   project        - summaryData row: { avg: { [id]: number }, totalAvg }
// @param {object[]} criteriaConfig - [{ id, max, shortLabel, label }]
// @returns {string|null}
export function getProjectHighlight(project, criteriaConfig = []) {
  if (!project?.avg || criteriaConfig.length === 0) return null;

  const entries = criteriaConfig
    .map((c) => {
      const raw = project.avg[c.id];
      if (raw == null || !c.max) return null;
      return { label: c.shortLabel || c.label || c.id, pct: (raw / c.max) * 100 };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => b.pct - a.pct);

  if (project.totalAvg != null && project.totalAvg >= 85) return "Outstanding overall performance";

  if (entries.length >= 2) {
    const range = sorted[0].pct - sorted[sorted.length - 1].pct;
    if (range <= 10) return "Consistent across all criteria";
  }

  if (sorted.length >= 2 && sorted[0].pct - sorted[1].pct > 15) {
    return `High ${sorted[0].label}`;
  }

  if (sorted.length >= 2 && sorted[0].pct > 80 && sorted[1].pct > 80) {
    return `Strong ${sorted[0].label} & ${sorted[1].label}`;
  }

  return `Strongest in ${sorted[0].label}`;
}

// ── Overview dashboard metrics ─────────────────────────────────
// Pure function: no React deps. Extracted from AdminPanel.jsx useMemo
// so it can be unit-tested independently.
//
// @param {object[]} rawScores       - flat score rows from adminGetScores
// @param {object[]} assignedJurors  - jurors assigned to the current period
// @param {number}   totalProjects   - total groups in the period
// @returns {object} counts for each dashboard metric
export function computeOverviewMetrics(rawScores, assignedJurors, totalProjects, criteria = []) {
  const safeScores  = rawScores      || [];
  const safeJurors  = assignedJurors || [];
  const safeProjCt  = totalProjects  || 0;

  const assignedIds   = new Set(safeJurors.map((j) => j.jurorId));
  const totalJurors   = safeJurors.length;
  const scoredByJuror = new Map();
  const startedByJuror = new Map();
  let scoredEvaluations  = 0;
  let partialEvaluations = 0;

  safeScores.forEach((r) => {
    if (assignedIds.size > 0 && !assignedIds.has(r.jurorId)) return;
    const cellState = getCellState(r, criteria);
    if (cellState === "scored")  scoredEvaluations  += 1;
    if (cellState === "partial") partialEvaluations += 1;
    if (r.total === null || r.total === undefined) return;
    const key = rowKey(r);
    scoredByJuror.set(key, (scoredByJuror.get(key) || 0) + 1);
  });

  safeScores.forEach((r) => {
    if (assignedIds.size > 0 && !assignedIds.has(r.jurorId)) return;
    if (getCellState(r, criteria) === "empty") return;
    const key = rowKey(r);
    startedByJuror.set(key, (startedByJuror.get(key) || 0) + 1);
  });

  const editingJurors = safeJurors.filter((j) =>
    !!(j.editEnabled ?? j.edit_enabled)
  ).length;

  const completedJurors = safeJurors.filter((j) => {
    const isEditing = !!(j.editEnabled ?? j.edit_enabled);
    return !isEditing && !!(j.finalSubmitted ?? j.finalSubmittedAt);
  }).length;

  const totalEvaluations = totalJurors * safeProjCt;
  const emptyEvaluations = Math.max(
    totalEvaluations - scoredEvaluations - partialEvaluations,
    0
  );

  const readyToSubmitJurors = safeJurors.filter((j) => {
    const isEditing = !!(j.editEnabled ?? j.edit_enabled);
    const isFinal   = !!(j.finalSubmitted ?? j.finalSubmittedAt);
    if (isEditing || isFinal) return false;
    return safeProjCt > 0 && (scoredByJuror.get(j.key) || 0) >= safeProjCt;
  }).length;

  const inProgressJurors = safeJurors.filter((j) => {
    const isEditing = !!(j.editEnabled ?? j.edit_enabled);
    const isFinal   = !!(j.finalSubmitted ?? j.finalSubmittedAt);
    if (isEditing || isFinal) return false;
    const started = startedByJuror.get(j.key) || 0;
    const scored  = scoredByJuror.get(j.key)  || 0;
    return started > 0 && scored < safeProjCt;
  }).length;

  const notStartedJurors = safeJurors.filter((j) => {
    const isEditing = !!(j.editEnabled ?? j.edit_enabled);
    if (isEditing) return false;
    const isFinal = !!(j.finalSubmitted ?? j.finalSubmittedAt);
    if (isFinal) return false;
    return (startedByJuror.get(j.key) || 0) === 0;
  }).length;

  return {
    completedJurors,
    readyToSubmitJurors,
    totalJurors,
    totalEvaluations,
    totalProjects: safeProjCt,
    scoredEvaluations,
    partialEvaluations,
    emptyEvaluations,
    inProgressJurors,
    editingJurors,
    notStartedJurors,
  };
}

// ── 5-level score palette — light and dark defined independently ───────────────
// Thresholds: <50 red | 50–64 orange | 65–74 yellow | 75–84 lime | ≥85 emerald
// Light mode colors live in HeatmapPage.css via body:not(.dark-mode) .m-score-lN.
// Dark mode colors applied as inline styles so they win over the CSS class.

// Dark mode: matches ga-cell-* aesthetic from AnalyticsPage
const PALETTE_DARK = [
  { bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.28)", text: "#f87171"  }, // red
  { bg: "rgba(251,146,60,0.14)",  border: "rgba(251,146,60,0.28)",  text: "#fb923c"  }, // orange
  { bg: "rgba(250,204,21,0.14)",  border: "rgba(250,204,21,0.28)",  text: "#fbbf24"  }, // yellow
  { bg: "rgba(163,230,53,0.12)",  border: "rgba(163,230,53,0.22)",  text: "#86efac"  }, // lime
  { bg: "rgba(74,222,128,0.14)",  border: "rgba(74,222,128,0.26)",  text: "#4ade80"  }, // green
];

function _scoreLevel(score, max) {
  if (score == null || max <= 0) return null;
  const pct = (score / max) * 100;
  if (pct >= 85) return 4; // emerald
  if (pct >= 75) return 3; // lime
  if (pct >= 65) return 2; // yellow
  if (pct >= 50) return 1; // orange
  return 0;                // red
}

// Returns a CSS class for score level (used to apply light-mode CSS overrides).
export function scoreCellClass(score, max) {
  const level = _scoreLevel(score, max);
  return level !== null ? `m-score-l${level}` : null;
}

// Returns just the rgba background string (used by SparkDot).
// isDark: pass from useTheme() — never read from DOM during render.
export function scoreBgColor(score, max, isDark = false) {
  const level = _scoreLevel(score, max);
  if (level === null) return null;
  if (!isDark) return null; // SparkDot light mode handled by CSS class
  return PALETTE_DARK[level].bg;
}

// Returns dark-mode inline styles for score cells (light mode uses CSS class).
// isDark: pass from useTheme() — never read from DOM during render.
export function scoreCellStyle(score, max, isDark = false) {
  const level = _scoreLevel(score, max);
  if (level === null) return null;
  if (!isDark) return null;
  const p = PALETTE_DARK[level];
  return {
    background: p.bg,
    boxShadow:  `inset 0 0 0 1px ${p.border}`,
    color:      p.text,
  };
}
