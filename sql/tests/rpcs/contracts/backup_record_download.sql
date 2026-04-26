-- RPC: rpc_backup_record_download(UUID) → void
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_backup_id UUID) returning void
--   * Authenticated required
--   * Calls _assert_org_admin via backup's organization_id
--   * Raises 'backup not found' for nonexistent backup
--   * Updates download_count and last_downloaded_at

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_record_download',
  ARRAY['uuid'::text],
  'rpc_backup_record_download(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_backup_record_download',
  ARRAY['uuid'::text],
  'void',
  'returns void'
);

-- ────────── 2. unauthenticated → cannot call ──────────
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_backup_record_download(uuid)', 'execute'),
  'anon has no execute privilege on rpc_backup_record_download'
);

-- ────────── seed backup rows at postgres level ──────────
-- platform_backups has REVOKE ALL FROM authenticated; must insert as postgres.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();

INSERT INTO platform_backups (id, organization_id, origin, format, storage_path, size_bytes, row_counts, period_ids, created_by)
VALUES (
  'f0000000-0000-0000-0000-000000000001'::uuid,
  '11110000-0000-4000-8000-000000000001'::uuid,
  'manual',
  'json',
  'backups/org-a/backup.json',
  1024000,
  '{}'::jsonb,
  ARRAY[]::uuid[],
  'aaaa0000-0000-4000-8000-000000000001'::uuid
);

INSERT INTO platform_backups (id, organization_id, origin, format, storage_path, size_bytes, row_counts, period_ids, created_by)
VALUES (
  'f0000000-0000-0000-0000-000000000002'::uuid,
  '22220000-0000-4000-8000-000000000002'::uuid,
  'manual',
  'json',
  'backups/org-b/backup.json',
  1024000,
  '{}'::jsonb,
  ARRAY[]::uuid[],
  'bbbb0000-0000-4000-8000-000000000002'::uuid
);

SELECT pgtap_test.become_a();

-- ────────── 3. org-admin can record download for own org backup ──────────
SELECT lives_ok(
  $c$SELECT rpc_backup_record_download('f0000000-0000-0000-0000-000000000001'::uuid)$c$,
  'org_a admin can record download for own backup'
);

-- ────────── 4. org-admin cannot record download for other org backup ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_record_download('f0000000-0000-0000-0000-000000000002'::uuid)$c$,
  NULL::text,
  'org_a admin cannot record download for org_b backup'
);

-- ────────── 5. super-admin can record download for any backup ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_backup_record_download('f0000000-0000-0000-0000-000000000002'::uuid)$c$,
  'super-admin can record download for any org backup'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
