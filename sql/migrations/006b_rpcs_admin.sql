-- VERA v1 — Admin RPCs (Part B): Period Management + System Config + Audit Helpers + Auth + Join Flow
-- Covers sections G (periods), H (system config), H2 (audit write helpers + atomic RPCs), I (public auth), J (join requests).
-- Companion file: 006a_rpcs_admin.sql (D jury, D2 org helpers, E org/token, F public stats).
-- Depends on: 002 (tables), 003 (helpers), 004 (RLS), 005_rpcs_jury, 006a_rpcs_admin.
--
-- All crypto functions use SET search_path = public, extensions
-- where pgcrypto (crypt, gen_salt, digest, gen_random_bytes) is needed.

-- ═══════════════════════════════════════════════════════════════════════════════
-- G) PERIOD MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- rpc_period_freeze_snapshot
-- =============================================================================

-- Drop old single-argument signature so the new (UUID, BOOLEAN) overload is
-- unambiguous for PostgREST callers that omit p_force.
DROP FUNCTION IF EXISTS public.rpc_period_freeze_snapshot(UUID);

-- Criteria and outcomes are managed as independent collections per period.
-- - p_force = false (initial freeze, e.g. first jury entry or period creation):
--     Fills period_criteria, period_outcomes, and period_criterion_outcome_maps
--     from the assigned framework if the snapshot has not been frozen yet.
-- - p_force = true  (framework reassignment from OutcomesPage):
--     Re-seeds ONLY period_outcomes and period_criterion_outcome_maps.
--     period_criteria is NEVER touched — criteria are managed separately via
--     the CriteriaPage flow. Mappings are re-inserted based on existing
--     period_criteria whose source_criterion_id matches the new framework's
--     criteria; unmatched criteria simply end up unmapped.
CREATE OR REPLACE FUNCTION public.rpc_period_freeze_snapshot(
  p_period_id UUID,
  p_force     BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period          periods%ROWTYPE;
  v_criteria_count  INT;
  v_outcomes_count  INT;
BEGIN
  SELECT * INTO v_period FROM periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'period_not_found');
  END IF;

  IF v_period.framework_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'period_has_no_framework');
  END IF;

  -- Force re-seed of outcomes + mappings only.
  -- period_criteria is intentionally preserved so the user's criteria setup
  -- survives a framework switch. Mappings must go because they reference the
  -- outcomes we are about to delete.
  IF p_force THEN
    DELETE FROM period_criterion_outcome_maps WHERE period_id = p_period_id;
    DELETE FROM period_outcomes                 WHERE period_id = p_period_id;
    UPDATE periods SET snapshot_frozen_at = NULL WHERE id = p_period_id;
    v_period.snapshot_frozen_at := NULL;
  END IF;

  -- Already frozen and has data — skip
  IF v_period.snapshot_frozen_at IS NOT NULL THEN
    SELECT COUNT(*) INTO v_criteria_count FROM period_criteria WHERE period_id = p_period_id;
    SELECT COUNT(*) INTO v_outcomes_count FROM period_outcomes WHERE period_id = p_period_id;
    IF v_outcomes_count > 0 THEN
      RETURN json_build_object('ok', true, 'already_frozen', true, 'criteria_count', v_criteria_count, 'outcomes_count', v_outcomes_count);
    END IF;
    -- Frozen but empty (template was empty when frozen) — reset and re-seed
    UPDATE periods SET snapshot_frozen_at = NULL WHERE id = p_period_id;
    v_period.snapshot_frozen_at := NULL;
  END IF;

  -- period_criteria is only seeded on a non-forced freeze. On force (framework
  -- reassignment) we leave existing criteria alone — see header comment.
  IF NOT p_force THEN
    INSERT INTO period_criteria (
      period_id, source_criterion_id, key, label,
      description, max_score, weight, color, rubric_bands, sort_order
    )
    SELECT p_period_id, fc.id, fc.key, fc.label,
      fc.description, fc.max_score, fc.weight, fc.color, fc.rubric_bands, fc.sort_order
    FROM framework_criteria fc
    WHERE fc.framework_id = v_period.framework_id
    ON CONFLICT (period_id, key) DO NOTHING;

    GET DIAGNOSTICS v_criteria_count = ROW_COUNT;
  ELSE
    SELECT COUNT(*) INTO v_criteria_count FROM period_criteria WHERE period_id = p_period_id;
  END IF;

  INSERT INTO period_outcomes (
    period_id, source_outcome_id, code, label, description, sort_order
  )
  SELECT p_period_id, fo.id, fo.code, fo.label, fo.description, fo.sort_order
  FROM framework_outcomes fo
  WHERE fo.framework_id = v_period.framework_id
  ON CONFLICT (period_id, code) DO NOTHING;

  GET DIAGNOSTICS v_outcomes_count = ROW_COUNT;

  -- Re-link mappings where existing period_criteria.source_criterion_id matches
  -- the new framework's criterion IDs. Unmatched criteria end up unmapped and
  -- can be remapped manually from the UI.
  INSERT INTO period_criterion_outcome_maps (
    period_id, period_criterion_id, period_outcome_id, coverage_type, weight
  )
  SELECT p_period_id, pc.id, po.id, fcom.coverage_type, fcom.weight
  FROM framework_criterion_outcome_maps fcom
  JOIN period_criteria pc ON pc.source_criterion_id = fcom.criterion_id AND pc.period_id = p_period_id
  JOIN period_outcomes po ON po.source_outcome_id = fcom.outcome_id AND po.period_id = p_period_id
  WHERE fcom.framework_id = v_period.framework_id
  ON CONFLICT DO NOTHING;

  UPDATE periods SET snapshot_frozen_at = now() WHERE id = p_period_id;

  RETURN json_build_object('ok', true, 'already_frozen', false, 'criteria_count', v_criteria_count, 'outcomes_count', v_outcomes_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_period_freeze_snapshot(UUID, BOOLEAN) TO authenticated;

-- =============================================================================
-- rpc_admin_period_unassign_framework
-- =============================================================================
-- Detach the framework from a period AND wipe the period's outcome snapshot
-- atomically. Without this, clearing `periods.framework_id` alone leaves
-- `period_outcomes` and `period_criterion_outcome_maps` rows behind, which
-- keeps showing up as stale mapping codes in CriteriaPage's Mapping column
-- (listPeriodCriteria joins through the mappings table).
--
-- `period_criteria` is intentionally preserved — criteria are independent
-- from outcomes per the project's data model. The DB cascade on
-- `period_criterion_outcome_maps.period_outcome_id` handles map deletion
-- when we drop period_outcomes.
CREATE OR REPLACE FUNCTION public.rpc_admin_period_unassign_framework(
  p_period_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period          periods%ROWTYPE;
  v_outcomes_count  INT;
  v_maps_count      INT;
BEGIN
  SELECT * INTO v_period FROM periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'period_not_found');
  END IF;

  PERFORM _assert_org_admin(v_period.organization_id);

  SELECT COUNT(*) INTO v_maps_count
  FROM period_criterion_outcome_maps
  WHERE period_id = p_period_id;

  SELECT COUNT(*) INTO v_outcomes_count
  FROM period_outcomes
  WHERE period_id = p_period_id;

  DELETE FROM period_criterion_outcome_maps WHERE period_id = p_period_id;
  DELETE FROM period_outcomes                 WHERE period_id = p_period_id;

  UPDATE periods
  SET framework_id        = NULL,
      snapshot_frozen_at  = NULL
  WHERE id = p_period_id;

  RETURN json_build_object(
    'ok', true,
    'outcomes_removed', v_outcomes_count,
    'mappings_removed', v_maps_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_period_unassign_framework(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- H) SYSTEM CONFIG
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- Maintenance Mode RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_public_maintenance_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row      maintenance_mode%ROWTYPE;
  v_now      TIMESTAMPTZ := now();
  v_live     BOOLEAN;
  v_upcoming BOOLEAN;
BEGIN
  -- SECURITY DEFINER + SET row_security = off ensures we can read the maintenance_mode
  -- table directly, even when called from anon context. This bypasses both RLS and the
  -- Postgres role restrictions that PostgREST might impose.
  SELECT * INTO v_row FROM public.maintenance_mode WHERE id = 1;

  -- Determine live state (with NULL safety)
  -- Use FOUND instead of v_row IS NOT NULL because SELECT INTO doesn't set a row to NULL
  -- when individual columns have NULL values. FOUND is the proper way to check if a row was found.
  IF FOUND AND v_row.is_active THEN
    IF v_row.mode = 'scheduled' THEN
      v_live := (v_row.start_time IS NOT NULL AND v_now >= v_row.start_time);
    ELSE
      v_live := true;
    END IF;
  ELSE
    v_live := false;
  END IF;

  -- Upcoming: scheduled and not yet started (show countdown banner)
  v_upcoming := (
    FOUND
    AND v_row.is_active
    AND v_row.mode = 'scheduled'
    AND v_row.start_time IS NOT NULL
    AND v_now < v_row.start_time
  );

  IF v_live AND v_row.end_time IS NOT NULL AND v_now > v_row.end_time THEN
    v_live := false;
  END IF;

  RETURN jsonb_build_object(
    'is_active',        COALESCE(v_live, false),
    'upcoming',         COALESCE(v_upcoming, false),
    'mode',             COALESCE(v_row.mode, 'immediate'),
    'start_time',       v_row.start_time,
    'end_time',         v_row.end_time,
    'message',          COALESCE(v_row.message, 'VERA is undergoing scheduled maintenance. We''ll be back shortly.'),
    'affected_org_ids', v_row.affected_org_ids
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_public_maintenance_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_get_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row maintenance_mode%ROWTYPE;
BEGIN
  IF NOT current_user_is_super_admin() THEN RAISE EXCEPTION 'super_admin required'; END IF;
  SELECT * INTO v_row FROM maintenance_mode WHERE id = 1;
  RETURN jsonb_build_object(
    'is_active', v_row.is_active, 'mode', v_row.mode,
    'start_time', v_row.start_time, 'end_time', v_row.end_time,
    'message', v_row.message, 'affected_org_ids', v_row.affected_org_ids,
    'notify_admins', v_row.notify_admins, 'updated_at', v_row.updated_at
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_get_maintenance() TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_set_maintenance(
  p_mode TEXT, p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_duration_min INT DEFAULT NULL, p_message TEXT DEFAULT NULL,
  p_affected_org_ids UUID[] DEFAULT NULL, p_notify_admins BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_end_time TIMESTAMPTZ;
  v_effective_start TIMESTAMPTZ;
BEGIN
  IF NOT current_user_is_super_admin() THEN RAISE EXCEPTION 'super_admin required'; END IF;
  IF p_mode NOT IN ('scheduled', 'immediate') THEN RAISE EXCEPTION 'invalid mode: %', p_mode; END IF;

  v_effective_start := CASE WHEN p_mode = 'immediate' THEN now() ELSE p_start_time END;
  IF p_duration_min IS NOT NULL AND v_effective_start IS NOT NULL THEN
    v_end_time := v_effective_start + (p_duration_min || ' minutes')::INTERVAL;
  END IF;

  UPDATE maintenance_mode SET
    is_active = true, mode = p_mode, start_time = v_effective_start,
    end_time = v_end_time, message = COALESCE(p_message, message),
    affected_org_ids = p_affected_org_ids, notify_admins = p_notify_admins,
    activated_by = auth.uid(), updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object('ok', true, 'start_time', v_effective_start, 'end_time', v_end_time)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_set_maintenance(TEXT, TIMESTAMPTZ, INT, TEXT, UUID[], BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_cancel_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT current_user_is_super_admin() THEN RAISE EXCEPTION 'super_admin required'; END IF;
  UPDATE maintenance_mode SET is_active = false, updated_at = now() WHERE id = 1;
  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_cancel_maintenance() TO authenticated;

-- =============================================================================
-- Security Policy RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_get_security_policy()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row security_policy%ROWTYPE;
BEGIN
  IF NOT current_user_is_super_admin() THEN RAISE EXCEPTION 'super_admin required'; END IF;
  SELECT * INTO v_row FROM security_policy WHERE id = 1;
  RETURN (v_row.policy || jsonb_build_object('updated_at', v_row.updated_at))::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_get_security_policy() TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_set_security_policy(p_policy JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_bool_fields  TEXT[] := ARRAY[
    'googleOAuth','emailPassword','rememberMe',
    'ccOnPinReset','ccOnScoreEdit','ccOnTenantApplication',
    'ccOnMaintenance','ccOnPasswordChanged'
  ];
  v_allowed_keys TEXT[] := ARRAY[
    'googleOAuth','emailPassword','rememberMe','qrTtl',
    'maxPinAttempts','pinLockCooldown',
    'ccOnPinReset','ccOnScoreEdit','ccOnTenantApplication',
    'ccOnMaintenance','ccOnPasswordChanged'
  ];
  v_key      TEXT;
  v_val      JSONB;
  v_attempts INT;
BEGIN
  IF NOT current_user_is_super_admin() THEN RAISE EXCEPTION 'super_admin required'; END IF;

  -- Reject unknown keys
  FOR v_key IN SELECT jsonb_object_keys(p_policy) LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'unknown_policy_key: %', v_key;
    END IF;
  END LOOP;

  -- Validate boolean fields
  FOREACH v_key IN ARRAY v_bool_fields LOOP
    v_val := p_policy -> v_key;
    IF v_val IS NOT NULL AND jsonb_typeof(v_val) != 'boolean' THEN
      RAISE EXCEPTION 'policy field % must be boolean', v_key;
    END IF;
  END LOOP;

  -- maxPinAttempts: integer 1–20
  v_val := p_policy -> 'maxPinAttempts';
  IF v_val IS NOT NULL THEN
    IF jsonb_typeof(v_val) != 'number' THEN
      RAISE EXCEPTION 'maxPinAttempts must be a number';
    END IF;
    v_attempts := (v_val #>> '{}')::INT;
    IF v_attempts < 1 OR v_attempts > 20 THEN
      RAISE EXCEPTION 'maxPinAttempts must be between 1 and 20';
    END IF;
  END IF;

  -- qrTtl: string matching ^\d+[hd]$
  v_val := p_policy -> 'qrTtl';
  IF v_val IS NOT NULL THEN
    IF jsonb_typeof(v_val) != 'string' OR (v_val #>> '{}') !~ '^\d+[hd]$' THEN
      RAISE EXCEPTION 'qrTtl must match pattern like "24h" or "7d"';
    END IF;
  END IF;

  -- pinLockCooldown: string matching ^\d+m$
  v_val := p_policy -> 'pinLockCooldown';
  IF v_val IS NOT NULL THEN
    IF jsonb_typeof(v_val) != 'string' OR (v_val #>> '{}') !~ '^\d+m$' THEN
      RAISE EXCEPTION 'pinLockCooldown must match pattern like "30m"';
    END IF;
  END IF;

  UPDATE security_policy
  SET policy = policy || p_policy, updated_by = auth.uid(), updated_at = now()
  WHERE id = 1;

  PERFORM public._audit_write(
    NULL,
    'security.policy.updated',
    'security_policy',
    NULL,
    'security'::audit_category,
    'high'::audit_severity,
    jsonb_build_object('updated_fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_policy) k))
  );

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_set_security_policy(JSONB) TO authenticated;

-- =============================================================================
-- rpc_admin_get_pin_policy — tenant admin + super admin
-- Returns maxPinAttempts, pinLockCooldown, and qrTtl from the platform policy.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_admin_get_pin_policy()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_policy JSONB;
BEGIN
  PERFORM _assert_tenant_admin('get_pin_policy');
  SELECT policy INTO v_policy FROM security_policy WHERE id = 1;
  RETURN jsonb_build_object(
    'maxPinAttempts',  COALESCE((v_policy->>'maxPinAttempts')::INT, 5),
    'pinLockCooldown', COALESCE(v_policy->>'pinLockCooldown', '30m'),
    'qrTtl',           COALESCE(v_policy->>'qrTtl', '24h')
  )::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_get_pin_policy() TO authenticated;

-- =============================================================================
-- rpc_admin_set_pin_policy — tenant admin + super admin
-- Writes maxPinAttempts, pinLockCooldown, and qrTtl; other policy fields untouched.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_admin_set_pin_policy(
  p_max_attempts INT,
  p_cooldown     TEXT,
  p_qr_ttl       TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  PERFORM _assert_tenant_admin('set_pin_policy');
  SELECT organization_id INTO v_org_id
  FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 THEN
    RAISE EXCEPTION 'invalid_max_attempts';
  END IF;
  IF p_cooldown IS NULL OR p_cooldown !~ '^\d+m$' THEN
    RAISE EXCEPTION 'invalid_cooldown';
  END IF;
  IF p_qr_ttl IS NULL OR p_qr_ttl !~ '^\d+[hd]$' THEN
    RAISE EXCEPTION 'invalid_qr_ttl';
  END IF;
  UPDATE security_policy
  SET
    policy     = policy || jsonb_build_object(
                   'maxPinAttempts', p_max_attempts,
                   'pinLockCooldown', p_cooldown,
                   'qrTtl', p_qr_ttl
                 ),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = 1;

  PERFORM public._audit_write(
    v_org_id,
    'security.pin_policy.updated',
    'security_policy',
    NULL,
    'security'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object(
      'maxPinAttempts', p_max_attempts,
      'pinLockCooldown', p_cooldown,
      'qrTtl', p_qr_ttl
    )
  );

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_set_pin_policy(INT, TEXT, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- H2) AUDIT WRITE HELPERS + PREMIUM ATOMIC RPCs
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- _audit_write
-- =============================================================================
-- Extracts IP/UA from PostgREST GUC headers, resolves actor_name from profiles
-- (with fallback to details fields for anon/juror flows), and inserts an audit row.

CREATE OR REPLACE FUNCTION public._audit_write(
  p_org_id          UUID,
  p_action          TEXT,
  p_resource_type   TEXT,
  p_resource_id     UUID,
  p_category        audit_category,
  p_severity        audit_severity,
  p_details         JSONB,
  p_diff            JSONB                DEFAULT NULL,
  p_actor_type      audit_actor_type     DEFAULT 'admin'::audit_actor_type,
  p_correlation_id  UUID                 DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_name         TEXT;
  v_actor_name_profile TEXT;
  v_ip                 INET;
  v_ua                 TEXT;
  v_req_headers        JSON;
  v_ip_raw             TEXT;
BEGIN
  -- For anon/juror flows, allow actor_name from details fallback.
  v_actor_name := NULLIF(
    trim(
      COALESCE(
        p_details->>'actor_name',
        p_details->>'juror_name',
        p_details->>'email',
        p_details->>'applicant_email',
        ''
      )
    ),
    ''
  );

  -- Prefer profile display_name when authenticated.
  IF auth.uid() IS NOT NULL THEN
    SELECT display_name INTO v_actor_name_profile
    FROM profiles
    WHERE id = auth.uid();
    v_actor_name := COALESCE(NULLIF(trim(v_actor_name_profile), ''), v_actor_name);
  END IF;

  -- PostgREST request headers (missing or non-JSON GUC must not abort caller).
  BEGIN
    v_req_headers := current_setting('request.headers', true)::JSON;
  EXCEPTION WHEN OTHERS THEN
    v_req_headers := NULL;
  END;

  IF v_req_headers IS NOT NULL THEN
    v_ua := NULLIF(v_req_headers->>'user-agent', '');
    -- Use trusted-proxy-depth aware extractor (P2.12).
    v_ip := public._audit_extract_client_ip(
      v_req_headers->>'x-forwarded-for',
      v_req_headers->>'x-real-ip'
    );
  END IF;

  INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id,
    category, severity, actor_type, actor_name,
    ip_address, user_agent, details, diff, correlation_id
  ) VALUES (
    p_org_id, auth.uid(), p_action, p_resource_type, p_resource_id,
    p_category, p_severity, p_actor_type, v_actor_name,
    v_ip, v_ua, p_details, p_diff, p_correlation_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._audit_write(
  UUID, TEXT, TEXT, UUID, audit_category, audit_severity, JSONB, JSONB, audit_actor_type, UUID
) TO authenticated;

-- =============================================================================
-- rpc_admin_write_audit_event
-- =============================================================================
-- Server enforces category + severity + actor_type; client cannot override.
-- IP/UA extracted from PostgREST headers with event-field fallback.

CREATE OR REPLACE FUNCTION public.rpc_admin_write_audit_event(
  p_event JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org_id        UUID;
  v_action        TEXT;
  v_category      audit_category;
  v_severity      audit_severity;
  v_actor_type    audit_actor_type;
  v_resource_type TEXT;
  v_resource_id   UUID;
  v_details       JSONB;
  v_diff          JSONB;
  v_ip            INET;
  v_ua            TEXT;
  v_session_id    UUID;
  v_corr_id       UUID;
  v_actor_name    TEXT;
  v_req_headers   JSON;
  v_ip_raw        TEXT;
BEGIN
  -- Caller must be an authenticated admin
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthenticated');
  END IF;

  v_action        := p_event->>'action';
  v_resource_type := p_event->>'resourceType';
  v_details       := COALESCE((p_event->'details')::JSONB, '{}'::JSONB);
  v_diff          := (p_event->'diff')::JSONB;

  -- Resolve org from details or explicit field
  v_org_id := CASE
    WHEN p_event->>'organizationId' IS NOT NULL
      THEN (p_event->>'organizationId')::UUID
    WHEN v_details->>'organizationId' IS NOT NULL
      THEN (v_details->>'organizationId')::UUID
    ELSE NULL
  END;

  -- Verify caller belongs to that org (or is super-admin)
  IF v_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid()
        AND (organization_id = v_org_id OR organization_id IS NULL)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized');
    END IF;
  END IF;

  IF p_event->>'resourceId' IS NOT NULL THEN
    v_resource_id := (p_event->>'resourceId')::UUID;
  END IF;

  -- ── IP / UA extraction ───────────────────────────────────────────────────
  BEGIN
    v_req_headers := current_setting('request.headers', true)::JSON;
  EXCEPTION WHEN OTHERS THEN
    v_req_headers := NULL;
  END;

  v_ua := COALESCE(
    NULLIF(p_event->>'ua', ''),
    NULLIF(v_req_headers->>'user-agent', '')
  );

  IF p_event->>'ip' IS NOT NULL AND p_event->>'ip' <> '' THEN
    BEGIN
      v_ip := (p_event->>'ip')::INET;
    EXCEPTION WHEN OTHERS THEN
      v_ip := NULL;
    END;
  END IF;

  IF v_ip IS NULL AND v_req_headers IS NOT NULL THEN
    v_ip_raw := NULLIF(trim(split_part(v_req_headers->>'x-forwarded-for', ',', 1)), '');
    IF v_ip_raw IS NULL THEN
      v_ip_raw := NULLIF(trim(COALESCE(v_req_headers->>'x-real-ip', '')), '');
    END IF;
    IF v_ip_raw IS NOT NULL THEN
      BEGIN
        v_ip := v_ip_raw::INET;
      EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
      END;
    END IF;
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────

  v_session_id := (p_event->>'sessionId')::UUID;
  v_corr_id    := (p_event->>'correlationId')::UUID;
  v_actor_name := COALESCE(v_details->>'actor_name', v_details->>'adminName');

  -- ── Category ─────────────────────────────────────────────────────────────
  v_category := CASE
    WHEN v_action IN (
      'admin.login', 'admin.logout', 'admin.session_expired',
      'auth.admin.login.success', 'auth.admin.login.failure',
      'auth.admin.password.changed', 'auth.admin.password.reset.requested'
    ) THEN 'auth'

    WHEN v_action IN (
      'admin.create', 'admin.updated', 'admin.role_granted', 'admin.role_revoked'
    ) THEN 'access'

    WHEN v_action IN (
      'period.create', 'period.update', 'period.delete',
      'period.lock', 'period.unlock',
      'periods.insert', 'periods.update', 'periods.delete',
      'criteria.save', 'criteria.update',
      'outcome.create', 'outcome.update', 'outcome.delete',
      'outcome.created', 'outcome.updated', 'outcome.deleted',
      'organization.status_changed',
      'framework.create', 'framework.update', 'framework.delete',
      'config.outcome.updated', 'config.outcome.deleted'
    ) THEN 'config'

    WHEN v_action LIKE 'export.%'
      OR v_action LIKE 'notification.%'
      OR v_action LIKE 'backup.%'
      OR v_action LIKE 'token.%'
      OR v_action LIKE 'security.%'
    THEN 'security'

    ELSE 'data'
  END::audit_category;

  -- ── Severity ─────────────────────────────────────────────────────────────
  v_severity := CASE
    WHEN v_action IN (
      'period.lock', 'period.unlock',
      'organization.status_changed',
      'backup.deleted',
      'security.entry_token.revoked',
      'security.anomaly.detected'
    ) THEN 'high'

    WHEN v_action IN (
      'admin.create',
      'pin.reset',
      'juror.pin_unlocked', 'juror.edit_mode_enabled',
      'snapshot.freeze',
      'application.approved', 'application.rejected',
      'token.revoke',
      'export.audit',
      'backup.downloaded',
      'criteria.save', 'criteria.update',
      'outcome.create', 'outcome.update', 'outcome.delete',
      'outcome.created', 'outcome.updated', 'outcome.deleted',
      'config.outcome.updated',
      'auth.admin.password.changed',
      'data.juror.edit_mode.force_closed'
    ) THEN 'medium'

    WHEN v_action IN (
      'admin.updated',
      'juror.edit_mode_closed_on_resubmit',
      'token.generate',
      'export.scores', 'export.rankings', 'export.heatmap',
      'export.analytics', 'export.backup',
      'backup.created',
      'config.outcome.deleted',
      'auth.admin.password.reset.requested',
      'notification.entry_token', 'notification.juror_pin',
      'notification.export_report', 'notification.admin_invite',
      'notification.application'
    ) THEN 'low'

    ELSE 'info'
  END::audit_severity;

  -- ── Actor type ───────────────────────────────────────────────────────────
  v_actor_type := CASE
    WHEN v_action IN (
      'evaluation.complete', 'score.update', 'data.score.submitted'
    ) THEN 'juror'

    WHEN v_action IN (
      'snapshot.freeze',
      'juror.pin_locked', 'data.juror.pin.locked',
      'juror.edit_mode_closed_on_resubmit', 'data.juror.edit_mode.closed',
      'security.anomaly.detected'
    ) THEN 'system'

    ELSE 'admin'
  END::audit_actor_type;
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id,
    category, severity, actor_type, actor_name,
    ip_address, user_agent, session_id, correlation_id,
    details, diff
  ) VALUES (
    v_org_id, auth.uid(), v_action, v_resource_type, v_resource_id,
    v_category, v_severity, v_actor_type, v_actor_name,
    v_ip, v_ua, v_session_id, v_corr_id,
    v_details, v_diff
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_write_audit_event(JSONB) TO authenticated;

-- =============================================================================
-- rpc_admin_log_period_lock
-- =============================================================================
-- Called by admin panel when locking/unlocking an evaluation period.
-- Validates action, asserts org-admin, delegates to _audit_write (category='config').

CREATE OR REPLACE FUNCTION public.rpc_admin_log_period_lock(
  p_period_id UUID,
  p_action    TEXT,   -- 'period.lock' | 'period.unlock'
  p_ctx       JSONB   -- {ip, ua, session_id}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org_id      UUID;
  v_period_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthenticated');
  END IF;

  SELECT organization_id, name INTO v_org_id, v_period_name
  FROM periods WHERE id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_not_found');
  END IF;

  IF p_action NOT IN ('period.lock', 'period.unlock') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_action');
  END IF;

  PERFORM public._assert_org_admin(v_org_id);

  PERFORM public._audit_write(
    v_org_id,
    p_action,
    'periods',
    p_period_id,
    'config'::audit_category,
    'high'::audit_severity,
    jsonb_build_object(
      'periodName', v_period_name,
      'period_id',  p_period_id,
      'legacy_ctx', COALESCE(p_ctx, '{}'::jsonb)
    ),
    NULL::JSONB,
    'admin'::audit_actor_type
  );

  RETURN jsonb_build_object('ok', true, 'periodName', v_period_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_log_period_lock(UUID, TEXT, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- I) PUBLIC AUTH HELPERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- rpc_check_email_available
-- Public RPC callable by anon. Uses SECURITY DEFINER to access auth.users.
-- Returns { available: bool, reason?: 'email_already_registered' | 'application_already_pending' }
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_check_email_available(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email      TEXT;
  v_in_auth    BOOLEAN;
  v_in_pending BOOLEAN;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email = '' OR v_email IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'email_required');
  END IF;

  -- Check auth.users (SECURITY DEFINER allows access to auth schema)
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE lower(email) = v_email
  ) INTO v_in_auth;

  IF v_in_auth THEN
    RETURN jsonb_build_object('available', false, 'reason', 'email_already_registered');
  END IF;

  -- Check for a pending application with the same email
  SELECT EXISTS(
    SELECT 1 FROM org_applications
    WHERE lower(trim(contact_email)) = v_email
      AND status = 'pending'
  ) INTO v_in_pending;

  IF v_in_pending THEN
    RETURN jsonb_build_object('available', false, 'reason', 'application_already_pending');
  END IF;

  RETURN jsonb_build_object('available', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_check_email_available(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION rpc_check_email_available(TEXT) TO authenticated;

-- =============================================================================
-- rpc_public_auth_flags
-- =============================================================================
-- Returns only the three public-facing auth toggles from security_policy.
-- Callable by anon (login screen uses this to hide disabled auth methods).

CREATE OR REPLACE FUNCTION public.rpc_public_auth_flags()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
BEGIN
  SELECT policy INTO v_policy FROM security_policy WHERE id = 1;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'googleOAuth',   true,
      'emailPassword', true,
      'rememberMe',    true
    );
  END IF;
  RETURN json_build_object(
    'googleOAuth',   COALESCE((v_policy->>'googleOAuth')::BOOLEAN,   true),
    'emailPassword', COALESCE((v_policy->>'emailPassword')::BOOLEAN, true),
    'rememberMe',    COALESCE((v_policy->>'rememberMe')::BOOLEAN,    true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_public_auth_flags() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- J) JOIN REQUEST FLOW
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- rpc_public_search_organizations
-- =============================================================================
-- Anon-accessible search for the registration org-discovery dropdown.
-- Returns only non-sensitive data: name, member count.

CREATE OR REPLACE FUNCTION public.rpc_public_search_organizations(p_query TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSON;
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN '[]'::JSON;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
  INTO v_results
  FROM (
    SELECT
      o.id,
      o.name,
      (SELECT count(*) FROM memberships m
       WHERE m.organization_id = o.id AND m.status = 'active') AS member_count
    FROM organizations o
    WHERE o.status = 'active'
      AND LOWER(o.name) LIKE LOWER(trim(p_query)) || '%'
    ORDER BY o.name
    LIMIT 20
  ) r;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_public_search_organizations(TEXT) TO anon, authenticated;

-- =============================================================================
-- rpc_request_to_join_org
-- =============================================================================
-- Authenticated user requests to join an existing organization.
-- Creates a membership row with status='requested'.

CREATE OR REPLACE FUNCTION public.rpc_request_to_join_org(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_org_name   TEXT;
  v_existing   TEXT;
  v_membership UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated')::JSON;
  END IF;

  -- Verify organization exists and is active
  SELECT name INTO v_org_name
  FROM organizations WHERE id = p_org_id AND status = 'active';

  IF v_org_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'org_not_found')::JSON;
  END IF;

  -- Check for existing membership (any status)
  SELECT status INTO v_existing
  FROM memberships WHERE user_id = v_user_id AND organization_id = p_org_id;

  IF v_existing = 'active' OR v_existing = 'invited' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'already_member')::JSON;
  END IF;
  IF v_existing = 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'already_requested')::JSON;
  END IF;

  -- Ensure profile row exists (Google OAuth safety)
  INSERT INTO profiles(id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;

  -- Create requested membership
  INSERT INTO memberships (user_id, organization_id, role, status)
  VALUES (v_user_id, p_org_id, 'org_admin', 'requested')
  RETURNING id INTO v_membership;

  -- Audit
  PERFORM public._audit_write(
    p_org_id,
    'membership.join_requested',
    'memberships',
    v_membership,
    'access'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('org_name', v_org_name, 'requester_id', v_user_id)
  );

  RETURN jsonb_build_object('ok', true, 'membership_id', v_membership)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_request_to_join_org(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_approve_join_request
-- =============================================================================
-- Org admin promotes a 'requested' membership to 'active'.

CREATE OR REPLACE FUNCTION public.rpc_admin_approve_join_request(p_membership_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID;
  v_user_id    UUID;
  v_org_name   TEXT;
  v_user_email TEXT;
BEGIN
  -- Find the requested membership
  SELECT organization_id, user_id INTO v_org_id, v_user_id
  FROM memberships
  WHERE id = p_membership_id AND status = 'requested';

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'request_not_found')::JSON;
  END IF;

  -- Verify caller is org admin
  PERFORM public._assert_org_admin(v_org_id);

  -- Promote to active
  UPDATE memberships SET status = 'active' WHERE id = p_membership_id;

  -- Gather context for audit
  SELECT name INTO v_org_name FROM organizations WHERE id = v_org_id;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  PERFORM public._audit_write(
    v_org_id,
    'membership.join_approved',
    'memberships',
    p_membership_id,
    'access'::audit_category,
    'high'::audit_severity,
    jsonb_build_object(
      'org_name', v_org_name,
      'approved_user_id', v_user_id,
      'approved_user_email', v_user_email,
      'approved_by', auth.uid()
    ),
    jsonb_build_object('before', jsonb_build_object('status', 'requested'), 'after', jsonb_build_object('status', 'active'))
  );

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_approve_join_request(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_reject_join_request
-- =============================================================================
-- Org admin rejects and deletes a 'requested' membership.

CREATE OR REPLACE FUNCTION public.rpc_admin_reject_join_request(p_membership_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID;
  v_user_id    UUID;
  v_org_name   TEXT;
  v_user_email TEXT;
BEGIN
  -- Find the requested membership
  SELECT organization_id, user_id INTO v_org_id, v_user_id
  FROM memberships
  WHERE id = p_membership_id AND status = 'requested';

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'request_not_found')::JSON;
  END IF;

  -- Verify caller is org admin
  PERFORM public._assert_org_admin(v_org_id);

  -- Gather context for audit before deletion
  SELECT name INTO v_org_name FROM organizations WHERE id = v_org_id;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Delete the requested membership
  DELETE FROM memberships WHERE id = p_membership_id;

  PERFORM public._audit_write(
    v_org_id,
    'membership.join_rejected',
    'memberships',
    p_membership_id,
    'access'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object(
      'org_name', v_org_name,
      'rejected_user_id', v_user_id,
      'rejected_user_email', v_user_email,
      'rejected_by', auth.uid()
    )
  );

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_join_request(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_clone_framework
-- Deep-clones a framework (rows, outcomes, criteria, maps) into a new
-- org-owned copy. Used by OutcomesPage and period setup.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_clone_framework(
  p_framework_id UUID,
  p_new_name     TEXT,
  p_org_id       UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_is_admin    BOOLEAN;
  v_new_fw_id   UUID;
  v_outcome_map JSONB := '{}';
  v_crit_map    JSONB := '{}';
  r             RECORD;
  v_new_id      UUID;
BEGIN
  -- Auth: caller must be admin (or super-admin) of p_org_id
  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = p_org_id OR organization_id IS NULL)
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validate source framework exists and is accessible to this org
  IF NOT EXISTS(
    SELECT 1 FROM frameworks
    WHERE id = p_framework_id
      AND (organization_id IS NULL OR organization_id = p_org_id)
  ) THEN
    RAISE EXCEPTION 'framework_not_found';
  END IF;

  -- 1. Clone the frameworks row
  INSERT INTO frameworks (
    organization_id, name, description, default_threshold
  )
  SELECT
    p_org_id, p_new_name, description, default_threshold
  FROM frameworks
  WHERE id = p_framework_id
  RETURNING id INTO v_new_fw_id;

  -- 2. Clone framework_outcomes, track old→new UUID mapping
  FOR r IN
    SELECT * FROM framework_outcomes
    WHERE framework_id = p_framework_id
    ORDER BY sort_order
  LOOP
    INSERT INTO framework_outcomes (framework_id, code, label, description, sort_order)
    VALUES (v_new_fw_id, r.code, r.label, r.description, r.sort_order)
    RETURNING id INTO v_new_id;

    v_outcome_map := v_outcome_map || jsonb_build_object(r.id::TEXT, v_new_id::TEXT);
  END LOOP;

  -- 3. Clone framework_criteria, track old→new UUID mapping
  FOR r IN
    SELECT * FROM framework_criteria
    WHERE framework_id = p_framework_id
    ORDER BY sort_order
  LOOP
    INSERT INTO framework_criteria (
      framework_id, key, label, description,
      max_score, weight, color, rubric_bands, sort_order
    )
    VALUES (
      v_new_fw_id, r.key, r.label, r.description,
      r.max_score, r.weight, r.color, r.rubric_bands, r.sort_order
    )
    RETURNING id INTO v_new_id;

    v_crit_map := v_crit_map || jsonb_build_object(r.id::TEXT, v_new_id::TEXT);
  END LOOP;

  -- 4. Clone framework_criterion_outcome_maps with remapped IDs
  FOR r IN
    SELECT * FROM framework_criterion_outcome_maps
    WHERE framework_id = p_framework_id
  LOOP
    -- Skip orphaned maps (shouldn't exist, but guard against it)
    CONTINUE WHEN (v_crit_map ->> r.criterion_id::TEXT) IS NULL;
    CONTINUE WHEN (v_outcome_map ->> r.outcome_id::TEXT) IS NULL;

    INSERT INTO framework_criterion_outcome_maps (
      framework_id, criterion_id, outcome_id, coverage_type, weight
    )
    VALUES (
      v_new_fw_id,
      (v_crit_map ->> r.criterion_id::TEXT)::UUID,
      (v_outcome_map ->> r.outcome_id::TEXT)::UUID,
      r.coverage_type,
      r.weight
    );
  END LOOP;

  RETURN v_new_fw_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_clone_framework(UUID, TEXT, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- rpc_admin_duplicate_period
-- Clones an existing period's configuration into a brand-new period:
--   • new periods row ("<name> (copy)", same season/description, dates NULL,
--     is_locked=false, criteria_name copied)
--   • if source has a framework, clones it ("<framework_name> (copy)") and
--     attaches to the new period
--   • freezes the snapshot so period_criteria / period_outcomes /
--     period_criterion_outcome_maps are populated immediately
-- Does NOT copy runtime data (projects, jurors, scores, tokens, audit).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_admin_duplicate_period(
  p_source_period_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_src            periods%ROWTYPE;
  v_new_period_id  UUID;
  v_new_name       TEXT;
  v_new_fw_name    TEXT;
  v_new_fw_id      UUID;
  v_src_fw_name    TEXT;
BEGIN
  SELECT * INTO v_src FROM periods WHERE id = p_source_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  PERFORM public._assert_org_admin(v_src.organization_id);

  v_new_name := v_src.name || ' (copy)';

  -- Clone framework first (if any), so new period owns an independent config
  -- and edits to its criteria/outcomes don't leak back to the source.
  IF v_src.framework_id IS NOT NULL THEN
    SELECT name INTO v_src_fw_name FROM frameworks WHERE id = v_src.framework_id;
    v_new_fw_name := COALESCE(v_src_fw_name, 'Framework') || ' (copy)';
    v_new_fw_id := public.rpc_admin_clone_framework(
      v_src.framework_id,
      v_new_fw_name,
      v_src.organization_id
    );
  END IF;

  INSERT INTO periods (
    organization_id, framework_id, name, season, description,
    start_date, end_date, is_locked, criteria_name
  ) VALUES (
    v_src.organization_id,
    v_new_fw_id,
    v_new_name,
    v_src.season,
    v_src.description,
    NULL,
    NULL,
    false,
    v_src.criteria_name
  )
  RETURNING id INTO v_new_period_id;

  -- Freeze the snapshot so period_criteria / period_outcomes / maps are
  -- populated right away. Non-fatal if it fails (no framework case).
  IF v_new_fw_id IS NOT NULL THEN
    PERFORM public.rpc_period_freeze_snapshot(v_new_period_id, false);
  END IF;

  RETURN v_new_period_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_duplicate_period(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- rpc_admin_set_period_criteria_name
-- Sets criteria_name on a period to record that criteria setup has been
-- initiated (e.g. "Custom Criteria" for blank start, or a framework name).
-- Passing NULL clears the name (resets to unconfigured state).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_admin_set_period_criteria_name(
  p_period_id UUID,
  p_name      TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;
  PERFORM public._assert_org_admin(v_org_id);
  UPDATE periods
  SET criteria_name = p_name,
      updated_at    = now()
  WHERE id = p_period_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_set_period_criteria_name(UUID, TEXT) TO authenticated;

-- =============================================================================
-- rpc_admin_delete_organization
-- Hard-deletes an organization + all CASCADE children after writing audit log.
-- Caller must be a super-admin (_assert_super_admin raises on failure).
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_admin_delete_organization(
  p_org_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_super_admin();

  -- Capture org snapshot for audit before deletion
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  SELECT p_org_id, auth.uid(), 'delete_organization', 'organization', p_org_id,
         row_to_json(o)::jsonb
  FROM organizations o WHERE o.id = p_org_id;

  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_admin_delete_organization(UUID) TO authenticated;

-- =============================================================================
-- rpc_admin_hard_delete_org_member
-- =============================================================================
-- Super-admin only. Removes a membership row (active or invited) for a given
-- user+org pair, then deletes the auth user if they have no other memberships.

CREATE OR REPLACE FUNCTION public.rpc_admin_hard_delete_org_member(
  p_user_id UUID,
  p_org_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id UUID;
BEGIN
  PERFORM public._assert_super_admin();

  SELECT id INTO v_membership_id
  FROM memberships
  WHERE user_id = p_user_id AND organization_id = p_org_id;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'membership_not_found';
  END IF;

  DELETE FROM memberships WHERE id = v_membership_id;

  PERFORM public._audit_write(
    p_org_id,
    'org.admin.remove',
    'membership',
    v_membership_id,
    'security'::audit_category,
    'high'::audit_severity,
    jsonb_build_object('removed_user_id', p_user_id)
  );

  -- Remove orphaned auth user (no remaining memberships in any org)
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = p_user_id) THEN
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_hard_delete_org_member(UUID, UUID) TO authenticated;

-- =============================================================================
-- _assert_tenant_admin (Phase 2 — Level B email-verification gate)
-- =============================================================================
-- Called at the start of Level B RPCs to enforce email verification during the
-- grace period and block action after grace expiry.
--
-- Level B action keys:
--   juror_invite, admin_invite, generate_entry_token,
--   jury_notify, report_email, archive_organization
--
-- Exemptions:
--   • Super-admins (memberships.organization_id IS NULL)
--   • Users whose grace_ends_at IS NULL (pre-migration or invite-path users)
--   • Users whose profiles.email_verified_at IS NOT NULL (verified via custom flow)
--
-- Raises:
--   email_verification_required      — email unverified, grace window still open
--   email_verification_grace_expired — email unverified, grace window has closed

CREATE OR REPLACE FUNCTION public._assert_tenant_admin(
  p_action TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_grace_ends_at  TIMESTAMPTZ;
  v_org_id         UUID;
  v_level_b        CONSTANT TEXT[] := ARRAY[
    'juror_invite',
    'admin_invite',
    'generate_entry_token',
    'jury_notify',
    'report_email',
    'archive_organization'
  ];
BEGIN
  -- Load the caller's active tenant membership (non-super-admin rows only).
  -- If the caller has no tenant membership (is a super-admin or unauthenticated),
  -- v_org_id stays NULL and we return early — super-admins are exempt.
  SELECT m.grace_ends_at, m.organization_id
  INTO v_grace_ends_at, v_org_id
  FROM public.memberships m
  WHERE m.user_id = auth.uid()
    AND m.status  = 'active'
    AND m.organization_id IS NOT NULL
  ORDER BY m.grace_ends_at DESC NULLS LAST
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Only enforce for Level B actions; pass-through for all others.
  IF p_action IS NULL OR NOT (p_action = ANY(v_level_b)) THEN
    RETURN;
  END IF;

  -- grace_ends_at NULL → pre-migration user or invite-path signup → always allowed.
  IF v_grace_ends_at IS NULL THEN
    RETURN;
  END IF;

  -- Verified email → allowed.
  IF public.email_is_verified(auth.uid()) THEN
    RETURN;
  END IF;

  -- Unverified but grace window still open → allow through (banner shown on client).
  IF v_grace_ends_at >= now() THEN
    RETURN;
  END IF;

  -- Unverified, grace window has closed → block.
  RAISE EXCEPTION 'email_verification_grace_expired'
    USING HINT = 'Your email verification grace period has expired. Please verify your email to continue.';
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_tenant_admin(TEXT) TO authenticated;

-- =============================================================================
-- =============================================================================
-- rpc_org_admin_list_members — list active + invited members for caller's org
-- =============================================================================
-- Returns an object of shape:
--   { "members": [ { ..., "is_owner": bool, "is_you": bool } ], "admins_can_invite": bool }
-- The top-level admins_can_invite field reflects the org's delegation setting
-- so the UI can decide whether non-owner admins see the Invite button.

DROP FUNCTION IF EXISTS public.rpc_org_admin_list_members();

CREATE OR REPLACE FUNCTION public.rpc_org_admin_list_members()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id  UUID;
  v_members JSONB;
  v_flag    boolean;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE((settings->>'admins_can_invite')::boolean, false)
  INTO v_flag
  FROM organizations
  WHERE id = v_org_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',           m.id,
      'user_id',      m.user_id,
      'status',       m.status,
      'created_at',   m.created_at,
      'display_name', p.display_name,
      'email',        u.email,
      'is_owner',     m.is_owner,
      'is_you',       (m.user_id = auth.uid())
    )
  ), '[]'::jsonb)
  INTO v_members
  FROM memberships m
  LEFT JOIN profiles p   ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = v_org_id
    AND m.status IN ('active', 'invited');

  RETURN jsonb_build_object(
    'members', v_members,
    'admins_can_invite', COALESCE(v_flag, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_list_members() TO authenticated;

-- =============================================================================
-- rpc_org_admin_transfer_ownership
-- =============================================================================
-- Owner-only. Transfers ownership to another active org_admin in the same org.
-- After transfer, caller remains on the team as a regular org_admin.

CREATE OR REPLACE FUNCTION public.rpc_org_admin_transfer_ownership(
  p_target_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id       UUID;
  v_target_user  UUID;
  v_target_status TEXT;
  v_target_role  TEXT;
  v_target_owner boolean;
  v_caller_membership UUID;
BEGIN
  -- Load target row and its org.
  SELECT organization_id, user_id, status, role, is_owner
    INTO v_org_id, v_target_user, v_target_status, v_target_role, v_target_owner
  FROM memberships
  WHERE id = p_target_membership_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  -- Caller must be owner of this org (or super-admin).
  PERFORM public._assert_tenant_owner(v_org_id);

  IF v_target_status <> 'active' OR v_target_role <> 'org_admin' OR v_target_owner THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  IF v_target_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot_transfer_to_self';
  END IF;

  -- Find caller's membership in this org.
  SELECT id INTO v_caller_membership
  FROM memberships
  WHERE organization_id = v_org_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  -- Two-step update in a single transaction. Unique index allows the
  -- intermediate state (zero owners) momentarily; constraint is enforced at
  -- statement boundary, not row boundary.
  UPDATE memberships SET is_owner = false WHERE id = v_caller_membership;
  UPDATE memberships SET is_owner = true  WHERE id = p_target_membership_id;

  -- Audit
  PERFORM public._audit_write(
    v_org_id,
    'org.ownership.transfer',
    'membership',
    p_target_membership_id,
    'security'::audit_category,
    'high'::audit_severity,
    jsonb_build_object(
      'from_user_id', auth.uid(),
      'to_user_id',   v_target_user
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'new_owner_user_id', v_target_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_transfer_ownership(UUID) TO authenticated;

-- =============================================================================
-- rpc_org_admin_remove_member
-- =============================================================================
-- Owner-only. Deletes a membership row (active or invited).
-- Cannot remove the owner's own row; ownership must be transferred first.

CREATE OR REPLACE FUNCTION public.rpc_org_admin_remove_member(
  p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID;
  v_target_user UUID;
  v_is_owner   boolean;
BEGIN
  SELECT organization_id, user_id, is_owner
    INTO v_org_id, v_target_user, v_is_owner
  FROM memberships
  WHERE id = p_membership_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  PERFORM public._assert_tenant_owner(v_org_id);

  IF v_is_owner THEN
    RAISE EXCEPTION 'cannot_remove_owner';
  END IF;

  DELETE FROM memberships WHERE id = p_membership_id;

  PERFORM public._audit_write(
    v_org_id,
    'org.admin.remove',
    'membership',
    p_membership_id,
    'security'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('removed_user_id', v_target_user)
  );

  -- Remove orphaned auth user (no remaining memberships in any org)
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = v_target_user) THEN
    DELETE FROM public.profiles WHERE id = v_target_user;
    DELETE FROM auth.users WHERE id = v_target_user;
  END IF;

  RETURN jsonb_build_object('ok', true, 'membership_id', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_remove_member(UUID) TO authenticated;

-- =============================================================================
-- rpc_org_admin_set_admins_can_invite
-- =============================================================================
-- Owner-only. Toggles organizations.settings.admins_can_invite for p_org_id.

CREATE OR REPLACE FUNCTION public.rpc_org_admin_set_admins_can_invite(
  p_org_id  UUID,
  p_enabled boolean
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_tenant_owner(p_org_id);

  UPDATE organizations
  SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{admins_can_invite}',
        to_jsonb(p_enabled),
        true
      ),
      updated_at = now()
  WHERE id = p_org_id;

  PERFORM public._audit_write(
    p_org_id,
    'org.settings.admins_can_invite',
    'organization',
    p_org_id,
    'config'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('enabled', p_enabled)
  );

  RETURN jsonb_build_object('ok', true, 'enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_set_admins_can_invite(UUID, boolean) TO authenticated;

