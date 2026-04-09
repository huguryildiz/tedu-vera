-- sql/migrations/012_admin_invites.sql
-- Admin invite system: table + RPCs for send/list/resend/cancel

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_token
  ON admin_invites(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_invites_org
  ON admin_invites(org_id) WHERE status = 'pending';

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_invites_select ON admin_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND (memberships.organization_id = admin_invites.org_id
             OR memberships.role = 'super_admin')
    )
  );

CREATE POLICY admin_invites_insert ON admin_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND (memberships.organization_id = admin_invites.org_id
             OR memberships.role = 'super_admin')
    )
  );

CREATE POLICY admin_invites_update ON admin_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND (memberships.organization_id = admin_invites.org_id
             OR memberships.role = 'super_admin')
    )
  );

-- ── Helper: assert caller is admin for org ───────────────────
CREATE OR REPLACE FUNCTION _assert_org_admin(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = p_org_id OR role = 'super_admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

-- ── RPC: send invite ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_send(
  p_org_id UUID,
  p_email  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email      TEXT;
  v_existing   UUID;
  v_invite_id  UUID;
  v_token      UUID;
  v_count      INT;
BEGIN
  PERFORM _assert_org_admin(p_org_id);

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND status = 'active') THEN
    RAISE EXCEPTION 'organization_not_found';
  END IF;

  SELECT m.user_id INTO v_existing
  FROM memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE u.email = v_email AND m.organization_id = p_org_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  SELECT count(*) INTO v_count
  FROM admin_invites
  WHERE org_id = p_org_id
    AND created_at > now() - INTERVAL '1 hour';
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  SELECT id INTO v_existing FROM auth.users WHERE email = v_email;

  IF v_existing IS NOT NULL THEN
    INSERT INTO memberships (user_id, organization_id, role)
    VALUES (v_existing, p_org_id, 'org_admin');
    RETURN jsonb_build_object('status', 'added', 'user_id', v_existing);
  END IF;

  UPDATE admin_invites
  SET status = 'cancelled'
  WHERE org_id = p_org_id AND email = v_email AND status = 'pending';

  v_token := gen_random_uuid();
  INSERT INTO admin_invites (org_id, email, invited_by, token)
  VALUES (p_org_id, v_email, auth.uid(), v_token)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'status', 'invited',
    'invite_id', v_invite_id,
    'token', v_token,
    'email', v_email
  );
END;
$$;

-- ── RPC: list pending invites ────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_list(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_org_admin(p_org_id);

  UPDATE admin_invites
  SET status = 'expired'
  WHERE org_id = p_org_id AND status = 'pending' AND expires_at < now();

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ai.id,
        'email', ai.email,
        'created_at', ai.created_at,
        'expires_at', ai.expires_at
      ) ORDER BY ai.created_at DESC
    )
    FROM admin_invites ai
    WHERE ai.org_id = p_org_id AND ai.status = 'pending'
  ), '[]'::jsonb);
END;
$$;

-- ── RPC: resend invite ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_resend(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
  v_email  TEXT;
  v_token  UUID;
BEGIN
  SELECT org_id, email INTO v_org_id, v_email
  FROM admin_invites
  WHERE id = p_invite_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  PERFORM _assert_org_admin(v_org_id);

  v_token := gen_random_uuid();
  UPDATE admin_invites
  SET token = v_token,
      expires_at = now() + INTERVAL '7 days'
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'status', 'resent',
    'invite_id', p_invite_id,
    'token', v_token,
    'email', v_email
  );
END;
$$;

-- ── RPC: cancel invite ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_cancel(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id
  FROM admin_invites
  WHERE id = p_invite_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  PERFORM _assert_org_admin(v_org_id);

  UPDATE admin_invites SET status = 'cancelled' WHERE id = p_invite_id;

  RETURN jsonb_build_object('status', 'cancelled', 'invite_id', p_invite_id);
END;
$$;

-- ── RPC: get invite payload (for accept Edge Function) ───────
CREATE OR REPLACE FUNCTION rpc_admin_invite_get_payload(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite RECORD;
  v_org_name TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM admin_invites
  WHERE token = p_token AND status = 'pending';

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE admin_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('error', 'invite_expired');
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = v_invite.org_id;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'org_id', v_invite.org_id,
    'org_name', v_org_name,
    'email', v_invite.email,
    'expires_at', v_invite.expires_at
  );
END;
$$;

-- ── RPC: mark invite accepted (called by Edge Function) ──────
CREATE OR REPLACE FUNCTION rpc_admin_invite_mark_accepted(
  p_invite_id UUID,
  p_user_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id
  FROM admin_invites WHERE id = p_invite_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  INSERT INTO memberships (user_id, organization_id, role)
  VALUES (p_user_id, v_org_id, 'org_admin')
  ON CONFLICT DO NOTHING;

  UPDATE admin_invites SET status = 'accepted' WHERE id = p_invite_id;
END;
$$;

-- Grant anon access to payload lookup (invitee has no account yet)
GRANT EXECUTE ON FUNCTION rpc_admin_invite_get_payload(UUID) TO anon;
GRANT EXECUTE ON FUNCTION rpc_admin_invite_get_payload(UUID) TO authenticated;
