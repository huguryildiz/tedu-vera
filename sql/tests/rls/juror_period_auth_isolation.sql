-- RLS isolation: juror_period_auth.
--
-- Policy under test (sql/migrations/004_rls.sql §juror_period_auth):
--   juror_period_auth_select  — tenant-scoped via jurors.organization_id
--   juror_period_auth_insert  — same scope (write-side)
--   juror_period_auth_update  — same scope
--   juror_period_auth_delete  — same scope
--
-- Bug classes this file catches:
--   1. Admin A reading juror B's PIN hash / session token (cross-tenant credential leak).
--   2. Admin A mutating juror B's auth row (PIN hijack surface).
--   3. Anon reading any juror auth row (jury-day PIN exposure).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

CREATE TEMP TABLE _row_counts (label text PRIMARY KEY, n int) ON COMMIT DROP;
GRANT SELECT, INSERT ON _row_counts TO authenticated, anon;

-- Seed: one juror_period_auth row per org's (juror, period) pair.
INSERT INTO juror_period_auth (juror_id, period_id, pin_hash, is_blocked, failed_attempts)
VALUES
  ('55550000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'pgtap-hash-a', false, 0),
  ('66660000-0000-4000-8000-000000000002'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid,
   'pgtap-hash-b', false, 0)
ON CONFLICT (juror_id, period_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A sees juror A's auth row.
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM juror_period_auth
   WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees org A juror_period_auth row'::text
);

-- 2. admin A cannot see juror B's auth row (silent filter).
SELECT is(
  (SELECT count(*)::int FROM juror_period_auth
   WHERE juror_id = '66660000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A cannot see org B juror_period_auth row (silent filter)'::text
);

-- 3. anon cannot read any juror_period_auth rows.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM juror_period_auth),
  0,
  'anon cannot read any juror_period_auth rows'::text
);

-- 4. super_admin sees both rows.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM juror_period_auth
   WHERE juror_id = ANY(ARRAY[
     '55550000-0000-4000-8000-000000000001'::uuid,
     '66660000-0000-4000-8000-000000000002'::uuid
   ])),
  2,
  'super_admin sees both juror_period_auth rows'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — cross-tenant write must throw.
-- ─────────────────────────────────────────────────────────────────────────

-- 5. admin A cannot INSERT a juror_period_auth row for org B's juror.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO juror_period_auth (juror_id, period_id, pin_hash)
     VALUES ('66660000-0000-4000-8000-000000000002'::uuid,
             'cccc0000-0000-4000-8000-000000000001'::uuid,
             'pgtap-cross-tenant-insert')$i$,
  '42501',
  NULL,
  'admin A INSERT for org B juror is rejected (RLS WITH CHECK)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation
-- ─────────────────────────────────────────────────────────────────────────

-- 6. admin A cannot UPDATE juror B's auth row (0-row update, not an error).
WITH u AS (
  UPDATE juror_period_auth
     SET pin_hash = 'pgtap-cross-tenant-update'
   WHERE juror_id = '66660000-0000-4000-8000-000000000002'::uuid
   RETURNING 1
)
INSERT INTO _row_counts SELECT 'a_update_b', count(*)::int FROM u;
SELECT is(
  (SELECT n FROM _row_counts WHERE label = 'a_update_b'),
  0,
  'admin A UPDATE on org B juror_period_auth silently affects 0 rows'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
