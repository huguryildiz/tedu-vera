-- sql/migrations/041_audit_eval_period_name.sql
-- Add periodName to evaluation.complete and juror.edit_mode_closed_on_resubmit
-- audit log entries so the admin drawer can show the period name instead of a UUID.

CREATE OR REPLACE FUNCTION public.rpc_jury_finalize_submission(
  p_period_id     UUID,
  p_juror_id      UUID,
  p_session_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_row     juror_period_auth%ROWTYPE;
  v_session_hash TEXT;
  v_org_id       UUID;
  v_juror_name   TEXT;
  v_period_name  TEXT;
BEGIN
  v_session_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  SELECT * INTO v_auth_row
  FROM juror_period_auth
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found')::JSON;
  END IF;

  IF v_auth_row.session_token_hash IS NULL OR v_auth_row.session_token_hash != v_session_hash THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_session')::JSON;
  END IF;

  IF v_auth_row.is_blocked THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_blocked')::JSON;
  END IF;

  UPDATE juror_period_auth
  SET final_submitted_at = now(),
      last_seen_at       = now(),
      edit_enabled       = false,
      edit_reason        = NULL,
      edit_expires_at    = NULL
  WHERE juror_id = p_juror_id AND period_id = p_period_id;

  -- Fetch org + juror name + period name for audit logs
  SELECT organization_id, juror_name INTO v_org_id, v_juror_name
  FROM jurors WHERE id = p_juror_id;

  SELECT name INTO v_period_name
  FROM periods WHERE id = p_period_id;

  IF v_org_id IS NOT NULL THEN
    -- Always emit evaluation.complete
    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
    VALUES (
      v_org_id,
      auth.uid(),
      'evaluation.complete',
      'juror_period_auth',
      p_juror_id,
      jsonb_build_object(
        'period_id',   p_period_id,
        'juror_id',    p_juror_id,
        'actor_name',  v_juror_name,
        'periodName',  v_period_name
      )
    );

    -- Also emit edit-mode close if an edit window was active at the time
    IF (
      COALESCE(v_auth_row.edit_enabled, false)
      OR v_auth_row.edit_reason IS NOT NULL
      OR v_auth_row.edit_expires_at IS NOT NULL
    ) THEN
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
      VALUES (
        v_org_id,
        auth.uid(),
        'juror.edit_mode_closed_on_resubmit',
        'juror_period_auth',
        p_juror_id,
        jsonb_build_object(
          'period_id',             p_period_id,
          'juror_id',              p_juror_id,
          'actor_name',            v_juror_name,
          'periodName',            v_period_name,
          'previous_edit_enabled', v_auth_row.edit_enabled,
          'previous_edit_reason',  v_auth_row.edit_reason,
          'previous_expires_at',   v_auth_row.edit_expires_at,
          'closed_at',             now(),
          'close_source',          'jury_resubmit'
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_jury_finalize_submission(UUID, UUID, TEXT) TO anon, authenticated;
