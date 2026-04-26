-- RLS isolation: framework_criteria.
--
-- Policy under test (sql/migrations/004_rls.sql §framework_criteria):
--   framework_criteria_select  — tenant-scoped via frameworks.organization_id
--                                 OR organization_id IS NULL (global frameworks
--                                 are readable by any authenticated user)
--   framework_criteria_insert  — org-scoped or super_admin (no global write)
--   framework_criteria_update  — same scope
--   framework_criteria_delete  — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading org B's proprietary framework criteria (accreditation IP leak).
--   2. Admin A mutating org B's criteria (cross-tenant write).
--   3. Global (NULL-org) criteria becoming invisible — breaks system-wide framework display.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- Seed: one framework per org + one global (NULL-org) framework.
INSERT INTO frameworks (id, organization_id, name) VALUES
  ('fa000000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'pgtap Framework A'),
  ('fb000000-0000-4000-8000-000000000002'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'pgtap Framework B'),
  ('fg000000-0000-4000-8000-000000000000'::uuid,
   NULL, 'pgtap Global Framework')
ON CONFLICT (id) DO NOTHING;

-- One criterion per framework.
INSERT INTO framework_criteria (id, framework_id, key, label, max_score, weight, sort_order) VALUES
  ('fc000000-0000-4000-8000-000000000a01'::uuid,
   'fa000000-0000-4000-8000-000000000001'::uuid,
   'k_a', 'pgtap Criterion A', 10, 1.0, 1),
  ('fc000000-0000-4000-8000-000000000b01'::uuid,
   'fb000000-0000-4000-8000-000000000002'::uuid,
   'k_b', 'pgtap Criterion B', 10, 1.0, 1),
  ('fc000000-0000-4000-8000-000000000g01'::uuid,
   'fg000000-0000-4000-8000-000000000000'::uuid,
   'k_g', 'pgtap Global Criterion', 10, 1.0, 1)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees org A's criterion.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM framework_criteria
   WHERE id = 'fc000000-0000-4000-8000-000000000a01'::uuid),
  1,
  'admin A sees org A framework_criteria row'::text
);

-- 2. admin A cannot see org B's criterion (silent filter).
SELECT is(
  (SELECT count(*)::int FROM framework_criteria
   WHERE id = 'fc000000-0000-4000-8000-000000000b01'::uuid),
  0,
  'admin A cannot see org B framework_criteria row (silent filter)'::text
);

-- 3. admin A CAN see global (NULL-org) criterion.
SELECT is(
  (SELECT count(*)::int FROM framework_criteria
   WHERE id = 'fc000000-0000-4000-8000-000000000g01'::uuid),
  1,
  'admin A sees global (NULL-org) framework_criteria row'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — cross-tenant write must throw.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A cannot INSERT a criterion into org B's framework.
SELECT throws_ok(
  $i$INSERT INTO framework_criteria (framework_id, key, label, max_score, weight, sort_order)
     VALUES ('fb000000-0000-4000-8000-000000000002'::uuid,
             'k_xta', 'pgtap cross-tenant', 10, 1.0, 99)$i$,
  '42501',
  NULL,
  'admin A INSERT into org B framework is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot UPDATE org B's criterion (0-row update).
WITH u AS (
  UPDATE framework_criteria
     SET label = 'pgtap cross-tenant update'
   WHERE id = 'fc000000-0000-4000-8000-000000000b01'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B framework_criteria silently affects 0 rows'::text
);

-- 6. super_admin sees all three criteria.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM framework_criteria
   WHERE id = ANY(ARRAY[
     'fc000000-0000-4000-8000-000000000a01'::uuid,
     'fc000000-0000-4000-8000-000000000b01'::uuid,
     'fc000000-0000-4000-8000-000000000g01'::uuid
   ])),
  3,
  'super_admin sees all three seeded framework_criteria rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
