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
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_delete_period_criterion_outcome_map(uuid)', 'execute'),
  'anon has no execute privilege on rpc_admin_delete_period_criterion_outcome_map'
);

-- ────────── seed all data before switching roles ──────────
-- seed_period_criteria inserts rows for both Org A and Org B; calling it after
-- become_a() would trigger RLS violations on the Org B rows.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();
SELECT pgtap_test.seed_period_outcomes();

-- mapping for unlocked period (step 4 deletes this)
INSERT INTO period_criterion_outcome_maps (id, period_id, period_criterion_id, period_outcome_id)
VALUES (
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  'a1110000-0000-4000-8000-000000000a01'::uuid,
  'a2220000-0000-4000-8000-000000000a01'::uuid
);

-- mapping for locked period (step 5 asserts delete is blocked)
-- block_pcom_on_locked trigger prevents INSERT on locked periods even as postgres,
-- so disable it temporarily for this test-only row.
ALTER TABLE period_criterion_outcome_maps DISABLE TRIGGER block_pcom_on_locked;
INSERT INTO period_criterion_outcome_maps (id, period_id, period_criterion_id, period_outcome_id)
VALUES (
  'd0000000-0000-0000-0000-000000000003'::uuid,
  'cccc0000-0000-4000-8000-000000000011'::uuid,
  'a1110000-0000-4000-8000-000000000b01'::uuid,
  'a2220000-0000-4000-8000-000000000b01'::uuid
);
ALTER TABLE period_criterion_outcome_maps ENABLE TRIGGER block_pcom_on_locked;

-- mapping for unlocked period (step 6 checks response shape)
INSERT INTO period_criterion_outcome_maps (id, period_id, period_criterion_id, period_outcome_id)
VALUES (
  'f0000000-0000-0000-0000-000000000002'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  'a1110000-0000-4000-8000-000000000a02'::uuid,
  'a2220000-0000-4000-8000-000000000a01'::uuid
);

SELECT pgtap_test.become_a();

-- ────────── 3. nonexistent mapping → mapping_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('00000000-0000-0000-0000-000000009998'::uuid)$c$,
  NULL::text,
  'mapping_not_found',
  'nonexistent mapping raises mapping_not_found'
);

-- ────────── 4. org-admin can delete mapping for unlocked period ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('f0000000-0000-0000-0000-000000000001'::uuid)$c$,
  'org_a admin can delete mapping for unlocked period'
);

-- ────────── 5. org-admin cannot delete for locked period ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_delete_period_criterion_outcome_map('d0000000-0000-0000-0000-000000000003'::uuid)$c$,
  NULL::text,
  'period_locked',
  'cannot delete mapping when period is locked'
);

-- ────────── 6. response has ok key on success ──────────
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
