-- ============================================================
-- 015_prevent_duplicate_pending_admin_applications.sql
-- Enforce one pending application per (tenant, applicant email)
-- and return deterministic RPC errors for duplicate submissions.
-- ============================================================

-- Normalize legacy duplicates first: keep newest pending row, cancel older ones.
WITH ranked_pending AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, lower(trim(applicant_email))
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.tenant_admin_applications
  WHERE status = 'pending'
)
UPDATE public.tenant_admin_applications a
SET status = 'cancelled', updated_at = now()
FROM ranked_pending r
WHERE a.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS taa_pending_email_tenant_unique
  ON public.tenant_admin_applications (lower(trim(applicant_email)), tenant_id)
  WHERE status = 'pending';

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
