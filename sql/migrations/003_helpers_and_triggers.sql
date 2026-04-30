-- VERA v1 — Helper Functions, Trigger Functions, Trigger Attachments
-- Depends on: 002_tables.sql (all tables must exist)

-- =============================================================================
-- HELPER: current_user_is_super_admin()
-- =============================================================================
-- Used in RLS policies. SECURITY DEFINER avoids infinite recursion
-- when memberships policies reference themselves.

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships
    WHERE user_id = (SELECT auth.uid())
      AND organization_id IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_super_admin() TO authenticated;

-- =============================================================================
-- HELPER: current_user_admin_org_ids()
-- =============================================================================
-- Returns org IDs where current user is an active org_admin.
-- SECURITY DEFINER avoids infinite recursion in memberships RLS policies.

CREATE OR REPLACE FUNCTION public.current_user_admin_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM memberships
  WHERE user_id = (SELECT auth.uid())
    AND status = 'active'
    AND role = 'org_admin'
    AND organization_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_admin_org_ids() TO authenticated;

-- =============================================================================
-- HELPER: _assert_super_admin()
-- =============================================================================
-- Raises 'unauthorized' if caller is not a super admin.
-- Used by rpc_admin_list_organizations and other admin RPCs.

CREATE OR REPLACE FUNCTION public._assert_super_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_super_admin() TO authenticated;

-- =============================================================================
-- TRIGGER FUNCTION: trigger_set_updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at() TO authenticated;

-- Attach to tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON periods
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON jurors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON juror_period_auth
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON score_sheets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON score_sheet_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_maintenance_mode BEFORE UPDATE ON maintenance_mode
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_security_policy BEFORE UPDATE ON security_policy
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- HELPER: _jsonb_diff(old jsonb, new jsonb) -> jsonb
-- =============================================================================
-- Returns { before: { changed_keys_only }, after: { changed_keys_only } }.
-- Keys present in only one side appear only in that side. Always-noisy keys
-- (updated_at, last_seen_at) are stripped to keep the diff focused.
-- IMMUTABLE so PostgreSQL can inline the call inside the trigger hot-path.

