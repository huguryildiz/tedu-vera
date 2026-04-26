-- RLS isolation: profiles.
--
-- Policy under test (sql/migrations/004_rls.sql §profiles):
--   profiles_select  — id = auth.uid() OR super_admin
--   profiles_insert  — id = auth.uid() (own row only)
--   profiles_update  — id = auth.uid() (own row only)
--
-- Bug classes this file catches:
--   1. Admin A reading admin B's display_name / avatar (cross-tenant identity leak).
--   2. Admin A being able to UPDATE admin B's profile (identity impersonation).
--   3. Super-admin losing visibility over all profiles.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees only their own profile.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM profiles
   WHERE id = 'aaaa0000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees their own profile'::text
);

-- 2. admin A cannot see admin B's profile (silent filter).
SELECT is(
  (SELECT count(*)::int FROM profiles
   WHERE id = 'bbbb0000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A cannot see admin B profile (silent filter)'::text
);

-- 3. anon cannot read any profiles.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM profiles
   WHERE id = ANY(ARRAY[
     'aaaa0000-0000-4000-8000-000000000001'::uuid,
     'bbbb0000-0000-4000-8000-000000000002'::uuid
   ])),
  0,
  'anon cannot read any profiles (silent filter)'::text
);

-- 4. super_admin sees all three seeded profiles (A + B + super).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM profiles
   WHERE id = ANY(ARRAY[
     'aaaa0000-0000-4000-8000-000000000001'::uuid,
     'bbbb0000-0000-4000-8000-000000000002'::uuid,
     'eeee0000-0000-4000-8000-00000000000e'::uuid
   ])),
  3,
  'super_admin sees all three seeded profiles'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot UPDATE admin B's profile (0-row update, not an error).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
WITH u AS (
  UPDATE profiles
     SET display_name = 'pgtap cross-user update attempt'
   WHERE id = 'bbbb0000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on admin B profile silently affects 0 rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
