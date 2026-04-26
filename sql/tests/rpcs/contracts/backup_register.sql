-- RPC: rpc_backup_register(UUID, TEXT, BIGINT, TEXT, JSONB, UUID[], TEXT) → uuid
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_org_id UUID, p_filename TEXT, p_file_size BIGINT,
--                 p_storage_origin TEXT, p_metadata JSONB, p_affected_user_ids UUID[],
--                 p_origin TEXT DEFAULT 'manual') returning uuid
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Validates origin and format
--   * Returns backup ID (UUID)

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_register',
  ARRAY['uuid'::text, 'text'::text, 'bigint'::text, 'text'::text, 'jsonb'::text, 'uuid[]'::text, 'text'::text],
  'rpc_backup_register with 7 params exists'
);

SELECT function_returns(
  'public', 'rpc_backup_register',
  ARRAY['uuid'::text, 'text'::text, 'bigint'::text, 'text'::text, 'jsonb'::text, 'uuid[]'::text, 'text'::text],
  'uuid',
  'returns uuid'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_backup_register('pgtap-org-1111'::uuid, 'backup.sql', 1024000, 's3', '{}'::jsonb, ARRAY[]::uuid[])$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can register backup for their org ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT is_uuid(
  rpc_backup_register(
    (SELECT id FROM organizations WHERE name = 'org_a'),
    'backup-2024-01-15.sql',
    2048000,
    's3',
    '{}'::jsonb,
    ARRAY[]::uuid[]
  ),
  'org_a admin can register backup, returns uuid'
);

-- ────────__ 4. org-admin cannot register for another org ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_register((SELECT id FROM organizations WHERE name = 'org_b'), 'backup.sql', 1024000, 's3', '{}'::jsonb, ARRAY[]::uuid[])$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. super-admin can register for any org ──────────
SELECT pgtap_test.become_super();

SELECT is_uuid(
  rpc_backup_register(
    (SELECT id FROM organizations WHERE name = 'org_b'),
    'backup-org-b.sql',
    3048000,
    'gcs',
    '{}'::jsonb,
    ARRAY[]::uuid[]
  ),
  'super-admin can register backup for any org'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
