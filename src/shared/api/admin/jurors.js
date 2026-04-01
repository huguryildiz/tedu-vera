// src/shared/api/admin/jurors.js
// ============================================================
// Admin juror management (PostgREST).
// ============================================================

import { supabase } from "../core/client";

export async function createJuror(payload) {
  // Insert juror
  const { data: juror, error: jurorErr } = await supabase
    .from("jurors")
    .insert({
      organization_id: payload.organizationId || payload.organization_id,
      juror_name: payload.juror_name,
      affiliation: payload.affiliation,
      email: payload.email || null,
      notes: payload.notes || null,
    })
    .select()
    .single();
  if (jurorErr) throw jurorErr;

  // If periodId provided, assign juror to period
  if (payload.periodId || payload.period_id) {
    const { error: authErr } = await supabase
      .from("juror_period_auth")
      .insert({
        juror_id: juror.id,
        period_id: payload.periodId || payload.period_id,
      });
    if (authErr) throw authErr;
  }

  return juror;
}

export async function updateJuror(id, payload) {
  const updates = {};
  if (payload.juror_name !== undefined) updates.juror_name = payload.juror_name;
  if (payload.affiliation !== undefined) updates.affiliation = payload.affiliation;
  if (payload.email !== undefined) updates.email = payload.email;
  if (payload.notes !== undefined) updates.notes = payload.notes;

  const { data, error } = await supabase
    .from("jurors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJuror(id) {
  const { error } = await supabase.from("jurors").delete().eq("id", id);
  if (error) throw error;
}

export async function resetJurorPin(jurorId, periodId) {
  // Use the RPC for PIN reset (requires server-side logic)
  const { data, error } = await supabase.rpc("rpc_jury_authenticate", {
    p_period_id: periodId,
    p_juror_name: "", // will be looked up by juror_id internally
    p_affiliation: "",
    p_force_reissue: true,
  });
  if (error) throw error;
  return data;
}

export async function setJurorEditMode(jurorId, periodId, enabled) {
  const { error } = await supabase
    .from("juror_period_auth")
    .update({ edit_enabled: !!enabled })
    .match({ juror_id: jurorId, period_id: periodId });
  if (error) throw error;
}

export async function forceCloseJurorEditMode(jurorId, periodId) {
  const { error } = await supabase
    .from("juror_period_auth")
    .update({ edit_enabled: false, session_token: null })
    .match({ juror_id: jurorId, period_id: periodId });
  if (error) throw error;
}
