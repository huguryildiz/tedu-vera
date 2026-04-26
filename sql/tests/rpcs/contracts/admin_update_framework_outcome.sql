-- RPC: rpc_admin_update_framework_outcome(uuid, jsonb) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_outcome_id uuid, p_patch jsonb) returning jsonb
--   * Unknown outcome               → RAISE 'outcome_not_found'
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → Updated JSONB row (code, label, description, sort_order)
--
-- See docs/qa/vera-test-audit-report.md P0-B5.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- Seed frameworks and outcomes under org A and org B.
INSERT INTO frameworks (id, organization_id, name) VALUES
  ('8f000000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'pgtap Framework A'),
  ('8f000000-0000-4000-8000-000000000002'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'pgtap Framework B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO framework_outcomes (id, framework_id, code, label) VALUES
  ('9f000000-0000-4000-8000-0000000000a1'::uuid,
   '8f000000-0000-4000-8000-000000000001'::uuid, 'PO1', 'Outcome One'),
  ('9f000000-0000-4000-8000-0000000000b1'::uuid,
   '8f000000-0000-4000-8000-000000000002'::uuid, 'PO1', 'Outcome One B')
ON CONFLICT (id) DO NOTHING;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_update_framework_outcome',
  ARRAY['uuid', 'jsonb'],
  'rpc_admin_update_framework_outcome(uuid,jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_update_framework_outcome',
  ARRAY['uuid', 'jsonb'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown outcome → outcome_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_update_framework_outcome(
       '00000000-0000-4000-8000-000000000abc'::uuid,
       '{"label": "New label"}'::jsonb
     )$c$,
  NULL::text,
  'outcome_not_found',
  'unknown outcome_id → raises outcome_not_found'
);

-- ────────── 3. cross-tenant caller → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_update_framework_outcome(
       '9f000000-0000-4000-8000-0000000000b1'::uuid,
       '{"label": "Tampered"}'::jsonb
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B outcome → raises unauthorized'
);

-- ────────── 4. success → returns JSONB row ──────────
CREATE TEMP TABLE _updated ON COMMIT DROP AS
SELECT rpc_admin_update_framework_outcome(
  '9f000000-0000-4000-8000-0000000000a1'::uuid,
  '{"label": "Updated Outcome One"}'::jsonb
) AS r;

SELECT ok(
  (SELECT r IS NOT NULL FROM _updated),
  'success call returns non-null JSONB'
);

SELECT is(
  (SELECT r->>'label' FROM _updated),
  'Updated Outcome One',
  'returned label matches patch value'
);

SELECT ok(
  (SELECT r ? 'id' FROM _updated),
  'returned row contains id'
);

-- ────────── 5. super-admin can update any outcome ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_update_framework_outcome(
       '9f000000-0000-4000-8000-0000000000b1'::uuid,
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
