export function formatRelative(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  if (diff < 31_536_000_000) return `${Math.floor(diff / 2_592_000_000)}mo ago`;
  const yrs = Math.round(diff / 31_536_000_000 * 10) / 10;
  return `${yrs % 1 === 0 ? yrs : yrs.toFixed(1)}yr ago`;
}

// Five-state lifecycle derivation. Draft splits into "incomplete" / "ready" as
// a UI nuance — the readiness check flips this flag automatically whenever
// criteria or projects change. State transitions (Draft→Published→Live→Closed)
// require deliberate admin actions; readiness does not.
export function getPeriodState(period, hasScores, readiness) {
  if (period.closed_at) return "closed";
  if (period.is_locked && hasScores) return "live";
  if (period.is_locked) return "published";
  return readiness?.ok ? "draft_ready" : "draft_incomplete";
}

// Fixed denominator for setup % — matches the required-severity check count
// emitted by rpc_admin_check_period_readiness (criteria, weights, rubric
// bands, projects, jurors, framework). Keep in sync with that RPC if checks
// are added or removed.
export const SETUP_REQUIRED_TOTAL = 6;

// Pure: derives setup completion % for a draft period from the readiness
// payload. `readiness` may be undefined while the row's readiness check is
// still in flight.
export function computeSetupPercent(readiness) {
  if (!readiness) return null;
  if (readiness.ok) return 100;
  const required = (readiness.issues || []).filter((i) => i.severity === "required");
  const satisfied = Math.max(0, SETUP_REQUIRED_TOTAL - required.length);
  return Math.round((satisfied / SETUP_REQUIRED_TOTAL) * 100);
}

// Pure: derives the mobile ring model { percent, label, stateClass } for a
// given period + lifecycle state + stats/readiness snapshots. Returns null
// percent when data is not yet loaded so the UI can render a skeleton ring.
export function computeRingModel({ state, readiness, stats }) {
  if (state === "closed") {
    return { percent: 100, label: "DONE", stateClass: "ring-closed" };
  }
  if (state === "live") {
    const pct = typeof stats?.progress === "number" ? stats.progress : null;
    return { percent: pct, label: "EVAL", stateClass: "ring-live" };
  }
  if (state === "published") {
    // Locked but no scores yet — treat like live at 0.
    return { percent: 0, label: "EVAL", stateClass: "ring-live" };
  }
  // draft_ready | draft_incomplete
  return {
    percent: computeSetupPercent(readiness),
    label: "SETUP",
    stateClass: "ring-draft",
  };
}
