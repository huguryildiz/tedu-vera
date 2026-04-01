-- VERA: Trigger functions (updated_at, audit logging)

-- ============================================================================
-- updated_at Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at trigger to scores table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- Audit Log Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_action TEXT;
  v_resource_id UUID;
BEGIN
  -- Determine action
  v_action := TG_TABLE_NAME || '.' || lower(TG_OP);

  -- Get resource_id from NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    v_resource_id := OLD.id;
  ELSE
    v_resource_id := NEW.id;
  END IF;

  -- Try to get organization_id from the record
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.id;
    ELSE
      v_org_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME IN ('periods', 'jurors', 'frameworks') THEN
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'scores' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'memberships' THEN
    IF TG_OP = 'DELETE' THEN
      v_org_id := OLD.organization_id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
  END IF;

  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (
    v_org_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Attach Audit Log Triggers to Key Tables
-- ============================================================================

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON jurors
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();
