-- RLS isolation: platform_settings.
--
-- Policy under test (sql/migrations/008_platform.sql §platform_settings):
--   platform_settings_super_admin_read  — FOR SELECT TO authenticated
--                                          USING (current_user_is_super_admin())
--
-- Grant situation: authenticated and anon have NO direct table grants.
-- All access must go through SECURITY DEFINER RPCs
-- (rpc_admin_get_platform_settings, rpc_public_platform_settings).
-- Even super_admin cannot SELECT directly — the RLS policy is unreachable
-- without a prior GRANT SELECT.
--
-- Bug classes this file catches:
--   1. Non-super admin reading platform config (API secrets / feature flags leak).
--   2. Anon reading platform config.
--   3. Any role bypassing SECURITY DEFINER RPCs and writing directly.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(3);

SELECT pgtap_test.seed_two_orgs();

-- platform_settings is a single-row table (id = 1) seeded by the migration.

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation — no table grant → permission denied for all roles.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A SELECT throws 42501 (no SELECT grant for authenticated).
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $$SELECT count(*)::int FROM platform_settings WHERE id = 1$$,
  '42501',
  NULL,
  'admin A SELECT on platform_settings throws 42501 (no table grant)'::text
);

-- 2. anon SELECT throws 42501 (no SELECT grant for anon).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $$SELECT count(*)::int FROM platform_settings WHERE id = 1$$,
  '42501',
  NULL,
  'anon SELECT on platform_settings throws 42501 (no table grant)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — no INSERT grant → permission denied.
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A direct INSERT/UPSERT throws 42501 (no INSERT grant for authenticated).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO platform_settings (id) VALUES (1)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()$i$,
  '42501',
  NULL,
  'admin A direct INSERT/UPSERT on platform_settings throws 42501 (no table grant)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
