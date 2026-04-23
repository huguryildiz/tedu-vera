export default function LifecycleBar({ draft, published, live, closed }) {
  const total = draft + published + live + closed;
  if (total === 0) return null;
  const pct = (n) => `${(n / total) * 100}%`;

  const parts = [];
  if (draft > 0) parts.push(`${draft} draft`);
  if (published > 0) parts.push(`${published} published`);
  if (live > 0) parts.push(`${live} live`);
  if (closed > 0) parts.push(`${closed} closed`);

  return (
    <div className="periods-lifecycle-bar">
      <div className="periods-lifecycle-top">
        <span className="periods-lifecycle-label">Period Lifecycle</span>
        <span className="periods-lifecycle-summary">{parts.join(" · ")}</span>
      </div>
      <div className="periods-lifecycle-track">
        {draft > 0 && <div className="periods-lifecycle-segment draft" style={{ width: pct(draft) }} />}
        {published > 0 && <div className="periods-lifecycle-segment published" style={{ width: pct(published) }} />}
        {live > 0 && <div className="periods-lifecycle-segment live" style={{ width: pct(live) }} />}
        {closed > 0 && <div className="periods-lifecycle-segment closed" style={{ width: pct(closed) }} />}
      </div>
      <div className="periods-lifecycle-legend">
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot draft" /> Draft ({draft})</span>
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot published" /> Published ({published})</span>
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot live" /> Live ({live})</span>
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot closed" /> Closed ({closed})</span>
      </div>
    </div>
  );
}
