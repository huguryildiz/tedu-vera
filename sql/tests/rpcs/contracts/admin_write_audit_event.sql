-- RPC: rpc_admin_write_audit_event(jsonb) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_event jsonb) returning jsonb
--   * Unauthenticated caller        → { ok: false, error_code: 'unauthenticated' }
--   * Org-id mismatch (caller ≠ org) → { ok: false, error_code: 'unauthorized' }
--   * Success                       → { ok: true }
--
-- See docs/qa/vera-test-audit-report.md P0-B4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_write_audit_event',
  ARRAY['jsonb'],
  'rpc_admin_write_audit_event(jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_write_audit_event',
  ARRAY['jsonb'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → error envelope ──────────
SELECT pgtap_test.become_reset();

SELECT is(
  (SELECT rpc_admin_write_audit_event(
     jsonb_build_object('action', 'period.lock')
   )->>'error_code'),
  'unauthenticated',
  'unauthenticated caller → error_code=unauthenticated'
);

SELECT is(
  (SELECT rpc_admin_write_audit_event(
     jsonb_build_object('action', 'period.lock')
   )->>'ok'),
  'false',
  'unauthenticated caller → ok=false'
);

-- ────────── 3. cross-org caller → unauthorized ──────────
-- Admin A calls with org B's id in event.
SELECT pgtap_test.become_a();

SELECT is(
  (SELECT rpc_admin_write_audit_event(
     jsonb_build_object(
       'action',         'period.lock',
       'organizationId', '22220000-0000-4000-8000-000000000002'
     )
   )->>'error_code'),
  'unauthorized',
  'admin A calling with org B id → error_code=unauthorized'
);

SELECT is(
  (SELECT rpc_admin_write_audit_event(
     jsonb_build_object(
       'action',         'period.lock',
       'organizationId', '22220000-0000-4000-8000-000000000002'
     )
   )->>'ok'),
  'false',
  'cross-org call → ok=false'
);

-- ────────── 4. own-org success → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_write_audit_event(
     jsonb_build_object(
       'action',         'period.update',
       'organizationId', '11110000-0000-4000-8000-000000000001',
       'resourceType',   'periods'
     )
   )->>'ok'),
  'true',
  'admin A on own org → ok=true'
);

-- ────────── 5. super-admin can write without org restriction ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_write_audit_event(
       jsonb_build_object('action', 'admin.login')
     )$c$,
  'super-admin write_audit_event does not raise'
);

SELECT is(
  (SELECT rpc_admin_write_audit_event(
     jsonb_build_object('action', 'admin.login')
   )->>'ok'),
  'true',
  'super-admin call → ok=true'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
