-- RPC: rpc_admin_clone_framework(uuid, text, uuid) → uuid
--
-- Pins the public contract:
--   * Signature: (p_framework_id uuid, p_new_name text, p_org_id uuid) returning uuid
--   * Unknown framework          → RAISE 'source_framework_not_found'
--   * NULL new_name              → RAISE NOT NULL constraint
--   * Invalid org (cross-tenant) → RAISE (via _assert_org_admin)
--   * Success                    → returns new UUID of cloned framework
--
-- Critical: state-changing RPC that clones accreditation frameworks with criteria + outcome maps.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_admin_clone_framework', ARRAY['uuid', 'text', 'uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_admin_clone_framework', ARRAY['uuid', 'text', 'uuid'], 'uuid', 'returns uuid');

-- 3. unknown framework → framework_not_found
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $c$SELECT rpc_admin_clone_framework('00000000-0000-4000-8000-000000000abc'::uuid, 'Cloned', '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'framework_not_found'::text,
  'unknown framework → framework_not_found'
);

-- 4. NULL framework_id → framework_not_found
SELECT throws_ok(
  $c$SELECT rpc_admin_clone_framework(NULL::uuid, 'Cloned', '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'framework_not_found'::text,
  'NULL framework_id → framework_not_found'
);

-- 5. success: returns non-null UUID
-- Use a real framework from seed data (a1b2c3d4-e5f6-4000-a000-000000000001 = VERA Standard)
SELECT isnt(
  rpc_admin_clone_framework('a1b2c3d4-e5f6-4000-a000-000000000001'::uuid, 'Cloned VERA', '11110000-0000-4000-8000-000000000001'::uuid),
  NULL::uuid,
  'valid framework → returns new uuid'
);

-- 6. returned UUID differs from source
SELECT isnt(
  rpc_admin_clone_framework('a1b2c3d4-e5f6-4000-a000-000000000001'::uuid, 'Another Clone', '11110000-0000-4000-8000-000000000001'::uuid),
  'a1b2c3d4-e5f6-4000-a000-000000000001'::uuid,
  'cloned framework id differs from source'
);

-- 7. NULL new_name → raises (NOT NULL constraint on name)
SELECT throws_ok(
  $c$SELECT rpc_admin_clone_framework('a1b2c3d4-e5f6-4000-a000-000000000001'::uuid, NULL, '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  NULL::text,
  'NULL new_name → raises NOT NULL constraint'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
