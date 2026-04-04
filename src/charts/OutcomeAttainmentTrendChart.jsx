// src/charts/OutcomeAttainmentTrendChart.jsx
// Dual-line trend chart: attainment rate (solid) + average score (dashed) per outcome.
// One line pair per programme outcome. Click legend to toggle outcomes.

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const THRESHOLD = 70;

function OutcomeTrendTooltip({ active, payload, label, outcomeMeta }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface-overlay)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 11,
      minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{label}</div>
      {outcomeMeta.map((o) => {
        const attVal = payload.find((p) => p.dataKey === o.attKey)?.value;
        const avgVal = payload.find((p) => p.dataKey === o.avgKey)?.value;
        if (attVal == null && avgVal == null) return null;
        return (
          <div key={o.code} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, background: o.color, borderRadius: "50%", flexShrink: 0 }} />
            <span style={{ color: "var(--text-secondary)", minWidth: 28 }}>{o.code}:</span>
            <span style={{ fontWeight: 500 }}>{attVal != null ? `${attVal}% met` : "—"}</span>
            <span style={{ color: "var(--text-muted)" }}>/ avg {avgVal != null ? `${Math.round(avgVal * 10) / 10}%` : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {object} props
 * @param {object[]} props.rows        — from buildOutcomeAttainmentTrendDataset().rows
 * @param {object[]} props.outcomeMeta — from buildOutcomeAttainmentTrendDataset().outcomeMeta
 */
export function OutcomeAttainmentTrendChart({ rows = [], outcomeMeta = [] }) {
  const [hidden, setHidden] = useState(new Set());

  function toggle(code) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (!rows.length || !outcomeMeta.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1, strokeDasharray: "3 2" }}
            content={<OutcomeTrendTooltip outcomeMeta={outcomeMeta.filter((o) => !hidden.has(o.code))} />}
          />
          <ReferenceLine
            y={THRESHOLD}
            stroke="var(--text-tertiary)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
          {outcomeMeta.flatMap((o) => {
            if (hidden.has(o.code)) return [];
            return [
              <Line
                key={`${o.code}_att`}
                type="monotone"
                dataKey={o.attKey}
                stroke={o.color}
                strokeWidth={2}
                dot={{ r: 3, fill: o.color }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />,
              <Line
                key={`${o.code}_avg`}
                type="monotone"
                dataKey={o.avgKey}
                stroke={o.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />,
            ];
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Custom toggle legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
        {outcomeMeta.map((o) => {
          const isHidden = hidden.has(o.code);
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => toggle(o.code)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                cursor: "pointer",
                border: "none",
                background: "none",
                color: isHidden ? "var(--text-muted)" : "var(--text-secondary)",
                opacity: isHidden ? 0.4 : 1,
                padding: "2px 6px",
                borderRadius: 4,
              }}
              title={isHidden ? `Show ${o.code}` : `Hide ${o.code}`}
            >
              <span style={{ width: 14, height: 2, background: o.color, display: "inline-block", flexShrink: 0 }} />
              {o.code}
            </button>
          );
        })}
        <span style={{ fontSize: 10, color: "var(--text-muted)", alignSelf: "center" }}>
          — solid: attainment rate · dashed: avg score
        </span>
      </div>
    </div>
  );
}
