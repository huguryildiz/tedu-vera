-- RPC: rpc_admin_upsert_period_criterion_outcome_map(uuid, uuid, uuid, text) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_period_id uuid, p_period_criterion_id uuid,
--                 p_period_outcome_id uuid, p_coverage_type text DEFAULT 'direct')
--                returning jsonb
--   * Invalid coverage_type         → RAISE 'invalid_coverage_type'
--   * Unknown period                → RAISE 'period_not_found'
--   * Locked period                 → RAISE 'period_locked'
--   * Criterion not in period       → RAISE 'criterion_not_in_period'
--   * Outcome not in period         → RAISE 'outcome_not_in_period'
--   * Non-org-admin caller          → raises in _assert_org_admin
--
-- This RPC wires criteria→outcomes mappings used by analytics. Shape drift
-- would silently break attainment math. See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_upsert_period_criterion_outcome_map',
  ARRAY['uuid', 'uuid', 'uuid', 'text'],
  'rpc_admin_upsert_period_criterion_outcome_map(uuid,uuid,uuid,text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_upsert_period_criterion_outcome_map',
  ARRAY['uuid', 'uuid', 'uuid', 'text'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. invalid coverage_type ──────────
-- NOTE: coverage_type validation runs BEFORE the period lookup, so caller
-- identity/role does not matter here — postgres role is enough.
SELECT throws_ok(
  $c$SELECT rpc_admin_upsert_period_criterion_outcome_map(
      'cccc0000-0000-4000-8000-000000000001'::uuid,
      'a1110000-0000-4000-8000-000000000001'::uuid,
      'a2220000-0000-4000-8000-000000000001'::uuid,
      'sideways'
    )$c$,
  NULL::text,
  'invalid_coverage_type'::text,
  'coverage_type outside {direct, indirect} → invalid_coverage_type'
);

SELECT pgtap_test.become_a();

-- ────────── 3. unknown period → period_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_upsert_period_criterion_outcome_map(
      '00000000-0000-4000-8000-000000000abc'::uuid,
      'a1110000-0000-4000-8000-000000000001'::uuid,
      'a2220000-0000-4000-8000-000000000001'::uuid,
      'direct'
    )$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → period_not_found'
);

-- ────────── 4. locked period → period_locked ──────────
-- Period A2 (cccc...0011) is seeded locked.
SELECT throws_ok(
  $c$SELECT rpc_admin_upsert_period_criterion_outcome_map(
      'cccc0000-0000-4000-8000-000000000011'::uuid,
      'a1110000-0000-4000-8000-000000000011'::uuid,
      'a2220000-0000-4000-8000-000000000011'::uuid,
      'direct'
    )$c$,
  NULL::text,
  'period_locked'::text,
  'locked period → period_locked'
);

-- ────────── 5. criterion not in period → criterion_not_in_period ──────────
-- Period A1 has no period_criteria rows — any criterion id is "not in period".
SELECT throws_ok(
  $c$SELECT rpc_admin_upsert_period_criterion_outcome_map(
      'cccc0000-0000-4000-8000-000000000001'::uuid,
      'a1110000-0000-4000-8000-0000000000ff'::uuid,
      'a2220000-0000-4000-8000-0000000000ff'::uuid,
      'direct'
    )$c$,
  NULL::text,
  'criterion_not_in_period'::text,
  'criterion belonging to a different period → criterion_not_in_period'
);

-- ────────── 6. default p_coverage_type = 'direct' ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_upsert_period_criterion_outcome_map(
      '00000000-0000-4000-8000-000000000abc'::uuid,
      'a1110000-0000-4000-8000-000000000001'::uuid,
      'a2220000-0000-4000-8000-000000000001'::uuid
    )$c$,
  NULL::text,
  'period_not_found'::text,
  '3-arg call (default coverage_type) reaches period lookup (no invalid_coverage_type)'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
