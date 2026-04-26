-- RPC: rpc_admin_get_security_policy() → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: () returning json
--   * Non-super-admin caller        → RAISE 'super_admin required'
--   * Super-admin caller            → Returns JSON with policy fields + updated_at
--
-- See docs/qa/vera-test-audit-report.md P0-B7.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_get_security_policy',
  ARRAY[]::text[],
  'rpc_admin_get_security_policy() exists'
);

SELECT function_returns(
  'public', 'rpc_admin_get_security_policy',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. org-admin (non-super) → raises super_admin required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_security_policy()$c$,
  NULL::text,
  'super_admin required',
  'org_admin caller → raises super_admin required'
);

-- ────────── 3. unauthenticated → raises super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_security_policy()$c$,
  NULL::text,
  'super_admin required',
  'unauthenticated caller → raises super_admin required'
);

-- ────────── 4. super-admin → does not raise ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_get_security_policy()$c$,
  'super-admin call does not raise'
);

-- ────────── 5. super-admin → returns JSON with updated_at ──────────
SELECT ok(
  (SELECT (rpc_admin_get_security_policy()::jsonb) ? 'updated_at'),
  'super-admin response contains updated_at'
);

-- ────────── 6. org-admin (B) also blocked ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_b();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_security_policy()$c$,
  NULL::text,
  'super_admin required',
  'org_admin B caller → raises super_admin required'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
