-- VERA — Rename organizations.subtitle → institution
-- =============================================================================
-- "subtitle" was a display-oriented alias for the parent institution name
-- (previously institution_name). Renamed to "institution" for clarity.
-- UI: Column 1 = "Organization" (institution), Column 2 = "Program" (name).
-- =============================================================================

-- 1. Rename the column
ALTER TABLE organizations RENAME COLUMN subtitle TO institution;

-- 2. Update rpc_admin_list_organizations — return 'institution' key
CREATE OR REPLACE FUNCTION public.rpc_admin_list_organizations()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(
    json_agg(
      jsonb_build_object(
        'id',                 o.id,
        'code',               o.code,
        'name',               o.name,
        'institution',        o.institution,
        'contact_email',      o.contact_email,
        'status',             o.status,
        'settings',           o.settings,
        'created_at',         o.created_at,
        'updated_at',         o.updated_at,
        'active_period_name', p_curr.name,
        'juror_count',        j_cnt.juror_count,
        'project_count',      pr_cnt.project_count,
        'memberships',        m_agg.data,
        'org_applications',   a_agg.data
      ) ORDER BY o.name
    ),
    '[]'::json
  )
  INTO v_result
  FROM organizations o
  LEFT JOIN LATERAL (
    SELECT name
    FROM periods
    WHERE organization_id = o.id AND is_current = true
    LIMIT 1
  ) p_curr ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS juror_count
    FROM jurors j
    WHERE j.organization_id = o.id
  ) j_cnt ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS project_count
    FROM periods cp
    JOIN projects pr ON pr.period_id = cp.id
    WHERE cp.organization_id = o.id AND cp.is_current = true
  ) pr_cnt ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        jsonb_build_object(
          'id',              m.id,
          'user_id',         m.user_id,
          'organization_id', m.organization_id,
          'role',            m.role,
          'created_at',      m.created_at,
          'profiles', jsonb_build_object(
            'id',           p.id,
            'display_name', p.display_name,
            'email',        u.email
          )
        )
      ),
      '[]'::json
    ) AS data
    FROM memberships m
    LEFT JOIN profiles p ON p.id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = o.id
  ) m_agg ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        jsonb_build_object(
          'id',              a.id,
          'organization_id', a.organization_id,
          'applicant_name',  a.applicant_name,
          'contact_email',   a.contact_email,
          'status',          a.status,
          'created_at',      a.created_at
        )
      ),
      '[]'::json
    ) AS data
    FROM org_applications a
    WHERE a.organization_id = o.id
  ) a_agg ON true;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_list_organizations() TO authenticated;

-- 3. Update rpc_landing_stats — column is now institution
CREATE OR REPLACE FUNCTION public.rpc_landing_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'organizations', (SELECT count(*) FROM organizations),
    'evaluations',   (SELECT count(*) FROM scores_compat),
    'jurors',        (SELECT count(DISTINCT juror_id) FROM scores_compat),
    'projects',      (SELECT count(DISTINCT project_id) FROM scores_compat),
    'institutions',  (SELECT json_agg(DISTINCT institution ORDER BY institution)
                       FROM organizations
                       WHERE status = 'active')
  );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_landing_stats() TO anon, authenticated;
