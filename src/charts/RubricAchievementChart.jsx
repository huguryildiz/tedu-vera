// src/charts/RubricAchievementChart.jsx
// ════════════════════════════════════════════════════════════
// CHART 6 — Rubric Achievement Level Distribution (vertical 100% stacked)
// Vertical bars: one bar per criterion, stacked Excellent→Insufficient bottom-to-top
// Banding uses CRITERIA rubric min/max thresholds from config
// ════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { CRITERIA } from "../config";
import {
  OUTCOMES,
  CHART_COPY,
  OutcomeLabelSvg,
  ChartEmpty,
  ChartDataTable,
  useChartColors,
} from "./chartUtils";

export function RubricAchievementChart({ data, outcomes: oc = OUTCOMES }) {
  const colors = useChartColors();
  const rows = data || [];
  if (!rows.length) return <ChartEmpty />;

  // Stacked from bottom to top: Insufficient → Developing → Good → Excellent
  // So "better" results are higher on the chart.
  const bands = useMemo(() => [
    { key: "insufficient", label: "Insufficient", color: colors.scorePoorBg },
    { key: "developing",   label: "Developing",   color: colors.scoreAdequateBg },
    { key: "good",         label: "Good",         color: colors.scoreGoodBg },
    { key: "excellent",    label: "Excellent",    color: colors.scoreExcellentBg },
  ], [colors]);

  const classify = (v, rubric) => {
    if (!Number.isFinite(v)) return null;
    for (const band of rubric) {
      if (v >= band.min && v <= band.max) return band.level.toLowerCase();
    }
    return null;
  };

  const stacks = oc.map((o) => {
    const rubric = o.rubric?.length ? o.rubric : (CRITERIA.find((c) => c.id === o.key)?.rubric || []);
    const vals = rows.map((r) => Number(r[o.key])).filter((v) => Number.isFinite(v));
    const counts = { excellent: 0, good: 0, developing: 0, insufficient: 0 };
    vals.forEach((v) => {
      const k = classify(v, rubric);
      if (k) counts[k] += 1;
    });
    const total = vals.length || 1;
    const pct = bands.map((b) => ({ ...b, pct: (counts[b.key] / total) * 100, count: counts[b.key] }));
    return { ...o, pct, total: vals.length };
  });

  const bandPresence = bands.map((b) => ({
    ...b,
    anyPresent: stacks.some((c) => c.pct.find((p) => p.key === b.key)?.pct > 0),
  }));

  // Vertical layout
  const padL    = 32;  // y-axis labels
  const padR    = 10;
  const padT    = 8;
  const hasLongLabel = oc.some((o) => o.label.includes(" "));
  const padB    = hasLongLabel ? 52 : 40;
  const chartH  = 180;
  const W       = 340;
  const H       = padT + chartH + padB;
  const groupW  = (W - padL - padR) / stacks.length;
  const barW    = Math.min(44, groupW * 0.65);
  const yScale  = (pct) => (pct / 100) * chartH;

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 flex-1 h-full flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{CHART_COPY.achievementDistribution.title}</div>
          <div className="text-xs text-muted-foreground">{CHART_COPY.achievementDistribution.note}</div>
        </div>
      </div>

      <div className="chart-svg-fill rubric-svg-fill" style={{ overflowX: "auto" }}>
        <svg className="chart-main-svg" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Achievement Level Distribution chart">
          {/* Y-axis grid lines and labels */}
          {[0, 25, 50, 75, 100].map((v) => {
            const y = padT + chartH - yScale(v);
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={colors.border} strokeWidth="1" />
                <text x={padL - 4} y={y + 4} fontSize="8" textAnchor="end" fill={colors.mutedForeground}>{v}%</text>
              </g>
            );
          })}

          {/* One vertical 100%-stacked bar per criterion */}
          {stacks.map((c, i) => {
            const cx = padL + i * groupW + groupW / 2;
            const x  = cx - barW / 2;
            let cursorFromBottom = 0;
            return (
              <g key={c.key}>
                {c.pct.map((b) => {
                  if (b.pct <= 0) return null;
                  const segH = yScale(b.pct);
                  const y    = padT + chartH - cursorFromBottom - segH;
                  cursorFromBottom += segH;
                  const showLabel = segH >= 16;
                  return (
                    <g key={b.key}>
                      <title>{c.label} · {b.label}{"\n"}Count: {b.count} evaluation{b.count !== 1 ? "s" : ""}{"\n"}Share: {b.pct.toFixed(0)}%</title>
                      <rect x={x} y={y} width={barW} height={segH} fill={b.color} />
                      {showLabel && (
                        <text x={cx} y={y + segH / 2 + 4} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">
                          {b.pct.toFixed(0)}%
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* Criterion label below bar */}
                <OutcomeLabelSvg
                  x={cx}
                  y={padT + chartH + 14}
                  label={c.label}
                  code={c.code}
                  mainSize={9}
                  subSize={7}
                  mainFill={colors.mutedForeground}
                  subFill={colors.mutedForeground}
                  fontWeight={600}
                  lineGap={10}
                  wrap={hasLongLabel}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <ChartDataTable
        caption="Achievement Level Distribution"
        headers={["Criterion", "Band", "%"]}
        rows={stacks.flatMap((c) =>
          c.pct.map((b) => [c.label, b.label, b.pct.toFixed(1) + "%"])
        )}
      />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {[...bandPresence].reverse().map((b) => (
          <span
            key={b.key}
            className="legend-item"
            style={b.anyPresent ? undefined : { opacity: 0.35, textDecoration: "line-through" }}
          >
            <span className="legend-dot" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CHART 6-PRINT — Achievement Level Distribution (100% stacked)
// viewBox 340 × 220  (half-width card)
// ════════════════════════════════════════════════════════════
export function RubricAchievementChartPrint({ data, outcomes: oc = OUTCOMES }) {
  const colors = useChartColors();
  const rows = data || [];
  if (!rows.length) return null;

  const bands = useMemo(() => [
    { key: "insufficient", label: "Insufficient", color: colors.scorePoorBg },
    { key: "developing",   label: "Developing",   color: colors.scoreAdequateBg },
    { key: "good",         label: "Good",         color: colors.scoreGoodBg },
    { key: "excellent",    label: "Excellent",    color: colors.scoreExcellentBg },
  ], [colors]);

  const classify = (v, rubric) => {
    if (!Number.isFinite(v)) return null;
    for (const band of rubric) {
      if (v >= band.min && v <= band.max) return band.level.toLowerCase();
    }
    return null;
  };

  const stacks = oc.map((o) => {
    const criterion = CRITERIA.find((c) => c.id === o.key);
    const vals      = rows.map((r) => Number(r[o.key])).filter((v) => Number.isFinite(v));
    const counts    = { excellent: 0, good: 0, developing: 0, insufficient: 0 };
    vals.forEach((v) => {
      const k = classify(v, criterion.rubric);
      if (k) counts[k] += 1;
    });
    const total = vals.length || 1;
    const pct   = bands.map((b) => ({ ...b, pct: (counts[b.key] / total) * 100, count: counts[b.key] }));
    return { ...o, pct };
  });

  const bandPresence = bands.map((b) => ({
    ...b,
    anyPresent: stacks.some((c) => c.pct.find((p) => p.key === b.key)?.pct > 0),
  }));

  const padL   = 32;
  const padR   = 10;
  const padT   = 8;
  const hasLongLabelPrint = oc.some((o) => o.label.includes(" "));
  const padB   = hasLongLabelPrint ? 66 : 54;
  const chartH = 160;
  const W      = 340;
  const H      = padT + chartH + padB;
  const groupW = (W - padL - padR) / stacks.length;
  const barW   = Math.min(44, groupW * 0.65);
  const yScale = (pct) => (pct / 100) * chartH;
  const legendY = H - 8;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Y-axis grid */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = padT + chartH - yScale(v);
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={colors.border} strokeWidth="1" />
            <text x={padL - 4} y={y + 4} fontSize="7.5" textAnchor="end" fill={colors.mutedForeground}>{v}%</text>
          </g>
        );
      })}

      {/* Stacked bars */}
      {stacks.map((c, i) => {
        const cx = padL + i * groupW + groupW / 2;
        const x  = cx - barW / 2;
        let cursorFromBottom = 0;
        return (
          <g key={c.key}>
            {c.pct.map((b) => {
              if (b.pct <= 0) return null;
              const segH = yScale(b.pct);
              const y    = padT + chartH - cursorFromBottom - segH;
              cursorFromBottom += segH;
              const showLabel = segH >= 14;
              return (
                <g key={b.key}>
                  <rect x={x} y={y} width={barW} height={segH} fill={b.color} />
                  {showLabel && (
                    <text x={cx} y={y + segH / 2 + 4}
                      textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700"
                    >{b.pct.toFixed(0)}%</text>
                  )}
                </g>
              );
            })}
            <OutcomeLabelSvg
              x={cx}
              y={padT + chartH + 12}
              label={c.label}
              code={c.code}
              mainSize={9}
              subSize={7}
              mainFill={colors.mutedForeground}
              subFill={colors.mutedForeground}
              fontWeight={600}
              lineGap={10}
              wrap={hasLongLabelPrint}
            />
          </g>
        );
      })}

      {/* Legend */}
      {[...bandPresence].reverse().map((b, i) => {
        const lx = padL + i * 74;
        return (
          <g key={b.key} opacity={b.anyPresent ? 1 : 0.4}>
            <rect x={lx} y={legendY - 8} width={10} height={10} fill={b.color} rx="2" />
            <text x={lx + 13} y={legendY} fontSize="8.5" fill={colors.mutedForeground}>{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
