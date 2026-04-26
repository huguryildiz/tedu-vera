-- RLS isolation: org_applications.
--
-- Policy under test (sql/migrations/004_rls.sql §org_applications):
--   org_applications_select  — super_admin OR contact_email = jwt.email claim
--   org_applications_insert  — any authenticated user (auth.uid() IS NOT NULL)
--   org_applications_update  — super_admin only
--
-- Bug classes this file catches:
--   1. Applicant A reading another applicant's application (email-match bypass).
--   2. Anon submitting an application (should be blocked — requires authenticated session).
--   3. Non-super admin updating application status (approval/rejection bypass).
--   4. Super-admin visibility regression.
--
-- Note: org_applications_select uses auth.jwt()->>'email', not auth.uid() →
--   become_a() is NOT used here; JWT claims must include the email field explicitly.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- Two applications: one per org's admin email.
INSERT INTO org_applications (id, applicant_name, contact_email, message) VALUES
  ('ab000000-0000-4000-8000-000000000001'::uuid,
   'pgtap Applicant A', 'pgtap_admin_a@test.local', 'pgtap application A'),
  ('ab000000-0000-4000-8000-000000000002'::uuid,
   'pgtap Applicant B', 'pgtap_admin_b@test.local', 'pgtap application B')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation via email claim
-- ─────────────────────────────────────────────────────────────────────────

-- 1. applicant A (JWT with matching email) sees own application.
SET LOCAL request.jwt.claims = '{"sub":"aaaa0000-0000-4000-8000-000000000001","role":"authenticated","email":"pgtap_admin_a@test.local"}';
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM org_applications
   WHERE id = 'ab000000-0000-4000-8000-000000000001'::uuid),
  1,
  'applicant A sees own org_applications row (email-match policy)'::text
);

-- 2. applicant A cannot see applicant B's application.
SELECT is(
  (SELECT count(*)::int FROM org_applications
   WHERE id = 'ab000000-0000-4000-8000-000000000002'::uuid),
  0,
  'applicant A cannot see applicant B org_applications row (email mismatch)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 3. anon cannot INSERT an application (auth.uid() IS NULL → rejected).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $i$INSERT INTO org_applications (applicant_name, contact_email)
     VALUES ('pgtap anon attacker', 'anon@attacker.test')$i$,
  '42501',
  NULL,
  'anon INSERT into org_applications is rejected (RLS WITH CHECK: uid IS NOT NULL)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 4. regular admin cannot UPDATE any application (0-row update — not super_admin).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
WITH u AS (
  UPDATE org_applications
     SET status = 'approved'
   WHERE id = 'ab000000-0000-4000-8000-000000000001'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_own', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_own'),
  0,
  'regular admin UPDATE on org_applications silently affects 0 rows (requires super_admin)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Super-admin baseline
-- ─────────────────────────────────────────────────────────────────────────

-- 5. super_admin sees both applications.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM org_applications
   WHERE id = ANY(ARRAY[
     'ab000000-0000-4000-8000-000000000001'::uuid,
     'ab000000-0000-4000-8000-000000000002'::uuid
   ])),
  2,
  'super_admin sees both seeded org_applications rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
