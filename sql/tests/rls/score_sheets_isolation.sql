-- RLS isolation: score_sheets.
--
-- Policy under test (sql/migrations/004_rls.sql §score_sheets):
--   score_sheets_select  — tenant-scoped via periods.organization_id
--   score_sheets_insert  — same scope (open periods only)
--   score_sheets_update  — same scope (open periods only)
--   score_sheets_delete  — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading org B's score sheets (cross-tenant score leak).
--   2. Admin A inserting/updating org B's score sheets (cross-tenant write).
--   3. Super-admin visibility regression.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_projects();
SELECT pgtap_test.seed_jurors();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- One score sheet per org.
INSERT INTO score_sheets (id, juror_id, project_id, period_id, status) VALUES
  ('e1110000-0000-4000-8000-000000000001'::uuid,
   '55550000-0000-4000-8000-000000000001'::uuid,
   '33330000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid, 'in_progress'),
  ('f2220000-0000-4000-8000-000000000002'::uuid,
   '66660000-0000-4000-8000-000000000002'::uuid,
   '44440000-0000-4000-8000-000000000002'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid, 'in_progress')
ON CONFLICT (juror_id, project_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees org A's score sheet.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM score_sheets
   WHERE id = 'e1110000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees org A score_sheets row'::text
);

-- 2. admin A cannot see org B's score sheet (silent filter).
SELECT is(
  (SELECT count(*)::int FROM score_sheets
   WHERE id = 'f2220000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A cannot see org B score_sheets row (silent filter)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A cannot INSERT a score sheet into org B's period.
SELECT throws_ok(
  $i$INSERT INTO score_sheets (juror_id, project_id, period_id, status)
     VALUES (
       '55550000-0000-4000-8000-000000000001'::uuid,
       '44440000-0000-4000-8000-000000000002'::uuid,
       'dddd0000-0000-4000-8000-000000000002'::uuid,
       'in_progress'
     )$i$,
  '42501',
  NULL,
  'admin A INSERT into org B period score_sheets is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A cannot UPDATE org B's score sheet (0-row update).
WITH u AS (
  UPDATE score_sheets
     SET status = 'submitted'
   WHERE id = 'f2220000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B score_sheets silently affects 0 rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Super-admin baseline
-- ─────────────────────────────────────────────────────────────────────────

-- 5. super_admin sees both score sheets.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM score_sheets
   WHERE id = ANY(ARRAY[
     'e1110000-0000-4000-8000-000000000001'::uuid,
     'f2220000-0000-4000-8000-000000000002'::uuid
   ])),
  2,
  'super_admin sees both seeded score_sheets rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
