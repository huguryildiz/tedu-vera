-- VERA: Essential RPCs (jury auth, token validation, score upsert, application approval)
-- These are the only remaining SECURITY DEFINER functions after PostgREST migration.
-- All functions use: SET search_path = public, auth; SECURITY DEFINER; LANGUAGE plpgsql;

-- =============================================================================
-- 1. rpc_jury_authenticate
-- =============================================================================
-- Creates or retrieves juror by (name + affiliation) within the period's org.
-- Generates PIN if needed, returns PIN on first login (pin_reveal).

DROP FUNCTION IF EXISTS public.rpc_jury_authenticate(UUID, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.rpc_jury_authenticate(
  p_period_id         UUID,
  p_juror_name        TEXT,
  p_affiliation       TEXT,
  p_force_reissue     BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_organization_id UUID;
  v_juror_id UUID;
  v_pin TEXT;
  v_needs_pin BOOLEAN;
  v_auth_row juror_period_auth%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Look up organization from period
  SELECT periods.organization_id INTO v_organization_id
  FROM periods
  WHERE id = p_period_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('error', 'period_not_found')::JSON;
  END IF;

  -- Find or create juror by (name + affiliation + organization_id)
  SELECT id INTO v_juror_id
  FROM jurors
  WHERE juror_name = p_juror_name
    AND affiliation = p_affiliation
    AND organization_id = v_organization_id
  LIMIT 1;

  IF v_juror_id IS NULL THEN
    INSERT INTO jurors (organization_id, juror_name, affiliation)
    VALUES (v_organization_id, p_juror_name, p_affiliation)
    RETURNING id INTO v_juror_id;
  END IF;

  -- Create or get juror_period_auth row
  INSERT INTO juror_period_auth (juror_id, period_id, pin, failed_attempts, locked_until)
  VALUES (v_juror_id, p_period_id, NULL, 0, NULL)
  ON CONFLICT (juror_id, period_id) DO UPDATE SET pin = EXCLUDED.pin
  RETURNING * INTO v_auth_row;

  -- Check lockout status
  IF v_auth_row.locked_until IS NOT NULL AND v_auth_row.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'juror_id', v_juror_id,
      'juror_name', p_juror_name,
      'affiliation', p_affiliation,
      'needs_pin', false,
      'pin_plain_once', NULL,
      'locked_until', v_auth_row.locked_until,
      'failed_attempts', v_auth_row.failed_attempts
    )::JSON;
  END IF;

  -- Generate PIN if needed or if force_reissue=true
  v_needs_pin := false;
  IF p_force_reissue OR v_auth_row.pin IS NULL THEN
    v_pin := lpad(floor(random() * 10000)::TEXT, 4, '0');
    UPDATE juror_period_auth
    SET pin = v_pin
    WHERE juror_id = v_juror_id AND period_id = p_period_id;
    v_needs_pin := true;
  ELSE
    v_pin := v_auth_row.pin;
  END IF;

  RETURN jsonb_build_object(
    'juror_id', v_juror_id,
    'juror_name', p_juror_name,
    'affiliation', p_affiliation,
    'needs_pin', v_needs_pin,
    'pin_plain_once', CASE WHEN v_needs_pin THEN v_pin ELSE NULL END,
    'locked_until', NULL,
    'failed_attempts', 0
  )::JSON;
END;
$$;

-- =============================================================================
-- 2. rpc_jury_verify_pin
-- =============================================================================
-- Verifies PIN and returns session token on success.
-- Tracks failed attempts and lockout (3 failures → 15 min lockout).

DROP FUNCTION IF EXISTS public.rpc_jury_verify_pin(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_jury_verify_pin(
  p_period_id     UUID,
  p_juror_name    TEXT,
  p_affiliation   TEXT,
  p_pin           TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_organization_id UUID;
  v_juror_id UUID;
  v_auth_row juror_period_auth%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_failed_count INT;
  v_locked_until TIMESTAMPTZ;
  v_session_token TEXT;
BEGIN
  -- Look up organization from period
  SELECT periods.organization_id INTO v_organization_id
  FROM periods
  WHERE id = p_period_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_not_found')::JSON;
  END IF;

  -- Find juror
  SELECT id INTO v_juror_id
  FROM jurors
  WHERE juror_name = p_juror_name
    AND affiliation = p_affiliation
    AND organization_id = v_organization_id
  LIMIT 1;

  IF v_juror_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_not_found')::JSON;
  END IF;

  -- Get auth row
  SELECT * INTO v_auth_row
  FROM juror_period_auth
  WHERE juror_id = v_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'no_auth_row')::JSON;
  END IF;

  -- Check if blocked
  IF v_auth_row.is_blocked THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'blocked')::JSON;
  END IF;

  -- Check if locked
  IF v_auth_row.locked_until IS NOT NULL AND v_auth_row.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'locked',
      'locked_until', v_auth_row.locked_until,
      'failed_attempts', v_auth_row.failed_attempts
    )::JSON;
  END IF;

  -- Reset attempts if lock window expired
  IF v_auth_row.locked_until IS NOT NULL AND v_auth_row.locked_until <= v_now THEN
    UPDATE juror_period_auth
    SET failed_attempts = 0, locked_until = NULL
    WHERE juror_id = v_juror_id AND period_id = p_period_id;
    v_auth_row.failed_attempts := 0;
    v_auth_row.locked_until := NULL;
  END IF;

  -- Verify PIN
  IF v_auth_row.pin = p_pin THEN
    v_session_token := encode(gen_random_bytes(32), 'hex');
    UPDATE juror_period_auth
    SET session_token = v_session_token, failed_attempts = 0, locked_until = NULL, last_seen_at = v_now
    WHERE juror_id = v_juror_id AND period_id = p_period_id;

    RETURN jsonb_build_object(
      'ok', true,
      'juror_id', v_juror_id,
      'session_token', v_session_token
    )::JSON;
  END IF;

  -- PIN mismatch: increment failed attempts
  v_failed_count := v_auth_row.failed_attempts + 1;
  v_locked_until := NULL;

  IF v_failed_count >= 3 THEN
    v_locked_until := v_now + interval '15 minutes';
  END IF;

  UPDATE juror_period_auth
  SET failed_attempts = v_failed_count, locked_until = v_locked_until
  WHERE juror_id = v_juror_id AND period_id = p_period_id;

  RETURN jsonb_build_object(
    'ok', false,
    'error_code', 'invalid_pin',
    'locked_until', v_locked_until,
    'failed_attempts', v_failed_count
  )::JSON;
