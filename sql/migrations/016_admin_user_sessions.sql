-- sql/migrations/016_admin_user_sessions.sql
-- Device-scoped admin session tracking for Settings > View Sessions drawer.
--
-- Notes:
-- - This is not Supabase native auth.sessions listing.
-- - Rows are keyed by (user_id, device_id) and updated by Edge Function touch events.
-- - Retention cleanup (90 days) is enforced by the ingest function.

-- =============================================================================
-- 1) TABLE + INDEXES
-- =============================================================================

CREATE TABLE admin_user_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id         TEXT NOT NULL,
  user_agent        TEXT,
  browser           TEXT,
  os                TEXT,
  ip_address        TEXT,
  country_code      TEXT,
  auth_method       TEXT,
  signed_in_at      TIMESTAMPTZ,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX idx_admin_user_sessions_user_last_activity
  ON admin_user_sessions (user_id, last_activity_at DESC);

-- Keep updated_at consistent with other mutable tables.
CREATE TRIGGER set_updated_at_admin_user_sessions
  BEFORE UPDATE ON admin_user_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- 2) SECURITY
-- =============================================================================

GRANT SELECT ON admin_user_sessions TO authenticated;

ALTER TABLE admin_user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_user_sessions_select_own" ON admin_user_sessions
  FOR SELECT
  USING (user_id = auth.uid());

