// src/charts/CompetencyRadarChart.jsx
// ════════════════════════════════════════════════════════════
// CHART 3 — Competency Profile per Group (Radar)
// CHART 3b — RadarPrintAll
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { mean } from "../shared/stats";
import {
  OUTCOMES,
  CHART_COPY,
  OutcomeLabelSvg,
  ChartEmpty,
  ChartDataTable,
  useChartColors,
} from "./chartUtils";

export function CompetencyRadarChart({ stats, outcomes: oc = OUTCOMES }) {
  const colors = useChartColors();
  const available = stats.filter((s) => s.count > 0);
  const [selId, setSelId] = useState(available[0]?.id ?? null);
  if (!available.length) return <ChartEmpty />;

  const group = available.find((s) => s.id === (selId ?? available[0].id)) ?? available[0];
  const N = oc.length;
  const cx = 130, cy = 120, R = 82;
  const angle = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const spoke = (i, r) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });

  const vals    = oc.map((o) => ((group.avg[o.key] || 0) / o.max) * 100);
  const avgVals = oc.map((o) => {
    const v = available.map((s) => ((s.avg[o.key] || 0) / o.max) * 100);
    return mean(v);
  });

  const pts    = vals.map((v, i) => spoke(i, (v / 100) * R));
  const avgPts = avgVals.map((v, i) => spoke(i, (v / 100) * R));
  const path    = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const avgPath = avgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 h-full flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{CHART_COPY.competencyProfile.title}</div>
          <div className="text-xs text-muted-foreground">{CHART_COPY.competencyProfile.note}</div>
        </div>
      </div>

      {available.length > 1 && (
        <select
          className="radar-group-select"
          value={selId ?? available[0].id}
          onChange={(e) => setSelId(e.target.value)}
        >
          {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      <div className="chart-svg-fill" style={{ overflowX: "auto" }}>
        <svg
          className="chart-main-svg"
          viewBox="0 0 260 240"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", maxWidth: 280, height: "100%", display: "block" }}
          role="img"
          aria-label="Competency Profile per Group chart"
        >
          {[0.25, 0.5, 0.75, 1].map((r) => {
            const ring = oc.map((_, i) => spoke(i, r * R));
            const rpath = ring.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
            return <path key={r} d={rpath} fill="none" stroke={colors.border} strokeWidth="1" />;
          })}
          {[0.25, 0.5, 0.75, 1].map((r) => {
            const p = spoke(0, r * R);
            return (
              <text
                key={`tick-${r}`}
                x={p.x.toFixed(1)}
                y={(p.y - 6).toFixed(1)}
                textAnchor="middle"
                fontSize="8"
                fill={colors.mutedForeground}
              >
                {Math.round(r * 100)}%
              </text>
            );
          })}
          {oc.map((_, i) => {
            const end = spoke(i, R);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={end.x.toFixed(1)}
                y2={end.y.toFixed(1)}
                stroke={colors.border}
                strokeWidth="1"
              />
            );
          })}
          <path d={avgPath} fill="none" stroke={colors.mutedForeground} strokeWidth="1.5" strokeDasharray="4,3" />
          <path d={path} fill={colors.chart4} stroke={colors.chart1} strokeWidth="2.2" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <title>{oc[i].label}: {vals[i].toFixed(1)}%{"\n"}Cohort avg: {avgVals[i].toFixed(1)}%</title>
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill={colors.chart1} stroke="#fff" strokeWidth="1.2" />
            </g>
          ))}
          {oc.map((o, i) => {
            const lp = spoke(i, R + 28);
            return (
              <OutcomeLabelSvg
                key={o.key}
                x={lp.x}
                y={lp.y}
                label={o.label}
                code={o.code}
                mainSize={9}
                subSize={7}
                mainFill={colors.mutedForeground}
                subFill={colors.mutedForeground}
                fontWeight={700}
                lineGap={9}
              />
            );
          })}
        </svg>
      </div>

      <ChartDataTable
        caption={`Competency Profile — ${group.name}`}
        headers={["Criterion", "Score (%)", "Cohort Avg (%)"]}
        rows={oc.map((o, i) => [o.label, vals[i].toFixed(1), avgVals[i].toFixed(1)])}
      />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: colors.chart1 }} />
          {group.name}
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: colors.mutedForeground }} />
          Cohort Average (dashed)
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CHART 3b — RadarPrintAll
// Print-only: renders one radar per group in a 4-column grid.
// Hidden on screen via .radar-all-print-section { display:none }.
// Shown in @media print.
// ════════════════════════════════════════════════════════════
export function RadarPrintAll({ stats, outcomes: oc = OUTCOMES }) {
  const colors = useChartColors();
  const available = stats.filter((s) => s.count > 0);
  if (!available.length) return null;

  const N = oc.length;
  const cx = 130, cy = 120, R = 82;
  const angle = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const spoke  = (i, r) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });
  const ringPath = (r) => {
    const pts = oc.map((_, i) => spoke(i, r * R));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  };

  // Cohort average path (dashed reference line)
  const avgVals = oc.map((o) => {
    const vs = available.map((s) => ((s.avg[o.key] || 0) / o.max) * 100);
    return mean(vs);
  });
  const avgPts  = avgVals.map((v, i) => spoke(i, (v / 100) * R));
  const avgPathD = avgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <>
      {available.map((group) => {
        const vals = oc.map((o) => ((group.avg[o.key] || 0) / o.max) * 100);
        const pts  = vals.map((v, i) => spoke(i, (v / 100) * R));
        const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
        return (
          <section key={group.id} className="print-page report-chart radar-print-page">
            <h2 className="print-card-title">{CHART_COPY.competencyProfile.title}</h2>
            <div className="print-card-subtitle">{group.name}</div>
            <div className="print-card-note">{CHART_COPY.competencyProfile.note}</div>
            <div className="chart-wrapper">
              <div className="radar-print-card">
                <svg
                  viewBox="0 0 260 240"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ width: "100%", height: "auto", display: "block" }}
                >
                {[0.25, 0.5, 0.75, 1].map((r) => (
                  <path key={r} d={ringPath(r)} fill="none" stroke={colors.border} strokeWidth="1" />
                ))}
                {[0.25, 0.5, 0.75, 1].map((r) => {
                  const p = spoke(0, r * R);
                  return (
                    <text
                      key={`tick-${r}`}
                      x={p.x.toFixed(1)}
                      y={(p.y - 6).toFixed(1)}
                      textAnchor="middle"
                      fontSize="8"
                      fill={colors.mutedForeground}
                    >
                      {Math.round(r * 100)}%
                    </text>
                  );
                })}
                {oc.map((_, i) => {
                  const end = spoke(i, R);
                  return <line key={i} x1={cx} y1={cy} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke={colors.border} strokeWidth="1" />;
                })}
                <path d={avgPathD} fill="none" stroke={colors.mutedForeground} strokeWidth="1.5" strokeDasharray="4,3" />
                <path d={pathD} fill={colors.chart4} stroke={colors.chart1} strokeWidth="2.2" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill={colors.chart1} stroke="#fff" strokeWidth="1.2" />
                ))}
                {oc.map((o, i) => {
                  const lp = spoke(i, R + 28);
                  return (
                    <OutcomeLabelSvg
                      key={o.key}
                      x={lp.x}
                      y={lp.y}
                      label={o.label}
                      code={o.code}
                      mainSize={8.5}
                      subSize={6.8}
                      mainFill={colors.mutedForeground}
                      subFill={colors.mutedForeground}
                      fontWeight={700}
                      lineGap={8}
                    />
                  );
                })}
                </svg>
              </div>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: colors.chart1 }} />
                {group.name}
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: colors.mutedForeground }} />
                Cohort Average (dashed)
              </span>
            </div>
          </section>
        );
      })}
    </>
  );
}
