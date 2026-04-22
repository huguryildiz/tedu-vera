// src/jury/utils/scoreSnapshot.js
// ============================================================
// Helpers for building a normalized score snapshot (used for
// deduplication via lastWrittenRef) and for classifying
// period-lock errors.
// ============================================================

import { isScoreFilled, normalizeScoreValue } from "./scoreState";

// Internal helper: template rows use `key`; config.js rows use `id`.
const _id = (c) => c.id ?? c.key;

// ── Score snapshot ─────────────────────────────────────────
//
// Returns a normalized representation of the current scores
// and comment for a single project. The `key` field is used
// by lastWrittenRef to detect whether data has changed since
// the last successful write, avoiding redundant RPC calls.
//
// Requires explicit `criteria` (the period's criteria_config array).
// Template objects use `key`; config.js objects use `id`.

export const buildScoreSnapshot = (scores, comment, criteria) => {
  const normalizedScores = {};
  let hasAnyScores = false;
  criteria.forEach((c) => {
    const key = _id(c);
    const v = normalizeScoreValue(scores?.[key], c.max);
    normalizedScores[key] = v;
    if (isScoreFilled(v)) hasAnyScores = true;
  });
  const cleanComment = String(comment ?? "");
  const key =
    `${criteria.map((c) => (normalizedScores[_id(c)] ?? "")).join("|")}::${cleanComment}`;
  return {
    normalizedScores,
    comment: cleanComment,
    key,
    hasAnyScores,
    hasComment: cleanComment.trim() !== "",
  };
};

// ── Error classification ───────────────────────────────────
//
// These helpers classify structured DB errors at the jury write boundary.
// The DB raises exceptions with exact message strings; we match them exactly
// (not with .includes()) to prevent false positives if error text ever
// acquires a prefix/suffix.
//
// SQLSTATE reference (sql/000_bootstrap.sql):
//   period_locked       — P0001 (default) — rpc_upsert_score period lock check
//   juror_session_*       — P0401           — _assert_juror_session
//
// If the DB exception text ever changes, update the constants below.

// rpc_upsert_score: RAISE EXCEPTION 'period_locked' (SQLSTATE P0001)
export const isPeriodLockedError = (err) =>
  String(err?.message || "") === "period_locked";

// rpc_upsert_score: juror already has a final submission and edit is not enabled.
// Scores are already persisted — treat as a skip (no write needed).
export const isFinalSubmittedError = (err) =>
  String(err?.message || "") === "final_submit_required";

// _assert_juror_session: all four cases use SQLSTATE P0401
// juror_session_expired   — session_expires_at <= now()
// juror_session_missing   — empty token string
// juror_session_not_found — no matching row in juror_period_auth
// juror_session_invalid   — null hash, or bcrypt mismatch
const SESSION_EXPIRED_MESSAGES = new Set([
  "juror_session_expired",
  "juror_session_missing",
  "juror_session_not_found",
  "juror_session_invalid",
]);

export const isSessionExpiredError = (err) =>
  err?.code === "P0401" && SESSION_EXPIRED_MESSAGES.has(String(err?.message || ""));
