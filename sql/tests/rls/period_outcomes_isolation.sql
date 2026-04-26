-- RLS isolation: period_outcomes.
--
-- Same shape as period_criteria_isolation.sql — tenant scoping is derived
-- via period_id → periods.organization_id. Kept as a separate file (not
-- merged with criteria) per architecture § 7 glossary: every protected
-- table owns exactly one `<table>_isolation.sql`. A future column addition
-- to either table must not have to navigate around an asymmetric merged
-- file.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_outcomes();

-- ────────── 1. admin A sees only A's outcomes ──────────
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM period_outcomes
   WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees seeded outcome for own-org period A1'::text
);

-- ────────── 2. admin A sees zero of B's outcomes ──────────
SELECT is(
  (SELECT count(*)::int FROM period_outcomes
   WHERE period_id = 'dddd0000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A sees zero outcomes belonging to org B''s period B1 (silent filter)'::text
);

-- ────────── 3. admin A cannot INSERT an outcome into B's period ──────────
SELECT throws_ok(
  $i$INSERT INTO period_outcomes (period_id, code, label, sort_order)
     VALUES ('dddd0000-0000-4000-8000-000000000002'::uuid,
             'pgtap_xtenant', 'Cross-tenant outcome', 99)$i$,
  '42501',
  NULL,
  'admin A INSERT into org B period is rejected (RLS WITH CHECK)'::text
);

-- ────────── 4. anon sees zero outcomes from UNLOCKED periods ──────────
--   period_outcomes mirrors period_criteria: there is a public_visible-style
--   policy on locked periods. Scope to seeded UNLOCKED-period outcomes only.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM period_outcomes
   WHERE period_id IN (
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'dddd0000-0000-4000-8000-000000000002'::uuid)),
  0,
  'anon sees zero seeded UNLOCKED-period outcomes (public policy gates on is_locked)'::text
);

-- ────────── 5. super_admin sees all (both orgs) ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM period_outcomes
   WHERE period_id IN (
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'dddd0000-0000-4000-8000-000000000002'::uuid)),
  2,
  'super_admin sees all 2 seeded outcomes (both orgs)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
