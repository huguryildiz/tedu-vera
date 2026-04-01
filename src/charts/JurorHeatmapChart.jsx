// src/charts/JurorHeatmapChart.jsx
// ════════════════════════════════════════════════════════════
// CHART 4 — Juror Consistency Heatmap (CV)
// CV = SD/mean × 100 per group × criterion
// ════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { mean, stdDev } from "../shared/stats";
import {
  OUTCOMES,
  CHART_COPY,
  OutcomeLabelSvg,
  ChartEmpty,
  ChartDataTable,
  useChartColors,
} from "./chartUtils";

export function JurorConsistencyHeatmap({ stats, data, outcomes: oc = OUTCOMES }) {
  const colors = useChartColors();
  const groups = stats.filter((s) => s.count > 0);
  const rows   = data || [];
  if (!groups.length || !rows.length) return <ChartEmpty />;

  const rowsByProject = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.projectId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [rows]);

  const cellData = useMemo(() => (
    oc.map((o) =>
      groups.map((g) => {
        const groupRows = rowsByProject.get(g.id) || [];
        const vals = groupRows
          .map((r) => Number(r[o.key]))
          .filter((v) => Number.isFinite(v));
        if (vals.length < 2) return { cv: null, m: null, sd: null, n: vals.length };
        const m  = mean(vals);
        if (!m) return { cv: null, m, sd: null, n: vals.length };
        const sd = stdDev(vals, true);
        return { cv: (sd / m) * 100, m, sd, n: vals.length };
      })
    )
  ), [groups, rowsByProject]);

  const cvBand = (v) => {
    if (v === null) return { fill: colors.scoreHighBg, text: colors.mutedForeground };
    if (v < 10)    return { fill: colors.scoreExcellentBg, text: colors.statusMetText };
    if (v < 15)    return { fill: colors.scoreGoodBg, text: colors.statusMetText };
    if (v < 25)    return { fill: colors.scoreAdequateBg, text: colors.statusBorderlineText };
    return               { fill: colors.scorePoorBg, text: colors.statusNotMetText };
  };

  const leftW = 100;
  const topH  = 26;
  const cellW = 96;
  const cellH = 48;
  const W = leftW + groups.length * cellW;
  const H = topH + oc.length * cellH + 10;

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 h-full flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{CHART_COPY.jurorConsistency.title}</div>
          <div className="text-xs text-muted-foreground">{CHART_COPY.jurorConsistency.note}</div>
        </div>
      </div>

      {/* CV formula with variable legend */}
      <div className="cv-formula-block">
        <span className="cv-formula-pill" aria-label="CV equals sigma divided by x bar times 100">
          <math xmlns="http://www.w3.org/1998/Math/MathML" className="cv-formula-math">
            <mrow>
              <mi>CV</mi>
              <mo>=</mo>
              <mrow>
                <mo>(</mo>
                <mfrac>
                  <mi>σ</mi>
                  <mi>μ</mi>
                </mfrac>
                <mo>)</mo>
              </mrow>
              <mo>×</mo>
              <mn>100</mn>
            </mrow>
          </math>
        </span>
        <span className="cv-formula-legend">
          σ = std. deviation &nbsp;·&nbsp; μ = mean score &nbsp;·&nbsp; CV = juror disagreement %
        </span>
      </div>

      <div className="chart-scroll-wrap">
        <div className="chart-scroll-inner" style={{ minWidth: W }}>
          <div className="chart-svg-fill heatmap-svg-fill">
            <svg className="chart-main-svg" viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: "none", height: "100%", display: "block" }} role="img" aria-label="Juror Consistency Heatmap chart">
          {groups.map((g, i) => (
            <text key={g.id} x={leftW + i * cellW + cellW / 2} y={16}
              textAnchor="middle" fontSize="11" fill={colors.mutedForeground} fontWeight="600"
            >
              {g.name}
            </text>
          ))}
          {oc.map((o, i) => (
            <g key={o.key}>
              <OutcomeLabelSvg
                x={leftW - 10}
                y={topH + i * cellH + cellH / 2 - 4}
                label={o.label}
                code={o.code}
                anchor="end"
                mainSize={11}
                subSize={8.5}
                mainFill={colors.mutedForeground}
                subFill={colors.mutedForeground}
                fontWeight={600}
                lineGap={9}
              />
              {groups.map((g, j) => {
                const cell = cellData[i][j];
                const v    = cell.cv;
                const x    = leftW + j * cellW;
                const y    = topH + i * cellH;
                const band = cvBand(v);
                const tooltipLines = [
                  `${g.name} · ${o.label}`,
                  `CV: ${v === null ? "N/A" : Math.round(v) + "%"}`,
                  cell.m !== null ? `Mean: ${((cell.m / o.max) * 100).toFixed(1)}%` : "",
                  cell.sd !== null ? `SD: ${cell.sd.toFixed(2)}` : "",
                  `N jurors: ${cell.n}`,
                ].filter(Boolean).join("\n");
                return (
                  <g key={`${o.key}-${g.id}`}>
                    <title>{tooltipLines}</title>
                    <rect x={x + 3} y={y + 3} width={cellW - 6} height={cellH - 6} rx="12" fill={band.fill} stroke="rgba(148,163,184,0.25)" />
                    <text x={x + cellW / 2} y={y + cellH / 2 + 6}
                      textAnchor="middle" fontSize="12" fill={band.text} fontWeight="700"
                    >
                      {v === null ? "N/A" : `${Math.round(v)}%`}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
            </svg>
          </div>
        </div>
      </div>

      <ChartDataTable
        caption="Juror Consistency Heatmap (CV %)"
        headers={["Criterion", "Group", "CV (%)", "Mean (%)", "N"]}
        rows={oc.flatMap((o, i) =>
          groups.map((g, j) => {
            const cell = cellData[i][j];
            return [
              o.label,
              g.name,
              cell.cv !== null ? Math.round(cell.cv) + "%" : "N/A",
              cell.m !== null ? ((cell.m / o.max) * 100).toFixed(1) + "%" : "N/A",
              cell.n,
            ];
          })
        )}
      />

      <div className="heatmap-legend">
        <span className="heatmap-legend-item">
          <span className="heatmap-legend-swatch" style={{ background: colors.scoreExcellentBg, borderColor: colors.scoreGoodBg }} />
          &lt;10% CV (excellent)
        </span>
        <span className="heatmap-legend-item">
          <span className="heatmap-legend-swatch" style={{ background: colors.scoreGoodBg, borderColor: colors.scoreHighBg }} />
          10–15% CV
        </span>
        <span className="heatmap-legend-item">
          <span className="heatmap-legend-swatch" style={{ background: colors.scoreAdequateBg, borderColor: colors.scorePartialBg }} />
          15–25% CV
        </span>
        <span className="heatmap-legend-item">
          <span className="heatmap-legend-swatch" style={{ background: colors.scorePoorBg, borderColor: colors.statusNotMetText }} />
          &gt;25% CV (poor)
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CHART 4-PRINT — Juror Consistency Heatmap (CV grid)
// viewBox dynamic × dynamic  (full-width card)
// ════════════════════════════════════════════════════════════
export function JurorConsistencyHeatmapPrint({ stats, data, outcomes: oc = OUTCOMES }) {
  const colors = useChartColors();
  const groups = stats.filter((s) => s.count > 0);
  const rows   = data || [];
  if (!groups.length || !rows.length) return null;

  const rowsByProject = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.projectId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [rows]);

  const cellData = useMemo(() => (
    oc.map((o) =>
      groups.map((g) => {
        const groupRows = rowsByProject.get(g.id) || [];
        const vals = groupRows
          .map((r) => Number(r[o.key]))
          .filter((v) => Number.isFinite(v));
        if (vals.length < 2) return { cv: null, n: vals.length };
        const m = mean(vals);
        if (!m) return { cv: null, n: vals.length };
        return { cv: (stdDev(vals, true) / m) * 100, n: vals.length };
      })
    )
  ), [groups, rowsByProject]);

  const cvBand = (v) => {
    if (v === null) return { fill: colors.scoreHighBg, text: colors.mutedForeground };
    if (v < 10)    return { fill: colors.scoreExcellentBg, text: colors.statusMetText };
    if (v < 15)    return { fill: colors.scoreGoodBg, text: colors.statusMetText };
    if (v < 25)    return { fill: colors.scoreAdequateBg, text: colors.statusBorderlineText };
    return               { fill: colors.scorePoorBg, text: colors.statusNotMetText };
  };

  const leftW = 88;
  const topH  = 26;
  const cellH = 44;
  const maxW  = 700;
  const cellW = Math.min(100, Math.floor((maxW - leftW) / groups.length));
  const W     = leftW + groups.length * cellW;
  const legH  = 26;
  const H     = topH + oc.length * cellH + legH;

  const legendColors = [
    { fill: colors.scoreExcellentBg, label: "<10% CV (excellent)" },
    { fill: colors.scoreGoodBg, label: "10–15% CV" },
    { fill: colors.scoreAdequateBg, label: "15–25% CV" },
    { fill: colors.scorePoorBg, label: ">25% CV (poor)" },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Column headers */}
      {groups.map((g, i) => (
        <text key={g.id}
          x={leftW + i * cellW + cellW / 2} y={17}
          textAnchor="middle" fontSize="10" fill={colors.mutedForeground} fontWeight="600"
        >{g.name}</text>
      ))}

      {/* Rows */}
      {oc.map((o, i) => (
        <g key={o.key}>
          <OutcomeLabelSvg
            x={leftW - 8}
            y={topH + i * cellH + cellH / 2 - 4}
            label={o.label}
            code={o.code}
            anchor="end"
            mainSize={10.5}
            subSize={8}
            mainFill={colors.mutedForeground}
            subFill={colors.mutedForeground}
            fontWeight={600}
            lineGap={8}
          />
          {groups.map((g, j) => {
            const cv   = cellData[i][j].cv;
            const x    = leftW + j * cellW;
            const y    = topH + i * cellH;
            const band = cvBand(cv);
            return (
              <g key={`${o.key}-${g.id}`}>
                <rect x={x + 3} y={y + 3} width={cellW - 6} height={cellH - 6}
                  rx="9" fill={band.fill} stroke="rgba(148,163,184,0.25)" />
                <text x={x + cellW / 2} y={y + cellH / 2 + 5}
                  textAnchor="middle" fontSize="11" fill={band.text} fontWeight="700"
                >{cv === null ? "N/A" : `${Math.round(cv)}%`}</text>
              </g>
            );
          })}
        </g>
      ))}

      {/* Legend */}
      {legendColors.map((lc, i) => {
        const lx = leftW + i * Math.floor((W - leftW) / 4);
        const ly = topH + oc.length * cellH + 6;
        return (
          <g key={lc.label}>
            <rect x={lx} y={ly} width={12} height={12} rx="3" fill={lc.fill}
              stroke="rgba(148,163,184,0.4)" />
            <text x={lx + 15} y={ly + 10} fontSize="8.5" fill="#6b7280">{lc.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
