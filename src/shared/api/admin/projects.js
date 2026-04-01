// src/shared/api/admin/projects.js
// ============================================================
// Admin project management (PostgREST).
// ============================================================

import { supabase } from "../core/client";

export async function listProjects(periodId) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("period_id", periodId)
    .order("title");
  if (error) throw error;
  return data || [];
}

export async function createProject(payload) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      period_id: payload.periodId || payload.period_id,
      title: payload.title,
      members: payload.members || null,
      advisor: payload.advisor || null,
      description: payload.description || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertProject(payload) {
  const { data, error } = await supabase
    .from("projects")
    .upsert(
      {
        id: payload.id || undefined,
        period_id: payload.periodId || payload.period_id,
        title: payload.title,
        members: payload.members || null,
        advisor: payload.advisor || null,
        description: payload.description || null,
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
