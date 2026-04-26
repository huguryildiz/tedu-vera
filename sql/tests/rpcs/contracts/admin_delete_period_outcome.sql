-- RPC: rpc_admin_delete_period_outcome(uuid) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_outcome_id uuid) returning jsonb
--   * Unknown outcome               → RAISE 'outcome_not_found'
--   * Period locked                 → RAISE 'period_locked'
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → { ok: true }
--
-- See docs/qa/vera-test-audit-report.md P0-B6.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- Unlocked-period outcomes — inserted normally.
INSERT INTO period_outcomes (id, period_id, code, label) VALUES
  ('0e000000-0000-4000-8000-0000000000a1'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid, 'PO1', 'Outcome A1'),
  ('0e000000-0000-4000-8000-0000000000b1'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid, 'PO1', 'Outcome B1')
ON CONFLICT (id) DO NOTHING;

-- block_period_outcomes_on_locked fires BEFORE INSERT on locked periods;
-- bypass it during test setup via session_replication_role.
SET LOCAL session_replication_role = 'replica';
INSERT INTO period_outcomes (id, period_id, code, label) VALUES
  ('0e000000-0000-4000-8000-0000000000a2'::uuid,
   'cccc0000-0000-4000-8000-000000000011'::uuid, 'PO1', 'Outcome A2 locked')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = DEFAULT;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_delete_period_outcome',
  ARRAY['uuid'],
  'rpc_admin_delete_period_outcome(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_delete_period_outcome',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown outcome → outcome_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_outcome(
       '00000000-0000-4000-8000-000000000abc'::uuid
     )$c$,
  NULL::text,
  'outcome_not_found',
  'unknown outcome_id → raises outcome_not_found'
);

-- ────────── 3. outcome on locked period → period_locked ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_outcome(
       '0e000000-0000-4000-8000-0000000000a2'::uuid
     )$c$,
  NULL::text,
  'period_locked',
  'outcome on locked period → raises period_locked'
);

-- ────────── 4. cross-tenant caller → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_outcome(
       '0e000000-0000-4000-8000-0000000000b1'::uuid
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B outcome → raises unauthorized'
);

-- ────────── 5. success → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_delete_period_outcome(
     '0e000000-0000-4000-8000-0000000000a1'::uuid
   )->>'ok'),
  'true',
  'delete own-org unlocked outcome → ok=true'
);

-- ────────── 6. super-admin can delete any unlocked period outcome ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_delete_period_outcome(
       '0e000000-0000-4000-8000-0000000000b1'::uuid
     )$c$,
  'super-admin delete on org B outcome does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
