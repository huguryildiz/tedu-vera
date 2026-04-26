-- RLS isolation: framework_criterion_outcome_maps.
--
-- Policy under test (sql/migrations/004_rls.sql §framework_criterion_outcome_maps):
--   framework_criterion_outcome_maps_select  — tenant-scoped via frameworks.organization_id
--                                               OR organization_id IS NULL (global)
--   framework_criterion_outcome_maps_insert  — org-scoped or super_admin
--   framework_criterion_outcome_maps_update  — same scope
--   framework_criterion_outcome_maps_delete  — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading org B's criterion-outcome mappings (accreditation IP leak).
--   2. Admin A inserting/updating org B's mappings (cross-tenant write).
--   3. Global-framework maps disappearing for regular admins.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- Seed frameworks, criteria, and outcomes for both orgs.
INSERT INTO frameworks (id, organization_id, name) VALUES
  ('fa000000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'pgtap Framework A'),
  ('fb000000-0000-4000-8000-000000000002'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'pgtap Framework B'),
  ('f0000000-0000-4000-8000-000000000000'::uuid,
   NULL, 'pgtap Global Framework')
ON CONFLICT (id) DO NOTHING;

INSERT INTO framework_criteria (id, framework_id, key, label, max_score, weight, sort_order) VALUES
  ('fc000000-0000-4000-8000-000000000a01'::uuid,
   'fa000000-0000-4000-8000-000000000001'::uuid, 'k_a', 'pgtap Criterion A', 10, 1.0, 1),
  ('fc000000-0000-4000-8000-000000000b01'::uuid,
   'fb000000-0000-4000-8000-000000000002'::uuid, 'k_b', 'pgtap Criterion B', 10, 1.0, 1),
  ('fc000000-0000-4000-8000-000000000001'::uuid,
   'f0000000-0000-4000-8000-000000000000'::uuid, 'k_g', 'pgtap Global Criterion', 10, 1.0, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO framework_outcomes (id, framework_id, code, label, sort_order) VALUES
  ('f9000000-0000-4000-8000-000000000a01'::uuid,
   'fa000000-0000-4000-8000-000000000001'::uuid, 'O_A', 'pgtap Outcome A', 1),
  ('f9000000-0000-4000-8000-000000000b01'::uuid,
   'fb000000-0000-4000-8000-000000000002'::uuid, 'O_B', 'pgtap Outcome B', 1),
  ('f9000000-0000-4000-8000-000000000001'::uuid,
   'f0000000-0000-4000-8000-000000000000'::uuid, 'O_G', 'pgtap Global Outcome', 1)
ON CONFLICT (id) DO NOTHING;

-- One map per framework (criterion → outcome within the same framework).
INSERT INTO framework_criterion_outcome_maps
  (id, framework_id, criterion_id, outcome_id, coverage_type)
VALUES
  ('f4000000-0000-4000-8000-000000000a01'::uuid,
   'fa000000-0000-4000-8000-000000000001'::uuid,
   'fc000000-0000-4000-8000-000000000a01'::uuid,
   'f9000000-0000-4000-8000-000000000a01'::uuid,
   'direct'),
  ('f4000000-0000-4000-8000-000000000b01'::uuid,
   'fb000000-0000-4000-8000-000000000002'::uuid,
   'fc000000-0000-4000-8000-000000000b01'::uuid,
   'f9000000-0000-4000-8000-000000000b01'::uuid,
   'direct'),
  ('f4000000-0000-4000-8000-000000000001'::uuid,
   'f0000000-0000-4000-8000-000000000000'::uuid,
   'fc000000-0000-4000-8000-000000000001'::uuid,
   'f9000000-0000-4000-8000-000000000001'::uuid,
   'direct')
ON CONFLICT (criterion_id, outcome_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees org A's map.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM framework_criterion_outcome_maps
   WHERE id = 'f4000000-0000-4000-8000-000000000a01'::uuid),
  1,
  'admin A sees org A framework_criterion_outcome_maps row'::text
);

-- 2. admin A cannot see org B's map (silent filter).
SELECT is(
  (SELECT count(*)::int FROM framework_criterion_outcome_maps
   WHERE id = 'f4000000-0000-4000-8000-000000000b01'::uuid),
  0,
  'admin A cannot see org B framework_criterion_outcome_maps row (silent filter)'::text
);

-- 3. admin A CAN see global (NULL-org) map.
SELECT is(
  (SELECT count(*)::int FROM framework_criterion_outcome_maps
   WHERE id = 'f4000000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees global (NULL-org) framework_criterion_outcome_maps row'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A cannot INSERT a map referencing org B's framework.
SELECT throws_ok(
  $i$INSERT INTO framework_criterion_outcome_maps
       (framework_id, criterion_id, outcome_id, coverage_type)
     VALUES (
       'fb000000-0000-4000-8000-000000000002'::uuid,
       'fc000000-0000-4000-8000-000000000b01'::uuid,
       'f9000000-0000-4000-8000-000000000b01'::uuid,
       'indirect'
     )$i$,
  '42501',
  NULL,
  'admin A INSERT into org B framework maps is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot UPDATE org B's map (0-row update).
WITH u AS (
  UPDATE framework_criterion_outcome_maps
     SET coverage_type = 'indirect'
   WHERE id = 'f4000000-0000-4000-8000-000000000b01'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B framework maps silently affects 0 rows'::text
);

-- 6. super_admin sees all three maps.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM framework_criterion_outcome_maps
   WHERE id = ANY(ARRAY[
     'f4000000-0000-4000-8000-000000000a01'::uuid,
     'f4000000-0000-4000-8000-000000000b01'::uuid,
     'f4000000-0000-4000-8000-000000000001'::uuid
   ])),
  3,
  'super_admin sees all three seeded framework_criterion_outcome_maps rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
