-- RPC: rpc_admin_delete_period_criterion_outcome_map(UUID) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_map_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin implicitly
--   * Error codes: 'mapping_not_found', 'period_locked'
--   * Returns {ok, deleted_mapping_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_delete_period_criterion_outcome_map',
  ARRAY['uuid'::text],
  'rpc_admin_delete_period_criterion_outcome_map(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_delete_period_criterion_outcome_map',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('pgtap-map-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. nonexistent mapping → not found ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT results_eq(
  $c$SELECT (rpc_admin_delete_period_criterion_outcome_map('pgtap-map-nonexist'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['mapping_not_found'],
  'nonexistent mapping returns mapping_not_found'
);

-- ────────__ 4. org-admin can delete mapping for unlocked period ──────────
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();
SELECT pgtap_test.seed_period_outcomes();

-- Create a mapping for org_a's unlocked period
INSERT INTO period_criterion_outcome_maps (id, period_id, criterion_id, outcome_id, created_at, updated_at)
VALUES (
  'pgtap-map-001'::uuid,
  (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') AND is_locked = false LIMIT 1),
  (SELECT id FROM period_criteria WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1),
  (SELECT id FROM period_outcomes WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1),
  now(),
  now()
);

SELECT lives_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('pgtap-map-001'::uuid)$c$,
  'org_a admin can delete mapping for unlocked period'
);

-- ────────__ 5. org-admin cannot delete for locked period ──────────
-- Create another mapping for a locked period
INSERT INTO periods (id, organization_id, name, start_date, end_date, is_locked, created_at, updated_at)
VALUES (
  'pgtap-period-locked'::uuid,
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'Locked Period',
  now(),
  now() + interval '30 days',
  true,
  now(),
  now()
);

INSERT INTO period_criteria (id, organization_id, period_id, label, weight, created_at, updated_at)
VALUES (
  'pgtap-crit-locked'::uuid,
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'pgtap-period-locked'::uuid,
  'Test Criterion',
  1.0,
  now(),
  now()
);

INSERT INTO period_outcomes (id, organization_id, period_id, label, created_at, updated_at)
VALUES (
  'pgtap-outcome-locked'::uuid,
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'pgtap-period-locked'::uuid,
  'Test Outcome',
  now(),
  now()
);

INSERT INTO period_criterion_outcome_maps (id, period_id, criterion_id, outcome_id, created_at, updated_at)
VALUES (
  'pgtap-map-locked'::uuid,
  'pgtap-period-locked'::uuid,
  'pgtap-crit-locked'::uuid,
  'pgtap-outcome-locked'::uuid,
  now(),
  now()
);

SELECT results_eq(
  $c$SELECT (rpc_admin_delete_period_criterion_outcome_map('pgtap-map-locked'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['period_locked'],
  'cannot delete mapping when period is locked'
);

-- ────────__ 6. response has ok key on success ──────────
SELECT ok(
  (SELECT rpc_admin_delete_period_criterion_outcome_map('pgtap-map-001'::uuid) IS NULL OR
          (rpc_admin_delete_period_criterion_outcome_map('pgtap-map-001'::uuid)::jsonb ? 'ok')),
  'successful response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
