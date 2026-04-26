-- RPC: rpc_backup_record_download(UUID) → void
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_backup_id UUID) returning void
--   * Authenticated required
--   * Calls _assert_org_admin implicitly via backup ownership
--   * May raise 'backup not found'
--   * Updates backup download metadata

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

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

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_backup_record_download('pgtap-backup-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can record download for own org backup ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

-- Create a backup for org_a
INSERT INTO backups (id, organization_id, filename, file_size, storage_origin, metadata, origin, created_at, updated_at)
VALUES (
  'pgtap-backup-001'::uuid,
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'backup.sql',
  1024000,
  's3',
  '{}'::jsonb,
  'manual',
  now(),
  now()
);

SELECT lives_ok(
  $c$SELECT rpc_backup_record_download('pgtap-backup-001'::uuid)$c$,
  'org_a admin can record download'
);

-- ────────── 4. org-admin cannot record download for other org backup ──────────
INSERT INTO backups (id, organization_id, filename, file_size, storage_origin, metadata, origin, created_at, updated_at)
VALUES (
  'pgtap-backup-002'::uuid,
  (SELECT id FROM organizations WHERE name = 'org_b'),
  'backup.sql',
  1024000,
  's3',
  '{}'::jsonb,
  'manual',
  now(),
  now()
);

SELECT throws_ok(
  $c$SELECT rpc_backup_record_download('pgtap-backup-002'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. super-admin can record download for any backup ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_backup_record_download('pgtap-backup-002'::uuid)$c$,
  'super-admin can record download for any org backup'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
