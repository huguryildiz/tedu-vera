-- RLS isolation: period_criteria.
--
-- period_criteria has no organization_id column; tenant scoping is *derived*
-- via period_id → periods.organization_id. That makes a regression here
-- particularly nasty: a missing JOIN in the policy would silently expose
-- every tenant's criteria.
--
-- Policies (sql/migrations/004_rls.sql §period_criteria):
--   period_criteria_select          — caller's org via periods JOIN, or super_admin
--   period_criteria_insert/update/delete — same scope as select; super_admin only on rows
--                                          tied to a non-locked period (lock-trigger fires
--                                          regardless and is asserted in triggers/period_lock.sql).
--
-- Bug classes this file catches:
--   1. The JOIN to periods being dropped → admin A reads admin B's criteria.
--   2. Anon reading the criteria catalog (which is jury-day hidden info).
--   3. Cross-tenant write attempt being silently allowed (a rubric overwrite
--      from another tenant would corrupt the wrong period's snapshot).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- ────────── 1. admin A sees only A's criteria ──────────
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM period_criteria
   WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  2,
  'admin A sees both seeded criteria for own-org period A1'::text
);

-- ────────── 2. admin A sees zero of B's criteria ──────────
SELECT is(
  (SELECT count(*)::int FROM period_criteria
   WHERE period_id = 'dddd0000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A sees zero criteria belonging to org B''s period B1 (silent filter)'::text
);

-- ────────── 3. admin A cannot INSERT a criterion into B's period ──────────
SELECT throws_ok(
  $i$INSERT INTO period_criteria (period_id, key, label, max_score, weight, sort_order)
     VALUES ('dddd0000-0000-4000-8000-000000000002'::uuid,
             'pgtap_xtenant', 'Cross-tenant attempt', 10, 1, 99)$i$,
  '42501',
  NULL,
  'admin A INSERT into org B period is rejected (RLS WITH CHECK)'::text
);

-- ────────── 4. admin A's UPDATE on a B criterion silently affects 0 rows ──────────
WITH u AS (
  UPDATE period_criteria SET label = 'pgtap pwned'
   WHERE id = 'a1110000-0000-4000-8000-000000000b01'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b_crit', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b_crit'),
  0,
  'admin A UPDATE on org B criterion silently affects 0 rows'::text
);

-- ────────── 5. anon sees zero criteria from UNLOCKED periods ──────────
--   period_criteria has TWO SELECT policies:
--     period_criteria_select         — caller's org via JOIN to periods
--     period_criteria_select_public  — period_id IN (SELECT id FROM periods WHERE is_locked=true)
--   The public policy intentionally exposes locked-period criteria so the
--   jury anon path can render the rubric pre-auth. We therefore assert anon
--   visibility ONLY for our seeded UNLOCKED-period criteria. Scoping by
--   seeded period IDs avoids interference from the demo DB's real rows.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM period_criteria
   WHERE period_id IN (
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'dddd0000-0000-4000-8000-000000000002'::uuid)),
  0,
  'anon sees zero seeded UNLOCKED-period criteria (public policy gates on is_locked)'::text
);

-- ────────── 6. anon cannot INSERT into period_criteria ──────────
SELECT throws_ok(
  $i$INSERT INTO period_criteria (period_id, key, label, max_score, weight, sort_order)
     VALUES ('cccc0000-0000-4000-8000-000000000001'::uuid,
             'pgtap_anon', 'Anon attempt', 10, 1, 99)$i$,
  '42501',
  NULL,
  'anon INSERT is rejected'::text
);

-- ────────── 7. super_admin sees all (both orgs) ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM period_criteria
   WHERE period_id IN (
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'dddd0000-0000-4000-8000-000000000002'::uuid)),
  4,
  'super_admin sees all 4 seeded criteria (both orgs)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
