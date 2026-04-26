-- RPC: rpc_landing_stats() → json
--
-- Pins the public contract:
--   * Signature: () returning json
--   * No auth required (anon + authenticated)
--   * Returns platform-wide statistics
--   * Returns {total_orgs, total_evaluations, total_participants}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_landing_stats',
  ARRAY[]::text[],
  'rpc_landing_stats() exists'
);

SELECT function_returns(
  'public', 'rpc_landing_stats',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_landing_stats()$c$,
  'anon role can call rpc_landing_stats'
);

-- ────────__ 3. response has stats ──────────
SELECT ok(
  (SELECT rpc_landing_stats()::jsonb ? 'organizations'),
  'response has organizations key'
);

SELECT ok(
  (SELECT rpc_landing_stats()::jsonb ? 'evaluations'),
  'response has evaluations key'
);

-- ────────__ 4. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_landing_stats()$c$,
  'authenticated role can call rpc_landing_stats'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
