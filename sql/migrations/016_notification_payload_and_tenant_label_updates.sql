-- ============================================================
-- 016_notification_payload_and_tenant_label_updates.sql
-- Fix notification payload applicant email and use full
-- university+department label in submit notification flow.
-- ============================================================

CREATE OR REPLACE FUNCTION public._dispatch_application_notification(
  p_type text, p_application_id uuid, p_recipient_email text, p_tenant_id uuid,
  p_applicant_name text DEFAULT NULL, p_tenant_short_label text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_url text;
  v_auth text;
  v_host text;
  v_applicant_email text;
BEGIN
  SELECT lower(trim(a.applicant_email))
    INTO v_applicant_email
  FROM tenant_admin_applications a
  WHERE a.id = p_application_id
  LIMIT 1;

  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    IF v_url IS NULL OR trim(v_url) = '' THEN
      BEGIN
        SELECT decrypted_secret
          INTO v_url
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_url'
        ORDER BY created_at DESC
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        v_url := NULL;
      END;
    END IF;

    IF v_url IS NULL OR trim(v_url) = '' THEN
      BEGIN
        v_host := (current_setting('request.headers', true)::jsonb ->> 'host');
        IF v_host IS NOT NULL AND trim(v_host) <> '' THEN
          IF left(trim(v_host), 9) = 'localhost'
             OR left(trim(v_host), 9) = '127.0.0.1' THEN
            v_url := 'http://' || trim(v_host);
          ELSE
            v_url := 'https://' || trim(v_host);
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_url := NULL;
      END;
    END IF;

    BEGIN
      v_auth := current_setting('app.settings.supabase_service_role_key', true);
      IF v_auth IS NULL OR trim(v_auth) = '' THEN
        SELECT decrypted_secret
          INTO v_auth
        FROM vault.decrypted_secrets
        WHERE name IN ('supabase_service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_auth := NULL;
    END;

    IF v_url IS NOT NULL AND v_url <> '' THEN
      PERFORM net.http_post(url := v_url || '/functions/v1/notify-application',
        body := jsonb_build_object('type', p_type, 'application_id', p_application_id,
          'recipient_email', p_recipient_email, 'tenant_id', p_tenant_id,
          'applicant_name', p_applicant_name, 'applicant_email', v_applicant_email, 'tenant_name', p_tenant_short_label),
        headers := CASE
          WHEN v_auth IS NOT NULL AND trim(v_auth) <> '' THEN
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || trim(v_auth))
          ELSE
            jsonb_build_object('Content-Type', 'application/json')
        END);
    ELSE
      PERFORM public._audit_log('system', NULL, 'notification_failed', 'tenant_admin_application', p_application_id,
        'Notification skipped: supabase URL not resolved.',
        jsonb_build_object('type', p_type, 'tenant_id', p_tenant_id, 'recipient_email', p_recipient_email));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._audit_log('system', NULL, 'notification_failed', 'tenant_admin_application', p_application_id,
      'Notification dispatch failed.',
      jsonb_build_object('type', p_type, 'tenant_id', p_tenant_id, 'recipient_email', p_recipient_email, 'error', SQLERRM));
  END;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_submit(
  p_tenant_id uuid, p_email text, p_password text,
  p_name text, p_university text DEFAULT '', p_department text DEFAULT ''
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id uuid; v_tsl text; v_hash text; v_notify_email text; v_email text;
BEGIN
  v_email := lower(trim(COALESCE(p_email, '')));
  IF v_email = '' THEN RAISE EXCEPTION 'email_required'; END IF;
  IF trim(COALESCE(p_name,'')) = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF length(COALESCE(p_password,'')) < 10 THEN RAISE EXCEPTION 'password_too_short'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(trim(email)) = v_email) THEN
    RAISE EXCEPTION 'email_already_registered';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM tenant_admin_applications a
    WHERE a.tenant_id = p_tenant_id
      AND a.status = 'pending'
      AND lower(trim(a.applicant_email)) = v_email
  ) THEN
    RAISE EXCEPTION 'application_already_pending';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));
  INSERT INTO tenant_admin_applications (tenant_id, applicant_email, applicant_name, university, department, encrypted_password)
  VALUES (p_tenant_id, v_email, trim(p_name), COALESCE(trim(p_university),''), COALESCE(trim(p_department),''), v_hash)
  RETURNING id INTO v_id;

  SELECT COALESCE(
    NULLIF(
      concat_ws(' · ', NULLIF(trim(university), ''), NULLIF(trim(department), '')),
      ''
    ),
    short_label
  )
  INTO v_tsl
  FROM tenants
  WHERE id = p_tenant_id;
  PERFORM public._audit_log('system', NULL, 'application_submit', 'tenant_admin_application', v_id,
    format('Application submitted by %s for tenant %s.', v_email, COALESCE(v_tsl, p_tenant_id::text)),
    jsonb_build_object('tenant_id', p_tenant_id));

  FOR v_notify_email IN
    SELECT lower(trim(u.email))
    FROM tenant_admin_memberships tam
    JOIN auth.users u ON u.id = tam.user_id
    WHERE tam.role = 'super_admin'
      AND tam.tenant_id IS NULL
      AND u.email IS NOT NULL
      AND trim(u.email) <> ''
    ORDER BY tam.created_at ASC
  LOOP
    PERFORM public._dispatch_application_notification(
      'application_submitted',
      v_id,
      v_notify_email,
      p_tenant_id,
      trim(p_name),
      v_tsl
    );
  END LOOP;

  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_submit(
  p_tenant_id uuid, p_name text, p_university text DEFAULT '', p_department text DEFAULT ''
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_email text; v_id uuid; v_tsl text; v_notify_email text;
BEGIN
  v_uid := public._get_auth_user_id();
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  v_email := lower(trim(COALESCE(v_email, '')));
  IF v_email = '' THEN RAISE EXCEPTION 'email_required'; END IF;
  IF trim(COALESCE(p_name,'')) = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM tenant_admin_applications a
    WHERE a.tenant_id = p_tenant_id
      AND a.status = 'pending'
      AND lower(trim(a.applicant_email)) = v_email
  ) THEN
    RAISE EXCEPTION 'application_already_pending';
  END IF;

  INSERT INTO tenant_admin_applications (tenant_id, applicant_email, applicant_name, university, department)
  VALUES (p_tenant_id, v_email, trim(p_name), COALESCE(trim(p_university),''), COALESCE(trim(p_department),''))
  RETURNING id INTO v_id;

  SELECT COALESCE(
    NULLIF(
      concat_ws(' · ', NULLIF(trim(university), ''), NULLIF(trim(department), '')),
      ''
    ),
    short_label
  )
  INTO v_tsl
  FROM tenants
  WHERE id = p_tenant_id;
  PERFORM public._audit_log('admin', v_uid, 'application_submit', 'tenant_admin_application', v_id,
    format('Application submitted by %s for tenant %s.', v_email, COALESCE(v_tsl, p_tenant_id::text)),
    jsonb_build_object('tenant_id', p_tenant_id));

  FOR v_notify_email IN
    SELECT lower(trim(u.email))
    FROM tenant_admin_memberships tam
    JOIN auth.users u ON u.id = tam.user_id
    WHERE tam.role = 'super_admin'
      AND tam.tenant_id IS NULL
      AND u.email IS NOT NULL
      AND trim(u.email) <> ''
    ORDER BY tam.created_at ASC
  LOOP
    PERFORM public._dispatch_application_notification(
      'application_submitted',
      v_id,
      v_notify_email,
      p_tenant_id,
      trim(p_name),
      v_tsl
    );
  END LOOP;

  RETURN v_id;
END; $$;
