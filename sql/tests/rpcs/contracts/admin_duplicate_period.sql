-- RPC: rpc_admin_duplicate_period(uuid) → uuid
--
-- Pins the public contract:
--   * Signature: (p_source_period_id uuid) returning uuid
--   * Unknown period            → RAISE 'period_not_found'
--   * Unauthorized caller       → RAISE (via _assert_org_admin)
--   * Success                   → returns new UUID of cloned period
--
-- Critical: state-changing RPC that duplicates a period (criteria, outcomes, etc.)

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_admin_duplicate_period', ARRAY['uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_admin_duplicate_period', ARRAY['uuid'], 'uuid', 'returns uuid');

-- 3. unknown period → period_not_found
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $c$SELECT rpc_admin_duplicate_period('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → period_not_found'
);

-- 4. success: returns non-null UUID
SELECT isnt(
  rpc_admin_duplicate_period('cccc0000-0000-4000-8000-000000000001'::uuid),
  NULL::uuid,
  'valid period → returns new uuid'
);

-- 5. returned UUID differs from source
SELECT isnt(
  rpc_admin_duplicate_period('cccc0000-0000-4000-8000-000000000001'::uuid),
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  'new period id differs from source'
);

-- 6. NULL period_id → period_not_found
SELECT throws_ok(
  $c$SELECT rpc_admin_duplicate_period(NULL::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'NULL period_id → period_not_found'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
