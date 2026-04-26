-- RLS isolation matrix: periods.
--
-- This is the canonical "tenant isolation across all CRUD verbs" example for
-- the architecture spec § 3.3 dual-failure-mode pattern: the policy must
-- *throw* on explicit denial (UPDATE/DELETE/INSERT WITH CHECK) and silently
-- *filter* on SELECT. A policy that means to throw but only filters leaks
-- the existence of rows via timing.
--
-- Policies under test (sql/migrations/004_rls.sql §periods):
--   periods_select                 — caller's org, OR super_admin
--   periods_select_public_visible  — any caller may SELECT rows where is_locked = true
--                                     (jury identity step needs locked-period names)
--   periods_insert                 — org_admin in WITH CHECK (organization_id) OR super_admin
--   periods_update                 — same scope as insert
--   periods_delete                 — same scope as insert
--
-- Bug classes this file catches:
--   1. Tenant A admin accidentally seeing tenant B's UNLOCKED periods (silent leak).
--   2. Tenant A admin accidentally MUTATING a tenant B period (write-side leak).
--   3. Anon being able to SELECT unlocked periods at all (entire tenant catalog leaks).
--   4. The public_visible policy silently dropping (jury identity step would 404).
--   5. Super-admin losing read access (panel breaks).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(11);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- Helper: capture data-modifying CTE row counts at top level. PostgreSQL
-- does not allow `WITH (UPDATE ... RETURNING)` inside a subquery, which is
-- the natural way to assert `is(rows_affected, 0)`. We INSERT the count
-- into a TEMP table at top level and then assert against it.
-- The grants are required because the temp table is owned by `postgres`
-- but later assertions run under `authenticated` / `anon` after a
-- pgtap_test.become_*() call.
CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT matrix
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees both A periods (unlocked + locked) via tenant policy.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM periods
   WHERE organization_id = '11110000-0000-4000-8000-000000000001'::uuid),
  2,
  'admin A sees both periods in org A (unlocked + locked)'::text
);

-- 2. admin A cannot see B's UNLOCKED period (silent filter, not an error).
SELECT is(
  (SELECT count(*)::int FROM periods
   WHERE id = 'dddd0000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A cannot see unlocked period in org B (silent filter)'::text
);

-- 3. admin A CAN see B's LOCKED period via the public_visible policy
--    (jury identity step needs this to render the period name).
SELECT is(
  (SELECT count(*)::int FROM periods
   WHERE id = 'dddd0000-0000-4000-8000-000000000022'::uuid),
  1,
  'admin A sees LOCKED period in org B (public_visible policy)'::text
);

-- 4. anon cannot see unlocked periods at all.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM periods
   WHERE id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  0,
  'anon cannot see unlocked period in org A (silent filter)'::text
);

-- 5. anon CAN see locked periods (jury entry-token redemption pre-auth).
SELECT is(
  (SELECT count(*)::int FROM periods
   WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid),
  1,
  'anon sees locked period in org A (public_visible policy)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT matrix — write-side leaks must throw, never silently insert.
-- ─────────────────────────────────────────────────────────────────────────

-- 6. admin A cannot INSERT a period into org B.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO periods (organization_id, name, season, is_locked)
     VALUES ('22220000-0000-4000-8000-000000000002'::uuid,
             'pgtap cross-tenant insert', 'Spring', false)$i$,
  '42501',
  NULL,
  'admin A INSERT into org B is rejected (RLS WITH CHECK)'::text
);

-- 7. anon cannot INSERT periods at all.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $i$INSERT INTO periods (organization_id, name, season, is_locked)
     VALUES ('11110000-0000-4000-8000-000000000001'::uuid,
             'pgtap anon insert', 'Spring', false)$i$,
  '42501',
  NULL,
  'anon INSERT is rejected'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE matrix
-- ─────────────────────────────────────────────────────────────────────────

-- 8. admin A cannot UPDATE B's UNLOCKED period via direct table.
--    Note: RLS UPDATE on a row the policy hides becomes a 0-row UPDATE
--    (silent), not an error. We assert no row was changed.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
WITH u AS (
  UPDATE periods
     SET description = 'pgtap cross-tenant update attempt'
   WHERE id = 'dddd0000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B unlocked period silently affects 0 rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- DELETE matrix
-- ─────────────────────────────────────────────────────────────────────────

-- 9. admin A cannot DELETE B's UNLOCKED period via direct table.
WITH d AS (
  DELETE FROM periods
   WHERE id = 'dddd0000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_delete_b', count(*)::int FROM d;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_delete_b'),
  0,
  'admin A DELETE on org B unlocked period silently affects 0 rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Super-admin baseline — the role that MUST see everything.
-- ─────────────────────────────────────────────────────────────────────────

-- 10. super_admin sees all 4 seeded periods.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM periods
   WHERE organization_id IN (
     '11110000-0000-4000-8000-000000000001'::uuid,
     '22220000-0000-4000-8000-000000000002'::uuid)),
  4,
  'super_admin sees all 4 seeded periods (both orgs, locked + unlocked)'::text
);

-- 11. super_admin can DELETE a non-locked period in any org.
SELECT lives_ok(
  $d$DELETE FROM periods WHERE id = 'dddd0000-0000-4000-8000-000000000002'::uuid$d$,
  'super_admin DELETE on org B unlocked period succeeds'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
