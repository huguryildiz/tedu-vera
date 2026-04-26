-- RPC: rpc_get_period_impact(UUID) → json
--
-- Pins the public contract:
--   * Signature: (p_period_id UUID) returning json
--   * Authenticated org-admin required
--   * Returns impact metrics: {completion_rate, avg_score, participation}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_get_period_impact',
  ARRAY['uuid'::text],
  'rpc_get_period_impact(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_get_period_impact',
  ARRAY['uuid'::text],
  'json',
  'returns json'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_get_period_impact('pgtap-period-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can get impact metrics ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_get_period_impact((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1))$c$,
  'org_a admin can get period impact'
);

-- ────────__ 4. org-admin cannot get other org period impact ──────────
SELECT throws_ok(
  $c$SELECT rpc_get_period_impact((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_b') LIMIT 1))$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. super-admin can get any period impact ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_get_period_impact((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_b') LIMIT 1))$c$,
  'super-admin can get any period impact'
);

-- ────────__ 6. response has impact metrics ──────────
SELECT ok(
  (SELECT rpc_get_period_impact((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1))::jsonb ? 'completion_rate'),
  'response has completion_rate key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
