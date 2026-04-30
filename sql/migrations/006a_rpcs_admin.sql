-- VERA v1 — Admin RPCs (Part A): Jury Management + Org & Token + Public Stats
-- Covers sections D (jury mgmt), D2 (org admin helpers), E (org & token), F (public stats).
-- Companion file: 006b_rpcs_admin.sql (G period, H config, H2 audit helpers, I auth, J join flow).
-- Depends on: 002 (tables), 003 (helpers), 004 (RLS), 005_rpcs_jury
--
-- All crypto functions use SET search_path = public, extensions
-- where pgcrypto (crypt, gen_salt, digest, gen_random_bytes) is needed.

-- ═══════════════════════════════════════════════════════════════════════════════
-- D) ADMIN JURY MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- rpc_juror_reset_pin (FINAL: 032 body + 033 search_path)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_juror_reset_pin(
  p_period_id UUID,
  p_juror_id  UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_org_id     UUID;
  v_is_admin   BOOLEAN;
  v_pin        TEXT;
  v_pin_hash   TEXT;
  v_juror_name TEXT;
BEGIN
  SELECT organization_id, juror_name INTO v_org_id, v_juror_name
  FROM jurors
  WHERE id = p_juror_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_not_found')::JSON;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = v_org_id OR organization_id IS NULL)
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  v_pin      := lpad(floor(random() * 10000)::TEXT, 4, '0');
  v_pin_hash := crypt(v_pin, gen_salt('bf'));

  UPDATE juror_period_auth
  SET pin_hash           = v_pin_hash,
      pin_pending_reveal = v_pin,
      failed_attempts    = 0,
      locked_until       = NULL,
      locked_at          = NULL
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'auth_row_not_found')::JSON;
  END IF;

  -- Semantic audit: admin reset a juror's PIN. Mirrors rpc_juror_unlock_pin's
  -- pattern (action+resource_type+details). Pin value is NOT included in
  -- details — we only log that a reset occurred, not what the new PIN is.
  INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id, details
  ) VALUES (
    v_org_id, auth.uid(), 'pin.reset', 'juror_period_auth', p_juror_id,
    jsonb_build_object(
      'period_id',  p_period_id,
      'juror_id',   p_juror_id,
      'juror_name', v_juror_name,
      'reset_by',   auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'pin_plain_once', v_pin
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_juror_reset_pin(UUID, UUID) TO authenticated;

-- =============================================================================
-- rpc_juror_toggle_edit_mode
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_juror_toggle_edit_mode(
  p_period_id         UUID,
  p_juror_id          UUID,
  p_enabled           BOOLEAN,
  p_reason            TEXT DEFAULT NULL,
  p_duration_minutes  INT  DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id        UUID;
  v_is_admin      BOOLEAN;
  v_auth_row      juror_period_auth%ROWTYPE;
  v_reason        TEXT;
  v_minutes       INT;
  v_expires_at    TIMESTAMPTZ;
  v_juror_name    TEXT;
BEGIN
  SELECT organization_id, juror_name INTO v_org_id, v_juror_name
  FROM jurors WHERE id = p_juror_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_not_found')::JSON;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = v_org_id OR organization_id IS NULL)
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  SELECT * INTO v_auth_row
  FROM juror_period_auth
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'auth_row_not_found')::JSON;
  END IF;

  IF p_enabled THEN
    v_reason := btrim(COALESCE(p_reason, ''));
    IF char_length(v_reason) < 5 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'reason_too_short')::JSON;
    END IF;

    v_minutes := COALESCE(p_duration_minutes, 30);
    IF v_minutes < 1 OR v_minutes > 2880 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_duration')::JSON;
    END IF;

    IF v_auth_row.final_submitted_at IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'final_submission_required')::JSON;
    END IF;

    v_expires_at := now() + make_interval(mins => v_minutes);

    UPDATE juror_period_auth
    SET edit_enabled    = true,
        edit_reason     = v_reason,
        edit_expires_at = v_expires_at
    WHERE juror_id = p_juror_id AND period_id = p_period_id;

    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
    VALUES (
      v_org_id, auth.uid(), 'juror.edit_mode_enabled', 'juror_period_auth', p_juror_id,
      jsonb_build_object(
        'period_id', p_period_id, 'juror_id', p_juror_id, 'juror_name', v_juror_name,
        'reason', v_reason, 'duration_minutes', v_minutes, 'expires_at', v_expires_at
      )
    );

    RETURN jsonb_build_object('ok', true, 'edit_expires_at', v_expires_at)::JSON;
  END IF;

  UPDATE juror_period_auth
  SET edit_enabled = false, edit_reason = NULL, edit_expires_at = NULL
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_org_id, auth.uid(), 'juror.edit_mode_disabled', 'juror_period_auth', p_juror_id,
    jsonb_build_object(
      'period_id',           p_period_id,
      'juror_id',            p_juror_id,
      'juror_name',          v_juror_name,
      'previous_reason',     v_auth_row.edit_reason,
      'previous_expires_at', v_auth_row.edit_expires_at,
      'close_source',        'admin_manual'
    )
  );

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_juror_toggle_edit_mode(UUID, UUID, BOOLEAN, TEXT, INT) TO authenticated;

-- =============================================================================
-- rpc_juror_unlock_pin
-- =============================================================================
-- Extends unlock so that clearing a lockout simultaneously generates a fresh
-- 4-digit PIN, writes pin_hash + pin_pending_reveal, and returns pin_plain_once
-- so the admin modal can show it once.

CREATE OR REPLACE FUNCTION public.rpc_juror_unlock_pin(
  p_period_id UUID,
  p_juror_id  UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_org_id     UUID;
  v_is_admin   BOOLEAN;
  v_juror_name TEXT;
  v_pin        TEXT;
  v_pin_hash   TEXT;
BEGIN
  -- Fetch juror org + name
  SELECT organization_id, juror_name
  INTO v_org_id, v_juror_name
  FROM jurors
  WHERE id = p_juror_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_not_found')::JSON;
  END IF;

  -- Verify caller is admin for this org (or super-admin)
  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = v_org_id OR organization_id IS NULL)
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  -- Generate a new 4-digit PIN
  v_pin      := lpad(floor(random() * 10000)::TEXT, 4, '0');
  v_pin_hash := crypt(v_pin, gen_salt('bf'));

  -- Clear lockout + write new PIN atomically
  UPDATE juror_period_auth
  SET failed_attempts    = 0,
      is_blocked         = false,
      locked_until       = NULL,
      locked_at          = NULL,
      pin_hash           = v_pin_hash,
      pin_pending_reveal = v_pin
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'auth_row_not_found')::JSON;
  END IF;

  -- Single combined audit event
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_org_id,
    auth.uid(),
    'juror.pin_unlocked_and_reset',
    'juror_period_auth',
    p_juror_id,
    jsonb_build_object(
      'period_id',  p_period_id,
      'juror_id',   p_juror_id,
      'juror_name', v_juror_name
    )
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'pin_plain_once', v_pin
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_juror_unlock_pin(UUID, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- D2) ORG ADMIN HELPERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- _assert_org_admin
-- =============================================================================
-- Raises 'unauthorized' if caller is not an org admin for p_org_id (or super-admin).

