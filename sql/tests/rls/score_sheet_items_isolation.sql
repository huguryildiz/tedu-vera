-- RLS isolation: score_sheet_items.
--
-- Policy under test (sql/migrations/004_rls.sql §score_sheet_items):
--   score_sheet_items_select  — tenant-scoped via score_sheets→periods.organization_id
--   score_sheet_items_insert  — same scope (open periods only)
--   score_sheet_items_update  — same scope (open periods only)
--   score_sheet_items_delete  — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading org B's individual criterion scores (per-juror score leak).
--   2. Admin A inserting/updating org B's score items (cross-tenant score write).
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

-- period_criteria rows required as FK targets for score_sheet_items.
INSERT INTO period_criteria (id, period_id, key, label, max_score, weight, sort_order)
VALUES
  ('ec000000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'pgtap_sc_a', 'pgtap ScoreItem Crit A', 10, 1.0, 1),
  ('ec000000-0000-4000-8000-000000000002'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid,
   'pgtap_sc_b', 'pgtap ScoreItem Crit B', 10, 1.0, 1)
ON CONFLICT (id) DO NOTHING;

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

-- One score_sheet_item per org.
INSERT INTO score_sheet_items (id, score_sheet_id, period_criterion_id, score_value)
VALUES
  ('ed000000-0000-4000-8000-000000000001'::uuid,
   'e1110000-0000-4000-8000-000000000001'::uuid,
   'ec000000-0000-4000-8000-000000000001'::uuid, 7.5),
  ('ed000000-0000-4000-8000-000000000002'::uuid,
   'f2220000-0000-4000-8000-000000000002'::uuid,
   'ec000000-0000-4000-8000-000000000002'::uuid, 8.0)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees org A's score item.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM score_sheet_items
   WHERE id = 'ed000000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees org A score_sheet_items row'::text
);

-- 2. admin A cannot see org B's score item (silent filter).
SELECT is(
  (SELECT count(*)::int FROM score_sheet_items
   WHERE id = 'ed000000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A cannot see org B score_sheet_items row (silent filter)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A cannot INSERT a score item referencing org B's score sheet.
SELECT throws_ok(
  $i$INSERT INTO score_sheet_items (score_sheet_id, period_criterion_id, score_value)
     VALUES (
       'f2220000-0000-4000-8000-000000000002'::uuid,
       'ec000000-0000-4000-8000-000000000002'::uuid,
       9.0
     )$i$,
  '42501',
  NULL,
  'admin A INSERT into org B score_sheet_items is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A cannot UPDATE org B's score item (0-row update).
WITH u AS (
  UPDATE score_sheet_items
     SET score_value = 1.0
   WHERE id = 'ed000000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B score_sheet_items silently affects 0 rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Super-admin baseline
-- ─────────────────────────────────────────────────────────────────────────

-- 5. super_admin sees both score items.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM score_sheet_items
   WHERE id = ANY(ARRAY[
     'ed000000-0000-4000-8000-000000000001'::uuid,
     'ed000000-0000-4000-8000-000000000002'::uuid
   ])),
  2,
  'super_admin sees both seeded score_sheet_items rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
