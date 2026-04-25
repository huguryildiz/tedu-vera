-- pgTAP: Public RLS Policies (Anon SELECT)
--
-- Tests that the public RLS policies for period_criteria, period_outcomes,
-- and juror_period_auth correctly allow anon (unauthenticated) SELECT access
-- to locked periods' data.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- ====================================================================
-- Test 1: Check period_criteria_select_public policy exists
-- ====================================================================
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'period_criteria'
      AND policyname = 'period_criteria_select_public'
  ),
  'RLS policy period_criteria_select_public exists'
);

-- ====================================================================
-- Test 2: Check period_outcomes_select_public policy exists
-- ====================================================================
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'period_outcomes'
      AND policyname = 'period_outcomes_select_public'
  ),
  'RLS policy period_outcomes_select_public exists'
);

-- ====================================================================
-- Test 3: Check juror_period_auth_select_public policy exists
-- ====================================================================
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'juror_period_auth'
      AND policyname = 'juror_period_auth_select_public'
  ),
  'RLS policy juror_period_auth_select_public exists'
);

-- ====================================================================
-- Test 4: Anon can SELECT from period_criteria (locked period)
-- ====================================================================
SET LOCAL ROLE anon;

-- Period A2 (cccc0000-0000-4000-8000-000000000011) is locked;
-- anon should be able to SELECT from it
SELECT lives_ok(
  'SELECT count(*) FROM period_criteria WHERE period_id = ''cccc0000-0000-4000-8000-000000000011''::uuid',
  'Anon SELECT from period_criteria for locked period does not raise'
);

RESET ROLE;

-- ====================================================================
-- Test 5: Anon can SELECT from period_outcomes (locked period)
-- ====================================================================
SET LOCAL ROLE anon;

SELECT lives_ok(
  'SELECT count(*) FROM period_outcomes WHERE period_id = ''cccc0000-0000-4000-8000-000000000011''::uuid',
  'Anon SELECT from period_outcomes for locked period does not raise'
);

RESET ROLE;

-- ====================================================================
-- Test 6: Anon can SELECT from juror_period_auth (always allowed)
-- ====================================================================
SET LOCAL ROLE anon;

SELECT lives_ok(
  'SELECT count(*) FROM juror_period_auth',
  'Anon SELECT from juror_period_auth does not raise'
);

RESET ROLE;

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
