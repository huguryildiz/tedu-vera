-- sql/migrations/045_audit_trigger_diff.sql
-- Enhance trigger_audit_log() to write:
--   category  = 'data'
--   severity  = varies by table + operation
--   actor_type = 'system'
--   diff      = {before: {...}, after: {...}} (INSERT omits before; DELETE omits after)
--
-- score_sheets diff is intentionally excluded (too large — many criterion columns).
-- All other tables get full before/after serialization.

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
  v_severity    audit_severity;
  v_diff        JSONB;
BEGIN
  v_action      := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_resource_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  -- ── Severity by table + operation ──────────────────────────────
  v_severity := CASE
    WHEN TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('memberships')       THEN 'high'
    WHEN TG_OP = 'DELETE' AND TG_TABLE_NAME IN (
      'jurors','projects','frameworks','entry_tokens','admin_invites'
    )                                                                  THEN 'medium'
    WHEN TG_OP = 'DELETE'                                             THEN 'low'
    ELSE 'info'
  END::audit_severity;

  -- ── Diff (before/after) — skip score_sheets to avoid row bloat ─
  IF TG_TABLE_NAME <> 'score_sheets' THEN
    v_diff := CASE
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('after',  to_jsonb(NEW))
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('before', to_jsonb(OLD))
    END;
  ELSE
    v_diff := NULL;
  END IF;

  -- ── Organization resolution (unchanged from previous version) ──
  IF TG_TABLE_NAME = 'organizations' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  ELSIF TG_TABLE_NAME IN ('periods', 'jurors', 'frameworks') THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id
                                            ELSE NEW.organization_id END;

  ELSIF TG_TABLE_NAME IN ('projects', 'score_sheets') THEN
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

  ELSIF TG_TABLE_NAME IN ('period_criteria', 'period_criterion_outcome_maps') THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = OLD.period_id;
    ELSE
      SELECT p.organization_id INTO v_org_id FROM periods p WHERE p.id = NEW.period_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'admin_invites' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END;

  ELSIF TG_TABLE_NAME = 'profiles' THEN
    v_org_id := NULL;

  END IF;

  INSERT INTO audit_logs (
    organization_id, user_id,
    action, resource_type, resource_id,
    category, severity, actor_type,
    details, diff
  ) VALUES (
    v_org_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    'data'::audit_category,
    v_severity,
    'system'::audit_actor_type,
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME),
    v_diff
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_audit_log() TO authenticated;
