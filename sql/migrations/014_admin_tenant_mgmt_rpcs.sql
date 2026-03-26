-- ============================================================
-- 014_admin_tenant_admin_manage.sql
-- Super-admin management for approved organization admins:
-- - enrich rpc_admin_tenant_list tenant_admins payload
-- - update admin name/email
-- - hard-delete admin user (auth + profile + memberships)
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

DROP FUNCTION IF EXISTS public.rpc_admin_tenant_admin_update(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.rpc_admin_tenant_admin_update(
  p_tenant_id uuid,
  p_user_id uuid,
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid;
  v_new_name text;
  v_new_email text;
BEGIN
  v_uid := public._assert_super_admin();

  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id_required'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'cannot_edit_self'; END IF;

  IF EXISTS (
    SELECT 1
    FROM tenant_admin_memberships tam
    WHERE tam.user_id = p_user_id
      AND tam.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'cannot_modify_super_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tenant_admin_memberships tam
    WHERE tam.user_id = p_user_id
      AND tam.tenant_id = p_tenant_id
      AND tam.role = 'tenant_admin'
  ) THEN
    RAISE EXCEPTION 'tenant_admin_not_found';
  END IF;

  v_new_name := NULLIF(trim(COALESCE(p_name, '')), '');
  v_new_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');

  IF v_new_name IS NULL AND v_new_email IS NULL THEN
    RAISE EXCEPTION 'nothing_to_update';
  END IF;

  IF v_new_email IS NOT NULL THEN
    IF position('@' in v_new_email) < 2 THEN
      RAISE EXCEPTION 'invalid_email';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE lower(trim(u.email)) = v_new_email
        AND u.id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'email_already_in_use';
    END IF;

    UPDATE auth.users
    SET email = v_new_email, updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'user_not_found';
    END IF;

    UPDATE auth.identities
    SET
      provider_id = v_new_email,
      identity_data = jsonb_set(
        COALESCE(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(v_new_email),
        true
      ),
      updated_at = now()
    WHERE user_id = p_user_id
      AND provider = 'email';
  END IF;

  IF v_new_name IS NOT NULL THEN
    INSERT INTO admin_profiles (user_id, display_name)
    VALUES (p_user_id, v_new_name)
    ON CONFLICT (user_id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          updated_at = now();
  END IF;

  PERFORM public._audit_log(
    'admin',
    v_uid,
    'tenant_admin_update',
    'tenant',
    p_tenant_id,
    format('Updated tenant admin %s.', p_user_id),
    jsonb_build_object('target_user_id', p_user_id)
  );

  RETURN true;
END; $$;

DROP FUNCTION IF EXISTS public.rpc_admin_tenant_admin_delete_hard(uuid, uuid);
CREATE OR REPLACE FUNCTION public.rpc_admin_tenant_admin_delete_hard(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid;
  v_target_email text;
BEGIN
  v_uid := public._assert_super_admin();

  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id_required'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'cannot_delete_self'; END IF;

  IF EXISTS (
    SELECT 1
    FROM tenant_admin_memberships tam
    WHERE tam.user_id = p_user_id
      AND tam.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'cannot_delete_super_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tenant_admin_memberships tam
    WHERE tam.user_id = p_user_id
      AND tam.tenant_id = p_tenant_id
      AND tam.role = 'tenant_admin'
  ) THEN
    RAISE EXCEPTION 'tenant_admin_not_found';
  END IF;

  SELECT lower(trim(u.email))
  INTO v_target_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  DELETE FROM tenant_admin_memberships WHERE user_id = p_user_id;
  DELETE FROM admin_profiles WHERE user_id = p_user_id;

  PERFORM public._audit_log(
    'admin',
    v_uid,
    'tenant_admin_delete_hard',
    'tenant',
    p_tenant_id,
    format('Hard-deleted tenant admin %s.', COALESCE(v_target_email, p_user_id::text)),
    jsonb_build_object('target_user_id', p_user_id)
  );

  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_admin_update(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_admin_delete_hard(uuid, uuid) TO authenticated;
