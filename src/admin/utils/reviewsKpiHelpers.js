// src/admin/utils/reviewsKpiHelpers.js

/**
 * Projects where inter-juror σ exceeds `threshold` (default 10).
 * Returns count of such projects.
 */
export function computeHighDisagreement(kpiBase, threshold = 10) {
  const byProject = new Map();
  kpiBase.forEach((r) => {
    if (
      r.jurorStatus !== "completed" ||
      r.total == null ||
      !Number.isFinite(Number(r.total))
    )
      return;
    const key = r.projectId || r.title;
    if (!key) return;
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push(Number(r.total));
  });

  let count = 0;
  byProject.forEach((scores) => {
    if (scores.length < 2) return;
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const sigma = Math.sqrt(
      scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length
    );
    if (sigma > threshold) count++;
  });
  return count;
}

/**
 * Individual completed reviews where score deviates from project mean by > `threshold` (default 15).
 * Returns count of outlier reviews.
 */
export function computeOutlierReviews(kpiBase, threshold = 15) {
  const projectMeans = new Map();
  const completed = kpiBase.filter(
    (r) =>
      r.jurorStatus === "completed" &&
      r.total != null &&
      Number.isFinite(Number(r.total))
  );

  completed.forEach((r) => {
    const key = r.projectId || r.title;
    if (!key) return;
    if (!projectMeans.has(key)) projectMeans.set(key, []);
    projectMeans.get(key).push(Number(r.total));
  });

  const means = new Map();
  projectMeans.forEach((scores, key) => {
    means.set(key, scores.reduce((s, v) => s + v, 0) / scores.length);
  });

  return completed.filter((r) => {
    const key = r.projectId || r.title;
    const mean = means.get(key);
    return mean != null && Math.abs(Number(r.total) - mean) > threshold;
  }).length;
}

/**
 * Completed jurors / total assigned jurors.
 * Returns { display, completed, total } for color logic.
 */
export function computeCoverage(kpiBase, assignedJurors) {
  const total = Array.isArray(assignedJurors) ? assignedJurors.length : 0;
  if (total === 0) return { display: "—", completed: 0, total: 0 };
  const completed = new Set(
    kpiBase
      .filter((r) => r.jurorStatus === "completed")
      .map((r) => r.jurorId || r.juryName)
  ).size;
  return { display: `${completed} / ${total}`, completed, total };
}

/**
 * Count of unique jurors in ready_to_submit state.
 */
export function computePending(kpiBase) {
  return new Set(
    kpiBase
      .filter((r) => r.jurorStatus === "ready_to_submit")
      .map((r) => r.jurorId || r.juryName)
  ).size;
}

/**
 * Average inter-juror population σ across projects (completed jurors only).
 * Each project with ≥ 2 completed jurors contributes one σ value.
 * Returns "—" when no project qualifies.
 */
export function computeSpread(kpiBase) {
  const byProject = new Map();
  kpiBase.forEach((r) => {
    if (
      r.jurorStatus !== "completed" ||
      r.total == null ||
      !Number.isFinite(Number(r.total))
    )
      return;
    const key = r.projectId || r.title;
    if (!key) return;
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push(Number(r.total));
  });

  const sigmas = [];
  byProject.forEach((scores) => {
    if (scores.length < 2) return;
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance =
      scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    sigmas.push(Math.sqrt(variance));
  });

  if (sigmas.length === 0) return "—";
  return (sigmas.reduce((s, v) => s + v, 0) / sigmas.length).toFixed(1);
}
