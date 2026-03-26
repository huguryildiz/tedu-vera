-- ============================================================
-- 006_admin_tenant_rpcs.sql
-- v2 JWT-based tenant management, session, onboarding, and
-- admin profile RPCs.  Canonical column names:
--   tenants.short_label (was name), semesters.semester_name,
--   semesters.is_current (was is_active).
-- ============================================================

-- Auth helpers (_get_auth_user_id, _assert_super_admin, _assert_tenant_admin,
-- _assert_semester_access) are defined in 003_auth_helpers.sql.

-- ── From-scratch cleanup ─────────────────────────────────────
-- Make this migration re-runnable as if applying from a clean state.
DROP FUNCTION IF EXISTS public.rpc_admin_auth_get_session();
DROP FUNCTION IF EXISTS public.rpc_admin_tenant_list();
DROP FUNCTION IF EXISTS public.rpc_admin_tenant_create(text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_admin_tenant_update(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_admin_tenant_list_public();
DROP FUNCTION IF EXISTS public._dispatch_application_notification(text, uuid, text, uuid, text, text);
DROP FUNCTION IF EXISTS public._dispatch_application_notification(text, uuid, text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_admin_application_submit(uuid, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_admin_application_submit(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_admin_application_submit(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_admin_application_cancel(uuid);
DROP FUNCTION IF EXISTS public.rpc_admin_application_get_mine();
DROP FUNCTION IF EXISTS public.rpc_admin_application_approve(uuid);
DROP FUNCTION IF EXISTS public.rpc_admin_application_reject(uuid);
DROP FUNCTION IF EXISTS public.rpc_admin_application_list_pending(uuid);
DROP FUNCTION IF EXISTS public.rpc_admin_profile_upsert(text);
DROP FUNCTION IF EXISTS public.rpc_admin_profile_get();

-- ── Session ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_admin_auth_get_session()
RETURNS TABLE (user_id uuid, user_email text, tenant_id uuid, tenant_code text, tenant_short_label text, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_is_super boolean; v_email text;
BEGIN
  v_uid := public._get_auth_user_id();
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM tenant_admin_memberships tam
    WHERE tam.user_id = v_uid AND tam.role = 'super_admin' AND tam.tenant_id IS NULL
  ) INTO v_is_super;

  IF v_is_super THEN
    RETURN QUERY SELECT v_uid, v_email::text, NULL::uuid, NULL::text, NULL::text, 'super_admin'::text;
    RETURN QUERY SELECT v_uid, v_email::text, t.id, t.code, t.short_label, 'super_admin'::text
      FROM tenants t WHERE t.status = 'active' ORDER BY t.code;
  ELSE
    RETURN QUERY SELECT tam.user_id, v_email::text, tam.tenant_id, t.code, t.short_label, tam.role
      FROM tenant_admin_memberships tam
      LEFT JOIN tenants t ON t.id = tam.tenant_id
      WHERE tam.user_id = v_uid;
  END IF;
END; $$;

-- ── Tenant CRUD (super-admin) ───────────────────────────────
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

CREATE OR REPLACE FUNCTION public.rpc_admin_tenant_create(p_code text, p_short_label text, p_university text DEFAULT '', p_department text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_id uuid;
BEGIN
  v_uid := public._assert_super_admin();
  INSERT INTO tenants (code, short_label, university, department)
  VALUES (trim(p_code), trim(p_short_label), COALESCE(trim(p_university),''), COALESCE(trim(p_department),''))
  RETURNING id INTO v_id;
  PERFORM public._audit_log('admin', v_uid, 'tenant_create', 'tenant', v_id,
    format('Created tenant %s (%s).', trim(p_short_label), trim(p_code)), jsonb_build_object('code', trim(p_code)));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_tenant_update(p_tenant_id uuid, p_short_label text DEFAULT NULL, p_university text DEFAULT NULL, p_department text DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid := public._assert_super_admin();
  UPDATE tenants SET short_label = COALESCE(NULLIF(trim(p_short_label),''), short_label),
    university = COALESCE(p_university, university), department = COALESCE(p_department, department),
    status = COALESCE(NULLIF(trim(p_status),''), status) WHERE id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;
  PERFORM public._audit_log('admin', v_uid, 'tenant_update', 'tenant', p_tenant_id, format('Updated tenant %s.', p_tenant_id), NULL);
  RETURN true;
END; $$;

-- ── Public tenant list ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_admin_tenant_list_public()
RETURNS TABLE (id uuid, code text, short_label text, university text, department text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  -- No auth check: this RPC is intentionally public so the registration
  -- form can display available departments before the user signs up.
  RETURN QUERY SELECT t.id, t.code, t.short_label, t.university, t.department FROM tenants t WHERE t.status = 'active' ORDER BY t.code;
END; $$;

-- ── Notification dispatch (internal) ────────────────────────
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
    -- Preferred sources: DB setting, then Vault secret.
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

    -- Last resort: infer host from request headers when called via PostgREST RPC.
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

    -- Optional auth for function calls (works when verify_jwt is enabled).
    -- Support both legacy/lowercase and uppercase secret naming conventions.
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

-- ── Application workflow ────────────────────────────────────
-- Enforce one pending application per (tenant, applicant email).
-- If legacy duplicate pending rows exist, keep the newest pending row
-- and cancel older ones before (re)creating the unique partial index.
WITH ranked_pending AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, lower(trim(applicant_email))
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM tenant_admin_applications
  WHERE status = 'pending'
)
UPDATE tenant_admin_applications a
SET status = 'cancelled', updated_at = now()
FROM ranked_pending r
WHERE a.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS taa_pending_email_tenant_unique
  ON public.tenant_admin_applications (lower(trim(applicant_email)), tenant_id)
  WHERE status = 'pending';

-- Submit is intentionally anon-accessible: the applicant has no
-- auth.users row yet. Password is bcrypt-hashed and stored in
-- the application row until approval.
CREATE OR REPLACE FUNCTION public.rpc_admin_application_submit(
  p_tenant_id uuid, p_email text, p_password text,
  p_name text, p_university text DEFAULT '', p_department text DEFAULT ''
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id uuid; v_tsl text; v_hash text; v_notify_email text; v_email text;
BEGIN
  v_email := lower(trim(COALESCE(p_email, '')));
  -- Validate
  IF v_email = '' THEN RAISE EXCEPTION 'email_required'; END IF;
  IF trim(COALESCE(p_name,'')) = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF length(COALESCE(p_password,'')) < 10 THEN RAISE EXCEPTION 'password_too_short'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;
  -- Check for existing auth user with same email
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(trim(email)) = v_email) THEN
    RAISE EXCEPTION 'email_already_registered';
  END IF;
  -- Prevent duplicate pending applications for same tenant+email.
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

  -- Notification targets: all global super admin emails.
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

-- Backward-compatible overload for already authenticated users.
-- Keeps notification routing consistent with the 6-arg submit RPC.
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
  -- Prevent duplicate pending applications for same tenant+email.
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

  -- Notification targets: all global super admin emails.
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

CREATE OR REPLACE FUNCTION public.rpc_admin_application_cancel(p_application_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_email text; v_app_email text;
BEGIN
  v_uid := public._get_auth_user_id();
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT applicant_email INTO v_app_email FROM tenant_admin_applications WHERE id = p_application_id;
  IF v_app_email IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF lower(trim(v_email)) <> lower(trim(v_app_email)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0403'; END IF;
  UPDATE tenant_admin_applications SET status = 'cancelled', updated_at = now() WHERE id = p_application_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_pending'; END IF;
  PERFORM public._audit_log('admin', v_uid, 'application_cancel', 'tenant_admin_application', p_application_id, 'Application cancelled by applicant.', NULL);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_get_mine()
RETURNS TABLE (id uuid, tenant_id uuid, applicant_email text, applicant_name text, status text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_email text;
BEGIN
  v_uid := public._get_auth_user_id();
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  RETURN QUERY SELECT a.id, a.tenant_id, a.applicant_email, a.applicant_name, a.status, a.created_at, a.updated_at
    FROM tenant_admin_applications a WHERE lower(trim(a.applicant_email)) = lower(trim(v_email)) ORDER BY a.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_approve(p_application_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_app tenant_admin_applications%ROWTYPE; v_new_user_id uuid; v_tsl text;
BEGIN
  SELECT * INTO v_app FROM tenant_admin_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  v_uid := public._assert_tenant_admin(v_app.tenant_id);
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'application_not_pending'; END IF;

  -- Check if user already exists (e.g. re-approval or manual creation)
  SELECT id INTO v_new_user_id FROM auth.users
  WHERE lower(trim(email)) = lower(trim(v_app.applicant_email)) LIMIT 1;

  -- Create auth.users entry if not exists
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
    -- Create identity row (required by Supabase Auth)
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_new_user_id, v_new_user_id, lower(trim(v_app.applicant_email)),
      jsonb_build_object('sub', v_new_user_id::text, 'email', lower(trim(v_app.applicant_email))),
      'email', now(), now(), now()
    );
  END IF;

  -- Update application + create membership
  UPDATE tenant_admin_applications SET
    status = 'approved', reviewed_by = v_uid, reviewed_at = now(),
    encrypted_password = NULL, updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO tenant_admin_memberships (tenant_id, user_id, role)
  VALUES (v_app.tenant_id, v_new_user_id, 'tenant_admin')
  ON CONFLICT DO NOTHING;

  -- Admin profile
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

CREATE OR REPLACE FUNCTION public.rpc_admin_application_reject(p_application_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_app tenant_admin_applications%ROWTYPE; v_tsl text;
BEGIN
  SELECT * INTO v_app FROM tenant_admin_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  v_uid := public._assert_tenant_admin(v_app.tenant_id);
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'application_not_pending'; END IF;
  UPDATE tenant_admin_applications SET status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), updated_at = now() WHERE id = p_application_id;
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
  PERFORM public._audit_log('admin', v_uid, 'application_reject', 'tenant_admin_application', p_application_id,
    format('Rejected admin application for %s.', v_app.applicant_email), jsonb_build_object('tenant_id', v_app.tenant_id));
  PERFORM public._dispatch_application_notification('application_rejected', p_application_id, v_app.applicant_email, v_app.tenant_id, v_app.applicant_name, v_tsl);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_application_list_pending(p_tenant_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, applicant_email text, applicant_name text, university text, department text, status text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM public._assert_tenant_admin(p_tenant_id);
  RETURN QUERY SELECT a.id, a.tenant_id, a.applicant_email, a.applicant_name, a.university, a.department, a.status, a.created_at
    FROM tenant_admin_applications a WHERE a.tenant_id = p_tenant_id AND a.status = 'pending' ORDER BY a.created_at ASC;
END; $$;

-- ── Admin profiles ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_admin_profile_upsert(p_display_name text DEFAULT NULL)
RETURNS TABLE (out_user_id uuid, out_display_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid := public._get_auth_user_id();
  INSERT INTO admin_profiles (user_id, display_name) VALUES (v_uid, NULLIF(trim(p_display_name),''))
  ON CONFLICT (user_id) DO UPDATE SET display_name = COALESCE(NULLIF(trim(EXCLUDED.display_name),''), admin_profiles.display_name), updated_at = now();
  RETURN QUERY SELECT ap.user_id, ap.display_name FROM admin_profiles ap WHERE ap.user_id = v_uid;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_profile_get()
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid := public._get_auth_user_id();
  RETURN QUERY SELECT ap.user_id, ap.display_name FROM admin_profiles ap WHERE ap.user_id = v_uid;
END; $$;

-- ── Grants ──────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public._get_auth_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public._assert_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public._assert_tenant_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._assert_semester_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_auth_get_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_create(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_update(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_tenant_list_public() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_submit(uuid, text, text, text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_submit(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_get_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_approve(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_reject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_application_list_pending(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_profile_upsert(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_profile_get() TO authenticated;
