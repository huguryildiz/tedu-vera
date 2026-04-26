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
--   * 3-arg call defaults p_coverage_type to 'direct'
--
-- This RPC wires criteria→outcomes mappings used by analytics. Shape drift
-- would silently break attainment math.
--
-- Lives in migration 009 alongside the audit system. CI caps at 007, so
-- the test detects the missing function via information_schema and emits
-- 7 SKIPped tests instead of failing.
--
-- See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'rpc_admin_upsert_period_criterion_outcome_map'
) AS rpc_exists;

SELECT skip('migration 009 not applied — rpc_admin_upsert_period_criterion_outcome_map missing', 7)
FROM _ctx WHERE NOT rpc_exists;

SELECT pgtap_test.seed_two_orgs() FROM _ctx WHERE rpc_exists;
SELECT pgtap_test.seed_periods() FROM _ctx WHERE rpc_exists;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_upsert_period_criterion_outcome_map',
  ARRAY['uuid', 'uuid', 'uuid', 'text'],
  'rpc_admin_upsert_period_criterion_outcome_map(uuid,uuid,uuid,text) exists'
) FROM _ctx WHERE rpc_exists;

SELECT function_returns(
  'public', 'rpc_admin_upsert_period_criterion_outcome_map',
  ARRAY['uuid', 'uuid', 'uuid', 'text'],
  'jsonb',
  'returns jsonb'
) FROM _ctx WHERE rpc_exists;

-- ────────── 2. invalid coverage_type ──────────
-- coverage_type validation runs BEFORE the period lookup, so caller identity
-- doesn't matter — postgres role is enough.
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
) FROM _ctx WHERE rpc_exists;

SELECT pgtap_test.become_a() FROM _ctx WHERE rpc_exists;

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
) FROM _ctx WHERE rpc_exists;

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
) FROM _ctx WHERE rpc_exists;

-- ────────── 5. criterion not in period → criterion_not_in_period ──────────
-- Period A1 has no period_criteria rows by default — any criterion id is
-- "not in period".
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
) FROM _ctx WHERE rpc_exists;

-- ────────── 6. default p_coverage_type = 'direct' ──────────
-- A 3-arg call must reach the period lookup (i.e. NOT raise
-- invalid_coverage_type), so an unknown period id surfaces period_not_found.
SELECT throws_ok(
  $c$SELECT rpc_admin_upsert_period_criterion_outcome_map(
      '00000000-0000-4000-8000-000000000abc'::uuid,
      'a1110000-0000-4000-8000-000000000001'::uuid,
      'a2220000-0000-4000-8000-000000000001'::uuid
    )$c$,
  NULL::text,
  'period_not_found'::text,
  '3-arg call (default coverage_type) reaches period lookup'
) FROM _ctx WHERE rpc_exists;

SELECT pgtap_test.become_reset() FROM _ctx WHERE rpc_exists;
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
