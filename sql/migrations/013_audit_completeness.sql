-- sql/migrations/013_audit_completeness.sql
-- Audit log completeness: server-side audit for application actions,
-- org_applications trigger, and reject RPC.
--
-- Fixes:
--   1. rpc_admin_approve_application now writes audit_logs directly
--   2. New rpc_admin_reject_application replaces direct PostgREST update
--   3. trigger_audit_log() extended for org_applications table
--   4. Audit trigger attached to org_applications

-- =============================================================================
-- 1. rpc_admin_approve_application — add audit INSERT
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
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_application_id;

  -- Audit: server-side record (no longer depends on frontend fire-and-forget)
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_app_row.organization_id,
    auth.uid(),
    'application.approved',
    'org_applications',
    p_application_id,
    jsonb_build_object(
      'applicant_email', v_app_row.contact_email,
      'applicant_name', v_app_row.applicant_name
    )
  );

  RETURN jsonb_build_object('ok', true, 'application_id', p_application_id)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_approve_application(UUID) TO authenticated;

-- =============================================================================
-- 2. rpc_admin_reject_application — new RPC with audit
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

  -- Audit: server-side record
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_app_row.organization_id,
    auth.uid(),
    'application.rejected',
    'org_applications',
    p_application_id,
    jsonb_build_object(
      'applicant_email', v_app_row.contact_email,
      'applicant_name', v_app_row.applicant_name
    )
  );

  RETURN jsonb_build_object('ok', true, 'application_id', p_application_id)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_application(UUID) TO authenticated;

-- =============================================================================
-- 3. trigger_audit_log() — add org_applications case
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      UUID;
  v_action      TEXT;
  v_resource_id UUID;
BEGIN
  v_action      := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_resource_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  -- Resolve organization_id per table
  IF TG_TABLE_NAME = 'organizations' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  ELSIF TG_TABLE_NAME IN ('periods', 'jurors', 'frameworks') THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id
                                            ELSE NEW.organization_id END;

  ELSIF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'score_sheets' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'memberships' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id
                                            ELSE NEW.organization_id END;

  ELSIF TG_TABLE_NAME = 'entry_tokens' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'org_applications' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id
                                            ELSE NEW.organization_id END;
  END IF;

  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_org_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_audit_log() TO authenticated;

-- =============================================================================
-- 4. Attach audit trigger to org_applications
-- =============================================================================

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON org_applications
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();
