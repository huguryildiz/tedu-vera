-- sql/migrations/015_audit_trigger_phase3.sql
-- Phase 3 audit trigger expansion: admin_invites, frameworks, profiles.
--
-- admin_invites: 6 RPC operations with no audit coverage
-- frameworks: CRUD exists but no trigger attached (org resolution already in function)
-- profiles: display name edits untracked

-- =============================================================================
-- 1. trigger_audit_log() — add admin_invites + profiles cases
-- =============================================================================
-- Note: frameworks already has org resolution in the function (migration 014,
-- line 30: `ELSIF TG_TABLE_NAME IN ('periods', 'jurors', 'frameworks')`).
-- Only the trigger attachment is missing.

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

  ELSIF TG_TABLE_NAME = 'framework_outcomes' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT f.organization_id INTO v_org_id FROM frameworks f WHERE f.id = OLD.framework_id;
    ELSE
      SELECT f.organization_id INTO v_org_id FROM frameworks f WHERE f.id = NEW.framework_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'period_criteria' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'period_criterion_outcome_maps' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'admin_invites' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END;

  ELSIF TG_TABLE_NAME = 'profiles' THEN
    v_org_id := NULL;  -- cross-org table, no organization_id column

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
-- 2. Attach audit triggers to new tables
-- =============================================================================

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON admin_invites
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON frameworks
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();
