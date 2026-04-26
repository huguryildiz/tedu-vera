-- RPC: rpc_platform_metrics() → jsonb
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: () returning jsonb
--   * Return shape: {db_size_bytes, db_size_pretty, active_connections,
--                    audit_requests_24h, total_organizations, total_jurors}
--   * Access: REVOKE ALL from public/authenticated/anon — service_role only
--   * Authenticated callers receive permission denied (sqlstate 42501)
--
-- NOTE: Cannot invoke as authenticated; we pin existence + type + access control.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_platform_metrics',
  ARRAY[]::text[],
  'rpc_platform_metrics() exists'
);

SELECT function_returns(
  'public', 'rpc_platform_metrics',
  ARRAY[]::text[],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. postgres role can call (function works) ──────────
SELECT lives_ok(
  $c$SELECT rpc_platform_metrics()$c$,
  'postgres role can invoke rpc_platform_metrics'
);

-- ────────── 3. response shape has expected keys ──────────
SELECT ok(
  (SELECT rpc_platform_metrics() ? 'db_size_bytes'
     AND  rpc_platform_metrics() ? 'db_size_pretty'
     AND  rpc_platform_metrics() ? 'active_connections'
     AND  rpc_platform_metrics() ? 'audit_requests_24h'
     AND  rpc_platform_metrics() ? 'total_organizations'
     AND  rpc_platform_metrics() ? 'total_jurors'),
  'response has all expected keys'
);

-- ────────── 4. authenticated caller is denied (42501) ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_platform_metrics()$c$,
  '42501',
  NULL,
  'authenticated caller gets permission denied (42501)'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
