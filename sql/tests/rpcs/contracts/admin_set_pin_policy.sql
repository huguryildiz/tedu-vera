-- RPC: rpc_admin_set_pin_policy(int, text, text) → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_max_attempts int, p_cooldown text, p_qr_ttl text) returning json
--   * p_max_attempts < 1            → RAISE 'invalid_max_attempts'
--   * p_cooldown not matching \d+m$ → RAISE 'invalid_cooldown'
--   * p_qr_ttl not matching \d+[hd]$→ RAISE 'invalid_qr_ttl'
--   * Success                       → { ok: true }
--
-- See docs/qa/vera-test-audit-report.md P0-B7.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_set_pin_policy',
  ARRAY['integer', 'text', 'text'],
  'rpc_admin_set_pin_policy(int,text,text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_set_pin_policy',
  ARRAY['integer', 'text', 'text'],
  'json',
  'returns json'
);

-- ────────── 2. invalid max_attempts (0) → raises ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_pin_policy(0, '30m', '24h')$c$,
  NULL::text,
  'invalid_max_attempts',
  'max_attempts=0 → raises invalid_max_attempts'
);

-- ────────── 3. null max_attempts → raises ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_set_pin_policy(NULL, '30m', '24h')$c$,
  NULL::text,
  'invalid_max_attempts',
  'max_attempts=NULL → raises invalid_max_attempts'
);

-- ────────── 4. invalid cooldown format → raises ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_set_pin_policy(5, 'bad', '24h')$c$,
  NULL::text,
  'invalid_cooldown',
  'cooldown=bad → raises invalid_cooldown'
);

-- ────────── 5. invalid qr_ttl format → raises ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_set_pin_policy(5, '30m', 'bad')$c$,
  NULL::text,
  'invalid_qr_ttl',
  'qr_ttl=bad → raises invalid_qr_ttl'
);

-- ────────── 6. valid call → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_set_pin_policy(5, '30m', '24h')::jsonb->>'ok'),
  'true',
  'valid policy call → ok=true'
);

-- ────────── 7. response has ok field ──────────
SELECT ok(
  (SELECT (rpc_admin_set_pin_policy(3, '15m', '7d')::jsonb) ? 'ok'),
  'response envelope has ok field'
);

-- ────────── 8. super-admin can also set pin policy ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_set_pin_policy(10, '60m', '48h')$c$,
  'super-admin set_pin_policy does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
