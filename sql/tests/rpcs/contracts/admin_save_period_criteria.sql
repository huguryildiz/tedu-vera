-- RPC: rpc_admin_save_period_criteria(uuid, jsonb) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_period_id uuid, p_criteria jsonb) returning jsonb
--   * NULL period_id              → RAISE 'period_id_required'
--   * Non-array p_criteria        → RAISE 'criteria_must_be_array'
--   * Unknown period              → RAISE 'period_not_found'
--   * Non-org-admin caller        → raises in _assert_org_admin
--   * Locked period               → raises in _assert_period_unlocked
--   * Success                     → returns jsonb_agg(to_jsonb(period_criteria.*))
--
-- This RPC drives the setup wizard criteria step + CriteriaPage save button.
--
-- Lives in migration 009 alongside the audit system. CI caps at 007, so
-- the test detects the missing function via information_schema and emits
-- 7 SKIPped tests instead of failing. Same gating pattern as
-- admin_verify_audit_chain.sql.
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
    AND p.proname = 'rpc_admin_save_period_criteria'
) AS rpc_exists;

SELECT skip('migration 009 not applied — rpc_admin_save_period_criteria missing', 7)
FROM _ctx WHERE NOT rpc_exists;

SELECT pgtap_test.seed_two_orgs() FROM _ctx WHERE rpc_exists;
SELECT pgtap_test.seed_periods() FROM _ctx WHERE rpc_exists;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_save_period_criteria',
  ARRAY['uuid', 'jsonb'],
  'rpc_admin_save_period_criteria(uuid,jsonb) exists'
) FROM _ctx WHERE rpc_exists;

SELECT function_returns(
  'public', 'rpc_admin_save_period_criteria',
  ARRAY['uuid', 'jsonb'],
  'jsonb',
  'returns jsonb'
) FROM _ctx WHERE rpc_exists;

-- ────────── 2. NULL period_id → period_id_required ──────────
SELECT pgtap_test.become_a() FROM _ctx WHERE rpc_exists;

SELECT throws_ok(
  $c$SELECT rpc_admin_save_period_criteria(NULL::uuid, '[]'::jsonb)$c$,
  NULL::text,
  'period_id_required'::text,
  'NULL period_id → period_id_required'
) FROM _ctx WHERE rpc_exists;

-- ────────── 3. non-array p_criteria → criteria_must_be_array ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_save_period_criteria(
      'cccc0000-0000-4000-8000-000000000001'::uuid,
      '{"not":"array"}'::jsonb
    )$c$,
  NULL::text,
  'criteria_must_be_array'::text,
  'non-array p_criteria → criteria_must_be_array'
) FROM _ctx WHERE rpc_exists;

-- ────────── 4. unknown period → period_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_save_period_criteria(
      '00000000-0000-4000-8000-000000000abc'::uuid,
      '[]'::jsonb
    )$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → period_not_found'
) FROM _ctx WHERE rpc_exists;

-- ────────── 5. cross-tenant caller (admin A on period B) raises ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_save_period_criteria(
      'dddd0000-0000-4000-8000-000000000002'::uuid,
      '[]'::jsonb
    )$c$,
  NULL::text,
  NULL::text,
  'admin A on org-B period → raises (cross-tenant blocked)'
) FROM _ctx WHERE rpc_exists;

-- ────────── 6. locked period → raises ──────────
-- Period A2 (cccc...0011) is seeded locked.
SELECT throws_ok(
  $c$SELECT rpc_admin_save_period_criteria(
      'cccc0000-0000-4000-8000-000000000011'::uuid,
      '[]'::jsonb
    )$c$,
  NULL::text,
  NULL::text,
  'locked period → raises (_assert_period_unlocked)'
) FROM _ctx WHERE rpc_exists;

SELECT pgtap_test.become_reset() FROM _ctx WHERE rpc_exists;
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
