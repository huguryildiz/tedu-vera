-- ============================================================
-- 20260326121001_approve_via_auth_admin_api.sql
-- Move admin-application approval away from direct auth schema
-- writes. Auth user creation is handled by an Edge Function via
-- auth.admin.createUser; DB RPC now only finalizes approval.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.id
    INTO v_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  RETURN v_uid;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_admin_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_auth_user_id_by_email(text) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_get_approval_payload(p_application_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  applicant_email text,
  applicant_name text,
  encrypted_password text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_app tenant_admin_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_app FROM tenant_admin_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'application_not_pending'; END IF;

  PERFORM public._assert_tenant_admin(v_app.tenant_id);

  RETURN QUERY
  SELECT
    v_app.tenant_id,
    lower(trim(v_app.applicant_email)),
    v_app.applicant_name,
    v_app.encrypted_password;
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_application_get_approval_payload(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_approve(p_application_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid;
  v_app tenant_admin_applications%ROWTYPE;
  v_new_user_id uuid;
  v_tsl text;
BEGIN
  SELECT * INTO v_app FROM tenant_admin_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  v_uid := public._assert_tenant_admin(v_app.tenant_id);
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'application_not_pending'; END IF;

  SELECT id INTO v_new_user_id FROM auth.users
  WHERE lower(trim(email)) = lower(trim(v_app.applicant_email))
  LIMIT 1;

  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;

  UPDATE tenant_admin_applications SET
    status = 'approved', reviewed_by = v_uid, reviewed_at = now(),
    encrypted_password = NULL, updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO tenant_admin_memberships (tenant_id, user_id, role)
  VALUES (v_app.tenant_id, v_new_user_id, 'tenant_admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO admin_profiles (user_id, display_name)
  VALUES (v_new_user_id, v_app.applicant_name)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT COALESCE(
    NULLIF(
      concat_ws(' · ', NULLIF(trim(university), ''), NULLIF(trim(department), '')),
      ''
    ),
    short_label
  )
  INTO v_tsl
  FROM tenants
  WHERE id = v_app.tenant_id;

  PERFORM public._audit_log('admin', v_uid, 'application_approve', 'tenant_admin_application', p_application_id,
    format('Approved admin application for %s.', v_app.applicant_email), jsonb_build_object('tenant_id', v_app.tenant_id));

  PERFORM public._dispatch_application_notification(
    'application_approved',
    p_application_id,
    v_app.applicant_email,
    v_app.tenant_id,
    v_app.applicant_name,
    v_tsl
  );

  RETURN true;
END; $$;

