// src/charts/AttainmentRateChart.jsx
// CSS horizontal bar chart: attainment rate per criterion.
// Pure HTML/CSS — no canvas library.
// CSS classes match vera.css: .att-bar-fill.met/.borderline/.not-met, .att-bar-val, .att-bar-target

import { mean, outcomeValues } from "../shared/stats";
import { Target } from "lucide-react";

function fmt1(v) {
  return Math.round(v * 10) / 10;
}

/**
 * @param {object} props
 * @param {object[]} props.submittedData — score rows
 */
export function AttainmentRateChart({ submittedData = [], criteria = [], threshold = 70 }) {
  const rows = submittedData || [];

  // One row per unique outcome code (matches prototype layout)
  const outcomeMap = new Map(); // code → { criterionKey, max, label }
  for (const c of criteria || []) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) {
        outcomeMap.set(code, { criterionKey: c.id, max: c.max, label: c.label });
      }
    }
  }

  const items = [...outcomeMap.entries()].map(([code, { criterionKey, max, label }]) => {
    const vals = outcomeValues(rows, criterionKey);
    if (!vals.length) return { code, label, pct: null };
    const aboveThreshold = vals.filter((v) => (v / max) * 100 >= threshold).length;
    const pct = fmt1((aboveThreshold / vals.length) * 100);
    return { code, label, pct };
  });

  // Sort: highest attainment first
  items.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  if (!items.length) return (
    <div className="vera-es-no-data">
      <div className="vera-es-ghost-rows" aria-hidden="true">
        <div className="vera-es-ghost-row">
          <div className="vera-es-ghost-num" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "30%" }} />
        </div>
        <div className="vera-es-ghost-row">
          <div className="vera-es-ghost-num" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "22%" }} />
        </div>
      </div>
      <div className="vera-es-icon"><Target size={22} strokeWidth={1.8} /></div>
      <p className="vera-es-no-data-title">No Attainment Data</p>
      <p className="vera-es-no-data-desc">Map outcomes to criteria to see attainment rates per outcome.</p>
    </div>
  );

  return (
    <div className="att-bar-chart">
      {items.map(({ code, label, pct }, idx) => {
        const isMet = pct != null && pct >= threshold;
        const isBorderline = pct != null && pct >= 60 && pct < threshold;
        const modifier = pct == null ? "" : isMet ? "met" : isBorderline ? "borderline" : "not-met";
        return (
          <div key={code} className="att-bar-row">
            <div className="att-bar-label">
              <span className="code">{code}</span>
              <span className="name">{label}</span>
            </div>
            <div className="att-bar-track">
              <div
                className={`att-bar-fill${modifier ? ` ${modifier}` : ""}`}
                style={{ width: pct != null ? `${pct}%` : "0%" }}
              />
              {pct != null && (
                <span
                  className={`att-bar-val${modifier ? ` ${modifier}` : ""}${pct >= 15 ? " inside" : " outside"}`}
                  style={pct >= 15 ? { right: `${100 - pct}%` } : { left: `${pct}%` }}
                >
                  {pct}%
                </span>
              )}
              <div
                className={`att-bar-target${idx === 0 ? " first" : ""}`}
                style={{ left: `${threshold}%` }}
                title="Target: 70%"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
