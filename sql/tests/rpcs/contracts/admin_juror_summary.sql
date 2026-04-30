-- RPC: rpc_admin_juror_summary(uuid, boolean) → setof record
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_only_finalized boolean DEFAULT true)
--   * Authenticated only — anon cannot execute
--   * Org-admin can summarize own period jurors; cross-org call raises 'unauthorized'
--   * Unknown period_id raises 'period_not_found'
--   * Returns one row per (juror, period) auth row with 10 columns including
--     juror_id, scored_count, completion_pct, avg_total_pct, std_dev_pct, final_submitted_at

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT has_function(
  'public', 'rpc_admin_juror_summary',
  ARRAY['uuid', 'boolean'],
  'rpc_admin_juror_summary(uuid, boolean) exists'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_juror_summary(uuid, boolean)', 'execute'),
  'anon has no execute privilege'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.rpc_admin_juror_summary(uuid, boolean)', 'execute'),
  'authenticated has execute privilege'
);

SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT * FROM rpc_admin_juror_summary(
       (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
       true
     )$c$,
  'org_a admin can summarize own period jurors'
);

-- Use the seeded Org B period UUID directly. Looking it up via a SELECT here
-- would return NULL because RLS hides Org B periods from admin_a, and the
-- function would raise period_not_found instead of unauthorized.
SELECT throws_ok(
  $c$SELECT * FROM rpc_admin_juror_summary(
       'dddd0000-0000-4000-8000-000000000002'::uuid, true
     )$c$,
  'unauthorized',
  'cross-org call raises unauthorized'
);

SELECT throws_ok(
  $c$SELECT * FROM rpc_admin_juror_summary(
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
