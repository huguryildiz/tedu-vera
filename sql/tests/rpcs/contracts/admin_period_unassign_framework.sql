-- RPC: rpc_admin_period_unassign_framework(UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_period_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Unassigns accreditation framework from period
--   * Error: 'period_not_found', 'unauthorized'

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_period_unassign_framework',
  ARRAY['uuid'::text],
  'rpc_admin_period_unassign_framework(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_period_unassign_framework',
  ARRAY['uuid'::text],
  'json',
  'returns json'
);

-- ────────── 2. unauthenticated → cannot call ──────────
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_period_unassign_framework(uuid)', 'execute'),
  'anon has no execute privilege on rpc_admin_period_unassign_framework'
);

-- ────────── 3. org-admin can unassign framework ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_period_unassign_framework((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))$c$,
  'org_a admin can unassign framework from period'
);

-- ────────__ 4. org-admin cannot unassign for other org ──────────
-- RLS hides org_b periods from org_a admin, so the function returns period_not_found (no exception)
SELECT results_eq(
  $c$SELECT (rpc_admin_period_unassign_framework((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))::jsonb ->> 'error')$c$,
  ARRAY['period_not_found'],
  'org_a admin cannot access org_b period (RLS hides it, returns period_not_found)'
);

-- ────────__ 5. super-admin can unassign any period framework ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_period_unassign_framework((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  'super-admin can unassign framework from any period'
);

-- ────────── 6. response has ok key ──────────
SELECT ok(
  (SELECT rpc_admin_period_unassign_framework((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))::jsonb ? 'ok'),
  'response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
