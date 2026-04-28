-- VERA v1 — Identity: Admin Sessions + Invite Flow
-- Depends on: 006_rpcs_admin.sql (_assert_org_admin must exist), 002_tables.sql (memberships.status column)

-- =============================================================================
-- 1) ADMIN USER SESSIONS TABLE
-- =============================================================================
-- Device-scoped admin session tracking for Settings > View Sessions drawer.
-- Rows are keyed by (user_id, device_id); updated by the admin-session-touch
-- Edge Function on each active page load.
-- Retention: Edge Function prunes rows older than 90 days on write.

CREATE TABLE admin_user_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id        TEXT        NOT NULL,
  user_agent       TEXT,
  browser          TEXT,
  os               TEXT,
  ip_address       TEXT,
  country_code     TEXT,
  auth_method      TEXT,
  signed_in_at     TIMESTAMPTZ,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX idx_admin_user_sessions_user_last_activity
  ON admin_user_sessions (user_id, last_activity_at DESC);

-- Keep updated_at current (trigger_set_updated_at defined in 003_helpers_and_triggers.sql)
CREATE TRIGGER set_updated_at_admin_user_sessions
  BEFORE UPDATE ON admin_user_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- 2) ADMIN USER SESSIONS SECURITY
-- =============================================================================
-- Users can read their own session rows. Revocation goes through
-- rpc_admin_revoke_admin_session (audited). No INSERT/UPDATE/DELETE from the
-- client directly — those go through service_role Edge Functions.

GRANT SELECT ON admin_user_sessions TO authenticated;
GRANT SELECT ON admin_user_sessions TO anon;
-- UPDATE/DELETE granted but no matching RLS policy: cross-user mutations silently
-- affect 0 rows instead of erroring (matches Supabase platform default grants).
GRANT UPDATE, DELETE ON admin_user_sessions TO authenticated;
-- service_role needs full access so Edge Functions (admin-session-touch) can upsert rows
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_user_sessions TO service_role;

ALTER TABLE admin_user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_user_sessions_select_own" ON admin_user_sessions
  FOR SELECT
  USING (user_id = auth.uid() OR current_user_is_super_admin());

-- DELETE policy intentionally absent: revocation is handled exclusively via
-- rpc_admin_revoke_admin_session so every revocation produces an audit entry.

-- =============================================================================
-- 3) INVITE FLOW RPCs
-- =============================================================================
-- The legacy admin_invites table (012) was fully replaced by 028 with the
-- Supabase Auth invite flow. Memberships now use status='invited' and are
-- promoted to 'active' by the handle_invite_confirmed trigger (002_tables.sql).

-- -----------------------------------------------------------------------------
-- rpc_org_admin_cancel_invite
-- Deletes an 'invited' membership row (effectively cancels the invite).
-- Called from the admin UI invite management screen.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_org_admin_cancel_invite(p_membership_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  SELECT organization_id, user_id INTO v_org_id, v_user_id
  FROM memberships
  WHERE id = p_membership_id AND status = 'invited';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  PERFORM public._assert_can_invite(v_org_id);

  DELETE FROM memberships
  WHERE id = p_membership_id AND status = 'invited';

  -- Remove orphaned auth user (never confirmed, no remaining memberships)
  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships WHERE user_id = v_user_id
  ) THEN
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  PERFORM public._audit_write(
    v_org_id,
    'membership.invite.cancelled',
    'memberships',
    p_membership_id,
    'access'::audit_category,
    'low'::audit_severity,
    jsonb_build_object('membership_id', p_membership_id)
  );

  RETURN jsonb_build_object('ok', true, 'membership_id', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_cancel_invite(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- rpc_accept_invite
-- Promotes all 'invited' memberships for the authenticated user to 'active'.
-- Called from InviteAcceptScreen after the user completes password setup.
-- SECURITY DEFINER bypasses the super-admin-only UPDATE RLS on memberships.
-- Intentionally narrow: can only promote the caller's own rows, invited → active.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_accept_invite()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE memberships
  SET status = 'active'
  WHERE user_id = auth.uid()
    AND status = 'invited';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_accept_invite() TO authenticated;

-- =============================================================================
-- 4) SESSION REVOCATION RPC
-- =============================================================================
-- Replaces direct client-side DELETE on admin_user_sessions. Every revocation
-- now produces an audit entry (action='access.admin.session.revoked').
-- The caller can revoke their own sessions; super-admins can revoke any session.

CREATE OR REPLACE FUNCTION public.rpc_admin_revoke_admin_session(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row    admin_user_sessions%ROWTYPE;
  v_org_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthenticated')::JSON;
  END IF;

  SELECT * INTO v_row
  FROM admin_user_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found')::JSON;
  END IF;

  IF v_row.user_id IS DISTINCT FROM auth.uid() AND NOT current_user_is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized')::JSON;
  END IF;

  SELECT m.organization_id INTO v_org_id
  FROM memberships m
  WHERE m.user_id = v_row.user_id
    AND m.organization_id IS NOT NULL
  ORDER BY m.created_at DESC
  LIMIT 1;

  DELETE FROM admin_user_sessions
  WHERE id = p_session_id;

  PERFORM public._audit_write(
    v_org_id,
    'access.admin.session.revoked',
    'admin_user_sessions',
    p_session_id,
    'access'::audit_category,
    'high'::audit_severity,
    jsonb_build_object(
      'revoked_user_id', v_row.user_id,
      'device_id',       v_row.device_id,
      'browser',         v_row.browser,
      'os',              v_row.os,
      'ip_address',      v_row.ip_address,
      'country_code',    v_row.country_code,
      'auth_method',     v_row.auth_method,
      'last_activity_at', v_row.last_activity_at,
      'revoked_at',      now()
    )
  );

  RETURN jsonb_build_object('ok', true, 'id', p_session_id)::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_revoke_admin_session(UUID) TO authenticated;
