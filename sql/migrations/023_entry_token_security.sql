-- ============================================================
-- Migration 023: Entry Token Security Enhancements
-- ============================================================
-- 1. Token auto-expiry: 24h TTL on generate (both v1 + v2)
-- 2. Revoke → lock: sets is_locked = true + returns active session count
-- 3. Status: includes active_juror_count
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- GENERATE v2 (JWT) — add 24h TTL
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_admin_entry_token_generate(p_semester_id uuid)
RETURNS TABLE (raw_token text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_raw text; v_hash text; v_sn text;
BEGIN
  PERFORM public._assert_semester_access(p_semester_id);
  v_raw := encode(gen_random_bytes(24), 'base64');
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  UPDATE semesters SET entry_token_hash = v_hash, entry_token_enabled = true,
    entry_token_created_at = now(), entry_token_expires_at = now() + interval '1 day', updated_at = now()
  WHERE id = p_semester_id RETURNING semester_name INTO v_sn;
  IF NOT FOUND THEN RAISE EXCEPTION 'semester_not_found'; END IF;
  PERFORM public._audit_log('admin', auth.uid(), 'entry_token_generate', 'semester', p_semester_id,
    format('Jury entry token generated with 24h TTL (%s)', coalesce(v_sn, p_semester_id::text)),
    jsonb_build_object('semester_id', p_semester_id, 'semester_name', v_sn));
  RETURN QUERY SELECT v_raw;
END; $$;

-- ═══════════════════════════════════════════════════════════════
-- GENERATE v1 (password) — add 24h TTL
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.rpc_admin_generate_entry_token(uuid, text, text);
CREATE OR REPLACE FUNCTION public.rpc_admin_generate_entry_token(
  p_semester_id uuid, p_admin_password text, p_rpc_secret text DEFAULT ''
) RETURNS TABLE (raw_token text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_raw text; v_hash text; v_sn text;
BEGIN
  IF NOT public._verify_admin_password(p_admin_password, p_rpc_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0401'; END IF;
  v_raw := encode(gen_random_bytes(24), 'base64');
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  UPDATE semesters SET entry_token_hash = v_hash, entry_token_enabled = true,
    entry_token_created_at = now(), entry_token_expires_at = now() + interval '1 day', updated_at = now()
  WHERE id = p_semester_id RETURNING semester_name INTO v_sn;
  IF NOT FOUND THEN RAISE EXCEPTION 'semester_not_found'; END IF;
  PERFORM public._audit_log('admin', null::uuid, 'entry_token_generate', 'semester', p_semester_id,
    format('Jury entry token generated with 24h TTL (%s)', coalesce(v_sn, p_semester_id::text)),
    jsonb_build_object('semester_id', p_semester_id, 'semester_name', v_sn));
  RETURN QUERY SELECT v_raw;
END; $$;

-- ═══════════════════════════════════════════════════════════════
-- REVOKE v2 (JWT) — lock semester + return active session count
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.rpc_admin_entry_token_revoke(uuid);
CREATE OR REPLACE FUNCTION public.rpc_admin_entry_token_revoke(p_semester_id uuid)
RETURNS TABLE (success boolean, active_juror_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_sn text; v_active integer;
BEGIN
  PERFORM public._assert_semester_access(p_semester_id);
  UPDATE semesters SET entry_token_enabled = false, is_locked = true, updated_at = now()
  WHERE id = p_semester_id RETURNING semester_name INTO v_sn;
  IF NOT FOUND THEN RAISE EXCEPTION 'semester_not_found'; END IF;

  SELECT count(*)::integer INTO v_active
  FROM juror_semester_auth
  WHERE semester_id = p_semester_id AND session_expires_at > now();

  PERFORM public._audit_log('admin', auth.uid(), 'entry_token_revoke', 'semester', p_semester_id,
    format('Jury entry token revoked and evaluations locked (%s). %s active session(s).',
      coalesce(v_sn, p_semester_id::text), v_active),
    jsonb_build_object('semester_id', p_semester_id, 'semester_name', v_sn, 'active_sessions', v_active));
  RETURN QUERY SELECT true, v_active;
END; $$;

-- ═══════════════════════════════════════════════════════════════
-- REVOKE v1 (password) — lock semester + return active session count
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.rpc_admin_revoke_entry_token(uuid, text, text);
CREATE OR REPLACE FUNCTION public.rpc_admin_revoke_entry_token(
  p_semester_id uuid, p_admin_password text, p_rpc_secret text DEFAULT ''
) RETURNS TABLE (success boolean, active_juror_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_sn text; v_active integer;
BEGIN
  IF NOT public._verify_admin_password(p_admin_password, p_rpc_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0401'; END IF;
  UPDATE semesters SET entry_token_enabled = false, is_locked = true, updated_at = now()
  WHERE id = p_semester_id RETURNING semester_name INTO v_sn;
  IF NOT FOUND THEN RAISE EXCEPTION 'semester_not_found'; END IF;

  SELECT count(*)::integer INTO v_active
  FROM juror_semester_auth
  WHERE semester_id = p_semester_id AND session_expires_at > now();

  PERFORM public._audit_log('admin', null::uuid, 'entry_token_revoke', 'semester', p_semester_id,
    format('Jury entry token revoked and evaluations locked (%s). %s active session(s).',
      coalesce(v_sn, p_semester_id::text), v_active),
    jsonb_build_object('semester_id', p_semester_id, 'semester_name', v_sn, 'active_sessions', v_active));
  RETURN QUERY SELECT true, v_active;
END; $$;

-- ═══════════════════════════════════════════════════════════════
-- STATUS v2 (JWT) — add active_juror_count
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.rpc_admin_entry_token_status(uuid);
CREATE OR REPLACE FUNCTION public.rpc_admin_entry_token_status(p_semester_id uuid)
RETURNS TABLE (enabled boolean, created_at timestamptz, expires_at timestamptz, has_token boolean, active_juror_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_sem semesters%ROWTYPE; v_active integer;
BEGIN
  PERFORM public._assert_semester_access(p_semester_id);
  SELECT * INTO v_sem FROM semesters WHERE id = p_semester_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'semester_not_found'; END IF;

  SELECT count(*)::integer INTO v_active
  FROM juror_semester_auth
  WHERE semester_id = p_semester_id AND session_expires_at > now();

  RETURN QUERY SELECT v_sem.entry_token_enabled, v_sem.entry_token_created_at,
    v_sem.entry_token_expires_at, (v_sem.entry_token_hash IS NOT NULL), v_active;
END; $$;

-- ═══════════════════════════════════════════════════════════════
-- STATUS v1 (password) — add active_juror_count
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.rpc_admin_get_entry_token_status(uuid, text, text);
CREATE OR REPLACE FUNCTION public.rpc_admin_get_entry_token_status(
  p_semester_id uuid, p_admin_password text, p_rpc_secret text DEFAULT ''
) RETURNS TABLE (enabled boolean, created_at timestamptz, expires_at timestamptz, has_token boolean, active_juror_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_sem semesters%ROWTYPE; v_active integer;
BEGIN
  IF NOT public._verify_admin_password(p_admin_password, p_rpc_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0401'; END IF;
  SELECT * INTO v_sem FROM semesters WHERE id = p_semester_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'semester_not_found'; END IF;

  SELECT count(*)::integer INTO v_active
  FROM juror_semester_auth
  WHERE semester_id = p_semester_id AND session_expires_at > now();

  RETURN QUERY SELECT v_sem.entry_token_enabled, v_sem.entry_token_created_at,
    v_sem.entry_token_expires_at, (v_sem.entry_token_hash IS NOT NULL), v_active;
END; $$;

-- ═══════════════════════════════════════════════════════════════
-- GRANTS (re-grant with new signatures)
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.rpc_admin_entry_token_generate(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_entry_token_revoke(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_entry_token_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_generate_entry_token(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_revoke_entry_token(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_get_entry_token_status(uuid, text, text) TO anon, authenticated;
