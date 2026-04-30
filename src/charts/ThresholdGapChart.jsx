// src/charts/ThresholdGapChart.jsx
// CSS diverging lollipop chart: gap between criterion attainment rate and 70% threshold.
// Pure HTML/CSS — no canvas library.
// CSS classes match vera.css: .lollipop-stem.positive/.negative, .lollipop-dot.positive/.negative,
// .lollipop-val.positive/.negative (positioned inside .lollipop-track)

import { outcomeValues } from "../shared/stats";
import { Gauge } from "lucide-react";

// Max absolute gap displayed (bars beyond this are clamped)
const MAX_ABS_GAP = 30;

function fmt1(v) {
  return Math.round(v * 10) / 10;
}

// Normalize gap to 0–100 bar position (center = 50% = threshold)
function normalize(gap) {
  const clamped = Math.max(-MAX_ABS_GAP, Math.min(MAX_ABS_GAP, gap));
  return 50 + (clamped / MAX_ABS_GAP) * 50;
}

/**
 * @param {object} props
 * @param {object[]} props.submittedData — score rows
 */
export function ThresholdGapChart({ submittedData = [], criteria = [], threshold = 70 }) {
  const rows = submittedData || [];

  // One row per unique outcome code (same approach as attainment cards)
  const outcomeMap = new Map(); // code → { criterionKey, max, color, label }
  for (const c of criteria || []) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) {
        outcomeMap.set(code, { criterionKey: c.id, max: c.max, color: c.color, label: c.label });
      }
    }
  }

  const items = [...outcomeMap.entries()].map(([code, { criterionKey, max, label }]) => {
    const vals = outcomeValues(rows, criterionKey);
    if (!vals.length) return { code, label, gap: null };
    const aboveThreshold = vals.filter((v) => (v / max) * 100 >= threshold).length;
    const attRate = fmt1((aboveThreshold / vals.length) * 100);
    const gap = fmt1(attRate - threshold);
    return { code, label, gap };
  });

  // Sort: positive gaps first (descending), then negative (descending)
  items.sort((a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity));

  if (!items.length) return (
    <div className="vera-es-no-data">
      <div className="vera-es-ghost-rows" aria-hidden="true">
        <div className="vera-es-ghost-row">
          <div className="vera-es-ghost-num" /><div className="vera-es-ghost-bar" style={{ width: "22%" }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "18%" }} /><div className="vera-es-ghost-bar" style={{ width: "18%" }} />
        </div>
        <div className="vera-es-ghost-row">
          <div className="vera-es-ghost-num" /><div className="vera-es-ghost-bar" style={{ width: "16%" }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "22%" }} /><div className="vera-es-ghost-bar" style={{ width: "14%" }} />
        </div>
      </div>
      <div className="vera-es-icon"><Gauge size={22} strokeWidth={1.8} /></div>
      <p className="vera-es-no-data-title">No Gap Data</p>
      <p className="vera-es-no-data-desc">Map outcomes to criteria to see how far each deviates from the threshold.</p>
    </div>
  );

  return (
    <div className="lollipop-chart">
      {items.map(({ code, label, gap }) => {
        const modifier = gap == null ? "" : gap >= 0 ? "positive" : "negative";
        const stemLeft = gap != null ? (gap >= 0 ? "50%" : `${normalize(gap)}%`) : "50%";
        const stemWidth = gap != null ? `${Math.abs(normalize(gap) - 50)}%` : "0%";
        const dotPos = gap != null ? normalize(gap) : 50;
        const dotLeft = `${dotPos}%`;
        // Positive: right of dot; negative: left of dot.
        // Flip when the dot is too close to the track edge.
        const valStyle = gap == null
          ? { left: "50%", color: "var(--text-tertiary)" }
          : gap >= 0
            ? (dotPos > 88
                ? { left: `calc(${dotPos}% - 10px)`, transform: "translateX(-100%)" }
                : { left: `calc(${dotPos}% + 10px)` })
            : (dotPos < 12
                ? { left: `calc(${dotPos}% + 10px)` }
                : { left: `calc(${dotPos}% - 10px)`, transform: "translateX(-100%)" });

        return (
          <div key={code} className="lollipop-row">
            <div className="lollipop-label">
              <span className="code">{code}</span>
              <span className="name">{label}</span>
            </div>
            <div className="lollipop-track">
              {/* Center threshold line */}
              <div className="lollipop-center" />
              {/* Stem */}
              {gap != null && (
                <div
                  className={`lollipop-stem${modifier ? ` ${modifier}` : ""}`}
                  style={{ left: stemLeft, width: stemWidth }}
                />
              )}
              {/* Dot */}
              {gap != null && (
                <div
                  className={`lollipop-dot${modifier ? ` ${modifier}` : ""}`}
                  style={{ left: dotLeft }}
                />
              )}
              {/* Value label */}
              <div
                className={`lollipop-val${modifier ? ` ${modifier}` : ""}`}
                style={valStyle}
              >
                {gap != null ? `${gap >= 0 ? "+" : ""}${gap}%` : "—"}
              </div>
            </div>
          </div>
        );
      })}
      <div className="lollipop-axis-labels">
        <span>−{MAX_ABS_GAP}</span>
        <span>−{MAX_ABS_GAP / 2}</span>
        <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>70% threshold</span>
        <span>+{MAX_ABS_GAP / 2}</span>
        <span>+{MAX_ABS_GAP}</span>
      </div>
    </div>
  );
}
