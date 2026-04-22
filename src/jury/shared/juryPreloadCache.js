// src/jury/juryPreloadCache.js
// In-memory, short-TTL prefetch cache populated by JuryGatePage during the
// verification screen's 3.5s window. Consumed once by useJuryLoading on mount
// to skip the duplicate listPeriods/listProjects fetch. Not a cross-session
// cache — entries auto-expire and are cleared after the first read.

const TTL_MS = 20_000; // 20 seconds — covers verification + navigation

let entry = null; // { periodId, periods, periodInfo, projectCount, ts }

export function setJuryPreload({ periodId, periods, periodInfo, projectCount }) {
  entry = {
    periodId: periodId || null,
    periods: Array.isArray(periods) ? periods : null,
    periodInfo: periodInfo || null,
    projectCount: Number.isFinite(projectCount) ? projectCount : null,
    ts: Date.now(),
  };
}

/** Read and clear the preload. Returns null if absent, stale, or wrong period. */
export function consumeJuryPreload(expectedPeriodId) {
  if (!entry) return null;
  const fresh = Date.now() - entry.ts < TTL_MS;
  const matches = !expectedPeriodId || entry.periodId === expectedPeriodId;
  const out = fresh && matches ? entry : null;
  entry = null;
  return out;
}

export function clearJuryPreload() {
  entry = null;
}
