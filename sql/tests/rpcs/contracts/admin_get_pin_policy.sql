-- RPC: rpc_admin_get_pin_policy() → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: () returning json
--   * Accessible to tenant admins + super-admins (GRANT TO authenticated).
--   * _assert_tenant_admin('get_pin_policy') is not a Level-B action so it
--     passes for all callers; real enforcement is the DB GRANT.
--   * Success → JSON with maxPinAttempts (int), pinLockCooldown (text), qrTtl (text).
--
-- See docs/qa/vera-test-audit-report.md P0-B7.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_get_pin_policy',
  ARRAY[]::text[],
  'rpc_admin_get_pin_policy() exists'
);

SELECT function_returns(
  'public', 'rpc_admin_get_pin_policy',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. org-admin call succeeds ──────────
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_get_pin_policy()$c$,
  'org_admin call does not raise'
);

-- ────────── 3. response shape ──────────
CREATE TEMP TABLE _policy ON COMMIT DROP AS
  SELECT rpc_admin_get_pin_policy()::jsonb AS r;

SELECT ok(
  (SELECT r ? 'maxPinAttempts' FROM _policy),
  'response contains maxPinAttempts'
);

SELECT ok(
  (SELECT r ? 'pinLockCooldown' FROM _policy),
  'response contains pinLockCooldown'
);

SELECT ok(
  (SELECT r ? 'qrTtl' FROM _policy),
  'response contains qrTtl'
);

-- ────────── 4. super-admin also succeeds ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_get_pin_policy()$c$,
  'super-admin call does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
