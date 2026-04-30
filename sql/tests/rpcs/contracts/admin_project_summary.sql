-- RPC: rpc_admin_project_summary(uuid, boolean) → setof record
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_only_finalized boolean DEFAULT true)
--   * Authenticated only — anon cannot execute
--   * Org-admin can summarize own period; cross-org call raises 'unauthorized'
--   * Unknown period_id raises 'period_not_found'
--   * Returns one row per project in the period with 15 columns including
--     project_id, total_avg, total_pct, std_dev_pct, rank, per_criterion (jsonb)

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT has_function(
  'public', 'rpc_admin_project_summary',
  ARRAY['uuid', 'boolean'],
  'rpc_admin_project_summary(uuid, boolean) exists'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_project_summary(uuid, boolean)', 'execute'),
  'anon has no execute privilege'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.rpc_admin_project_summary(uuid, boolean)', 'execute'),
  'authenticated has execute privilege'
);

SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_projects();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT * FROM rpc_admin_project_summary(
       (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
       true
     )$c$,
  'org_a admin can summarize own period projects'
);

-- Result must include the seeded project for org A
SELECT ok(
  EXISTS (
    SELECT 1 FROM rpc_admin_project_summary(
      (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
      true
    ) WHERE project_id = '33330000-0000-4000-8000-000000000001'::uuid
  ),
  'seeded project A row present in result set'
);

SELECT throws_ok(
  $c$SELECT * FROM rpc_admin_project_summary(
       (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1),
       true
     )$c$,
  'unauthorized',
  'cross-org call raises unauthorized'
);

SELECT throws_ok(
  $c$SELECT * FROM rpc_admin_project_summary(
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
