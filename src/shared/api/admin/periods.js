// src/shared/api/admin/periods.js
// ============================================================
// Admin evaluation period management (PostgREST).
// ============================================================

import { supabase } from "../core/client";

export async function listPeriods(organizationId) {
  const { data, error } = await supabase
    .from("periods")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setCurrentPeriod(periodId, organizationId) {
  // Unset all current flags for this org
  const { error: clearErr } = await supabase
    .from("periods")
    .update({ is_current: false })
    .eq("organization_id", organizationId)
    .eq("is_current", true);
  if (clearErr) throw clearErr;

  // Set target as current
  const { data, error } = await supabase
    .from("periods")
    .update({ is_current: true })
    .eq("id", periodId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPeriod(payload) {
  const { data, error } = await supabase
    .from("periods")
    .insert({
      organization_id: payload.organizationId,
      name: payload.name,
      season: payload.season || null,
      description: payload.description || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      framework_id: payload.framework_id || null,
      criteria_config: payload.criteria_config || null,
      outcome_config: payload.outcome_config || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePeriod(id, payload) {
  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.season !== undefined) updates.season = payload.season;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.start_date !== undefined) updates.start_date = payload.start_date;
  if (payload.end_date !== undefined) updates.end_date = payload.end_date;
  if (payload.framework_id !== undefined) updates.framework_id = payload.framework_id;
  if (payload.criteria_config !== undefined) updates.criteria_config = payload.criteria_config;
  if (payload.outcome_config !== undefined) updates.outcome_config = payload.outcome_config;

  const { data, error } = await supabase
    .from("periods")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePeriod(id) {
  const { error } = await supabase.from("periods").delete().eq("id", id);
  if (error) throw error;
}

export async function setEvalLock(periodId, enabled) {
  const { error } = await supabase
    .from("periods")
    .update({ is_locked: !!enabled })
    .eq("id", periodId);
  if (error) throw error;
}

export async function updatePeriodCriteriaConfig(id, config) {
  const { error } = await supabase
    .from("periods")
    .update({ criteria_config: config })
    .eq("id", id);
  if (error) throw error;
}

export async function updatePeriodOutcomeConfig(id, config) {
  const { error } = await supabase
    .from("periods")
    .update({ outcome_config: config })
    .eq("id", id);
  if (error) throw error;
}