END;
$$;

-- =============================================================================
-- 3. rpc_jury_validate_entry_token
-- =============================================================================
-- Validates entry token: checks revocation and TTL (24 hours).
-- Returns period info if valid.

DROP FUNCTION IF EXISTS public.rpc_jury_validate_entry_token(TEXT);

CREATE OR REPLACE FUNCTION public.rpc_jury_validate_entry_token(
  p_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token_row entry_tokens%ROWTYPE;
  v_period_id UUID;
  v_period_name TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Look up token
  SELECT * INTO v_token_row
  FROM entry_tokens
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'token_not_found')::JSON;
  END IF;

  -- Check if revoked
  IF v_token_row.is_revoked THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'token_revoked')::JSON;
  END IF;

  -- Check TTL: created within 24 hours
  IF v_token_row.created_at < v_now - interval '24 hours' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'token_expired')::JSON;
  END IF;

  -- Check explicit expiry if set
  IF v_token_row.expires_at IS NOT NULL AND v_token_row.expires_at < v_now THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'token_expired')::JSON;
  END IF;

  -- Get period info
  SELECT id, name INTO v_period_id, v_period_name
  FROM periods
  WHERE id = v_token_row.period_id;

  IF v_period_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_not_found')::JSON;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', v_period_id,
    'period_name', v_period_name
  )::JSON;
END;
$$;

