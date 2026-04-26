-- RPC: rpc_backup_register(UUID, TEXT, BIGINT, TEXT, JSONB, UUID[], TEXT) → uuid
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_organization_id uuid, p_storage_path text, p_size_bytes bigint,
--                  p_format text, p_row_counts jsonb, p_period_ids uuid[],
--                  p_origin text DEFAULT 'manual') returning uuid
--   * Non-org-admin caller         → RAISE 'unauthorized'
--   * Invalid origin value         → RAISE 'invalid origin: <value>'
--   * Invalid format value         → RAISE 'invalid format: <value>'
--   * Snapshot origin              → expires_at=NULL (pinned)
--   * Success                      → returns new backup UUID

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_register',
  ARRAY['uuid', 'text', 'bigint', 'text', 'jsonb', 'uuid[]', 'text'],
  'rpc_backup_register(uuid,text,bigint,text,jsonb,uuid[],text) exists'
);

SELECT function_returns(
  'public', 'rpc_backup_register',
  ARRAY['uuid', 'text', 'bigint', 'text', 'jsonb', 'uuid[]', 'text'],
  'uuid',
  'returns uuid'
);

-- ────────── 2. unauthenticated → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_register(
    '11110000-0000-4000-8000-000000000001'::uuid,
    'backups/test.json', 1024, 'json', '{}', ARRAY[]::uuid[], 'manual')$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 3. invalid origin ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_backup_register(
    '11110000-0000-4000-8000-000000000001'::uuid,
    'backups/test.json', 1024, 'json', '{}', ARRAY[]::uuid[], 'bad_origin')$c$,
  NULL::text,
  'invalid origin: bad_origin'::text,
  'invalid origin → raises invalid origin: <value>'
);

-- ────────── 4. invalid format ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_register(
    '11110000-0000-4000-8000-000000000001'::uuid,
    'backups/test.json', 1024, 'csv', '{}', ARRAY[]::uuid[], 'manual')$c$,
  NULL::text,
  'invalid format: csv'::text,
  'invalid format → raises invalid format: <value>'
);

-- ────────── 5. cross-tenant → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_register(
    '22220000-0000-4000-8000-000000000002'::uuid,
    'backups/test.json', 1024, 'json', '{}', ARRAY[]::uuid[], 'manual')$c$,
  NULL::text,
  'unauthorized'::text,
  'org-A admin on org-B → raises unauthorized'
);

-- ────────── 6. manual backup success → returns UUID ──────────
CREATE TEMP TABLE _register_resp ON COMMIT DROP AS
SELECT rpc_backup_register(
  '11110000-0000-4000-8000-000000000001'::uuid,
  'backups/pgtap-test-001.json',
  2048,
  'json',
  '{"periods": 1}'::jsonb,
  ARRAY['cccc0000-0000-4000-8000-000000000001'::uuid],
  'manual'
) AS new_id;

SELECT ok(
  (SELECT new_id IS NOT NULL FROM _register_resp),
  'manual backup register returns a non-null UUID'
);

-- ────────── 7. snapshot backup → expires_at is NULL ──────────
CREATE TEMP TABLE _snapshot_id ON COMMIT DROP AS
SELECT rpc_backup_register(
  '11110000-0000-4000-8000-000000000001'::uuid,
  'backups/pgtap-snapshot-001.json',
  4096,
  'json',
  '{"periods": 1}'::jsonb,
  ARRAY['cccc0000-0000-4000-8000-000000000001'::uuid],
  'snapshot'
) AS new_id;

SELECT is(
  (SELECT expires_at FROM platform_backups
   WHERE id = (SELECT new_id FROM _snapshot_id)),
  NULL::timestamptz,
  'snapshot backup has expires_at=NULL (pinned)'
);

-- ────────── 8. manual backup has non-null expires_at ──────────
SELECT ok(
  (SELECT expires_at IS NOT NULL FROM platform_backups
   WHERE id = (SELECT new_id FROM _register_resp)),
  'manual backup has non-null expires_at'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
