-- RPC: rpc_admin_reorder_period_criteria(UUID, JSONB) → void
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_period_id uuid, p_keys jsonb) returning void
--   * NULL period_id      → RAISE 'period_id_required'
--   * Non-array p_keys    → RAISE 'keys_must_be_array'
--   * Unknown period_id   → RAISE 'period_not_found'
--   * Non-org-admin       → RAISE 'unauthorized' (via _assert_org_admin)
--   * Locked period       → RAISE 'period_locked' (via _assert_period_unlocked)
--   * Success             → updates sort_order on matching criteria rows, void

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_reorder_period_criteria',
  ARRAY['uuid', 'jsonb'],
  'rpc_admin_reorder_period_criteria(uuid,jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_reorder_period_criteria',
  ARRAY['uuid', 'jsonb'],
  'void',
  'returns void'
);

-- ────────── 2. NULL period_id → period_id_required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(NULL::uuid, '["tech_a","design_a"]'::jsonb)$c$,
  NULL::text,
  'period_id_required'::text,
  'NULL period_id → raises period_id_required'
);

-- ────────── 3. non-array p_keys → keys_must_be_array ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '"just_a_string"'::jsonb)$c$,
  NULL::text,
  'keys_must_be_array'::text,
  'non-array jsonb → raises keys_must_be_array'
);

-- ────────── 4. unknown period → period_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(
    '00000000-0000-4000-8000-000000000abc'::uuid,
    '["tech_a","design_a"]'::jsonb)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period id → raises period_not_found'
);

-- ────────── 5. unauthenticated → unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '["tech_a","design_a"]'::jsonb)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 6. cross-tenant → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(
    'dddd0000-0000-4000-8000-000000000002'::uuid,
    '["tech_b","design_b"]'::jsonb)$c$,
  NULL::text,
  'unauthorized'::text,
  'org-A admin on org-B period → raises unauthorized'
);

-- ────────── 7. locked period → period_locked ──────────
-- Period A2 is locked (seeded with is_locked=true)
SELECT throws_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(
    'cccc0000-0000-4000-8000-000000000011'::uuid,
    '[]'::jsonb)$c$,
  NULL::text,
  'period_locked'::text,
  'locked period → raises period_locked'
);

-- ────────── 8. own unlocked period → success ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_reorder_period_criteria(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '["design_a","tech_a"]'::jsonb)$c$,
  'reordering criteria on own unlocked period succeeds'
);

-- ────────── 9. sort_order updated ──────────
SELECT is(
  (SELECT sort_order FROM period_criteria
   WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid
     AND key = 'design_a'),
  0,
  'design_a moved to sort_order=0 after reorder'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
