// src/charts/chartUtils.jsx
// ── Shared helpers, constants, and small components used by all chart files ──

import { useState, useEffect, useMemo } from "react";
import { CRITERIA } from "../config";
import { useTheme } from "../shared/theme/ThemeProvider";

// ── CSS token helpers ───────────────────────────────────────────
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartColors() {
  return {
    chart1: getCSSVar("--chart-1"),
    chart2: getCSSVar("--chart-2"),
    chart3: getCSSVar("--chart-3"),
    chart4: getCSSVar("--chart-4"),
    chart5: getCSSVar("--chart-5"),
    scoreExcellentBg: getCSSVar("--score-excellent-bg"),
    scoreHighBg: getCSSVar("--score-high-bg"),
    scoreGoodBg: getCSSVar("--score-good-bg"),
    scoreAdequateBg: getCSSVar("--score-adequate-bg"),
    scoreLowBg: getCSSVar("--score-low-bg"),
    scorePoorBg: getCSSVar("--score-poor-bg"),
    scorePartialBg: getCSSVar("--score-partial-bg"),
    statusMetText: getCSSVar("--status-met-text"),
    statusBorderlineText: getCSSVar("--status-borderline-text"),
    statusNotMetText: getCSSVar("--status-not-met-text"),
    border: getCSSVar("--border"),
    mutedForeground: getCSSVar("--muted-foreground"),
  };
}

// ── Per-chart MÜDEK outcome code lists ───────────────────────
// All charts use the same set per spec §3.
export const CHART_OUTCOMES = ["9.1", "9.2", "1.2", "2", "3.1", "3.2", "8.1", "8.2"];

// ── Derive outcome list from criteria array ────────────────────────────────
// `buildOutcomes` accepts a CRITERIA-shaped array (from config or converted
// from criteria_template via getActiveCriteria). Missing optional fields
// (shortLabel, color, mudek) are handled gracefully.
export function buildOutcomes(criteria = CRITERIA) {
  return criteria.map((c) => ({
    key: c.id ?? c.key,
    code: Array.isArray(c.mudek) ? c.mudek.join("/") : "",
    label: c.shortLabel || c.label,
    max: c.max,
    color: c.color,
  }));
}

// Static config-based constant kept for backward compat.
export const OUTCOMES = buildOutcomes();

export const CHART_COPY = {
  outcomeByGroup: {
    title: "Outcome Achievement by Group",
    note: "Compares each group's normalized score across all four MÜDEK-mapped criteria.",
  },
  programmeAverages: {
    title: "Programme-Level Outcome Averages",
    note: "Grand mean ±1 std. deviation (σ) normalized score per outcome across all groups and jurors.",
  },
  semesterTrend: {
    title: "Semester Trend",
    note: "Normalized averages across selected semesters.",
  },
  competencyProfile: {
    title: "Competency Profile per Group",
    note: "Shows whether a group's competency development is balanced or skewed across all four outcomes.",
  },
  scoreDistribution: {
    title: "Score Distribution by Criterion",
    note: "Reveals inter-juror spread for each criterion — evidence of measurement reliability.",
  },
  jurorConsistency: {
    title: "Juror Consistency Heatmap",
    note: "Identifies which group × criterion combinations have poor juror agreement, guiding rubric improvement.",
  },
  achievementDistribution: {
    title: "Achievement Level Distribution",
    note: "% of evaluations per rubric band — directly maps to MÜDEK continuous improvement evidence.",
  },
};

export function parseOutcomeCode(code) {
  const [majorRaw, minorRaw] = String(code).split(".");
  const major = parseInt(majorRaw, 10);
  const minor = parseInt(minorRaw ?? "0", 10);
  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 0,
  };
}

export function compareOutcomeCodes(a, b) {
  const A = parseOutcomeCode(a);
  const B = parseOutcomeCode(b);
  if (A.major !== B.major) return A.major - B.major;
  if (A.minor !== B.minor) return A.minor - B.minor;
  return String(a).localeCompare(String(b));
}

export function formatMudekCodes(code) {
  return String(code || "")
    .split("/")
    .map((c) => c.trim())
    .filter(Boolean)
    .join(" / ");
}

export function outcomeCodeLine(code) {
  const formatted = formatMudekCodes(code);
  return formatted ? `(${formatted})` : "";
}

export function OutcomeLegendLabel({ label, code }) {
  const codeLine = outcomeCodeLine(code);
  return (
    <span className="legend-label">
      <span className="legend-label-main">{label}</span>
      {codeLine ? <span className="legend-label-sub">{codeLine}</span> : null}
    </span>
  );
}

function splitLabelLines(label) {
  const words = String(label || "").split(" ").filter(Boolean);
  if (words.length <= 1) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function OutcomeLabelSvg({
  x,
  y,
  label,
  code,
  anchor = "middle",
  mainSize = 9,
  subSize = 7,
  mainFill = "#475569",
  subFill = "#94a3b8",
  fontWeight = 600,
  lineGap = 11,
  mainClassName = "",
  subClassName = "",
  wrap = false,
}) {
  const codeLine = outcomeCodeLine(code);
  const lines = wrap ? splitLabelLines(label) : [label];
  return (
    <g>
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={y + i * (mainSize + 3)}
          textAnchor={anchor}
          fontSize={mainSize}
          fill={mainFill}
          fontWeight={fontWeight}
          className={i === 0 ? (mainClassName || undefined) : undefined}
        >
          {line}
        </text>
      ))}
      {codeLine ? (
        <text
          x={x}
          y={y + lines.length * (mainSize + 3)}
          textAnchor={anchor}
          fontSize={subSize}
          fill={subFill}
          className={subClassName || undefined}
        >
          {codeLine}
        </text>
      ) : null}
    </g>
  );
}

// ── Shared empty state ────────────────────────────────────────
export function ChartEmpty({ msg }) {
  return <div className="chart-empty">{msg || "Not enough data yet."}</div>;
}

// ── Shared accessible data table for charts ───────────────────
export function ChartDataTable({ caption, headers, rows, defaultOpen }) {
  if (!rows || rows.length === 0) return null;
  const reducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const shouldOpen = defaultOpen ?? reducedMotion;
  return (
    <details className="chart-data-table-details" open={shouldOpen}>
      <summary className="chart-data-table-summary">Show data table</summary>
      <div className="chart-data-table-scroll">
        <table className="chart-data-table">
          {caption && <caption>{caption}</caption>}
          <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── useChartColors hook — updates colors when theme changes ───────────
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => getChartColors(), [theme]);
}
