-- RPC: rpc_admin_delete_framework_outcome(uuid) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_outcome_id uuid) returning jsonb
--   * Unknown outcome               → RAISE 'outcome_not_found'
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → { ok: true }
--
-- See docs/qa/vera-test-audit-report.md P0-B5.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();

INSERT INTO frameworks (id, organization_id, name) VALUES
  ('8f000000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'pgtap Framework A'),
  ('8f000000-0000-4000-8000-000000000002'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'pgtap Framework B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO framework_outcomes (id, framework_id, code, label) VALUES
  ('9f000000-0000-4000-8000-0000000000a1'::uuid,
   '8f000000-0000-4000-8000-000000000001'::uuid, 'PO1', 'Outcome One'),
  ('9f000000-0000-4000-8000-0000000000a2'::uuid,
   '8f000000-0000-4000-8000-000000000001'::uuid, 'PO2', 'Outcome Two'),
  ('9f000000-0000-4000-8000-0000000000b1'::uuid,
   '8f000000-0000-4000-8000-000000000002'::uuid, 'PO1', 'Outcome One B')
ON CONFLICT (id) DO NOTHING;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_delete_framework_outcome',
  ARRAY['uuid'],
  'rpc_admin_delete_framework_outcome(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_delete_framework_outcome',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown outcome → outcome_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_framework_outcome(
       '00000000-0000-4000-8000-000000000abc'::uuid
     )$c$,
  NULL::text,
  'outcome_not_found',
  'unknown outcome_id → raises outcome_not_found'
);

-- ────────── 3. cross-tenant caller → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_delete_framework_outcome(
       '9f000000-0000-4000-8000-0000000000b1'::uuid
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B outcome → raises unauthorized'
);

-- ────────── 4. success → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_delete_framework_outcome(
     '9f000000-0000-4000-8000-0000000000a1'::uuid
   )->>'ok'),
  'true',
  'delete own-org outcome → ok=true'
);

-- ────────── 5. super-admin can delete any outcome ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_delete_framework_outcome(
       '9f000000-0000-4000-8000-0000000000a2'::uuid
     )$c$,
  'super-admin delete on org A outcome does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
