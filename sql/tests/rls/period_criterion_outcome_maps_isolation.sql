-- RLS isolation: period_criterion_outcome_maps.
--
-- Policies under test (sql/migrations/004_rls.sql §period_criterion_outcome_maps):
--   period_criterion_outcome_maps_select         — tenant-scoped via periods.organization_id
--   period_criterion_outcome_maps_select_public  — any caller for locked periods
--                                                   (jury anon flow reads mudek mappings)
--   period_criterion_outcome_maps_insert         — org-scoped or super_admin
--   period_criterion_outcome_maps_update         — same scope
--   period_criterion_outcome_maps_delete         — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading org B's criterion→outcome mappings for unlocked periods.
--   2. Admin A mutating org B's mappings.
--   3. Anon being blocked from locked-period maps (jury evaluation step would fail).
--   4. Public-visible policy silently disappearing (jury flow 404).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();
SELECT pgtap_test.seed_period_outcomes();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- Seed maps for both unlocked periods.
-- Period A (unlocked): cccc0000-...-0001 | criterion a1110000-...-a01 | outcome a2220000-...-a01
-- Period B (unlocked): dddd0000-...-0002 | criterion a1110000-...-b01 | outcome a2220000-...-b01
INSERT INTO period_criterion_outcome_maps
  (id, period_id, period_criterion_id, period_outcome_id, coverage_type)
VALUES
  ('pm000000-0000-4000-8000-000000000a01'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'a1110000-0000-4000-8000-000000000a01'::uuid,
   'a2220000-0000-4000-8000-000000000a01'::uuid,
   'direct'),
  ('pm000000-0000-4000-8000-000000000b01'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid,
   'a1110000-0000-4000-8000-000000000b01'::uuid,
   'a2220000-0000-4000-8000-000000000b01'::uuid,
   'direct')
ON CONFLICT (period_criterion_id, period_outcome_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees org A's (unlocked period) map.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM period_criterion_outcome_maps
   WHERE id = 'pm000000-0000-4000-8000-000000000a01'::uuid),
  1,
  'admin A sees org A period_criterion_outcome_maps row (unlocked period)'::text
);

-- 2. admin A cannot see org B's map for unlocked period (silent filter).
SELECT is(
  (SELECT count(*)::int FROM period_criterion_outcome_maps
   WHERE id = 'pm000000-0000-4000-8000-000000000b01'::uuid),
  0,
  'admin A cannot see org B maps for unlocked period (silent filter)'::text
);

-- 3. anon cannot read maps for unlocked periods.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM period_criterion_outcome_maps
   WHERE id = ANY(ARRAY[
     'pm000000-0000-4000-8000-000000000a01'::uuid,
     'pm000000-0000-4000-8000-000000000b01'::uuid
   ])),
  0,
  'anon cannot read maps for unlocked periods (both filtered)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — cross-tenant write must throw.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A cannot INSERT a map into org B's period.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO period_criterion_outcome_maps
       (period_id, period_criterion_id, period_outcome_id, coverage_type)
     VALUES (
       'dddd0000-0000-4000-8000-000000000002'::uuid,
       'a1110000-0000-4000-8000-000000000b01'::uuid,
       'a2220000-0000-4000-8000-000000000b01'::uuid,
       'indirect'
     )$i$,
  '42501',
  NULL,
  'admin A INSERT into org B period_criterion_outcome_maps is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot UPDATE org B's map (0-row update).
WITH u AS (
  UPDATE period_criterion_outcome_maps
     SET coverage_type = 'indirect'
   WHERE id = 'pm000000-0000-4000-8000-000000000b01'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B maps silently affects 0 rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Super-admin baseline
-- ─────────────────────────────────────────────────────────────────────────

-- 6. super_admin sees both maps.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM period_criterion_outcome_maps
   WHERE id = ANY(ARRAY[
     'pm000000-0000-4000-8000-000000000a01'::uuid,
     'pm000000-0000-4000-8000-000000000b01'::uuid
   ])),
  2,
  'super_admin sees both seeded period_criterion_outcome_maps rows'::text
);

-- 7. super_admin can DELETE a map.
SELECT lives_ok(
  $d$DELETE FROM period_criterion_outcome_maps
     WHERE id = 'pm000000-0000-4000-8000-000000000b01'::uuid$d$,
  'super_admin DELETE on org B map succeeds'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
