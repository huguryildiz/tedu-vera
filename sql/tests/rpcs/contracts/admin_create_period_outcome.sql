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
SELECT plan(9);

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

-- ────────── 6. super-admin can create in any unlocked period ──────────
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
