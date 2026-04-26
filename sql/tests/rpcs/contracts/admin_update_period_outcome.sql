-- RPC: rpc_admin_update_period_outcome(uuid, jsonb) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_outcome_id uuid, p_patch jsonb) returning jsonb
--   * Unknown outcome               → RAISE 'outcome_not_found'
--   * Period locked                 → RAISE 'period_locked'
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → Updated JSONB row
--
-- See docs/qa/vera-test-audit-report.md P0-B6.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- Unlocked-period outcomes — inserted normally.
INSERT INTO period_outcomes (id, period_id, code, label) VALUES
  ('0e000000-0000-4000-8000-0000000000a1'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid, 'PO1', 'Outcome One A1'),
  ('0e000000-0000-4000-8000-0000000000b1'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid, 'PO1', 'Outcome One B1')
ON CONFLICT (id) DO NOTHING;

-- block_period_outcomes_on_locked fires BEFORE INSERT on locked periods;
-- bypass it during test setup via session_replication_role.
SET LOCAL session_replication_role = 'replica';
INSERT INTO period_outcomes (id, period_id, code, label) VALUES
  ('0e000000-0000-4000-8000-0000000000a2'::uuid,
   'cccc0000-0000-4000-8000-000000000011'::uuid, 'PO1', 'Outcome One A2 locked')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = DEFAULT;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_update_period_outcome',
  ARRAY['uuid', 'jsonb'],
  'rpc_admin_update_period_outcome(uuid,jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_update_period_outcome',
  ARRAY['uuid', 'jsonb'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown outcome → outcome_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_update_period_outcome(
       '00000000-0000-4000-8000-000000000abc'::uuid,
       '{"label": "New"}'::jsonb
     )$c$,
  NULL::text,
  'outcome_not_found',
  'unknown outcome_id → raises outcome_not_found'
);

-- ────────── 3. outcome on locked period → period_locked ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_update_period_outcome(
       '0e000000-0000-4000-8000-0000000000a2'::uuid,
       '{"label": "Attempt"}'::jsonb
     )$c$,
  NULL::text,
  'period_locked',
  'outcome on locked period → raises period_locked'
);

-- ────────── 4. cross-tenant caller → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_update_period_outcome(
       '0e000000-0000-4000-8000-0000000000b1'::uuid,
       '{"label": "Tampered"}'::jsonb
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B outcome → raises unauthorized'
);

-- ────────── 5. success → returns updated JSONB ──────────
CREATE TEMP TABLE _updated ON COMMIT DROP AS
SELECT rpc_admin_update_period_outcome(
  '0e000000-0000-4000-8000-0000000000a1'::uuid,
  '{"label": "Updated PO1"}'::jsonb
) AS r;

SELECT ok(
  (SELECT r IS NOT NULL FROM _updated),
  'success call returns non-null JSONB'
);

SELECT is(
  (SELECT r->>'label' FROM _updated),
  'Updated PO1',
  'returned label matches patch value'
);

SELECT ok(
  (SELECT r ? 'id' FROM _updated),
  'returned row contains id'
);

-- ────────── 6. super-admin can update any unlocked period outcome ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_update_period_outcome(
       '0e000000-0000-4000-8000-0000000000b1'::uuid,
       '{"label": "Super Updated"}'::jsonb
     )$c$,
  'super-admin update on org B outcome does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
