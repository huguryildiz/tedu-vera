// src/shared/api/admin/profiles.js
// Admin profile functions (PostgREST).

import { supabase } from "../core/client";

export async function upsertProfile(displayName) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, display_name: displayName })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