CREATE OR REPLACE FUNCTION _assert_org_admin(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = p_org_id OR role = 'super_admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION _assert_org_admin(UUID) TO authenticated;

-- =============================================================================
-- _assert_tenant_owner
-- =============================================================================
-- Raises 'unauthorized' if caller is not the owner of p_org_id.
-- Super-admins bypass.

CREATE OR REPLACE FUNCTION public._assert_tenant_owner(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
      AND is_owner = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_tenant_owner(UUID) TO authenticated;

-- =============================================================================
-- _assert_can_invite
-- =============================================================================
-- Raises 'unauthorized' unless caller is:
--   • the owner of p_org_id, OR
--   • an active org_admin of p_org_id AND organizations.settings.admins_can_invite = true, OR
--   • a super_admin.

CREATE OR REPLACE FUNCTION public._assert_can_invite(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner      boolean;
  v_is_admin      boolean;
  v_is_super      boolean;
  v_delegated     boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND role = 'super_admin'),
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND status = 'active' AND is_owner = true),
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND status = 'active' AND role = 'org_admin')
  INTO v_is_super, v_is_owner, v_is_admin;

  IF v_is_super OR v_is_owner THEN
    RETURN;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE((settings->>'admins_can_invite')::boolean, false)
  INTO v_delegated
  FROM organizations
  WHERE id = p_org_id;

  IF NOT COALESCE(v_delegated, false) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_can_invite(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_find_user_by_email
-- =============================================================================
-- Used by the invite-org-admin Edge Function to check if a Supabase Auth user
-- already exists for the given email address.

CREATE OR REPLACE FUNCTION rpc_admin_find_user_by_email(p_email TEXT)
RETURNS TABLE (id UUID, email_confirmed_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public AS $$
  SELECT u.id, u.email_confirmed_at
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;

-- Restrict to service_role only — anon/authenticated must not call this
REVOKE EXECUTE ON FUNCTION rpc_admin_find_user_by_email(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION rpc_admin_find_user_by_email(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION rpc_admin_find_user_by_email(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION rpc_admin_find_user_by_email(TEXT) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- E) ADMIN ORG & TOKEN
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- rpc_admin_approve_application
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_approve_application(
  p_application_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_app_row  org_applications%ROWTYPE;
  v_user_id  UUID;
BEGIN
  IF NOT current_user_is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  SELECT * INTO v_app_row FROM org_applications WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'application_not_found')::JSON;
  END IF;

  IF v_app_row.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_status')::JSON;
  END IF;

  UPDATE org_applications
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_application_id;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(v_app_row.contact_email))
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO profiles (id)
    VALUES (v_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO memberships (user_id, organization_id, role, status)
    VALUES (v_user_id, v_app_row.organization_id, 'org_admin', 'active')
    ON CONFLICT (user_id, organization_id) DO UPDATE SET status = 'active';
  END IF;

  PERFORM public._audit_write(
    v_app_row.organization_id,
    'application.approved',
    'org_applications',
    p_application_id,
    'config'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object(
      'applicant_email', v_app_row.contact_email,
      'applicant_name', v_app_row.applicant_name,
      'membership_created', v_user_id IS NOT NULL
    ),
    jsonb_build_object(
      'before', jsonb_build_object('status', 'pending'),
      'after',  jsonb_build_object('status', 'approved')
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'membership_created', v_user_id IS NOT NULL
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_approve_application(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_reject_application
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_reject_application(
  p_application_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_app_row org_applications%ROWTYPE;
BEGIN
  IF NOT current_user_is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  SELECT * INTO v_app_row FROM org_applications WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'application_not_found')::JSON;
  END IF;

  IF v_app_row.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_status')::JSON;
  END IF;

  UPDATE org_applications
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_application_id;

  PERFORM public._audit_write(
    v_app_row.organization_id,
    'application.rejected',
    'org_applications',
    p_application_id,
    'config'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object(
      'applicant_email', v_app_row.contact_email,
      'applicant_name', v_app_row.applicant_name
    ),
    jsonb_build_object(
      'before', jsonb_build_object('status', 'pending'),
      'after',  jsonb_build_object('status', 'rejected')
    )
  );

  RETURN jsonb_build_object('ok', true, 'application_id', p_application_id)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_application(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_list_organizations
-- =============================================================================

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

  -- Pre-aggregate per-org data into CTEs with single table passes, then join
  -- to organizations once. Previous LATERAL-subquery variant re-scanned each
  -- child table once per organization (N orgs × 5 scans); with grouped CTEs
  -- each table is scanned exactly once and hash-joined.
  -- "Active" period per org = most recent Published/Live period
  -- (is_locked=true, closed_at IS NULL). DISTINCT ON picks one row per org.
  WITH active_periods AS (
    SELECT DISTINCT ON (organization_id) organization_id, id, name
    FROM periods
    WHERE is_locked = true AND closed_at IS NULL
    ORDER BY organization_id, activated_at DESC NULLS LAST, created_at DESC
  ),
  juror_counts AS (
    SELECT organization_id, COUNT(*)::int AS juror_count
    FROM jurors
    GROUP BY organization_id
  ),
  project_counts AS (
    SELECT ap.organization_id, COUNT(pr.id)::int AS project_count
    FROM active_periods ap
    JOIN projects pr ON pr.period_id = ap.id
    GROUP BY ap.organization_id
  ),
  mem_agg AS (
    SELECT
      m.organization_id,
      json_agg(
        jsonb_build_object(
          'id',              m.id,
          'user_id',         m.user_id,
          'organization_id', m.organization_id,
          'role',            m.role,
          'status',          m.status,
          'is_owner',        m.is_owner,
          'created_at',      m.created_at,
          'profiles', jsonb_build_object(
            'id',           p.id,
            'display_name', p.display_name,
            'email',        u.email
          )
        )
      ) AS data
    FROM memberships m
    LEFT JOIN profiles p   ON p.id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    GROUP BY m.organization_id
  ),
  app_agg AS (
    SELECT
      a.organization_id,
      json_agg(
        jsonb_build_object(
          'id',              a.id,
          'organization_id', a.organization_id,
          'applicant_name',  a.applicant_name,
          'contact_email',   a.contact_email,
          'status',          a.status,
          'created_at',      a.created_at
        )
      ) AS data
    FROM org_applications a
    GROUP BY a.organization_id
  )
  SELECT COALESCE(
    json_agg(
      jsonb_build_object(
        'id',                 o.id,
        'code',               o.code,
        'name',               o.name,
        'contact_email',      o.contact_email,
        'status',             o.status,
        'settings',           o.settings,
        'created_at',         o.created_at,
        'updated_at',         o.updated_at,
        'active_period_name', ap.name,
        'juror_count',        COALESCE(jc.juror_count, 0),
        'project_count',      COALESCE(pc.project_count, 0),
        'memberships',        COALESCE(ma.data, '[]'::json),
        'org_applications',   COALESCE(aa.data, '[]'::json)
      ) ORDER BY o.name
    ),
    '[]'::json
  )
  INTO v_result
  FROM organizations o
  LEFT JOIN active_periods ap ON ap.organization_id = o.id
  LEFT JOIN juror_counts   jc ON jc.organization_id = o.id
  LEFT JOIN project_counts pc ON pc.organization_id = o.id
  LEFT JOIN mem_agg        ma ON ma.organization_id = o.id
  LEFT JOIN app_agg        aa ON aa.organization_id = o.id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_list_organizations() TO authenticated;

-- =============================================================================
-- rpc_admin_super_create_organization  (super-admin: create org without self-membership)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_super_create_organization(
  p_name          TEXT,
  p_code          TEXT,
  p_contact_email TEXT DEFAULT NULL,
  p_status        TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO organizations (name, code, contact_email, status)
  VALUES (p_name, p_code, p_contact_email, p_status)
  RETURNING to_jsonb(organizations.*) INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_super_create_organization(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- rpc_admin_create_org_and_membership  (self-serve signup: creates org + active membership atomically)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_create_org_and_membership(
  p_name        TEXT,
  p_org_name    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id  UUID;
  v_code    TEXT;
  v_existing UUID;
  v_lock    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated')::JSON;
  END IF;

  IF p_org_name IS NULL OR trim(p_org_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'org_name_required')::JSON;
  END IF;

  -- Ensure profile row exists and lock it to serialize concurrent signups for the same user
  INSERT INTO public.profiles(id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_lock FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  -- Idempotent short-circuit: if caller already has an active org_admin membership,
  -- return that org instead of raising or duplicating.
  SELECT organization_id INTO v_existing
    FROM public.memberships
   WHERE user_id = v_user_id
     AND role = 'org_admin'
     AND status = 'active'
     AND organization_id IS NOT NULL
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'organization_id', v_existing, 'idempotent', true)::JSON;
  END IF;

  -- Generate a unique short code from org name prefix + random hex suffix
  v_code := upper(regexp_replace(left(p_org_name, 4), '[^A-Z0-9]', '', 'g'))
            || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  -- Create organization
  INSERT INTO public.organizations(code, name, status)
  VALUES (v_code, trim(p_org_name), 'active')
  RETURNING id INTO v_org_id;

  -- Create active org_admin membership; grace window gives 7 days to verify email
  INSERT INTO public.memberships(user_id, organization_id, role, status, grace_ends_at, is_owner)
  VALUES (v_user_id, v_org_id, 'org_admin', 'active', now() + interval '7 days', true);

  UPDATE public.profiles SET display_name = trim(p_name) WHERE id = v_user_id;

  -- Audit
  PERFORM public._audit_write(
    v_org_id,
    'organization.created',
    'organizations',
    v_org_id,
    'config'::audit_category,
    'high'::audit_severity,
    jsonb_build_object('org_name', p_org_name, 'created_by', v_user_id, 'flow', 'self_serve'),
    jsonb_build_object('before', null, 'after', jsonb_build_object('status', 'active', 'role', 'org_admin'))
  );

  RETURN jsonb_build_object('ok', true, 'organization_id', v_org_id, 'idempotent', false)::JSON;
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'org_name_taken')::JSON;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_create_org_and_membership(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_org_and_membership(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_org_and_membership(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_org_and_membership(TEXT, TEXT) TO service_role;

-- =============================================================================
-- rpc_admin_mark_setup_complete
-- =============================================================================
-- Stamps organizations.setup_completed_at the first time the setup wizard
-- finishes (publishPeriod + generateEntryToken succeeded in the wizard's
-- final step). Idempotent via COALESCE — re-calling never overwrites the
-- original timestamp. Caller must be a super admin or an active member of
-- the target org. Returns the resulting setup_completed_at timestamp.

CREATE OR REPLACE FUNCTION public.rpc_admin_mark_setup_complete(
  p_org_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_ts TIMESTAMPTZ;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id_required';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid()
        AND organization_id = p_org_id
        AND status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE organizations
     SET setup_completed_at = COALESCE(setup_completed_at, now()),
         updated_at = now()
   WHERE id = p_org_id
   RETURNING setup_completed_at INTO v_ts;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  RETURN v_ts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_mark_setup_complete(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_check_period_readiness
-- =============================================================================
-- Evaluates whether a period meets the minimum requirements to be published.
-- Returns { ok: boolean, issues: [{ check, msg, severity }] } where issues
-- contains both blocking (severity='required') and informational
-- (severity='optional') items. Publishing is allowed only when every required
-- item passes. UI surfaces both kinds — required ones block the Publish
-- button, optional ones render as warnings.

CREATE OR REPLACE FUNCTION public.rpc_admin_check_period_readiness(
  p_period_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id          UUID;
  v_period          periods%ROWTYPE;
  v_criteria_count  INT;
  v_weight_total    NUMERIC;
  v_missing_bands   INT;
  v_project_count   INT;
  v_framework_id    UUID;
  v_outcome_count   INT;
  v_juror_count     INT;
  v_issues          JSONB := '[]'::jsonb;
  v_ok              BOOLEAN := true;
BEGIN
  -- Fetch + authorize.
  SELECT * INTO v_period FROM periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;
  v_org_id := v_period.organization_id;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Required: criteria_name set.
  IF v_period.criteria_name IS NULL OR btrim(v_period.criteria_name) = '' THEN
    v_ok := false;
    v_issues := v_issues || jsonb_build_object(
      'check', 'criteria_name_missing',
      'msg', 'Criteria set needs a name.',
      'severity', 'required'
    );
  END IF;

  -- Required: ≥1 criterion + weights = 100 + rubric bands present on each.
  SELECT COUNT(*), COALESCE(SUM(weight), 0),
         COUNT(*) FILTER (
           WHERE rubric_bands IS NULL
              OR jsonb_typeof(rubric_bands) <> 'array'
              OR jsonb_array_length(rubric_bands) = 0
         )
    INTO v_criteria_count, v_weight_total, v_missing_bands
    FROM period_criteria
   WHERE period_id = p_period_id;

  IF v_criteria_count = 0 THEN
    v_ok := false;
    v_issues := v_issues || jsonb_build_object(
      'check', 'no_criteria',
      'msg', 'Add at least one criterion.',
      'severity', 'required'
    );
  ELSE
    IF v_weight_total <> 100 THEN
      v_ok := false;
      v_issues := v_issues || jsonb_build_object(
        'check', 'weight_mismatch',
        'msg', format('Criterion weights total %s; must equal 100.', v_weight_total),
        'severity', 'required'
      );
    END IF;
    IF v_missing_bands > 0 THEN
      v_ok := false;
      v_issues := v_issues || jsonb_build_object(
        'check', 'missing_rubric_bands',
        'msg', format('%s criterion(s) missing rubric bands.', v_missing_bands),
        'severity', 'required'
      );
    END IF;
  END IF;

  -- Required: ≥1 project.
  SELECT COUNT(*) INTO v_project_count FROM projects WHERE period_id = p_period_id;
  IF v_project_count = 0 THEN
    v_ok := false;
    v_issues := v_issues || jsonb_build_object(
      'check', 'no_projects',
      'msg', 'Add at least one project.',
      'severity', 'required'
    );
  END IF;

  -- Optional: framework + outcomes.
  v_framework_id := v_period.framework_id;
  IF v_framework_id IS NULL THEN
    v_issues := v_issues || jsonb_build_object(
      'check', 'no_framework',
      'msg', 'No outcome framework assigned (optional — required only for outcome reporting).',
      'severity', 'optional'
    );
  ELSE
    SELECT COUNT(*) INTO v_outcome_count FROM period_outcomes WHERE period_id = p_period_id;
    IF v_outcome_count = 0 THEN
      v_issues := v_issues || jsonb_build_object(
        'check', 'no_outcomes',
        'msg', 'Framework assigned but no outcomes frozen yet.',
        'severity', 'optional'
      );
    END IF;
  END IF;

  -- Optional: jurors pre-registered. Jurors can self-register via QR, so this
  -- is not blocking — but we surface it as a hint.
  SELECT COUNT(*) INTO v_juror_count FROM juror_period_auth WHERE period_id = p_period_id;
  IF v_juror_count = 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'check', 'no_jurors',
      'msg', 'No jurors pre-registered (jurors can still self-register via QR).',
      'severity', 'optional'
    );
  END IF;

  -- Optional: start/end dates filled.
  IF v_period.start_date IS NULL OR v_period.end_date IS NULL THEN
    v_issues := v_issues || jsonb_build_object(
      'check', 'no_dates',
      'msg', 'Start or end date not set.',
      'severity', 'optional'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'issues', v_issues,
    'counts', jsonb_build_object(
      'criteria', v_criteria_count,
      'weight_total', v_weight_total,
      'projects', v_project_count,
      'jurors', v_juror_count,
      'outcomes', COALESCE(v_outcome_count, 0)
    )
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_check_period_readiness(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_publish_period
-- =============================================================================
-- Transitions a period from Draft to Published. Runs the readiness check
-- first; if any required issues remain, fails with 'readiness_failed' and
-- returns the full issues list so the UI can surface them. On success, sets
-- is_locked = true and activated_at = now(). Idempotent — already-published
-- periods return ok with already_published = true.

CREATE OR REPLACE FUNCTION public.rpc_admin_publish_period(
  p_period_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id        UUID;
  v_period_name   TEXT;
  v_is_locked     BOOLEAN;
  v_activated_at  TIMESTAMPTZ;
  v_readiness     JSON;
  v_ok            BOOLEAN;
BEGIN
  SELECT organization_id, name, is_locked, activated_at
    INTO v_org_id, v_period_name, v_is_locked, v_activated_at
    FROM periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Idempotent: already published → no-op success.
  IF COALESCE(v_is_locked, false) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_published', true,
      'activated_at', v_activated_at
    )::JSON;
  END IF;

  -- Readiness gate.
  v_readiness := public.rpc_admin_check_period_readiness(p_period_id);
  v_ok := (v_readiness->>'ok')::BOOLEAN;
  IF NOT v_ok THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'readiness_failed',
      'readiness', v_readiness
    )::JSON;
  END IF;

  UPDATE periods
     SET is_locked    = true,
         activated_at = COALESCE(activated_at, now())
   WHERE id = p_period_id
   RETURNING activated_at INTO v_activated_at;

  PERFORM public._audit_write(
    v_org_id,
    'period.publish',
    'periods',
    p_period_id,
    'config'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('period_name', v_period_name),
    jsonb_build_object(
      'before', jsonb_build_object('is_locked', false),
      'after',  jsonb_build_object('is_locked', true, 'activated_at', v_activated_at)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_published', false,
    'activated_at', v_activated_at
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_publish_period(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_close_period
-- =============================================================================
-- Transitions a Published or Live period to Closed by setting closed_at.
-- Closed periods reject new score inserts (enforced separately) and QR
-- generation (already gated on is_locked, which remains true). Idempotent —
-- already-closed periods return ok with already_closed = true.

CREATE OR REPLACE FUNCTION public.rpc_admin_close_period(
  p_period_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id         UUID;
  v_period_name    TEXT;
  v_is_locked      BOOLEAN;
  v_closed_at      TIMESTAMPTZ;
  v_revoked_count  INT := 0;
BEGIN
  SELECT organization_id, name, is_locked, closed_at
    INTO v_org_id, v_period_name, v_is_locked, v_closed_at
    FROM periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT COALESCE(v_is_locked, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'period_not_published'
    )::JSON;
  END IF;

  IF v_closed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_closed', true,
      'closed_at', v_closed_at,
      'tokens_revoked', 0
    )::JSON;
  END IF;

  UPDATE periods
     SET closed_at = now()
   WHERE id = p_period_id
   RETURNING closed_at INTO v_closed_at;

  -- Revoke all active entry tokens so the QR code stops working immediately.
  WITH revoked AS (
    UPDATE entry_tokens
       SET is_revoked = true, revoked_at = now()
     WHERE period_id = p_period_id
       AND is_revoked = false
    RETURNING id
  )
  SELECT COUNT(*) INTO v_revoked_count FROM revoked;

  PERFORM public._audit_write(
    v_org_id,
    'period.close',
    'periods',
    p_period_id,
    'config'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('period_name', v_period_name, 'tokens_revoked', v_revoked_count),
    jsonb_build_object(
      'before', jsonb_build_object('closed_at', null),
      'after',  jsonb_build_object('closed_at', v_closed_at)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_closed', false,
    'closed_at', v_closed_at,
    'tokens_revoked', v_revoked_count
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_close_period(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_generate_entry_token
-- =============================================================================
-- Uses security_policy->>'qrTtl' (12h/24h/48h/7d) to determine token TTL.
-- Serializes generation per period with FOR UPDATE to avoid parallel races.
-- Revokes any currently active token(s) before inserting the new one.

CREATE OR REPLACE FUNCTION public.rpc_admin_generate_entry_token(p_period_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_token      TEXT;
  v_token_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_org_id     UUID;
  v_is_locked  BOOLEAN;
  v_ttl_str    TEXT;
  v_ttl        INTERVAL;
BEGIN
  -- Serialize generation per period to avoid parallel active-token races.
  SELECT organization_id, is_locked INTO v_org_id, v_is_locked
  FROM periods
  WHERE id = p_period_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Level B gate: raises if caller is unverified within/past grace period.
  PERFORM _assert_tenant_admin('generate_entry_token');

  -- Gate: QR generation requires the period to be Published (is_locked=true).
  -- Before the lifecycle redesign an auto-lock trigger on the first token
  -- INSERT made this implicit; now publish is a deliberate admin action via
  -- rpc_admin_publish_period, and QR is allowed only afterwards.
  IF NOT COALESCE(v_is_locked, false) THEN
    RAISE EXCEPTION 'period_not_published' USING
      HINT = 'Publish the period before generating QR codes.';
  END IF;

  -- Read qrTtl from security_policy; fall back to '24h'.
  SELECT COALESCE(policy->>'qrTtl', '24h')
  INTO v_ttl_str
  FROM security_policy
  WHERE id = 1;

  v_ttl := CASE v_ttl_str
    WHEN '12h' THEN INTERVAL '12 hours'
    WHEN '48h' THEN INTERVAL '48 hours'
    WHEN '7d'  THEN INTERVAL '7 days'
    ELSE            INTERVAL '24 hours'
  END;

  -- Revoke any currently non-revoked token(s) before creating a fresh one.
  UPDATE entry_tokens
  SET is_revoked = true, revoked_at = now()
  WHERE period_id = p_period_id
    AND is_revoked = false;

  v_token      := gen_random_uuid()::TEXT;
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + v_ttl;

  INSERT INTO entry_tokens (period_id, token_hash, token_plain, expires_at)
  VALUES (p_period_id, v_token_hash, v_token, v_expires_at);

  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_org_id,
    auth.uid(),
    'token.generate',
    'entry_tokens',
    p_period_id,
    jsonb_build_object('period_id', p_period_id, 'expires_at', v_expires_at, 'ttl', v_ttl_str)
  );

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_generate_entry_token(UUID) TO authenticated;

-- =============================================================================
-- rpc_entry_token_revoke
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_entry_token_revoke(
  p_token_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_period_id UUID;
  v_org_id    UUID;
  v_is_admin  BOOLEAN;
BEGIN
  SELECT t.period_id, p.organization_id
  INTO v_period_id, v_org_id
  FROM entry_tokens t
  JOIN periods p ON p.id = t.period_id
  WHERE t.id = p_token_id;

  IF v_period_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'token_not_found')::JSON;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = v_org_id OR organization_id IS NULL)
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  UPDATE entry_tokens SET is_revoked = true WHERE id = p_token_id;

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_entry_token_revoke(UUID) TO authenticated;

-- rpc_admin_revoke_entry_token lives in 009_audit.sql (canonical version with
-- security-category audit write). Not duplicated here to avoid return-type
-- conflicts.

-- =============================================================================
-- rpc_admin_request_unlock
-- =============================================================================
-- Org admin asks super admin to unlock a period that already has scores.
-- Creates a pending unlock_requests row; super admin resolves via
-- rpc_super_admin_resolve_unlock. Idempotent per period (unique partial index
-- enforces one pending request per period at a time).

CREATE OR REPLACE FUNCTION public.rpc_admin_request_unlock(
  p_period_id UUID,
  p_reason    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id       UUID;
  v_period_name  TEXT;
  v_is_locked    BOOLEAN;
  v_is_admin     BOOLEAN;
  v_has_scores   BOOLEAN;
  v_request_id   UUID;
  v_reason       TEXT;
BEGIN
  v_reason := btrim(COALESCE(p_reason, ''));
  IF char_length(v_reason) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'reason_too_short')::JSON;
  END IF;

  SELECT organization_id, name, is_locked
    INTO v_org_id, v_period_name, v_is_locked
  FROM periods
  WHERE id = p_period_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_not_found')::JSON;
  END IF;

  IF NOT COALESCE(v_is_locked, false) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_not_locked')::JSON;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = v_org_id OR organization_id IS NULL)
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM score_sheets ss
    JOIN projects pr ON pr.id = ss.project_id
    WHERE pr.period_id = p_period_id
  ) INTO v_has_scores;

  IF NOT v_has_scores THEN
    -- No scores yet: client should call rpc_admin_set_period_lock(_, false) directly.
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_has_no_scores')::JSON;
  END IF;

  BEGIN
    INSERT INTO unlock_requests (period_id, organization_id, requested_by, reason)
    VALUES (p_period_id, v_org_id, auth.uid(), v_reason)
    RETURNING id INTO v_request_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'pending_request_exists')::JSON;
  END;

  PERFORM public._audit_write(
    v_org_id,
    'unlock_request.create',
    'unlock_requests',
    v_request_id,
    'config'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object(
      'period_id',   p_period_id,
      'period_name', v_period_name,
      'reason',      v_reason
    )
  );

  RETURN jsonb_build_object(
    'ok',         true,
    'request_id', v_request_id
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_request_unlock(UUID, TEXT) TO authenticated;

-- =============================================================================
-- rpc_super_admin_resolve_unlock
-- =============================================================================
-- Super admin approves/rejects a pending unlock_requests row.
-- approved → period.is_locked = false + audit severity=high
-- rejected → status update only + audit severity=medium

CREATE OR REPLACE FUNCTION public.rpc_super_admin_resolve_unlock(
  p_request_id UUID,
  p_decision   TEXT,
  p_note       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request      unlock_requests%ROWTYPE;
  v_period_name  TEXT;
  v_severity     audit_severity;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_decision')::JSON;
  END IF;

  SELECT * INTO v_request
  FROM unlock_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'request_not_found')::JSON;
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'request_not_pending')::JSON;
  END IF;

  SELECT name INTO v_period_name FROM periods WHERE id = v_request.period_id;

  UPDATE unlock_requests
  SET status      = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    UPDATE periods SET is_locked = false WHERE id = v_request.period_id;
    -- Same token-revocation rule as direct revert: an approved revert-to-
    -- Draft invalidates any active QR so jurors cannot keep entering a
    -- period whose structure is being re-edited.
    UPDATE entry_tokens
      SET is_revoked = true, revoked_at = now()
    WHERE period_id = v_request.period_id AND is_revoked = false;
    v_severity := 'high'::audit_severity;
  ELSE
    v_severity := 'medium'::audit_severity;
  END IF;

  PERFORM public._audit_write(
    v_request.organization_id,
    'unlock_request.resolve',
    'unlock_requests',
    p_request_id,
    'config'::audit_category,
    v_severity,
    jsonb_build_object(
      'period_id',   v_request.period_id,
      'period_name', v_period_name,
      'decision',    p_decision,
      'review_note', NULLIF(btrim(COALESCE(p_note, '')), ''),
      'requested_by', v_request.requested_by
    )
  );

  RETURN jsonb_build_object(
    'ok',           true,
    'request_id',   p_request_id,
    'decision',     p_decision,
    'period_id',    v_request.period_id,
    'organization_id', v_request.organization_id,
    'requested_by', v_request.requested_by
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_super_admin_resolve_unlock(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- rpc_admin_list_unlock_requests
-- =============================================================================
-- Lists unlock requests visible to caller (RLS applies: org admin sees own org,
-- super admin sees all). Filter by status. Joins period + requester + reviewer
-- display names. Default: pending only.

CREATE OR REPLACE FUNCTION public.rpc_admin_list_unlock_requests(
  p_status TEXT DEFAULT 'pending'
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'created_at' DESC), '[]'::jsonb)::JSON
  FROM (
    SELECT jsonb_build_object(
      'id',               ur.id,
      'period_id',        ur.period_id,
      'period_name',      p.name,
      'organization_id',  ur.organization_id,
      'organization_name', o.name,
      'requested_by',     ur.requested_by,
      'requester_name',   rp.display_name,
      'reason',           ur.reason,
      'status',           ur.status,
      'reviewed_by',      ur.reviewed_by,
      'reviewer_name',    vp.display_name,
      'reviewed_at',      ur.reviewed_at,
      'review_note',      ur.review_note,
      'created_at',       ur.created_at
    ) AS row
    FROM unlock_requests ur
    JOIN periods       p  ON p.id = ur.period_id
    JOIN organizations o  ON o.id = ur.organization_id
    LEFT JOIN profiles rp ON rp.id = ur.requested_by
    LEFT JOIN profiles vp ON vp.id = ur.reviewed_by
    WHERE (
      public.current_user_is_super_admin()
      OR ur.organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND organization_id IS NOT NULL
      )
    )
    AND (p_status IS NULL OR p_status = 'all' OR ur.status = p_status)
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_list_unlock_requests(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- F) PUBLIC STATS
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- rpc_landing_stats
-- =============================================================================

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
    'projects',      (SELECT count(DISTINCT project_id) FROM scores_compat)
  );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_landing_stats() TO anon, authenticated;

-- =============================================================================
-- rpc_platform_metrics
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_platform_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_db_size_bytes      bigint;
  v_db_size_pretty     text;
  v_active_connections bigint;
  v_audit_24h          bigint;
  v_total_orgs         bigint;
  v_total_jurors       bigint;
BEGIN
  SELECT pg_database_size(current_database()) INTO v_db_size_bytes;
  SELECT pg_size_pretty(v_db_size_bytes) INTO v_db_size_pretty;
  SELECT count(*) INTO v_active_connections FROM pg_stat_activity WHERE state = 'active';
  SELECT count(*) INTO v_audit_24h FROM audit_logs WHERE created_at > now() - interval '24 hours';
  SELECT count(*) INTO v_total_orgs FROM organizations;
  SELECT count(*) INTO v_total_jurors FROM jurors;

  RETURN jsonb_build_object(
    'db_size_bytes',       v_db_size_bytes,
    'db_size_pretty',      v_db_size_pretty,
    'active_connections',  v_active_connections,
    'audit_requests_24h',  v_audit_24h,
    'total_organizations', v_total_orgs,
    'total_jurors',        v_total_jurors
  );
END;
$$;

-- Service role only — no public/authenticated/anon grant
REVOKE ALL ON FUNCTION public.rpc_platform_metrics() FROM PUBLIC, authenticated, anon;

-- =============================================================================
-- Score aggregation RPCs (single source of truth)
-- =============================================================================
-- Three RPCs replace the parallel JS-side aggregations in `getProjectSummary`,
-- `ProjectsPage.projectAvgMap`, `ProjectScoresDrawer.finalScore`,
-- `JurorScoresDrawer.avgScore`, and `RankingsPage`. All compute on the same
-- filter — `score_sheets.status = 'submitted'` AND (when `p_only_finalized`
-- is true) `juror_period_auth.final_submitted_at IS NOT NULL`.
--
-- Default `p_only_finalized = true` is for official/accreditation views
-- (Rankings, Projects, Drawers, Export, Outcome Attainment). Set to false
-- for live-monitoring views (Heatmap, JurorsPage live status) where partial
-- data must be visible.
--
-- Common shape:
--   total_max  := SUM(period_criteria.max_score) for the period
--   juror_total[i,p] := SUM(score_value[i,p]) for juror i × project p
--   juror_pct[i,p]   := juror_total[i,p] / total_max * 100
--
-- Per-project: AVG / MIN / MAX / stddev_pop over juror_pct, RANK by total_avg.
-- Per-juror:   AVG / stddev_pop over juror_pct (across all projects scored).
-- Period:      AVG over per-project total_pct + AVG over per-juror avg_total_pct.

-- =============================================================================
-- rpc_admin_period_summary
-- =============================================================================
-- Returns ONE row of period-wide reference values. Drawers use this to compute
-- "vs avg" deltas (project's total_pct vs avg_total_pct, juror's avg_total_pct
-- vs avg_juror_pct). Cheaper than recomputing the period mean on every drawer
-- open.

CREATE OR REPLACE FUNCTION public.rpc_admin_period_summary(
  p_period_id        UUID,
  p_only_finalized   BOOLEAN DEFAULT true
)
RETURNS TABLE (
  total_max         NUMERIC,
  total_projects    INT,
  ranked_count      INT,
  total_jurors      INT,
  finalized_jurors  INT,
  avg_total_pct     NUMERIC,
  avg_juror_pct     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM periods WHERE id = p_period_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- CTE column names are intentionally aliased away from the RETURNS TABLE
  -- column names (pmax/p_total_pct/p_total_avg) so PostgreSQL doesn't raise
  -- "column reference X is ambiguous" when a sub-select like
  -- `(SELECT total_max FROM period_max)` lives inside the final SELECT list
  -- of a RETURNS TABLE function whose own column is also named total_max.
  RETURN QUERY
  WITH period_max AS (
    SELECT COALESCE(SUM(max_score), 0)::numeric AS pmax
    FROM period_criteria
    WHERE period_id = p_period_id
  ),
  sheets AS (
    SELECT ss.id, ss.project_id, ss.juror_id
    FROM score_sheets ss
    JOIN juror_period_auth jpa
      ON jpa.juror_id = ss.juror_id AND jpa.period_id = ss.period_id
    WHERE ss.period_id = p_period_id
      AND CASE
            WHEN p_only_finalized THEN jpa.final_submitted_at IS NOT NULL
            ELSE ss.status = 'submitted'
          END
  ),
  juror_totals AS (
    SELECT s.project_id, s.juror_id, SUM(ssi.score_value)::numeric AS juror_total
    FROM sheets s
    JOIN score_sheet_items ssi ON ssi.score_sheet_id = s.id
    GROUP BY s.project_id, s.juror_id
  ),
  juror_pct AS (
    SELECT
      jt.project_id, jt.juror_id, jt.juror_total,
      CASE
        WHEN (SELECT pmax FROM period_max) > 0
          THEN jt.juror_total / (SELECT pmax FROM period_max) * 100
        ELSE NULL
      END AS pct
    FROM juror_totals jt
  ),
  project_pct AS (
    SELECT project_id, AVG(pct) AS p_total_pct, AVG(juror_total) AS p_total_avg
    FROM juror_pct
    GROUP BY project_id
  ),
  juror_avg_pct AS (
    SELECT juror_id, AVG(pct) AS avg_pct
    FROM juror_pct
    GROUP BY juror_id
  )
  SELECT
    (SELECT pmax FROM period_max)::numeric                                       AS total_max,
    (SELECT COUNT(*)::int FROM projects WHERE period_id = p_period_id)           AS total_projects,
    (SELECT COUNT(*)::int FROM project_pct WHERE p_total_avg IS NOT NULL)        AS ranked_count,
    (SELECT COUNT(*)::int FROM juror_period_auth WHERE period_id = p_period_id)  AS total_jurors,
    (SELECT COUNT(*)::int FROM juror_period_auth
       WHERE period_id = p_period_id AND final_submitted_at IS NOT NULL)         AS finalized_jurors,
    (SELECT AVG(p_total_pct) FROM project_pct)::numeric                          AS avg_total_pct,
    (SELECT AVG(avg_pct) FROM juror_avg_pct)::numeric                            AS avg_juror_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_period_summary(UUID, BOOLEAN) TO authenticated;

-- =============================================================================
-- rpc_admin_project_summary
-- =============================================================================
-- Returns one row per project with all aggregations needed by ProjectsPage,
-- ProjectScoresDrawer, RankingsPage, and Export. `per_criterion` is a JSONB
-- map { criterion_key: { avg, max, pct } } so drawers can render the
-- criterion strip without extra queries.

CREATE OR REPLACE FUNCTION public.rpc_admin_project_summary(
  p_period_id        UUID,
  p_only_finalized   BOOLEAN DEFAULT true
)
RETURNS TABLE (
  project_id        UUID,
  title             TEXT,
  project_no        INT,
  members           JSONB,
  advisor           TEXT,
  juror_count       INT,
  submitted_count   INT,
  assigned_count    INT,
  total_avg         NUMERIC,
  total_pct         NUMERIC,
  total_min         NUMERIC,
  total_max         NUMERIC,
  std_dev_pct       NUMERIC,
  rank              INT,
  per_criterion     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM periods WHERE id = p_period_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH period_max AS (
    SELECT COALESCE(SUM(pc.max_score), 0)::numeric AS pmax
    FROM period_criteria pc
    WHERE pc.period_id = p_period_id
  ),
  sheets AS (
    SELECT ss.id, ss.project_id, ss.juror_id
    FROM score_sheets ss
    JOIN juror_period_auth jpa
      ON jpa.juror_id = ss.juror_id AND jpa.period_id = ss.period_id
    WHERE ss.period_id = p_period_id
      AND CASE
            WHEN p_only_finalized THEN jpa.final_submitted_at IS NOT NULL
            ELSE ss.status = 'submitted'
          END
  ),
  juror_totals AS (
    SELECT s.project_id, s.juror_id, SUM(ssi.score_value)::numeric AS juror_total
    FROM sheets s
    JOIN score_sheet_items ssi ON ssi.score_sheet_id = s.id
    GROUP BY s.project_id, s.juror_id
  ),
  juror_pct AS (
    SELECT
      jt.project_id,
      jt.juror_id,
      jt.juror_total,
      CASE
        WHEN (SELECT pmax FROM period_max) > 0
          THEN jt.juror_total / (SELECT pmax FROM period_max) * 100
        ELSE NULL
      END AS pct
    FROM juror_totals jt
  ),
  project_totals AS (
    SELECT
      jp.project_id,
      AVG(jp.juror_total)::numeric           AS p_total_avg,
      AVG(jp.pct)::numeric                   AS p_total_pct,
      MIN(jp.juror_total)::numeric           AS p_total_min,
      MAX(jp.juror_total)::numeric           AS p_total_max,
      stddev_pop(jp.pct)::numeric            AS p_std_dev_pct,
      COUNT(*)::int                          AS p_juror_count
    FROM juror_pct jp
    GROUP BY jp.project_id
  ),
  per_crit AS (
    SELECT
      s.project_id,
      pc.key,
      AVG(ssi.score_value)::numeric AS crit_avg,
      pc.max_score::numeric         AS crit_max
    FROM sheets s
    JOIN score_sheet_items ssi ON ssi.score_sheet_id = s.id
    JOIN period_criteria pc    ON pc.id = ssi.period_criterion_id
    WHERE ssi.score_value IS NOT NULL
    GROUP BY s.project_id, pc.key, pc.max_score
  ),
  ranked AS (
    SELECT
      pt.project_id,
      RANK() OVER (ORDER BY pt.p_total_avg DESC NULLS LAST, pt.project_id)::int AS rk
    FROM project_totals pt
  ),
  assigned AS (
    SELECT ss.project_id, COUNT(*)::int AS ac
    FROM score_sheets ss
    WHERE ss.period_id = p_period_id
    GROUP BY ss.project_id
  )
  SELECT
    p.id                                       AS project_id,
    p.title                                    AS title,
    p.project_no                               AS project_no,
    p.members::jsonb                           AS members,
    p.advisor_name                             AS advisor,
    COALESCE(pt.p_juror_count, 0)              AS juror_count,
    COALESCE(pt.p_juror_count, 0)              AS submitted_count,
    COALESCE(a.ac, 0)                          AS assigned_count,
    pt.p_total_avg                             AS total_avg,
    pt.p_total_pct                             AS total_pct,
    pt.p_total_min                             AS total_min,
    pt.p_total_max                             AS total_max,
    pt.p_std_dev_pct                           AS std_dev_pct,
    r.rk                                       AS rank,
    COALESCE(
      (SELECT jsonb_object_agg(
                pc.key,
                jsonb_build_object(
                  'avg', pc.crit_avg,
                  'max', pc.crit_max,
                  'pct', CASE WHEN pc.crit_max > 0
                              THEN pc.crit_avg / pc.crit_max * 100
                              ELSE NULL END
                )
              )
       FROM per_crit pc WHERE pc.project_id = p.id),
      '{}'::jsonb
    )                                          AS per_criterion
  FROM projects p
  LEFT JOIN project_totals pt ON pt.project_id = p.id
  LEFT JOIN ranked r          ON r.project_id  = p.id
  LEFT JOIN assigned a        ON a.project_id  = p.id
  WHERE p.period_id = p_period_id
  ORDER BY p.title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_project_summary(UUID, BOOLEAN) TO authenticated;

-- =============================================================================
-- rpc_admin_juror_summary
-- =============================================================================
-- Returns one row per juror in the period with their evaluation stats.
-- JurorsPage and JurorScoresDrawer consume this directly.

CREATE OR REPLACE FUNCTION public.rpc_admin_juror_summary(
  p_period_id        UUID,
  p_only_finalized   BOOLEAN DEFAULT true
)
RETURNS TABLE (
  juror_id            UUID,
  juror_name          TEXT,
  affiliation         TEXT,
  scored_count        INT,
  assigned_count      INT,
  completion_pct      NUMERIC,
  avg_total           NUMERIC,
  avg_total_pct       NUMERIC,
  std_dev_pct         NUMERIC,
  final_submitted_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM periods WHERE id = p_period_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH period_max AS (
    SELECT COALESCE(SUM(pc.max_score), 0)::numeric AS pmax
    FROM period_criteria pc
    WHERE pc.period_id = p_period_id
  ),
  sheets AS (
    SELECT ss.id, ss.project_id, ss.juror_id
    FROM score_sheets ss
    JOIN juror_period_auth jpa
      ON jpa.juror_id = ss.juror_id AND jpa.period_id = ss.period_id
    WHERE ss.period_id = p_period_id
      AND CASE
            WHEN p_only_finalized THEN jpa.final_submitted_at IS NOT NULL
            ELSE ss.status = 'submitted'
          END
  ),
  juror_totals AS (
    SELECT s.project_id, s.juror_id, SUM(ssi.score_value)::numeric AS juror_total
    FROM sheets s
    JOIN score_sheet_items ssi ON ssi.score_sheet_id = s.id
    GROUP BY s.project_id, s.juror_id
  ),
  juror_pct AS (
    SELECT
      jt.juror_id,
      jt.juror_total,
      CASE
        WHEN (SELECT pmax FROM period_max) > 0
          THEN jt.juror_total / (SELECT pmax FROM period_max) * 100
        ELSE NULL
      END AS pct
    FROM juror_totals jt
  ),
  juror_stats AS (
    SELECT
      jp.juror_id,
      AVG(jp.juror_total)::numeric AS j_avg_total,
      AVG(jp.pct)::numeric         AS j_avg_pct,
      stddev_pop(jp.pct)::numeric  AS j_std_dev_pct,
      COUNT(*)::int                AS j_scored
    FROM juror_pct jp
    GROUP BY jp.juror_id
  ),
  assigned_per_juror AS (
    SELECT ss.juror_id, COUNT(*)::int AS ac
    FROM score_sheets ss
    WHERE ss.period_id = p_period_id
    GROUP BY ss.juror_id
  )
  SELECT
    j.id                                              AS juror_id,
    j.juror_name                                      AS juror_name,
    j.affiliation                                     AS affiliation,
    COALESCE(js.j_scored, 0)                          AS scored_count,
    COALESCE(a.ac, 0)                                 AS assigned_count,
    CASE WHEN COALESCE(a.ac, 0) > 0
         THEN (COALESCE(js.j_scored, 0)::numeric / a.ac * 100)
         ELSE NULL END                                AS completion_pct,
    js.j_avg_total                                    AS avg_total,
    js.j_avg_pct                                      AS avg_total_pct,
    js.j_std_dev_pct                                  AS std_dev_pct,
    jpa.final_submitted_at                            AS final_submitted_at
  FROM juror_period_auth jpa
  JOIN jurors j ON j.id = jpa.juror_id
  LEFT JOIN juror_stats js        ON js.juror_id = jpa.juror_id
  LEFT JOIN assigned_per_juror a  ON a.juror_id  = jpa.juror_id
  WHERE jpa.period_id = p_period_id
  ORDER BY j.juror_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_juror_summary(UUID, BOOLEAN) TO authenticated;

