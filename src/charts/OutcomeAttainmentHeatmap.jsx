// src/charts/OutcomeAttainmentHeatmap.jsx
// Heatmap: outcomes (rows) × evaluation periods (columns).
// Cell color = attainment rate; secondary label = avg score.
// Colors live in charts.css (.hm-cell--*) so they adapt to light/dark theme.

/** Returns the CSS modifier class for a given attainment rate. */
function attainmentClass(rate) {
  if (rate == null) return "hm-cell--none";
  if (rate >= 90) return "hm-cell--green";
  if (rate >= 80) return "hm-cell--lime";
  if (rate >= 70) return "hm-cell--yellow";
  if (rate >= 50) return "hm-cell--orange";
  return "hm-cell--red";
}

/**
 * @param {object}   props
 * @param {object[]} props.rows        — from buildOutcomeAttainmentTrendDataset().rows
 * @param {object[]} props.outcomeMeta — from buildOutcomeAttainmentTrendDataset().outcomeMeta
 */
export function OutcomeAttainmentHeatmap({ rows = [], outcomeMeta = [] }) {
  if (!rows.length || !outcomeMeta.length) return null;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{
        minWidth: Math.max(400, 220 + rows.length * 100),
        borderCollapse: "separate",
        borderSpacing: "4px 6px",
      }}>
        <colgroup>
          <col style={{ width: 220, minWidth: 220 }} />
          {rows.map((r) => <col key={r.period} style={{ minWidth: 90 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{
              textAlign: "left",
              fontSize: 10,
              color: "var(--text-muted)",
              fontWeight: 500,
              paddingBottom: 6,
            }}>
              Outcome
            </th>
            {rows.map((r) => (
              <th key={r.period} style={{
                textAlign: "center",
                fontSize: 10,
                color: "var(--text-muted)",
                fontWeight: 500,
                paddingBottom: 6,
              }}>
                {r.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {outcomeMeta.map((o) => (
            <tr key={o.code}>
              {/* Outcome label */}
              <td style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                fontWeight: 600,
                paddingRight: 12,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                <span style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: o.color,
                  marginRight: 6,
                  flexShrink: 0,
                }} />
                {o.code}
                {o.label && (
                  <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 5 }}>
                    {o.label.length > 28 ? `${o.label.slice(0, 28)}…` : o.label}
                  </span>
                )}
              </td>
              {rows.map((r) => {
                const att = r[o.attKey];
                const avg = r[o.avgKey];
                return (
                  <td
                    key={r.period}
                    className={`hm-cell ${attainmentClass(att)}`}
                    title={att != null
                      ? `Attainment: ${att}%  |  Avg score: ${avg != null ? avg + "%" : "—"}`
                      : "No data"}
                  >
                    {att != null ? (
                      <>
                        <div className="hm-cell__value">{att}%</div>
                        {avg != null && (
                          <div className="hm-cell__avg">avg {avg}%</div>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Color scale legend */}
      <div style={{
        display: "flex",
        gap: 12,
        justifyContent: "center",
        marginTop: 14,
        flexWrap: "wrap",
      }}>
        {[
          { label: "≥ 90%", cls: "hm-cell--green" },
          { label: "80–90%", cls: "hm-cell--lime" },
          { label: "70–80%", cls: "hm-cell--yellow" },
          { label: "50–70%", cls: "hm-cell--orange" },
          { label: "< 50%", cls: "hm-cell--red" },
          { label: "No data", cls: "hm-cell--none" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className={`hm-cell ${s.cls}`} style={{
              display: "inline-block",
              width: 16,
              height: 12,
              borderRadius: 3,
              padding: 0,
            }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
