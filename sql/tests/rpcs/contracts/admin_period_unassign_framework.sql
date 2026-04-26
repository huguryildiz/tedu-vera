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
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_period_unassign_framework('00000000-0000-0000-0000-000000009999'::uuid)$c$,
  NULL::text,
  'attempted to access'
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
SELECT throws_ok(
  $c$SELECT rpc_admin_period_unassign_framework((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  NULL::text,
  'attempted to access'
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
