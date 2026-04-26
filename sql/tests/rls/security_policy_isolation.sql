-- RLS isolation: security_policy.
--
-- Policy under test (sql/migrations/004_rls.sql §security_policy):
--   security_policy_super_admin_all  — super_admin FOR ALL (read + write)
--
-- Grant situation: authenticated and anon have NO direct table grants.
-- All access must go through SECURITY DEFINER RPCs.
-- The super_admin_all RLS policy is only reachable via those RPCs.
--
-- Bug classes this file catches:
--   1. Non-super admin reading security settings (PIN policy / OAuth config leak).
--   2. Anon reading security settings (unauthenticated config leak).
--   3. Any role bypassing RPCs and writing security settings directly.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(3);

SELECT pgtap_test.seed_two_orgs();

-- security_policy is a single-row table (id = 1) seeded by the migration.

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation — no grants for authenticated/anon → permission denied.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A SELECT throws 42501 (no SELECT grant for authenticated).
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $$SELECT count(*)::int FROM security_policy WHERE id = 1$$,
  '42501',
  NULL,
  'admin A SELECT on security_policy throws 42501 (no table grant)'::text
);

-- 2. anon SELECT throws 42501 (no SELECT grant for anon).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $$SELECT count(*)::int FROM security_policy WHERE id = 1$$,
  '42501',
  NULL,
  'anon SELECT on security_policy throws 42501 (no table grant)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — no INSERT grant → permission denied.
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A INSERT/UPSERT throws 42501 (no INSERT grant for authenticated).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO security_policy (id, policy) VALUES (1, '{}')
     ON CONFLICT (id) DO UPDATE SET updated_at = now()$i$,
  '42501',
  NULL,
  'admin A INSERT/UPSERT on security_policy throws 42501 (no table grant)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
