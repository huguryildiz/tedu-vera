-- ============================================================
-- 021_list_semesters_with_tenant_fields.sql
-- Adds university and department to rpc_list_semesters so
-- the jury loading hook can display tenant info when resolving
-- a semester by ID (e.g. demo mode entry-token flow).
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_list_semesters();
CREATE OR REPLACE FUNCTION public.rpc_list_semesters()
RETURNS TABLE (
  id                uuid,
  semester_name     text,
  is_current        boolean,
  is_locked         boolean,
  poster_date       date,
  updated_at        timestamptz,
  criteria_template jsonb,
  mudek_template    jsonb,
  university        text,
  department        text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    s.id, s.semester_name, s.is_current, s.is_locked,
    s.poster_date, s.updated_at, s.criteria_template, s.mudek_template,
    t.university, t.department
  FROM semesters s
  LEFT JOIN tenants t ON t.id = s.tenant_id
  ORDER BY s.poster_date DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_semesters() TO anon, authenticated;
