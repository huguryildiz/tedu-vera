-- sql/migrations/010_audit_write_rpc.sql
-- Generic audit log write RPC for frontend-instrumented events.
-- Allows the frontend to emit semantic audit events (admin.login,
-- export.scores, period.lock, criteria.save, etc.) without modifying
-- every existing RPC.
--
-- p_organization_id: optional explicit org override. When provided, used
-- directly instead of resolving from memberships. Required for super-admins
-- who hold memberships across multiple orgs (LIMIT 1 would be non-deterministic).

CREATE OR REPLACE FUNCTION public.rpc_admin_write_audit_log(
  p_action          TEXT,
  p_resource_type   TEXT     DEFAULT NULL,
  p_resource_id     UUID     DEFAULT NULL,
  p_details         JSONB    DEFAULT '{}',
  p_organization_id UUID     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;
  ELSE
    -- Fallback: resolve org from active membership (works for single-org tenant admins)
    SELECT organization_id INTO v_org_id
    FROM memberships
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (v_org_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_details);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_write_audit_log(TEXT, TEXT, UUID, JSONB, UUID) TO authenticated;
