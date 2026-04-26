-- RPC: rpc_admin_set_period_criteria_name(UUID, TEXT) → void
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_name text) returning void
--   * Unknown period      → RAISE 'period_not_found'
--   * Non-org-admin       → RAISE 'unauthorized' (via _assert_org_admin)
--   * Cross-tenant admin  → RAISE 'unauthorized'
--   * Success             → updates periods.criteria_name, returns void

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_set_period_criteria_name',
  ARRAY['uuid', 'text'],
  'rpc_admin_set_period_criteria_name(uuid,text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_set_period_criteria_name',
  ARRAY['uuid', 'text'],
  'void',
  'returns void'
);

-- ────────── 2. unknown period → period_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_period_criteria_name(
    '00000000-0000-4000-8000-000000000abc'::uuid, 'Test')$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period id → raises period_not_found'
);

-- ────────── 3. unauthenticated → unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_period_criteria_name(
    'cccc0000-0000-4000-8000-000000000001'::uuid, 'Test')$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 4. cross-tenant → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_period_criteria_name(
    'dddd0000-0000-4000-8000-000000000002'::uuid, 'Test')$c$,
  NULL::text,
  'unauthorized'::text,
  'org-A admin on org-B period → raises unauthorized'
);

-- ────────── 5. own-org period → success ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_set_period_criteria_name(
    'cccc0000-0000-4000-8000-000000000001'::uuid, 'pgtap Criteria 2024')$c$,
  'org-admin setting criteria_name on own period succeeds'
);

-- ────────── 6. value persisted ──────────
SELECT is(
  (SELECT criteria_name FROM periods
   WHERE id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  'pgtap Criteria 2024',
  'criteria_name is persisted after update'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
