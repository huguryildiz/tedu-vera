-- RPC: rpc_admin_write_audit_log(text, text, uuid, jsonb, uuid) → void
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_action text, p_resource_type text, p_resource_id uuid,
--                 p_details jsonb, p_organization_id uuid) returning void
--   * No internal auth guard — security enforced by GRANT TO authenticated.
--   * Authenticated call without explicit org → resolves org from membership.
--   * Authenticated call inserts a row into audit_logs.
--
-- See docs/qa/vera-test-audit-report.md P0-B4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_write_audit_log',
  ARRAY['text', 'text', 'uuid', 'jsonb', 'uuid'],
  'rpc_admin_write_audit_log(text,text,uuid,jsonb,uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_write_audit_log',
  ARRAY['text', 'text', 'uuid', 'jsonb', 'uuid'],
  'void',
  'returns void'
);

-- ────────── 2. authenticated admin call succeeds ──────────
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_write_audit_log(
       'period.update',
       'periods',
       'cccc0000-0000-4000-8000-000000000001'::uuid,
       '{"test": true}'::jsonb,
       '11110000-0000-4000-8000-000000000001'::uuid
     )$c$,
  'org_admin call does not raise'
);

-- ────────── 3. row written to audit_logs ──────────
-- Count audit_logs rows before call and verify it increases.
CREATE TEMP TABLE _audit_before ON COMMIT DROP AS
  SELECT count(*) AS n FROM audit_logs;

SELECT rpc_admin_write_audit_log(
  'config.test.write_audit_log_contract',
  'periods',
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  '{"contract_test": true}'::jsonb,
  '11110000-0000-4000-8000-000000000001'::uuid
);

SELECT ok(
  (SELECT count(*) FROM audit_logs) > (SELECT n FROM _audit_before),
  'audit_logs row count increased after call'
);

-- ────────── 4. written row action matches input ──────────
SELECT ok(
  EXISTS (
    SELECT 1 FROM audit_logs
    WHERE action = 'config.test.write_audit_log_contract'
      AND resource_type = 'periods'
  ),
  'written row has correct action and resource_type'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
