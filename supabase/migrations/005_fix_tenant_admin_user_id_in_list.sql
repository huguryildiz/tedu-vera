-- ============================================================
-- 018_fix_tenant_admin_user_id_in_list.sql
-- Ensure rpc_admin_tenant_list returns user_id for tenant_admins,
-- so super-admin edit/delete actions are enabled in frontend.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_tenant_list()
RETURNS TABLE (
  id uuid,
  code text,
  short_label text,
  university text,
  department text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  tenant_admins jsonb,
  pending_applications jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM public._assert_super_admin();
  RETURN QUERY
  SELECT
    t.id,
    t.code,
    t.short_label,
    t.university,
    t.department,
    t.status,
    t.created_at,
    t.updated_at,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', u.id,
          'name', COALESCE(
            NULLIF(trim(ap.display_name), ''),
            NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
            lower(trim(u.email))
          ),
          'email', lower(trim(u.email)),
          'status', 'approved',
          'updated_at', COALESCE(ap.updated_at, u.updated_at, tam.updated_at, t.updated_at)
        )
        ORDER BY COALESCE(NULLIF(trim(ap.display_name), ''), lower(trim(u.email)))
      )
      FROM tenant_admin_memberships tam
      JOIN auth.users u ON u.id = tam.user_id
      LEFT JOIN admin_profiles ap ON ap.user_id = u.id
      WHERE tam.tenant_id = t.id
        AND tam.role = 'tenant_admin'
        AND u.email IS NOT NULL
        AND trim(u.email) <> ''
    ), '[]'::jsonb) AS tenant_admins,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'application_id', a.id,
          'name', a.applicant_name,
          'email', a.applicant_email,
          'status', 'pending',
          'created_at', a.created_at
        )
        ORDER BY a.created_at ASC
      )
      FROM tenant_admin_applications a
      WHERE a.tenant_id = t.id
        AND a.status = 'pending'
    ), '[]'::jsonb) AS pending_applications
  FROM tenants t
  ORDER BY t.code;
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_list() TO authenticated;
