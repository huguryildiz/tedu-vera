-- RPC: rpc_admin_create_framework_outcome(uuid, text, text, text, int) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_framework_id uuid, p_code text, p_label text,
--                 p_description text, p_sort_order int) returning jsonb
--   * Unknown framework             → RAISE 'framework_not_found'
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → JSONB row with id, framework_id, code, label
--
-- See docs/qa/vera-test-audit-report.md P0-B5.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- Seed a framework under org A and one under org B.
INSERT INTO frameworks (id, organization_id, name) VALUES
  ('8f000000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'pgtap Framework A'),
  ('8f000000-0000-4000-8000-000000000002'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'pgtap Framework B')
ON CONFLICT (id) DO NOTHING;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_create_framework_outcome',
  ARRAY['uuid', 'text', 'text', 'text', 'integer'],
  'rpc_admin_create_framework_outcome(uuid,text,text,text,int) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_create_framework_outcome',
  ARRAY['uuid', 'text', 'text', 'text', 'integer'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown framework → framework_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_create_framework_outcome(
       '00000000-0000-4000-8000-000000000abc'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  NULL::text,
  'framework_not_found',
  'unknown framework_id → raises framework_not_found'
);

-- ────────── 3. cross-tenant caller → unauthorized ──────────
-- Admin A attempts to add outcome to org B's framework.
SELECT throws_ok(
  $c$SELECT rpc_admin_create_framework_outcome(
       '8f000000-0000-4000-8000-000000000002'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B framework → raises unauthorized'
);

-- ────────── 4. success → returns JSONB row ──────────
CREATE TEMP TABLE _created ON COMMIT DROP AS
SELECT rpc_admin_create_framework_outcome(
  '8f000000-0000-4000-8000-000000000001'::uuid,
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
  (SELECT r ? 'framework_id' FROM _created),
  'returned row contains framework_id'
);

SELECT is(
  (SELECT r->>'code' FROM _created),
  'PO1',
  'returned code matches input'
);

-- ────────── 5. super-admin can create in any framework ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_create_framework_outcome(
       '8f000000-0000-4000-8000-000000000002'::uuid,
       'PO1', 'Programme Outcome 1', NULL, 1
     )$c$,
  'super-admin create in org B framework does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
