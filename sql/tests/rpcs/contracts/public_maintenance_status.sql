-- RPC: rpc_public_maintenance_status() → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: () returning json
--   * No auth required (anon + authenticated)
--   * Returns {is_active, upcoming, mode, start_time, end_time,
--              message, affected_org_ids}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_public_maintenance_status',
  ARRAY[]::text[],
  'rpc_public_maintenance_status() exists'
);

SELECT function_returns(
  'public', 'rpc_public_maintenance_status',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_public_maintenance_status()$c$,
  'anon role can call rpc_public_maintenance_status'
);

-- ────────── 3. response shape ──────────
SELECT ok(
  (SELECT rpc_public_maintenance_status()::jsonb ? 'is_active'),
  'response has is_active key'
);

SELECT ok(
  (SELECT rpc_public_maintenance_status()::jsonb ? 'mode'),
  'response has mode key'
);

SELECT ok(
  (SELECT rpc_public_maintenance_status()::jsonb ? 'upcoming'),
  'response has upcoming key'
);

-- ────────── 4. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_public_maintenance_status()$c$,
  'authenticated role can call rpc_public_maintenance_status'
);

-- ────────── 5. is_active defaults to false when maintenance not set ──────────
SELECT is(
  (SELECT rpc_public_maintenance_status()::jsonb->>'is_active'),
  'false',
  'default state: is_active=false when maintenance not activated'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
