-- RPC: rpc_period_freeze_snapshot(uuid, boolean) → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_force boolean DEFAULT false) returning json
--   * Unknown period              → { ok: false, error: 'period_not_found' }
--   * Period without framework    → { ok: false, error: 'period_has_no_framework' }
--   * Success                     → { ok: true, already_frozen: ..., criteria_count: N, outcomes_count: M }
--
-- This RPC is called when closing a period — a shape drift breaks the close
-- flow silently. See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_period_freeze_snapshot',
  ARRAY['uuid', 'boolean'],
  'rpc_period_freeze_snapshot(uuid,boolean) exists'
);

SELECT function_returns(
  'public', 'rpc_period_freeze_snapshot',
  ARRAY['uuid', 'boolean'],
  'json',
  'returns json'
);

-- ────────── 2. unknown period → period_not_found ──────────
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     false
   )::jsonb->>'error'),
  'period_not_found',
  'unknown period → error=period_not_found'
);

SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     false
   )::jsonb->>'ok'),
  'false',
  'unknown period → ok=false'
);

-- ────────── 3. seeded period without framework → period_has_no_framework ──────────
-- Periods seeded by pgtap_test.seed_periods() have framework_id = NULL by default.
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     false
   )::jsonb->>'error'),
  'period_has_no_framework',
  'period with NULL framework → error=period_has_no_framework'
);

-- ────────── 4. default p_force argument works (1-arg call) ──────────
-- Using 1 arg relies on the default BOOLEAN DEFAULT false in the signature.
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     'cccc0000-0000-4000-8000-000000000001'::uuid
   )::jsonb->>'error'),
  'period_has_no_framework',
  '1-arg call (default p_force=false) works and returns same error'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
