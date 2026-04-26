-- RPC: rpc_public_auth_flags() → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: () returning json
--   * No auth required (anon + authenticated)
--   * Returns {googleOAuth, emailPassword, rememberMe} (all boolean)
--   * Defaults to all-true if no security_policy row exists

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_public_auth_flags',
  ARRAY[]::text[],
  'rpc_public_auth_flags() exists'
);

SELECT function_returns(
  'public', 'rpc_public_auth_flags',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_public_auth_flags()$c$,
  'anon role can call rpc_public_auth_flags'
);

-- ────────── 3. response shape ──────────
SELECT ok(
  (SELECT rpc_public_auth_flags()::jsonb ? 'googleOAuth'),
  'response has googleOAuth key'
);

SELECT ok(
  (SELECT rpc_public_auth_flags()::jsonb ? 'emailPassword'),
  'response has emailPassword key'
);

SELECT ok(
  (SELECT rpc_public_auth_flags()::jsonb ? 'rememberMe'),
  'response has rememberMe key'
);

-- ────────── 4. authenticated can also call ──────────
SELECT pgtap_test.become_reset();

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_public_auth_flags()$c$,
  'authenticated role can call rpc_public_auth_flags'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
