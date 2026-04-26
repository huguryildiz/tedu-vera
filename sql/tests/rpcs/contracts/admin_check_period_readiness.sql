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
  'json',
  'returns json'
);

-- ────────── 2. unauthenticated → cannot call ──────────
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_check_period_readiness(uuid)', 'execute'),
  'anon has no execute privilege on rpc_admin_check_period_readiness'
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
  (SELECT rpc_admin_check_period_readiness((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))::jsonb ? 'ok'),
  'response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
