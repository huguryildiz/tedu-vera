// src/charts/CoverageMatrix.jsx
// HTML table: Outcome × Assessment Tool coverage matrix.
// Shows which programme outcomes are directly assessed by VERA evaluation criteria.

function getCoverageType(outcomeCode, criterion) {
  if (!criterion) return "none";
  const types = criterion.outcomeTypes || {};
  if (outcomeCode in types) return types[outcomeCode] || "direct";
  // Fallback: check legacy outcomes array
  const outcomes = criterion.outcomes || [];
  if (outcomes.includes(outcomeCode)) return "direct";
  return "none";
}

function CoverageChip({ type }) {
  if (type === "direct") return <span className="coverage-chip direct">✓ Direct</span>;
  if (type === "indirect") return <span className="coverage-chip indirect">∼ Indirect</span>;
  return <span className="coverage-chip none">—</span>;
}

export function CoverageMatrix({ criteria = [], outcomes = [] }) {
  const activeCriteria = criteria || [];
  const activeOutcomes = outcomes || [];

  if (!activeOutcomes.length) return (
    <div style={{ padding: "24px 0", color: "var(--text-tertiary)", textAlign: "center", fontSize: 13 }}>
      No outcomes configured for this evaluation period.
    </div>
  );

  let directCount = 0;
  let indirectCount = 0;
  let unmappedCount = 0;

  const rows = activeOutcomes.map((outcome) => {
    const coverages = activeCriteria.map((c) => getCoverageType(outcome.code, c));
    const hasAnyDirect = coverages.includes("direct");
    const hasAnyIndirect = coverages.includes("indirect");
    if (hasAnyDirect) directCount++;
    if (hasAnyIndirect) indirectCount++;
    if (!hasAnyDirect && !hasAnyIndirect) unmappedCount++;
    return { outcome, coverages };
  });

  return (
    <>
      <table className="coverage-matrix table-dense table-pill-balance">
        <thead>
          <tr>
            <th>OUTCOME</th>
            {activeCriteria.map((c) => <th key={c.id}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ outcome, coverages }) => (
            <tr key={outcome.code}>
              <td>
                <div className="cm-cell">
                  <span className="cm-code">{outcome.code}</span>
                  <span className="cm-desc">{outcome.desc_en || outcome.label || ""}</span>
                </div>
              </td>
              {coverages.map((type, i) => (
                <td key={i}><CoverageChip type={type} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="coverage-summary">
        <div className="coverage-summary-stat">
          <span className="stat-num direct">{directCount}</span> Directly assessed
        </div>
        <div className="coverage-summary-stat">
          <span className="stat-num indirect">{indirectCount}</span> Indirectly assessed
        </div>
        <div className="coverage-summary-stat">
          <span className="stat-num unmapped">{unmappedCount}</span> Not mapped — requires other instruments
        </div>
      </div>
    </>
  );
}
