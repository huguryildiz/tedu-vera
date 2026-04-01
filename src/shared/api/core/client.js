// src/shared/api/core/client.js
// Supabase client configuration.

export { supabase } from "../../../lib/supabaseClient";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
