// src/shared/api/juryApi.js
// Juror-facing API — mix of RPCs (complex auth) and PostgREST (queries).

import { supabase } from "./core/client";
import { withRetry } from "./core/retry";
import { dbScoresToUi, uiScoresToDb } from "./fieldMapping";

// ── Juror auth (RPCs) ────────────────────────────────────────

export async function authenticateJuror(periodId, jurorName, affiliation, forceReissue = false) {
  const { data, error } = await supabase.rpc("rpc_jury_authenticate", {
    p_period_id: periodId,
    p_juror_name: String(jurorName || "").trim(),
    p_affiliation: String(affiliation || "").trim(),
    p_force_reissue: forceReissue,
  });
  if (error) throw error;
  return data;
}

export async function verifyJurorPin(periodId, jurorName, affiliation, pin) {
  const { data, error } = await supabase.rpc("rpc_jury_verify_pin", {
    p_period_id: periodId,
    p_juror_name: String(jurorName || "").trim(),
    p_affiliation: String(affiliation || "").trim(),
    p_pin: String(pin || "").trim(),
  });
  if (error) throw error;
  return data;
}

export async function verifyEntryToken(token) {
  const { data, error } = await supabase.rpc("rpc_jury_validate_entry_token", {
    p_token: String(token || "").trim(),
  });
  if (error) throw error;
  return data;
}

// ── Score upsert (RPC) ──────────────────────────────────────

export async function upsertScore(periodId, projectId, jurorId, sessionToken, scores, comment) {
  return withRetry(async () => {
    const dbScores = uiScoresToDb(scores);
    const { data, error } = await supabase.rpc("rpc_jury_upsert_scores", {
      p_period_id: periodId,
      p_project_id: projectId,
      p_juror_id: jurorId,
      p_session_token: sessionToken,
      p_technical: dbScores.technical,
      p_written: dbScores.written,
      p_oral: dbScores.oral,
      p_teamwork: dbScores.teamwork,
      p_comment: comment || "",
    });
    if (error) throw error;
    return data;
  });
}

// ── PostgREST queries ────────────────────────────────────────

export async function getJurorById(jurorId) {
  const { data, error } = await supabase
    .from("jurors")
    .select("*")
    .eq("id", jurorId)
    .single();
  if (error) throw error;
  return data;
}

export async function listProjects(periodId, jurorId = null, signal) {
  return withRetry(async () => {
    let query = supabase
      .from("projects")
      .select("*")
      .eq("period_id", periodId)
      .order("title");

    if (signal) query = query.abortSignal(signal);
    const { data: projects, error } = await query;
    if (error) throw error;

    // If jurorId provided, fetch their scores for these projects
    if (jurorId) {
      const scoreQuery = supabase
        .from("scores")
        .select("*")
        .eq("period_id", periodId)
        .eq("juror_id", jurorId);
      if (signal) scoreQuery.abortSignal(signal);
      const { data: scores } = await scoreQuery;

      const scoreMap = new Map((scores || []).map((s) => [s.project_id, s]));
      return (projects || []).map((p) => {
        const score = scoreMap.get(p.id);
        return {
          project_id: p.id,
          title: p.title,
          members: p.members || "",
          advisor: p.advisor || "",
          scores: score ? dbScoresToUi(score) : null,
          comment: score?.comments ?? "",
          total: score
            ? (score.technical || 0) + (score.written || 0) + (score.oral || 0) + (score.teamwork || 0)
            : null,
          updated_at: score?.updated_at,
          final_submitted_at: null, // Set from juror_period_auth, not individual scores
        };
      });
    }
    return (projects || []).map((p) => ({
      project_id: p.id,
      title: p.title,
      members: p.members || "",
      advisor: p.advisor || "",
      scores: null,
      comment: "",
      total: null,
    }));
  });
}

export async function getJurorEditState(periodId, jurorId, sessionToken, signal) {
  let query = supabase
    .from("juror_period_auth")
    .select("edit_enabled, is_blocked, last_seen_at, final_submitted_at")
    .match({ juror_id: jurorId, period_id: periodId })
    .single();

  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function finalizeJurorSubmission(periodId, jurorId, sessionToken) {
  const { data, error } = await supabase.rpc("rpc_jury_finalize_submission", {
    p_period_id: periodId,
    p_juror_id: jurorId,
    p_session_token: sessionToken,
  });
  if (error) throw error;
  return data;
}

// ── Period queries (public, for jury flow) ───────────────────

export async function listPeriods(signal) {
  let query = supabase
    .from("periods")
    .select("id, name, is_current, is_locked, organization_id")
    .eq("is_visible", true)
    .order("created_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCurrentPeriod(signal) {
  let query = supabase
    .from("periods")
    .select("*")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ── Semester compatibility functions (legacy RPC-based) ───────
// @deprecated Use listPeriods() instead
export async function listSemesters(signal) {
  return withRetry(async () => {
    const q = supabase.rpc("rpc_list_semesters");
    if (signal) q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw error;
    const { sortPeriodsByStartDateDesc } = await import("../periodSort.js");
    return sortPeriodsByStartDateDesc(data || []);
  });
}

// @deprecated Use getCurrentPeriod() instead
export async function getCurrentSemester(signal, semesterId) {
  const runRpc = async (params) => {
    const q = params
      ? supabase.rpc("rpc_get_current_semester", params)
      : supabase.rpc("rpc_get_current_semester");
    if (signal) q.abortSignal(signal);
    const { data, error } = await q;
    return { data, error };
  };

  // Default first: current production RPC signature is no-arg.
  const primary = await runRpc(null);
  if (!primary.error) return primary.data?.[0] || null;

  // Legacy fallback: some environments may still expose p_semester_id.
  if (semesterId) {
    const fnMissing = /function|does not exist|no function matches/i.test(String(primary.error.message || ""));
    if (!fnMissing) throw primary.error;
    const scoped = await runRpc({ p_semester_id: semesterId });
    if (scoped.error) throw scoped.error;
    return scoped.data?.[0] || null;
  }
  return null;
}

// ── Retry wrappers ───────────────────────────────────────────

export const listProjectsWithRetry = (...args) => listProjects(...args);
export const upsertScoreWithRetry = (...args) => upsertScore(...args);
