-- RLS isolation: framework_outcomes.
--
-- Policy under test (sql/migrations/004_rls.sql §framework_outcomes):
--   framework_outcomes_select  — tenant-scoped via frameworks.organization_id
--                                 OR organization_id IS NULL (global frameworks)
--   framework_outcomes_insert  — org-scoped or super_admin (no global write)
--   framework_outcomes_update  — same scope
--   framework_outcomes_delete  — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading org B's accreditation outcomes (IP leak across tenants).
--   2. Admin A inserting/updating org B's outcomes (cross-tenant write).
--   3. Global outcomes disappearing for regular admins (breaks system-framework view).

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
  ('f0000000-0000-4000-8000-000000000000'::uuid,
   NULL, 'pgtap Global Framework')
ON CONFLICT (id) DO NOTHING;

-- One outcome per framework.
INSERT INTO framework_outcomes (id, framework_id, code, label, sort_order) VALUES
  ('f9000000-0000-4000-8000-000000000a01'::uuid,
   'fa000000-0000-4000-8000-000000000001'::uuid,
   'O_A', 'pgtap Outcome A', 1),
  ('f9000000-0000-4000-8000-000000000b01'::uuid,
   'fb000000-0000-4000-8000-000000000002'::uuid,
   'O_B', 'pgtap Outcome B', 1),
  ('f9000000-0000-4000-8000-000000000001'::uuid,
   'f0000000-0000-4000-8000-000000000000'::uuid,
   'O_G', 'pgtap Global Outcome', 1)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees org A's outcome.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM framework_outcomes
   WHERE id = 'f9000000-0000-4000-8000-000000000a01'::uuid),
  1,
  'admin A sees org A framework_outcomes row'::text
);

-- 2. admin A cannot see org B's outcome (silent filter).
SELECT is(
  (SELECT count(*)::int FROM framework_outcomes
   WHERE id = 'f9000000-0000-4000-8000-000000000b01'::uuid),
  0,
  'admin A cannot see org B framework_outcomes row (silent filter)'::text
);

-- 3. admin A CAN see global (NULL-org) outcome.
SELECT is(
  (SELECT count(*)::int FROM framework_outcomes
   WHERE id = 'f9000000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees global (NULL-org) framework_outcomes row'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — cross-tenant write must throw.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A cannot INSERT an outcome into org B's framework.
SELECT throws_ok(
  $i$INSERT INTO framework_outcomes (framework_id, code, label, sort_order)
     VALUES ('fb000000-0000-4000-8000-000000000002'::uuid,
             'O_XTA', 'pgtap cross-tenant outcome', 99)$i$,
  '42501',
  NULL,
  'admin A INSERT into org B framework_outcomes is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot UPDATE org B's outcome (0-row update).
WITH u AS (
  UPDATE framework_outcomes
     SET label = 'pgtap cross-tenant update'
   WHERE id = 'f9000000-0000-4000-8000-000000000b01'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B framework_outcomes silently affects 0 rows'::text
);

-- 6. super_admin sees all three outcomes.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM framework_outcomes
   WHERE id = ANY(ARRAY[
     'f9000000-0000-4000-8000-000000000a01'::uuid,
     'f9000000-0000-4000-8000-000000000b01'::uuid,
     'f9000000-0000-4000-8000-000000000001'::uuid
   ])),
  3,
  'super_admin sees all three seeded framework_outcomes rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
