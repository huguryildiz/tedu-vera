-- RLS isolation: jury_feedback.
--
-- Policy under test (sql/migrations/004_rls.sql §jury_feedback):
--   RLS is ENABLED (no FORCE) but NO policies exist.
--   No GRANT to authenticated or anon — only postgres has access.
--   All access goes through SECURITY DEFINER RPCs only.
--   Because authenticated/anon have no table grants, SELECT throws 42501
--   (not a silent 0-row filter — that only happens when the role has SELECT
--    but no matching RLS policy).
--
-- Bug classes this file catches:
--   1. Authenticated user directly reading juror satisfaction data (privacy violation).
--   2. Anon reading jury feedback (unauthenticated access to internal feedback).
--   3. Authenticated user bypassing RPC and inserting feedback directly.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(4);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- Seed a jury_feedback row as the postgres superuser (before any role switch).
-- Only postgres has grants on this table (authenticated/anon have none).
INSERT INTO jury_feedback (id, period_id, juror_id, rating, comment)
VALUES
  ('fe000000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   '55550000-0000-4000-8000-000000000001'::uuid,
   4, 'pgtap feedback')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation — no grants → permission denied (42501) for every role.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A SELECT throws 42501 (no SELECT grant for authenticated).
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $$SELECT count(*)::int FROM jury_feedback$$,
  '42501',
  NULL,
  'admin A SELECT on jury_feedback throws 42501 (no grant for authenticated)'::text
);

-- 2. anon SELECT throws 42501 (no SELECT grant for anon).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $$SELECT count(*)::int FROM jury_feedback$$,
  '42501',
  NULL,
  'anon SELECT on jury_feedback throws 42501 (no grant for anon)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — no grants + no permissive WITH CHECK policy → throws.
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A INSERT throws 42501 (no INSERT grant for authenticated).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO jury_feedback (period_id, juror_id, rating)
     VALUES (
       'cccc0000-0000-4000-8000-000000000001'::uuid,
       '55550000-0000-4000-8000-000000000001'::uuid,
       3
     )$i$,
  '42501',
  NULL,
  'admin A direct INSERT into jury_feedback throws 42501 (no grant)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Postgres baseline — superuser bypasses both grants and RLS.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. postgres role can still see the seeded row (confirms row exists, deny is grant-level).
SELECT pgtap_test.become_reset();
SELECT is(
  (SELECT count(*)::int FROM jury_feedback
   WHERE id = 'fe000000-0000-4000-8000-000000000001'::uuid),
  1,
  'postgres role sees jury_feedback row (grant and RLS bypassed for superuser)'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
