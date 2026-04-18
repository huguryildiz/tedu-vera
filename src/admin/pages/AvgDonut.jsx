function bandColor(value, max) {
  if (value == null || max <= 0) return "var(--text-tertiary)";
  const pct = (value / max) * 100;
  if (pct >= 85) return "var(--success)";
  if (pct >= 70) return "var(--warning)";
  return "var(--danger)";
}

export default function AvgDonut({ value, max = 100 }) {
  const hasValue = value != null && max > 0;
  const pctDeg = hasValue ? Math.min(360, (value / max) * 360) : 0;
  const color = bandColor(value, max);
  const ariaLabel = hasValue
    ? `Average ${value.toFixed(1)} out of ${max}`
    : "Average not available";

  return (
    <div className="avg-donut" role="img" aria-label={ariaLabel}>
      <span
        className="avg-donut-fill"
        style={{ "--pct": `${pctDeg}deg`, "--ring": color }}
      >
        <span className="avg-donut-inner">
          <span className="avg-donut-value">
            {hasValue ? value.toFixed(1) : "\u2014"}
          </span>
          <span className="avg-donut-label">Avg</span>
        </span>
      </span>
    </div>
  );
}
