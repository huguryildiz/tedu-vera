-- RPC: rpc_admin_period_summary(uuid, boolean) → setof record
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_only_finalized boolean DEFAULT true)
--   * Authenticated only — anon cannot execute
--   * Org-admin can summarize own period; cross-org call raises 'unauthorized'
--   * Unknown period_id raises 'period_not_found'
--   * Returns one row with seven NUMERIC/INT columns:
--       total_max, total_projects, ranked_count, total_jurors,
--       finalized_jurors, avg_total_pct, avg_juror_pct

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_period_summary',
  ARRAY['uuid', 'boolean'],
  'rpc_admin_period_summary(uuid, boolean) exists'
);

-- ────────── 2. anon has no execute privilege ──────────
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_period_summary(uuid, boolean)', 'execute'),
  'anon has no execute privilege on rpc_admin_period_summary'
);

-- ────────── 3. authenticated does have execute privilege ──────────
SELECT ok(
  has_function_privilege('authenticated', 'public.rpc_admin_period_summary(uuid, boolean)', 'execute'),
  'authenticated has execute privilege'
);

-- ────────── 4. org-admin can summarize own period ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT * FROM rpc_admin_period_summary(
       (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
       true
     )$c$,
  'org_a admin can summarize own period (default p_only_finalized = true)'
);

-- ────────── 5. p_only_finalized = false also accepted ──────────
SELECT lives_ok(
  $c$SELECT * FROM rpc_admin_period_summary(
       (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
       false
     )$c$,
  'p_only_finalized = false (live monitoring view) accepted'
);

-- ────────── 6. cross-org call rejected ──────────
-- Use the seeded Org B period UUID directly. Looking it up via a SELECT here
-- would return NULL because RLS hides Org B periods from admin_a, and the
-- function would raise period_not_found instead of unauthorized.
SELECT throws_ok(
  $c$SELECT * FROM rpc_admin_period_summary(
       'dddd0000-0000-4000-8000-000000000002'::uuid, true
     )$c$,
  'unauthorized',
  'org_a admin cannot summarize org_b period (unauthorized)'
);

-- ────────── 7. unknown period_id rejected ──────────
SELECT throws_ok(
  $c$SELECT * FROM rpc_admin_period_summary(
       '00000000-0000-4000-8000-000000000999'::uuid, true
     )$c$,
  'period_not_found',
  'unknown period_id raises period_not_found'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
