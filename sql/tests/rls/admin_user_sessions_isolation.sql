-- RLS isolation: admin_user_sessions.
--
-- Policy under test (sql/migrations/007_identity.sql):
--   admin_user_sessions_select_own  — user_id = auth.uid()
--
-- No INSERT/UPDATE/DELETE policies exist: mutations go through service_role
-- Edge Functions only.
--
-- Bug classes this file catches:
--   1. User A reading user B's session rows (session metadata leak: IP, device, browser).
--   2. Super-admin unexpectedly blocked from seeing all sessions.
--   3. Anon being able to read any session rows.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- Seed: one session row per user (user A and user B).
INSERT INTO admin_user_sessions
  (id, user_id, device_id, browser, os, ip_address, first_seen_at, last_activity_at)
VALUES
  ('7a0a0000-0000-4000-8000-000000000001'::uuid,
   'aaaa0000-0000-4000-8000-000000000001'::uuid,
   'pgtap-device-a', 'Firefox', 'Linux', '10.0.0.1',
   now(), now()),
  ('7b0b0000-0000-4000-8000-000000000002'::uuid,
   'bbbb0000-0000-4000-8000-000000000002'::uuid,
   'pgtap-device-b', 'Chrome', 'macOS', '10.0.0.2',
   now(), now())
ON CONFLICT (user_id, device_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees only their own session.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM admin_user_sessions
   WHERE user_id = 'aaaa0000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees their own session row'::text
);

-- 2. admin A cannot see user B's session (silent filter).
SELECT is(
  (SELECT count(*)::int FROM admin_user_sessions
   WHERE id = '7b0b0000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A cannot see user B session (silent filter)'::text
);

-- 3. anon cannot read any sessions.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM admin_user_sessions
   WHERE id = ANY(ARRAY[
     '7a0a0000-0000-4000-8000-000000000001'::uuid,
     '7b0b0000-0000-4000-8000-000000000002'::uuid
   ])),
  0,
  'anon cannot read any admin_user_sessions rows'::text
);

-- 4. super admin sees both sessions.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM admin_user_sessions
   WHERE id = ANY(ARRAY[
     '7a0a0000-0000-4000-8000-000000000001'::uuid,
     '7b0b0000-0000-4000-8000-000000000002'::uuid
   ])),
  2,
  'super_admin sees both session rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation — no policy means cross-user mutation is silently blocked.
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot UPDATE user B's session (0-row update, not an error).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
WITH u AS (
  UPDATE admin_user_sessions
     SET browser = 'pgtap cross-user update attempt'
   WHERE id = '7b0b0000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on user B session silently affects 0 rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
