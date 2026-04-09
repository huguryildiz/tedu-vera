-- sql/migrations/014_audit_trigger_expansion.sql
-- Expand audit trigger coverage to framework_outcomes, period_criteria,
-- and period_criterion_outcome_maps tables.
--
-- These tables previously relied on fire-and-forget frontend writeAuditLog
-- calls, which could silently fail. Server-side triggers guarantee coverage.

-- =============================================================================
-- 1. trigger_audit_log() — add new table cases
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

  ELSIF TG_TABLE_NAME = 'framework_outcomes' THEN
    -- framework_outcomes.framework_id → frameworks.organization_id
    IF TG_OP = 'DELETE' THEN
      SELECT f.organization_id INTO v_org_id FROM frameworks f WHERE f.id = OLD.framework_id;
    ELSE
      SELECT f.organization_id INTO v_org_id FROM frameworks f WHERE f.id = NEW.framework_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'period_criteria' THEN
    -- period_criteria.period_id → periods.organization_id
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'period_criterion_outcome_maps' THEN
    -- period_criterion_outcome_maps.period_id → periods.organization_id
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

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
  AFTER INSERT OR UPDATE OR DELETE ON framework_outcomes
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON period_criteria
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON period_criterion_outcome_maps
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();
