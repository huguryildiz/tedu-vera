-- RPC: rpc_admin_delete_period_criterion_outcome_map(UUID) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_map_id UUID) returning jsonb
--   * Authenticated required; caller must be org_admin of the period's org
--   * Error codes: 'mapping_not_found', 'period_locked'
--   * Returns {ok}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_delete_period_criterion_outcome_map',
  ARRAY['uuid'::text],
  'rpc_admin_delete_period_criterion_outcome_map(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_delete_period_criterion_outcome_map',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('00000000-0000-0000-0000-000000009999'::uuid)$c$,
  NULL::text,
  'anon cannot call rpc_admin_delete_period_criterion_outcome_map'
);

-- ────────── 3. nonexistent mapping → mapping_not_found ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('00000000-0000-0000-0000-000000009998'::uuid)$c$,
  'mapping_not_found',
  NULL::text,
  'nonexistent mapping raises mapping_not_found'
);

-- ────────── 4. org-admin can delete mapping for unlocked period ──────────
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();
SELECT pgtap_test.seed_period_outcomes();

INSERT INTO period_criterion_outcome_maps (id, period_id, period_criterion_id, period_outcome_id)
VALUES (
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  'a1110000-0000-4000-8000-000000000a01'::uuid,
  'a2220000-0000-4000-8000-000000000a01'::uuid
);

SELECT lives_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('f0000000-0000-0000-0000-000000000001'::uuid)$c$,
  'org_a admin can delete mapping for unlocked period'
);

-- ────────── 5. org-admin cannot delete for locked period ──────────
INSERT INTO period_criterion_outcome_maps (id, period_id, period_criterion_id, period_outcome_id)
VALUES (
  'd0000000-0000-0000-0000-000000000003'::uuid,
  'cccc0000-0000-4000-8000-000000000011'::uuid,
  'a1110000-0000-4000-8000-000000000a01'::uuid,
  'a2220000-0000-4000-8000-000000000a01'::uuid
);

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('d0000000-0000-0000-0000-000000000003'::uuid)$c$,
  'period_locked',
  NULL::text,
  'cannot delete mapping when period is locked'
);

-- ────────── 6. response has ok key on success ──────────
INSERT INTO period_criterion_outcome_maps (id, period_id, period_criterion_id, period_outcome_id)
VALUES (
  'f0000000-0000-0000-0000-000000000002'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  'a1110000-0000-4000-8000-000000000a02'::uuid,
  'a2220000-0000-4000-8000-000000000a01'::uuid
);

SELECT ok(
  (SELECT (r ? 'ok')
   FROM (SELECT rpc_admin_delete_period_criterion_outcome_map('f0000000-0000-0000-0000-000000000002'::uuid)::jsonb AS r) t),
  'successful response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
