-- sql/migrations/047_audit_anon_auth_failure.sql
-- Anonymous-callable RPC to log failed admin login attempts.
-- Auth failures have no auth.uid() — normal authenticated RPCs cannot be used.
--
-- Rate-limited: max 20 failures per email per 5 minutes to prevent
-- audit table flooding from brute-force attacks.
-- Severity escalation: low (1–2), medium (3–4), high (5+).

CREATE OR REPLACE FUNCTION public.rpc_write_auth_failure_event(
  p_email  TEXT,
  p_method TEXT DEFAULT 'password'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_failure_count INT;
  v_severity      audit_severity;
BEGIN
  -- Sanitise inputs
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_email');
  END IF;

  -- Rate limit: count failures for this email in the last 5 minutes
  SELECT COUNT(*) INTO v_failure_count
  FROM audit_logs
  WHERE action     = 'auth.admin.login.failure'
    AND actor_name = trim(p_email)
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Reject if rate limit exceeded (20 per 5 min per email)
  IF v_failure_count >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'rate_limited');
  END IF;

  -- Severity escalates with repeated failures
  v_severity := CASE
    WHEN v_failure_count >= 4 THEN 'high'
    WHEN v_failure_count >= 2 THEN 'medium'
    ELSE                           'low'
  END::audit_severity;

  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    category,
    severity,
    actor_type,
    actor_name,
    details
  ) VALUES (
    NULL,
    NULL,
    'auth.admin.login.failure',
    'auth'::audit_category,
    v_severity,
    'anonymous'::audit_actor_type,
    trim(p_email),
    jsonb_build_object(
      'email',   trim(p_email),
      'method',  coalesce(p_method, 'password'),
      'attempt', v_failure_count + 1
    )
  );

  RETURN jsonb_build_object('ok', true, 'severity', v_severity::TEXT);
END;
$$;

-- Allow both anon (unauthenticated browser) and authenticated callers.
GRANT EXECUTE ON FUNCTION public.rpc_write_auth_failure_event(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_write_auth_failure_event(TEXT, TEXT) TO authenticated;