CREATE OR REPLACE FUNCTION public._jsonb_diff(p_old JSONB, p_new JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_before JSONB := '{}'::jsonb;
  v_after  JSONB := '{}'::jsonb;
  k TEXT;
  noisy CONSTANT TEXT[] := ARRAY['updated_at','last_seen_at','last_activity_at'];
BEGIN
  IF p_old IS NULL AND p_new IS NULL THEN RETURN NULL; END IF;
  IF p_old IS NULL THEN
    RETURN jsonb_build_object('after', p_new - noisy);
  END IF;
  IF p_new IS NULL THEN
    RETURN jsonb_build_object('before', p_old - noisy);
  END IF;

  -- jsonb_object_keys() is a set-returning function; PG forbids using it in
  -- WHERE directly, so iterate via a derived table.
  FOR k IN SELECT key FROM jsonb_object_keys(p_old) AS key WHERE key <> ALL (noisy) LOOP
    IF (p_new ? k) THEN
      IF (p_old -> k) IS DISTINCT FROM (p_new -> k) THEN
        v_before := v_before || jsonb_build_object(k, p_old -> k);
        v_after  := v_after  || jsonb_build_object(k, p_new -> k);
      END IF;
    ELSE
      v_before := v_before || jsonb_build_object(k, p_old -> k);
    END IF;
  END LOOP;

  FOR k IN SELECT key FROM jsonb_object_keys(p_new) AS key WHERE key <> ALL (noisy) LOOP
    IF NOT (p_old ? k) THEN
      v_after := v_after || jsonb_build_object(k, p_new -> k);
    END IF;
  END LOOP;

  IF v_before = '{}'::jsonb AND v_after = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('before', v_before, 'after', v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION public._jsonb_diff(JSONB, JSONB) TO authenticated;

-- =============================================================================
-- HELPER: _audit_extract_client_ip(xff_header, real_ip_header) -> INET
-- =============================================================================
-- Picks the real client IP out of a comma-separated X-Forwarded-For chain.
-- (P2.12 — trusted proxy depth.)
--
-- Default behavior (no GUC): trust the leftmost XFF element (legacy compat).
--
-- Hardened behavior: set
--     ALTER DATABASE postgres SET app.audit_proxy_depth = '1';
-- to indicate that 1 trusted proxy (Supabase Edge) sits between the user and
-- PostgREST. The function then returns the (length - 1 - depth)-th element of
-- the chain — anything to its left is treated as user-injected/untrustworthy
-- and ignored.
--
-- Returns NULL if no IP can be extracted or the candidate is not a valid INET.
CREATE OR REPLACE FUNCTION public._audit_extract_client_ip(
  p_xff      TEXT,
  p_real_ip  TEXT
)
RETURNS INET
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chain      TEXT[];
  v_depth_raw  TEXT;
  v_depth      INT;
  v_idx        INT;
  v_candidate  TEXT;
  v_ip         INET;
BEGIN
  IF p_xff IS NULL OR length(trim(p_xff)) = 0 THEN
    IF p_real_ip IS NULL OR length(trim(p_real_ip)) = 0 THEN
      RETURN NULL;
    END IF;
    BEGIN RETURN trim(p_real_ip)::INET; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  END IF;

  v_chain := string_to_array(p_xff, ',');
  -- Trim each element
  FOR v_idx IN 1 .. array_length(v_chain, 1) LOOP
    v_chain[v_idx] := trim(v_chain[v_idx]);
  END LOOP;

  -- Read trusted-proxy depth from custom GUC (missing GUC must not abort).
  BEGIN
    v_depth_raw := current_setting('app.audit_proxy_depth', true);
  EXCEPTION WHEN OTHERS THEN
    v_depth_raw := NULL;
  END;

  IF v_depth_raw IS NOT NULL AND length(trim(v_depth_raw)) > 0 THEN
    BEGIN
      v_depth := v_depth_raw::INT;
    EXCEPTION WHEN OTHERS THEN
      v_depth := 0;
    END;
    IF v_depth IS NULL OR v_depth < 0 THEN v_depth := 0; END IF;
    -- Pick xff[len - depth] (1-indexed); clamp to 1 if depth ≥ chain length.
    v_idx := GREATEST(1, array_length(v_chain, 1) - v_depth);
    v_candidate := v_chain[v_idx];
  ELSE
    -- Legacy: leftmost element.
    v_candidate := v_chain[1];
  END IF;

  IF v_candidate IS NULL OR length(trim(v_candidate)) = 0 THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_ip := trim(v_candidate)::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;
  RETURN v_ip;
END;
$$;

GRANT EXECUTE ON FUNCTION public._audit_extract_client_ip(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- TRIGGER FUNCTION: trigger_audit_log
-- =============================================================================
-- Final state: category='data', severity by table+op, actor_type='system',
-- selective diff via _jsonb_diff (score_sheets excluded to avoid row bloat).
-- Absorbed from: 014_audit_trigger_expansion, 015_audit_trigger_phase3,
--                045_audit_trigger_diff, audit-hardening-2026-04-28 (IP/UA, jsonb_diff)

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
  v_actor_name  TEXT;
  v_ip          INET;
  v_ua          TEXT;
  v_req_headers JSON;
  v_ip_raw      TEXT;
  v_entity_key     TEXT;
  v_entity_name    TEXT;
  v_extra_details  JSONB := '{}'::jsonb;
BEGIN
  v_action := TG_TABLE_NAME || '.' || lower(TG_OP);

  -- ── Resource ID — NULL for tables with non-UUID pk ────────────────────
  IF TG_TABLE_NAME = 'security_policy' THEN
    v_resource_id := NULL;
  ELSIF TG_TABLE_NAME = 'juror_period_auth' THEN
    -- Composite PK (juror_id, period_id) — use juror_id as primary subject.
    v_resource_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.juror_id ELSE NEW.juror_id END;
  ELSE
    v_resource_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  END IF;

  -- ── Resolve actor display name from profiles if session uid available ──
  IF auth.uid() IS NOT NULL THEN
    SELECT display_name INTO v_actor_name
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;

  -- ── Extract IP / user-agent from PostgREST request.headers GUC ────────
  -- Mirrors _audit_write logic so trigger-emitted rows are forensic-equivalent
  -- to RPC-emitted rows. Missing/non-JSON GUC must not abort the caller.
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

  -- ── Severity by table + operation ──────────────────────────────────────
  v_severity := CASE
    WHEN TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('memberships')       THEN 'high'
    WHEN TG_OP = 'DELETE' AND TG_TABLE_NAME IN (
      'jurors','projects','frameworks','entry_tokens','admin_invites'
    )                                                                  THEN 'medium'
    WHEN TG_TABLE_NAME = 'security_policy'                            THEN 'high'
    WHEN TG_OP = 'DELETE'                                             THEN 'low'
    ELSE 'info'
  END::audit_severity;

  -- ── Selective diff via _jsonb_diff — skip score_sheets to avoid bloat ──
  -- INSERT: full row in `after` (no `before` baseline). DELETE: full row in `before`.
  -- UPDATE: only the changed keys in both sides (huge storage win on 50+ col tables).
  IF TG_TABLE_NAME <> 'score_sheets' THEN
    IF TG_OP = 'INSERT' THEN
      v_diff := public._jsonb_diff(NULL, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
      v_diff := public._jsonb_diff(to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
      v_diff := public._jsonb_diff(to_jsonb(OLD), NULL);
    END IF;
  ELSE
    v_diff := NULL;
  END IF;

  -- Skip no-op UPDATEs whose only changes were stripped as noisy (updated_at,
  -- last_seen_at, last_activity_at). Without this, the new juror_period_auth
  -- trigger would emit thousands of empty-diff rows on jury days from
  -- heartbeat updates. score_sheets keeps NULL diff but is intentionally not
  -- skipped — score writes are an information-bearing event even without diff.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME <> 'score_sheets' AND v_diff IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Organization resolution ─────────────────────────────────────────
  IF TG_TABLE_NAME = 'organizations' THEN
    -- On DELETE the org row no longer exists when this AFTER trigger fires,
    -- so storing OLD.id would violate the FK. Use NULL to record the event
    -- without a dangling reference.
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END;

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

  ELSIF TG_TABLE_NAME = 'unlock_requests' THEN
    v_org_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id
                                            ELSE NEW.organization_id END;

  ELSIF TG_TABLE_NAME = 'juror_period_auth' THEN
    -- Org resolved via jurors.organization_id.
    IF TG_OP = 'DELETE' THEN
      SELECT j.organization_id INTO v_org_id FROM jurors j WHERE j.id = OLD.juror_id;
    ELSE
      SELECT j.organization_id INTO v_org_id FROM jurors j WHERE j.id = NEW.juror_id;
    END IF;

  ELSIF TG_TABLE_NAME IN ('profiles', 'security_policy') THEN
    v_org_id := NULL;

  END IF;

  -- Defensive: during cascade deletion of an organization, child AFTER DELETE
  -- triggers can fire after the org row is no longer visible. Writing the
  -- resolved org id would violate audit_logs_organization_id_fkey. Fall back
  -- to NULL so the audit record still captures the operation.
  IF v_org_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org_id) THEN
    v_org_id := NULL;
  END IF;

  -- Extract entity display name for the audit drawer. Must use procedural
  -- IF/ELSIF (lazy eval) — a SQL CASE around NEW.<col> is planned eagerly and
  -- raises "record has no field" when the trigger fires on a sibling table.
  IF TG_TABLE_NAME = 'periods' THEN
    v_entity_key  := 'periodName';
    v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END;
  ELSIF TG_TABLE_NAME = 'projects' THEN
    v_entity_key  := 'project_title';
    v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.title ELSE NEW.title END;
  ELSIF TG_TABLE_NAME = 'jurors' THEN
    v_entity_key  := 'juror_name';
    v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.juror_name ELSE NEW.juror_name END;
  END IF;

  -- Enrich juror_period_auth INSERT with human-readable names
  IF TG_TABLE_NAME = 'juror_period_auth' AND TG_OP = 'INSERT' THEN
    SELECT jsonb_build_object(
      'juror_name', j.juror_name,
      'period_name', per.name
    ) INTO v_extra_details
    FROM jurors j
    JOIN periods per ON per.id = NEW.period_id
    WHERE j.id = NEW.juror_id;
  END IF;

  -- Enrich entry_tokens events with period_name (drawer Period row)
  IF TG_TABLE_NAME = 'entry_tokens' THEN
    SELECT jsonb_build_object('period_name', per.name)
    INTO v_extra_details
    FROM periods per
    WHERE per.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.period_id ELSE NEW.period_id END;
  END IF;

  -- Enrich projects events with period_name (drawer Period row)
  IF TG_TABLE_NAME = 'projects' THEN
    SELECT jsonb_build_object('period_name', per.name, 'periodName', per.name)
    INTO v_extra_details
    FROM periods per
    WHERE per.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.period_id ELSE NEW.period_id END;
  END IF;

  -- Enrich memberships events with member email + role
  IF TG_TABLE_NAME = 'memberships' THEN
    SELECT jsonb_build_object(
      'member_email', u.email,
      'role', CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END
    ) INTO v_extra_details
    FROM auth.users u
    WHERE u.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  END IF;

  -- Enrich period_criteria events with criterion label + period name so the
  -- drawer doesn't render bare UUIDs.
  IF TG_TABLE_NAME = 'period_criteria' THEN
    SELECT jsonb_build_object(
      'period_name',    per.name,
      'criterion_name', CASE WHEN TG_OP = 'DELETE' THEN OLD.label ELSE NEW.label END
    ) INTO v_extra_details
    FROM periods per
    WHERE per.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.period_id ELSE NEW.period_id END;
  END IF;

  -- Enrich period_criterion_outcome_maps events with the joined criterion label,
  -- outcome code/label, and period name. The raw row only stores UUIDs which are
  -- meaningless in the audit drawer.
  IF TG_TABLE_NAME = 'period_criterion_outcome_maps' THEN
    SELECT jsonb_build_object(
      'period_name',    per.name,
      'criterion_name', pc.label,
      'outcome_code',   po.code,
      'outcome_label',  po.label
    ) INTO v_extra_details
    FROM periods per
    JOIN period_criteria pc ON pc.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.period_criterion_id ELSE NEW.period_criterion_id END
    JOIN period_outcomes po ON po.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.period_outcome_id   ELSE NEW.period_outcome_id   END
    WHERE per.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.period_id ELSE NEW.period_id END;
  END IF;

  INSERT INTO audit_logs (
    organization_id, user_id,
    action, resource_type, resource_id,
    category, severity, actor_type, actor_name,
    ip_address, user_agent,
    details, diff
  ) VALUES (
    v_org_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    CASE WHEN TG_TABLE_NAME = 'security_policy' THEN 'config' ELSE 'data' END::audit_category,
    v_severity,
    CASE WHEN auth.uid() IS NOT NULL THEN 'admin' ELSE 'system' END::audit_actor_type,
    v_actor_name,
    v_ip, v_ua,
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
    || CASE
         WHEN v_entity_key IS NOT NULL AND v_entity_name IS NOT NULL THEN
           jsonb_build_object(v_entity_key, v_entity_name)
         ELSE '{}'::jsonb
       END
    || v_extra_details,
    v_diff
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_audit_log() TO authenticated;

-- Attach audit trigger to key tables
CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON periods
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON jurors
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON score_sheets
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON entry_tokens
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Additional tables added in 014_audit_trigger_expansion + 015_audit_trigger_phase3
CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON framework_outcomes
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON period_criteria
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON period_criterion_outcome_maps
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON frameworks
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- security_policy: single-row config table, category='config', severity='high'
-- resource_id set to NULL (INT pk, not UUID); absorbed from 057_audit_trigger_hardening
DROP TRIGGER IF EXISTS audit_log_trigger ON security_policy;
CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON security_policy
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON unlock_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- juror_period_auth: PIN counter, edit-window grants, lock state, final-submit.
-- Composite PK (juror_id, period_id) handled inside the function.
-- Heartbeat-only updates (last_seen_at) are stripped by _jsonb_diff and skipped
-- by the no-op UPDATE check, so high-frequency writes don't flood audit_logs.
CREATE TRIGGER audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON juror_period_auth
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- =============================================================================
-- PERIOD-LOCK ENFORCEMENT
-- =============================================================================
-- Periods lock via the deliberate `rpc_admin_publish_period` action. The UI
-- exposes a Publish button once a period satisfies the readiness check; the
-- RPC sets is_locked = true and activated_at = now() in one transaction. QR
-- entry tokens can only be generated after publishing (gated inside
-- rpc_admin_generate_entry_token).
--
-- Before the lifecycle redesign, a trigger set is_locked on the first entry
-- token INSERT. That trigger has been removed — lock is no longer a side
-- effect of QR generation.
--
-- When periods.is_locked = true (set by rpc_admin_publish_period), the
-- period's structural content must not change: criteria, outcomes,
-- criterion-outcome maps, project data, or period metadata fields
-- (name/dates/framework/etc.). Juror metadata for jurors assigned to a
-- locked period is also frozen.
--
-- Exceptions (intentionally mutable while locked):
--   * juror_period_auth rows (PIN, session, edit-mode runtime state)
--   * scores / score_feedback (the whole point of a locked period)
--   * entry_tokens INSERT (QR generation remains allowed after publish)
--   * jurors INSERT (new juror registration stays allowed — rpc_jury_authenticate)
--   * periods.is_locked / activated_at / snapshot_frozen_at / closed_at
--     updates (orchestration + unlock + close flow must still work)

-- Central helper — callable from RPCs for clean early-exit, and from
-- table triggers as the shared check.
CREATE OR REPLACE FUNCTION public._assert_period_unlocked(p_period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  IF p_period_id IS NULL THEN
    RETURN;
  END IF;
  SELECT is_locked INTO v_locked FROM periods WHERE id = p_period_id;
  IF COALESCE(v_locked, false) THEN
    RAISE EXCEPTION 'period_locked' USING
      ERRCODE = 'check_violation',
      HINT    = 'Period is locked. Request unlock via rpc_admin_request_unlock.';
  END IF;
END;
$$;

-- ── projects: block all INSERT/UPDATE/DELETE when period is locked ─────────
CREATE OR REPLACE FUNCTION public.trigger_block_projects_on_locked_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._assert_period_unlocked(OLD.period_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public._assert_period_unlocked(OLD.period_id);
    IF NEW.period_id IS DISTINCT FROM OLD.period_id THEN
      PERFORM public._assert_period_unlocked(NEW.period_id);
    END IF;
    RETURN NEW;
  ELSE -- INSERT
    PERFORM public._assert_period_unlocked(NEW.period_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER block_projects_on_locked_period
  BEFORE INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_block_projects_on_locked_period();

-- ── projects: auto-assign project_no on INSERT when null ──────────────────
-- Gaps from deletions are preserved (no renumbering). Advisory xact lock on
-- period_id serializes concurrent inserts into the same period.
CREATE OR REPLACE FUNCTION public.trigger_assign_project_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.period_id::text, 0));
    SELECT COALESCE(MAX(project_no), 0) + 1
      INTO NEW.project_no
      FROM projects
     WHERE period_id = NEW.period_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_project_no
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_assign_project_no();

-- ── jurors: block UPDATE/DELETE if juror is assigned to any locked period ──
-- INSERT is intentionally unguarded so rpc_jury_authenticate can register
-- new jurors during a locked period.
CREATE OR REPLACE FUNCTION public.trigger_block_jurors_on_locked_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_juror_id UUID;
  v_has_lock BOOLEAN;
BEGIN
  v_juror_id := COALESCE(OLD.id, NEW.id);
  SELECT EXISTS(
    SELECT 1 FROM juror_period_auth jpa
    JOIN periods p ON p.id = jpa.period_id
    WHERE jpa.juror_id = v_juror_id AND p.is_locked = true
  ) INTO v_has_lock;
  IF v_has_lock THEN
    RAISE EXCEPTION 'period_locked' USING
      ERRCODE = 'check_violation',
      HINT    = 'Juror is assigned to a locked period.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER block_jurors_on_locked_period
  BEFORE UPDATE OR DELETE ON jurors
  FOR EACH ROW EXECUTE FUNCTION trigger_block_jurors_on_locked_period();

-- ── periods: block UPDATE of protected columns + DELETE while locked ───────
-- Allowed changes even while locked:
--   is_locked (unlock flow), activated_at, snapshot_frozen_at,
--   closed_at (close flow), updated_at.
-- Blocked: name, season, description, start_date, end_date, framework_id,
-- organization_id.
CREATE OR REPLACE FUNCTION public.trigger_block_periods_on_locked_mutate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins may delete or structurally modify locked periods.
  IF current_user_is_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.is_locked, false) THEN
      RAISE EXCEPTION 'period_locked' USING
        ERRCODE = 'check_violation',
        HINT    = 'Cannot delete a locked period.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NOT COALESCE(OLD.is_locked, false) THEN
    RETURN NEW;
  END IF;

  IF  NEW.name            IS DISTINCT FROM OLD.name            OR
      NEW.season          IS DISTINCT FROM OLD.season          OR
      NEW.description     IS DISTINCT FROM OLD.description     OR
      NEW.start_date      IS DISTINCT FROM OLD.start_date      OR
      NEW.end_date        IS DISTINCT FROM OLD.end_date        OR
      NEW.framework_id    IS DISTINCT FROM OLD.framework_id    OR
      NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'period_locked' USING
      ERRCODE = 'check_violation',
      HINT    = 'Period is locked. Only is_locked/activated_at/closed_at may change.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER block_periods_on_locked_mutate
  BEFORE UPDATE OR DELETE ON periods
  FOR EACH ROW EXECUTE FUNCTION trigger_block_periods_on_locked_mutate();

-- ── period_criteria / period_outcomes / period_criterion_outcome_maps ──────
-- Belt-and-suspenders: RPC guards also exist, but direct writes are blocked
-- at the table level regardless of caller.
CREATE OR REPLACE FUNCTION public.trigger_block_period_child_on_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_period_id := OLD.period_id;
    PERFORM public._assert_period_unlocked(v_period_id);
    RETURN OLD;
  ELSE
    v_period_id := NEW.period_id;
    PERFORM public._assert_period_unlocked(v_period_id);
    IF TG_OP = 'UPDATE' AND NEW.period_id IS DISTINCT FROM OLD.period_id THEN
      PERFORM public._assert_period_unlocked(OLD.period_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER block_period_criteria_on_locked
  BEFORE INSERT OR UPDATE OR DELETE ON period_criteria
  FOR EACH ROW EXECUTE FUNCTION trigger_block_period_child_on_locked();

CREATE TRIGGER block_period_outcomes_on_locked
  BEFORE INSERT OR UPDATE OR DELETE ON period_outcomes
  FOR EACH ROW EXECUTE FUNCTION trigger_block_period_child_on_locked();

CREATE TRIGGER block_pcom_on_locked
  BEFORE INSERT OR UPDATE OR DELETE ON period_criterion_outcome_maps
  FOR EACH ROW EXECUTE FUNCTION trigger_block_period_child_on_locked();

-- ── score_sheets: block DELETE once period is activated ────────────────────
-- Score records are accreditation evidence. Once a period moves out of Draft
-- (activated_at IS NOT NULL), score sheets must not be deleted directly — only
-- via cascade when the period itself is deleted (which is already blocked for
-- locked periods by trigger_block_periods_on_locked_mutate).
CREATE OR REPLACE FUNCTION public.trigger_block_score_sheet_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated_at TIMESTAMPTZ;
BEGIN
  SELECT activated_at INTO v_activated_at FROM periods WHERE id = OLD.period_id;
  IF v_activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'score_delete_forbidden' USING
      ERRCODE = 'check_violation',
      HINT    = 'Score sheets cannot be deleted once a period has been activated.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER block_score_sheet_delete
  BEFORE DELETE ON score_sheets
  FOR EACH ROW EXECUTE FUNCTION trigger_block_score_sheet_delete();

-- ── score_sheet_items: block direct DELETE once period is activated ─────────
-- Items are written exclusively via rpc_jury_upsert_score. Direct deletion
-- bypasses all audit and lock guards. Cascade from score_sheets is also
-- covered by the parent trigger above.
CREATE OR REPLACE FUNCTION public.trigger_block_score_sheet_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated_at TIMESTAMPTZ;
BEGIN
  SELECT p.activated_at INTO v_activated_at
    FROM score_sheets ss
    JOIN periods p ON p.id = ss.period_id
   WHERE ss.id = OLD.score_sheet_id;
  IF v_activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'score_delete_forbidden' USING
      ERRCODE = 'check_violation',
      HINT    = 'Score sheet items cannot be deleted once a period has been activated.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER block_score_sheet_item_delete
  BEFORE DELETE ON score_sheet_items
  FOR EACH ROW EXECUTE FUNCTION trigger_block_score_sheet_item_delete();

-- =============================================================================
-- HELPER: email_is_verified(uid uuid)
-- =============================================================================
-- Returns true when profiles.email_verified_at IS NOT NULL for the given uid.
-- Uses profiles.email_verified_at (set by the email-verification-confirm Edge
-- Function) rather than auth.users.email_confirmed_at, which Supabase
-- auto-sets at signup when "Confirm email" is OFF and cannot be used as a
-- verification signal.

CREATE OR REPLACE FUNCTION public.email_is_verified(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email_verified_at IS NOT NULL
  FROM public.profiles
  WHERE id = uid;
$$;

GRANT EXECUTE ON FUNCTION public.email_is_verified(UUID) TO authenticated;

-- =============================================================================
-- TRIGGER FUNCTION: trigger_clear_grace_on_email_verify
-- =============================================================================
-- When profiles.email_verified_at transitions NULL → NOT NULL, clears
-- memberships.grace_ends_at for all that user's rows so grace-lock checks
-- immediately pass without a separate cron step.
--
-- Fires on public.profiles (not auth.users) because auth.users.email_confirmed_at
-- is auto-set at signup time when Supabase "Confirm email" is disabled, making
-- it unusable as a verification transition signal.

CREATE OR REPLACE FUNCTION public.trigger_clear_grace_on_email_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_verified_at IS NULL AND NEW.email_verified_at IS NOT NULL THEN
    UPDATE public.memberships
       SET grace_ends_at = NULL
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_grace_on_email_verify ON auth.users;
DROP TRIGGER IF EXISTS clear_grace_on_email_verify ON public.profiles;
CREATE TRIGGER clear_grace_on_email_verify
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_clear_grace_on_email_verify();
