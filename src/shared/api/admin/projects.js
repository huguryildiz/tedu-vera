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
    .order("project_no", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    group_no: row.project_no ?? null,
    advisor: row.advisor_name ?? null,
  }));
}

// project_no is always DB-assigned via the BEFORE INSERT trigger; callers
// never supply it. On update, omitting project_no from the upsert preserves
// the existing value via Supabase's ON CONFLICT DO UPDATE semantics.
export async function createProject(payload) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      period_id: payload.periodId || payload.period_id,
      title: payload.title,
      members: payload.members ?? [],
      advisor_name: payload.advisor_name ?? payload.advisor ?? null,
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
        members: payload.members ?? [],
        advisor_name: payload.advisor_name ?? payload.advisor ?? null,
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
