-- ============================================================
-- 019_notify_applicant_on_approval.sql
-- Ensure approved applications also trigger email notification
-- to the applicant.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_application_approve(p_application_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_app tenant_admin_applications%ROWTYPE; v_new_user_id uuid; v_tsl text;
BEGIN
  SELECT * INTO v_app FROM tenant_admin_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  v_uid := public._assert_tenant_admin(v_app.tenant_id);
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'application_not_pending'; END IF;

  SELECT id INTO v_new_user_id FROM auth.users
  WHERE lower(trim(email)) = lower(trim(v_app.applicant_email)) LIMIT 1;

  IF v_new_user_id IS NULL THEN
    IF v_app.encrypted_password IS NULL THEN
      RAISE EXCEPTION 'no_password_stored';
    END IF;
    v_new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_new_user_id, 'authenticated', 'authenticated',
      lower(trim(v_app.applicant_email)), v_app.encrypted_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_app.applicant_name),
      now(), now(), '', false
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_new_user_id, v_new_user_id, lower(trim(v_app.applicant_email)),
      jsonb_build_object('sub', v_new_user_id::text, 'email', lower(trim(v_app.applicant_email))),
      'email', now(), now(), now()
    );
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
