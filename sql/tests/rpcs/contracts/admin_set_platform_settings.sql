-- RPC: rpc_admin_set_platform_settings(TEXT, TEXT, BOOLEAN) → json
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_platform_name text, p_support_email text,
--                  p_auto_approve_new_orgs boolean) returning json
--   * Non-super-admin           → RAISE 'super_admin required'
--   * NULL/empty platform_name  → RAISE 'platform_name required'
--   * platform_name > 100 chars → RAISE 'platform_name too long (max 100)'
--   * Invalid email             → RAISE 'support_email invalid'
--   * Success                   → {ok: true}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_set_platform_settings',
  ARRAY['text', 'text', 'boolean'],
  'rpc_admin_set_platform_settings(text,text,boolean) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_set_platform_settings',
  ARRAY['text', 'text', 'boolean'],
  'json',
  'returns json'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_platform_settings('VERA', 'admin@test.local', false)$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin caller → raises super_admin required'
);

-- ────────── 3. validation errors (as super-admin) ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_platform_settings('', 'admin@test.local', false)$c$,
  NULL::text,
  'platform_name required'::text,
  'empty platform_name → raises platform_name required'
);

SELECT throws_ok(
  $c$SELECT rpc_admin_set_platform_settings(NULL, 'admin@test.local', false)$c$,
  NULL::text,
  'platform_name required'::text,
  'NULL platform_name → raises platform_name required'
);

SELECT throws_ok(
  $c$SELECT rpc_admin_set_platform_settings(repeat('x', 101), 'admin@test.local', false)$c$,
  NULL::text,
  'platform_name too long (max 100)'::text,
  'platform_name > 100 chars → raises platform_name too long'
);

SELECT throws_ok(
  $c$SELECT rpc_admin_set_platform_settings('VERA', 'not-an-email', false)$c$,
  NULL::text,
  'support_email invalid'::text,
  'invalid email → raises support_email invalid'
);

-- ────────── 4. super-admin success ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_set_platform_settings('VERA Test', 'test@test.local', false)$c$,
  'super-admin valid call succeeds'
);

SELECT is(
  (SELECT rpc_admin_set_platform_settings('VERA Test', 'test@test.local', false)::jsonb->>'ok'),
  'true',
  'success response has ok=true'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
