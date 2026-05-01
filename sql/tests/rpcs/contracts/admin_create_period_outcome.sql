-- RPC: rpc_admin_create_period_outcome(uuid, text, text, text, int) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_period_id uuid, p_code text, p_label text,
--                 p_description text, p_sort_order int) returning jsonb
--   * Unknown period                → RAISE 'period_not_found'
--   * Period locked                 → RAISE 'period_locked'
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → JSONB row with id, period_id, code, label
--
-- See docs/qa/vera-test-audit-report.md P0-B6.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(11);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_create_period_outcome',
  ARRAY['uuid', 'text', 'text', 'text', 'integer'],
  'rpc_admin_create_period_outcome(uuid,text,text,text,int) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_create_period_outcome',
  ARRAY['uuid', 'text', 'text', 'text', 'integer'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown period → period_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_create_period_outcome(
       '00000000-0000-4000-8000-000000000abc'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  NULL::text,
  'period_not_found',
  'unknown period_id → raises period_not_found'
);

-- ────────── 3. locked period → period_locked ──────────
-- Period A2 (cccc...0011) is seeded locked.
SELECT throws_ok(
  $c$SELECT rpc_admin_create_period_outcome(
       'cccc0000-0000-4000-8000-000000000011'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  NULL::text,
  'period_locked',
  'locked period → raises period_locked'
);

-- ────────── 4. cross-tenant caller → unauthorized ──────────
-- Admin A on org B's unlocked period.
SELECT throws_ok(
  $c$SELECT rpc_admin_create_period_outcome(
       'dddd0000-0000-4000-8000-000000000002'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B period → raises unauthorized'
);

-- ────────── 5. success on unlocked own period ──────────
CREATE TEMP TABLE _created ON COMMIT DROP AS
SELECT rpc_admin_create_period_outcome(
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  'PO1', 'Programme Outcome 1', 'First outcome', 1
) AS r;

SELECT ok(
  (SELECT r IS NOT NULL FROM _created),
  'success call returns non-null JSONB'
);

SELECT ok(
  (SELECT r ? 'id' FROM _created),
  'returned row contains id'
);

SELECT ok(
  (SELECT r ? 'period_id' FROM _created),
  'returned row contains period_id'
);

SELECT is(
  (SELECT r->>'code' FROM _created),
  'PO1',
  'returned code matches input'
);

-- ────────── 6. audit_logs row written with period_name + outcome_code ──────────
-- Verifies _audit_write fires and details contain the period name we resolve
-- via SELECT name FROM periods (regression guard for periodName enrichment).
SELECT is(
  (SELECT count(*)::int FROM audit_logs
    WHERE action = 'config.outcome.created'
      AND resource_type = 'period_outcomes'
      AND details->>'outcome_code' = 'PO1'
      AND details->>'period_name' IS NOT NULL
      AND details->>'periodName' IS NOT NULL),
  1,
  'audit_logs row written with period_name + periodName + outcome_code'
);

-- ────────── 7. super-admin can create in any unlocked period ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_create_period_outcome(
       'dddd0000-0000-4000-8000-000000000002'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  'super-admin create in org B period does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
