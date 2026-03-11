// src/shared/stats.js
// Shared statistical helpers — used by AnalyticsTab and Charts.

export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// sample=true  → N-1 (Bessel's correction, better for small juror counts)
// sample=false → N   (population, kept for legacy chart visual parity)
export function stdDev(arr, sample = false) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const divisor = sample ? arr.length - 1 : arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / divisor);
}

export function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

export function outcomeValues(rows, key) {
  return (rows || [])
    .map((r) => Number(r[key]))
    .filter((v) => Number.isFinite(v));
}

export function fmt1(v) {
  return Number.isFinite(v) ? Number(v.toFixed(1)) : null;
}

export function fmt2(v) {
  return Number.isFinite(v) ? Number(v.toFixed(2)) : null;
}

// IQR boxplot stats for a pre-sorted, pre-filtered numeric array.
// Returns null when array is empty.
export function buildBoxplotStats(sorted) {
  if (!sorted.length) return null;
  const q1 = quantile(sorted, 0.25);
  const med = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const whiskerMin = sorted.find((v) => v >= low) ?? sorted[0];
  const whiskerMax = [...sorted].reverse().find((v) => v <= high) ?? sorted[sorted.length - 1];
  const outliers = sorted.filter((v) => v < low || v > high);
  return { q1, med, q3, iqr, whiskerMin, whiskerMax, outliers };
}
