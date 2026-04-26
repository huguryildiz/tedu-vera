-- RPC: rpc_backup_record_download(UUID) → void
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_backup_id uuid) returning void
--   * Backup not found     → RAISE 'backup not found'
--   * Non-org-admin caller → RAISE 'unauthorized' (via _assert_org_admin)
--   * Success              → increments download_count + sets last_downloaded_at

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_record_download',
  ARRAY['uuid'],
  'rpc_backup_record_download(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_backup_record_download',
  ARRAY['uuid'],
  'void',
  'returns void'
);

-- ────────── 2. unknown backup → backup not found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_backup_record_download('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'backup not found'::text,
  'unknown backup id → raises backup not found'
);

-- ────────── 3. setup: register a backup ──────────
INSERT INTO platform_backups (id, organization_id, origin, format, storage_path, size_bytes, row_counts, period_ids, created_by, download_count)
VALUES ('bkdl0000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'manual', 'json', 'backups/pgtap-dl-test.json', 1024,
        '{}'::jsonb,
        ARRAY[]::uuid[],
        'aaaa0000-0000-4000-8000-000000000001'::uuid,
        0)
ON CONFLICT (id) DO NOTHING;

-- ────────── 4. cross-tenant → unauthorized ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_b();

SELECT throws_ok(
  $c$SELECT rpc_backup_record_download('bkdl0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'cross-tenant admin → raises unauthorized'
);

-- ────────── 5. own-org admin succeeds ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_backup_record_download('bkdl0000-0000-4000-8000-000000000001'::uuid)$c$,
  'org-admin recording download succeeds'
);

-- ────────── 6. download_count incremented ──────────
SELECT is(
  (SELECT download_count FROM platform_backups
   WHERE id = 'bkdl0000-0000-4000-8000-000000000001'::uuid),
  1,
  'download_count was incremented to 1 after record_download call'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
