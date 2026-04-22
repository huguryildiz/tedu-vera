// src/jury/utils/periodSelection.js
// ============================================================
// Shared period selection helpers used by jury loading/session
// flows and admin dashboards to avoid duplicated and drifting
// period-picking logic.
// ============================================================

export function buildTokenPeriod(tokenResult) {
  if (!tokenResult?.period_id) return null;
  return {
    id: tokenResult.period_id,
    name: tokenResult.period_name || "",
    is_locked: tokenResult.is_locked ?? false,
    closed_at: tokenResult.closed_at ?? null,
  };
}

// A period is evaluable when it is Published or Live:
// structural content is locked AND it hasn't been closed yet.
export function isEvaluablePeriod(period) {
  return !!period?.is_locked && !period?.closed_at;
}

export function listEvaluablePeriods(periods = []) {
  return (periods || []).filter(isEvaluablePeriod);
}

export function pickDemoPeriod(periods = [], tokenPeriod = null) {
  const all = periods || [];
  if (tokenPeriod?.id) {
    const fromList = all.find((p) => p.id === tokenPeriod.id);
    return fromList ? { ...tokenPeriod, ...fromList } : tokenPeriod;
  }
  return listEvaluablePeriods(all)[0] || all[0] || null;
}

// Pick a reasonable default period for admin dashboard scope.
// Preference order:
//   1. Most recent Published/Live (is_locked AND NOT closed)
//   2. Most recent Closed
//   3. First Draft
//   4. First in list
// Tiebreaker within a bucket: activated_at DESC, then created_at DESC.
export function pickDefaultPeriod(periods = []) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const byRecency = (arr) =>
    [...arr].sort((a, b) => {
      const aActivated = Date.parse(a?.activated_at || 0) || 0;
      const bActivated = Date.parse(b?.activated_at || 0) || 0;
      if (aActivated !== bActivated) return bActivated - aActivated;
      const aCreated = Date.parse(a?.created_at || 0) || 0;
      const bCreated = Date.parse(b?.created_at || 0) || 0;
      return bCreated - aCreated;
    });
  const active = byRecency(periods.filter((p) => p?.is_locked && !p?.closed_at));
  const closed = byRecency(periods.filter((p) => !!p?.closed_at));
  const draft  = periods.filter((p) => !p?.is_locked && !p?.closed_at);
  return active[0] || closed[0] || draft[0] || periods[0] || null;
}
