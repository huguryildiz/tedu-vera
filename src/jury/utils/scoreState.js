// src/jury/utils/scoreState.js
// ============================================================
// Pure helpers for score values, completeness checks, and
// empty-state factories. No React dependencies.
//
// All exported functions accept an optional `criteria` param
// (defaults to CRITERIA from config.js) so they work with both
// the static config and period-specific dynamic templates.
// Template objects use `key`; config.js objects use `id`.
// The helper `_id(c)` normalises both shapes.
// ============================================================

import { CRITERIA } from "../../config";

// ── Internal helper ───────────────────────────────────────
// Template rows use `key`; config.js rows use `id`. Accept both.
const _id = (c) => c.id ?? c.key;

// ── Value helpers ─────────────────────────────────────────

export const isScoreFilled = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return Number.isFinite(v);
  const trimmed = String(v).trim();
  if (trimmed === "") return false;
  return Number.isFinite(Number(trimmed));
};

export const normalizeScoreValue = (val, max) => {
  if (val === "" || val === null || val === undefined) return null;
  const n = parseInt(String(val), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), max);
};

// ── Completeness helpers ───────────────────────────────────

export const isAllFilled = (scores, pid, criteria = CRITERIA) =>
  criteria.every((c) => isScoreFilled(scores[pid]?.[_id(c)]));

export const isAllComplete = (scores, projects, criteria = CRITERIA) =>
  projects.every((p) => isAllFilled(scores, p.project_id, criteria));

export const countFilled = (scores, projects, criteria = CRITERIA) =>
  (projects || []).reduce(
    (t, p) =>
      t +
      criteria.reduce(
        (n, c) => n + (isScoreFilled(scores[p.project_id]?.[_id(c)]) ? 1 : 0),
        0
      ),
    0
  );

// ── Empty-state factories (project UUID keyed) ────────────

export const makeEmptyScores = (projects, criteria = CRITERIA) =>
  Object.fromEntries(
    projects.map((p) => [
      p.project_id,
      Object.fromEntries(criteria.map((c) => [_id(c), null])),
    ])
  );

export const makeEmptyComments = (projects) =>
  Object.fromEntries(projects.map((p) => [p.project_id, ""]));

export const makeEmptyTouched = (projects, criteria = CRITERIA) =>
  Object.fromEntries(
    projects.map((p) => [
      p.project_id,
      Object.fromEntries(criteria.map((c) => [_id(c), false])),
    ])
  );

export const makeAllTouched = (projects, criteria = CRITERIA) =>
  Object.fromEntries(
    projects.map((p) => [
      p.project_id,
      Object.fromEntries(criteria.map((c) => [_id(c), true])),
    ])
  );
