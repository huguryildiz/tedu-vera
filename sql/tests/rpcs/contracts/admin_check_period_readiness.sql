-- RPC: rpc_admin_check_period_readiness(UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_period_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Returns {ready, missing_items[], missing_count}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_check_period_readiness',
  ARRAY['uuid'::text],
  'rpc_admin_check_period_readiness(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_check_period_readiness',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_check_period_readiness('00000000-0000-0000-0000-000000009999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────── 3. org-admin can check own period ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_check_period_readiness((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))$c$,
  'org_a admin can check own period readiness'
);

-- ────────__ 4. org-admin cannot check other org period ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_check_period_readiness((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. response shape contains readiness info ──────────
SELECT ok(
  (SELECT rpc_admin_check_period_readiness((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))::jsonb ? 'ready'),
  'response has ready key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
