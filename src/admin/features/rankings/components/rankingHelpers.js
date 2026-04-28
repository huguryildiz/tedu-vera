// Weighted percentage score: sum(score_i) / sum(max_i) * 100.
// Mirrors DB-side aggregation; client-side use is for testing and preview.
export function computeWeightedScore(scores, criteria) {
  if (!criteria || criteria.length === 0) return 0;
  const totalMax = criteria.reduce((s, c) => s + (c.max || 0), 0);
  if (totalMax === 0) return 0;
  const raw = criteria.reduce((s, c) => s + (scores[c.id] ?? 0), 0);
  return (raw / totalMax) * 100;
}

// Tied scores share the same rank; next rank skips (1,1,3,4,…).
export function computeRanks(sortedRows) {
  const map = {};
  let rank = 1;
  for (let i = 0; i < sortedRows.length; i++) {
    if (i > 0 && sortedRows[i].totalAvg < sortedRows[i - 1].totalAvg) {
      rank = i + 1;
    }
    map[sortedRows[i].id] = rank;
  }
  return map;
}

// Per-project juror consensus (σ of per-juror totals).
export function buildConsensusMap(summaryData, rawScores, criteriaConfig) {
  const map = {};
  if (!rawScores || !rawScores.length) return map;

  for (const proj of summaryData) {
    if (proj.totalAvg == null) continue;
    const projScores = rawScores.filter((s) => (s.projectId ?? s.project_id) === proj.id);
    if (!projScores.length) continue;

    const byJuror = {};
    for (const s of projScores) {
      const jid = s.jurorId ?? s.juror_id;
      if (!byJuror[jid]) byJuror[jid] = 0;
      for (const c of criteriaConfig) {
        const v = s[c.id];
        if (typeof v === "number") byJuror[jid] += v;
      }
    }

    const totals = Object.values(byJuror);
    if (totals.length < 2) continue;

    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const variance = totals.reduce((s, v) => s + (v - mean) ** 2, 0) / totals.length;
    const sigma = Math.sqrt(variance);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const level = sigma < 3 ? "high" : sigma <= 5 ? "moderate" : "disputed";

    map[proj.id] = { level, sigma: +sigma.toFixed(2), min: Math.round(min), max: Math.round(max) };
  }

  return map;
}
