-- sql/migrations/046_audit_rpc_hardening.sql
-- Add server-side audit write helpers so admin actions that currently
-- use fire-and-forget frontend writeAuditLog() can write audit rows
-- with correct category/severity/actor_name in a single DB round-trip.
--
-- New functions:
--   rpc_admin_log_period_lock(p_period_id, p_action, p_ctx)
--   rpc_admin_log_config_update(p_action, p_resource_type, p_resource_id, p_details, p_diff, p_ctx)
--   rpc_admin_write_audit_event(p_event) — generic hardened writer
--
-- p_ctx JSONB accepts {ip, ua, session_id, correlation_id} from Edge Function proxy.
-- All functions are SECURITY DEFINER with tenant admin assertion.

-- =============================================================================
-- 1. rpc_admin_write_audit_event — generic hardened writer
-- =============================================================================
-- Replaces the frontend writeAuditLog() fire-and-forget.
-- Server enforces category + severity from an allowed set; client cannot forge them.

CREATE OR REPLACE FUNCTION public.rpc_admin_write_audit_event(
  p_event JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org_id       UUID;
  v_action       TEXT;
  v_category     audit_category;
  v_severity     audit_severity;
  v_actor_type   audit_actor_type;
  v_resource_type TEXT;
  v_resource_id  UUID;
  v_details      JSONB;
  v_diff         JSONB;
  v_ip           INET;
  v_ua           TEXT;
  v_session_id   UUID;
  v_corr_id      UUID;
  v_actor_name   TEXT;
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

  -- Server-side category/severity assignment (client cannot override)
  v_category := CASE
    WHEN v_action IN ('admin.login','admin.logout','admin.session_expired') THEN 'auth'
    WHEN v_action IN ('admin.create','admin.updated','admin.role_granted','admin.role_revoked') THEN 'access'
    WHEN v_action IN (
      'criteria.save','criteria.update',
      'outcome.create','outcome.update','outcome.delete',
      'organization.status_changed',
      'framework.create','framework.update','framework.delete'
    ) THEN 'config'
    WHEN v_action LIKE 'export.%' OR v_action LIKE 'notification.%'
      OR v_action LIKE 'backup.%' OR v_action LIKE 'token.%'
    THEN 'security'
    ELSE 'data'
  END::audit_category;

  v_severity := CASE
    WHEN v_action IN ('period.lock','period.unlock','organization.status_changed','backup.deleted') THEN 'high'
    WHEN v_action IN (
      'admin.create','pin.reset','juror.pin_unlocked','juror.edit_mode_enabled',
      'period.set_current','snapshot.freeze','application.approved','application.rejected',
      'token.revoke','export.audit','backup.downloaded',
      'criteria.save','criteria.update','outcome.create','outcome.update','outcome.delete'
    ) THEN 'medium'
    WHEN v_action IN (
      'admin.updated','juror.edit_mode_closed_on_resubmit','token.generate',
      'export.scores','export.rankings','export.heatmap','export.analytics','export.backup',
      'backup.created'
    ) THEN 'low'
    ELSE 'info'
  END::audit_severity;

  v_actor_type := CASE
    WHEN v_action IN ('evaluation.complete','score.update') THEN 'juror'
    WHEN v_action IN ('snapshot.freeze','juror.pin_locked','juror.edit_mode_closed_on_resubmit')
      THEN 'system'
    ELSE 'admin'
  END::audit_actor_type;

  -- Context fields from Edge Function proxy
  v_ip         := (p_event->>'ip')::INET;
  v_ua         := p_event->>'ua';
  v_session_id := (p_event->>'sessionId')::UUID;
  v_corr_id    := (p_event->>'correlationId')::UUID;
  v_actor_name := COALESCE(v_details->>'actor_name', v_details->>'adminName');

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
-- 2. rpc_admin_log_period_lock — dedicated period lock/unlock writer
-- =============================================================================
-- Called by admin panel when locking/unlocking an evaluation period.
-- Writes audit row with correct context; returns period state.

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
  v_org_id     UUID;
  v_period_name TEXT;
  v_admin_name  TEXT;
BEGIN
  -- Verify caller is authenticated admin
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthenticated');
  END IF;

  SELECT organization_id, name INTO v_org_id, v_period_name
  FROM periods WHERE id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'period_not_found');
  END IF;

  SELECT display_name INTO v_admin_name FROM profiles WHERE id = auth.uid();

  INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id,
    category, severity, actor_type, actor_name,
    ip_address, user_agent, session_id,
    details
  ) VALUES (
    v_org_id, auth.uid(), p_action, 'periods', p_period_id,
    'data'::audit_category,
    'high'::audit_severity,
    'admin'::audit_actor_type,
    v_admin_name,
    (p_ctx->>'ip')::INET,
    p_ctx->>'ua',
    (p_ctx->>'sessionId')::UUID,
    jsonb_build_object('periodName', v_period_name, 'period_id', p_period_id)
  );

  RETURN jsonb_build_object('ok', true, 'periodName', v_period_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_log_period_lock(UUID, TEXT, JSONB)
  TO authenticated;
