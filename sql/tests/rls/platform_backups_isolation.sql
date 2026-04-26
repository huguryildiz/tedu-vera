-- RLS isolation: platform_backups.
--
-- Policy under test (sql/migrations/008_platform.sql §platform_backups):
--   platform_backups_select_org_admin  — org-scoped SELECT via memberships
--                                         (no super_admin clause — by design)
--   (no INSERT/UPDATE/DELETE policies — writes go through SECURITY DEFINER RPCs)
--
-- Grant situation: authenticated and anon have NO direct table grants.
-- All access must go through SECURITY DEFINER RPCs
-- (rpc_backup_list, rpc_backup_register, rpc_backup_delete).
-- The RLS SELECT policy is unreachable without a prior GRANT SELECT.
--
-- Bug classes this file catches:
--   1. Admin reading backup records directly (backup path + content exposure).
--   2. Anon reading backup records directly.
--   3. Any role writing backup records directly (bypassing RPC audit trail).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(4);

SELECT pgtap_test.seed_two_orgs();

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation — no table grant → permission denied for all roles.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A SELECT throws 42501 (no SELECT grant for authenticated).
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $$SELECT count(*)::int FROM platform_backups$$,
  '42501',
  NULL,
  'admin A SELECT on platform_backups throws 42501 (no table grant)'::text
);

-- 2. anon SELECT throws 42501 (no SELECT grant for anon).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $$SELECT count(*)::int FROM platform_backups$$,
  '42501',
  NULL,
  'anon SELECT on platform_backups throws 42501 (no table grant)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — no INSERT grant + no permissive write policy.
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A direct INSERT throws 42501 (no INSERT grant).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO platform_backups
       (organization_id, origin, format, storage_path, size_bytes, row_counts)
     VALUES (
       '11110000-0000-4000-8000-000000000001'::uuid,
       'manual', 'json', 'backups/pgtap-direct.json', 0, '{}'
     )$i$,
  '42501',
  NULL,
  'admin A direct INSERT into platform_backups throws 42501 (no INSERT grant)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation — no UPDATE grant.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A UPDATE throws 42501 (no UPDATE grant).
SELECT throws_ok(
  $$UPDATE platform_backups SET download_count = 999$$,
  '42501',
  NULL,
  'admin A UPDATE on platform_backups throws 42501 (no UPDATE grant)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
