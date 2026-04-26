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
SELECT plan(6);

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
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_backup_register(uuid, text, bigint, text, jsonb, uuid[], text)', 'execute'),
  'anon has no execute privilege on rpc_backup_register'
);

-- ────────__ 3. org-admin can register backup for their org ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT ok(
  rpc_backup_register(
    (SELECT id FROM organizations WHERE name = 'pgtap Org A'),
    'backup-2024-01-15.sql',
    2048000,
    'json',
    '{}'::jsonb,
    ARRAY[]::uuid[]
  ) IS NOT NULL,
  'org_a admin can register backup, returns uuid'
);

-- ────────__ 4. org-admin cannot register for another org ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_register((SELECT id FROM organizations WHERE name = 'pgtap Org B'), 'backup.sql', 1024000, 's3', '{}'::jsonb, ARRAY[]::uuid[])$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. super-admin can register for any org ──────────
SELECT pgtap_test.become_super();

SELECT ok(
  rpc_backup_register(
    (SELECT id FROM organizations WHERE name = 'pgtap Org B'),
    'backup-org-b.sql',
    3048000,
    'json',
    '{}'::jsonb,
    ARRAY[]::uuid[]
  ) IS NOT NULL,
  'super-admin can register backup for any org'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
