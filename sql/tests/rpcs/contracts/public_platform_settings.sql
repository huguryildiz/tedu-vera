-- RPC: rpc_public_platform_settings() → json
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: () returning json
--   * No auth required (anon + authenticated)
--   * Returns {platform_name, support_email}
--   * SECURITY DEFINER bypasses RLS

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_public_platform_settings',
  ARRAY[]::text[],
  'rpc_public_platform_settings() exists'
);

SELECT function_returns(
  'public', 'rpc_public_platform_settings',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_public_platform_settings()$c$,
  'anon role can call rpc_public_platform_settings'
);

-- ────────── 3. response shape ──────────
SELECT ok(
  (SELECT rpc_public_platform_settings()::jsonb ? 'platform_name'),
  'response has platform_name key'
);

SELECT ok(
  (SELECT rpc_public_platform_settings()::jsonb ? 'support_email'),
  'response has support_email key'
);

-- ────────── 4. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_public_platform_settings()$c$,
  'authenticated role can call rpc_public_platform_settings'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
