// src/shared/api/admin/export.js
// Admin data export (PostgREST).

import { supabase } from "../core/client";

export async function fullExport(organizationId) {
  const [periodsRes, jurorsRes, auditRes] = await Promise.all([
    supabase.from("periods").select("*").eq("organization_id", organizationId),
    supabase.from("jurors").select("*").eq("organization_id", organizationId),
    supabase.from("audit_logs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(500),
  ]);

  if (periodsRes.error) throw periodsRes.error;
  if (jurorsRes.error) throw jurorsRes.error;

  const periodIds = (periodsRes.data || []).map((p) => p.id);

  let projects = [];
  let scores = [];
  if (periodIds.length > 0) {
    const [projRes, scoreRes] = await Promise.all([
      supabase.from("projects").select("*").in("period_id", periodIds),
      supabase.from("scores").select("*").in("period_id", periodIds),
    ]);
    if (projRes.error) throw projRes.error;
    if (scoreRes.error) throw scoreRes.error;
    projects = projRes.data || [];
    scores = scoreRes.data || [];
  }

  return {
    periods: periodsRes.data || [],
    projects,
    jurors: jurorsRes.data || [],
    scores,
    audit_logs: auditRes.data || [],
  };
}
