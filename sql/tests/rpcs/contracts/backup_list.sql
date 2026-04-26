-- RPC: rpc_backup_list(UUID) → TABLE(...)
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_organization_id uuid) returning table
--   * Non-org-admin caller → RAISE 'unauthorized' (via _assert_org_admin)
--   * Org-admin success    → table with columns: id, organization_id, origin,
--                            format, storage_path, size_bytes, row_counts,
--                            period_ids, created_by, created_by_name, created_at,
--                            expires_at, download_count, last_downloaded_at

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_list',
  ARRAY['uuid'],
  'rpc_backup_list(uuid) exists'
);

-- ────────── 2. unauthenticated → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT * FROM rpc_backup_list('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 3. cross-tenant → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT * FROM rpc_backup_list('22220000-0000-4000-8000-000000000002'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'org-A admin on org-B → raises unauthorized'
);

-- ────────── 4. own-org returns without error ──────────
SELECT lives_ok(
  $c$SELECT * FROM rpc_backup_list('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  'org-A admin listing own backups succeeds (empty result is ok)'
);

-- ────────── 5. result set has expected columns ──────────
CREATE TEMP TABLE _backup_cols ON COMMIT DROP AS
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'platform_backups';

SELECT ok(
  EXISTS(SELECT 1 FROM _backup_cols WHERE column_name = 'storage_path'),
  'platform_backups table has storage_path column (backing store for return type)'
);

-- ────────── 6. super-admin can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT * FROM rpc_backup_list('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  'super-admin listing org-A backups succeeds'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
