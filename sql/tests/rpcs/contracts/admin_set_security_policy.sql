-- RPC: rpc_admin_set_security_policy(jsonb) → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_policy jsonb) returning json
--   * Non-super-admin caller        → RAISE 'super_admin required'
--   * Unknown policy key            → RAISE 'unknown_policy_key: <key>'
--   * Non-boolean for bool fields   → RAISE exception
--   * maxPinAttempts out of range   → RAISE exception
--   * qrTtl invalid format          → RAISE exception
--   * Success                       → { ok: true }
--
-- See docs/qa/vera-test-audit-report.md P0-B7.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_set_security_policy',
  ARRAY['jsonb'],
  'rpc_admin_set_security_policy(jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_set_security_policy',
  ARRAY['jsonb'],
  'json',
  'returns json'
);

-- ────────── 2. org-admin (non-super) → raises super_admin required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_security_policy('{"googleOAuth": true}'::jsonb)$c$,
  NULL::text,
  'super_admin required',
  'org_admin caller → raises super_admin required'
);

-- ────────── 3. unauthenticated → raises super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_security_policy('{"googleOAuth": true}'::jsonb)$c$,
  NULL::text,
  'super_admin required',
  'unauthenticated caller → raises super_admin required'
);

-- ────────── 4. super-admin with unknown key → raises ──────────
SELECT pgtap_test.become_super();

SELECT throws_like(
  $c$SELECT rpc_admin_set_security_policy('{"unknownField": true}'::jsonb)$c$,
  '%unknown_policy_key%',
  'unknown policy key → raises unknown_policy_key error'
);

-- ────────── 5. invalid maxPinAttempts (0 = out of range) → raises ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_set_security_policy('{"maxPinAttempts": 0}'::jsonb)$c$,
  NULL::text,
  'maxPinAttempts must be between 1 and 20',
  'maxPinAttempts=0 → raises range error'
);

-- ────────── 6. invalid qrTtl format → raises ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_set_security_policy('{"qrTtl": "invalid"}'::jsonb)$c$,
  NULL::text,
  'qrTtl must match pattern like "24h" or "7d"',
  'qrTtl=invalid → raises format error'
);

-- ────────── 7. valid policy → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_set_security_policy(
     '{"googleOAuth": true, "maxPinAttempts": 5}'::jsonb
   )::jsonb->>'ok'),
  'true',
  'super-admin valid policy → ok=true'
);

-- ────────── 8. valid policy returns ok field ──────────
SELECT ok(
  (SELECT (rpc_admin_set_security_policy(
     '{"emailPassword": true}'::jsonb
   )::jsonb) ? 'ok'),
  'response envelope has ok field'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
