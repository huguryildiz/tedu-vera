export default function ProgressCell({ period, stats }) {
  const pstats = stats?.[period.id] || {};
  const progress = pstats.progress;
  const isDraft = !period.is_locked;
  const isClosed = !!period.closed_at;

  if (isDraft) {
    return (
      <div className="periods-progress-cell">
        <span className="periods-progress-val muted">—</span>
        <div className="periods-progress-bar"><div className="periods-progress-fill" style={{ width: "0%" }} /></div>
      </div>
    );
  }

  const pct = progress ?? (isClosed ? 100 : null);
  if (pct === null) {
    return (
      <div className="periods-progress-cell">
        <span className="periods-progress-val muted">—</span>
        <div className="periods-progress-bar"><div className="periods-progress-fill" style={{ width: "0%" }} /></div>
      </div>
    );
  }

  return (
    <div className="periods-progress-cell">
      <span className={`periods-progress-val${pct >= 100 ? " done" : ""}`}>{pct}%</span>
      <div className="periods-progress-bar"><div className="periods-progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
