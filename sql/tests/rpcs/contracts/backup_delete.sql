-- RPC: rpc_backup_delete(UUID) → TABLE(storage_path TEXT)
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_backup_id uuid) returning table(storage_path text)
--   * Non-org-admin caller                     → RAISE 'unauthorized'
--   * Backup not found                         → RAISE 'backup not found'
--   * Snapshot backup                          → RAISE 'snapshot backups are pinned and cannot be deleted'
--   * Success                                  → returns storage_path of deleted backup

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_delete',
  ARRAY['uuid'],
  'rpc_backup_delete(uuid) exists'
);

-- ────────── 2. unauthenticated + unknown id → backup not found (lookup fires first) ──────────
SELECT throws_ok(
  $c$SELECT * FROM rpc_backup_delete('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'backup not found'::text,
  'unknown backup id → raises backup not found'
);

-- ────────── 3. register a backup, then delete as non-owner → unauthorized ──────────
-- Register backup as admin A
SELECT pgtap_test.become_a();

INSERT INTO platform_backups (id, organization_id, origin, format, storage_path, size_bytes, row_counts, period_ids, created_by)
VALUES ('bk010000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'manual', 'json', 'backups/pgtap-del-test.json', 1024,
        '{"periods": 1}'::jsonb,
        ARRAY['cccc0000-0000-4000-8000-000000000001'::uuid],
        'aaaa0000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Admin B trying to delete org A's backup → unauthorized
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_b();

SELECT throws_ok(
  $c$SELECT * FROM rpc_backup_delete('bk010000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'cross-tenant admin → raises unauthorized'
);

-- ────────── 4. snapshot backup → pinned, cannot delete ──────────
INSERT INTO platform_backups (id, organization_id, origin, format, storage_path, size_bytes, row_counts, period_ids, created_by)
VALUES ('bk020000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'snapshot', 'json', 'backups/pgtap-snapshot.json', 2048,
        '{}'::jsonb,
        ARRAY[]::uuid[],
        'aaaa0000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT * FROM rpc_backup_delete('bk020000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'snapshot backups are pinned and cannot be deleted'::text,
  'snapshot backup → raises pinned error'
);

-- ────────── 5. success: delete a manual backup ──────────
SELECT lives_ok(
  $c$SELECT * FROM rpc_backup_delete('bk010000-0000-4000-8000-000000000001'::uuid)$c$,
  'deleting own manual backup succeeds'
);

-- ────────── 6. result returns storage_path ──────────
INSERT INTO platform_backups (id, organization_id, origin, format, storage_path, size_bytes, row_counts, period_ids, created_by)
VALUES ('bk030000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'manual', 'json', 'backups/pgtap-path-check.json', 512,
        '{}'::jsonb,
        ARRAY[]::uuid[],
        'aaaa0000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT storage_path FROM rpc_backup_delete('bk030000-0000-4000-8000-000000000001'::uuid)),
  'backups/pgtap-path-check.json',
  'delete returns the storage_path of the deleted backup'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
