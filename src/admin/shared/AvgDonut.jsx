function bandColor(value, max) {
  if (value == null || max <= 0) return "var(--text-tertiary)";
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const hue = Math.round(pct * 1.2); // 0 → red(0°), 100 → green(120°)
  return `hsl(${hue} 68% 42%)`;
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