-- =============================================================================
-- 4. rpc_jury_upsert_scores
-- =============================================================================
-- Upserts scores for a project after validating session and period state.
-- Returns total score if successful.

DROP FUNCTION IF EXISTS public.rpc_jury_upsert_scores(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_jury_upsert_scores(
  p_period_id     UUID,
  p_project_id    UUID,
  p_juror_id      UUID,
  p_session_token TEXT,
  p_technical     NUMERIC,
  p_written       NUMERIC,
  p_oral          NUMERIC,
  p_teamwork      NUMERIC,
  p_comment       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_row juror_period_auth%ROWTYPE;
  v_period_locked BOOLEAN;
  v_total NUMERIC;
BEGIN
  -- Validate session
  SELECT * INTO v_auth_row
  FROM juror_period_auth
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found')::JSON;
  END IF;

  IF v_auth_row.session_token != p_session_token THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_session')::JSON;
  END IF;

  -- Check period is not locked
  SELECT is_locked INTO v_period_locked
  FROM periods
  WHERE id = p_period_id;

  IF v_period_locked THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_locked')::JSON;
  END IF;

  -- UPSERT scores
  INSERT INTO scores (juror_id, project_id, period_id, technical, written, oral, teamwork, comments)
  VALUES (p_juror_id, p_project_id, p_period_id, p_technical, p_written, p_oral, p_teamwork, p_comment)
  ON CONFLICT (juror_id, project_id) DO UPDATE SET
    technical = EXCLUDED.technical,
    written = EXCLUDED.written,
    oral = EXCLUDED.oral,
    teamwork = EXCLUDED.teamwork,
    comments = EXCLUDED.comments,
    updated_at = now();

  -- Update last_seen_at
  UPDATE juror_period_auth
  SET last_seen_at = now()
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  -- Calculate total
  v_total := COALESCE(p_technical, 0) + COALESCE(p_written, 0) + COALESCE(p_oral, 0) + COALESCE(p_teamwork, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total
  )::JSON;
END;
$$;

-- =============================================================================
-- 5. rpc_jury_finalize_submission
-- =============================================================================
-- Marks submission as finalized by setting final_submitted_at on auth row.

DROP FUNCTION IF EXISTS public.rpc_jury_finalize_submission(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_jury_finalize_submission(
  p_period_id     UUID,
  p_juror_id      UUID,
  p_session_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_row juror_period_auth%ROWTYPE;
BEGIN
  -- Validate session
  SELECT * INTO v_auth_row
  FROM juror_period_auth
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found')::JSON;
  END IF;

  IF v_auth_row.session_token != p_session_token THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_session')::JSON;
  END IF;

  -- Mark as finalized
  UPDATE juror_period_auth
  SET final_submitted_at = now()
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

-- =============================================================================
-- 6. rpc_admin_approve_application
-- =============================================================================
-- Approves a pending tenant application (updates status only).
-- Caller must be super_admin.

DROP FUNCTION IF EXISTS public.rpc_admin_approve_application(UUID);

CREATE OR REPLACE FUNCTION public.rpc_admin_approve_application(
  p_application_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_is_super_admin BOOLEAN;
  v_app_row tenant_applications%ROWTYPE;
BEGIN
  -- Get caller
  v_caller_id := auth.uid();

  -- Verify caller is super_admin
  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = v_caller_id AND role = 'super_admin'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  -- Look up application
  SELECT * INTO v_app_row
  FROM tenant_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'application_not_found')::JSON;
  END IF;

  -- Verify status is pending
  IF v_app_row.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_status')::JSON;
  END IF;

  -- Update application
  UPDATE tenant_applications
  SET status = 'approved', reviewed_by = v_caller_id, reviewed_at = now()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'ok', true,
    'application_id', p_application_id
  )::JSON;
END;
$$;

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_jury_authenticate(UUID, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_jury_verify_pin(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_jury_validate_entry_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_jury_upsert_scores(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_jury_finalize_submission(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_approve_application(UUID) TO anon, authenticated;
