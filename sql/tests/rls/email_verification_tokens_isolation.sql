-- RLS isolation: email_verification_tokens.
--
-- Policy under test (sql/migrations/004_rls.sql §email_verification_tokens):
--   NO RLS policies — table has REVOKE ALL FROM PUBLIC, anon, authenticated.
--   Only service-role (Edge Functions) may access this table.
--
-- Bug classes this file catches:
--   1. Any authenticated user reading token rows (token hijack → account takeover).
--   2. Anon reading token rows (unauthenticated token harvest).
--   3. Any authenticated user writing token rows (token forging).
--
-- Expected behavior: every direct SQL access by anon or authenticated throws
--   SQLSTATE 42501 (permission denied for table email_verification_tokens).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(3);

-- ─────────────────────────────────────────────────────────────────────────
-- Permission denial tests — no seed data needed; the table is unreachable.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. anon SELECT is rejected (REVOKE ALL).
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $$SELECT count(*) FROM email_verification_tokens$$,
  '42501',
  NULL,
  'anon SELECT on email_verification_tokens is rejected (REVOKE ALL)'::text
);

-- 2. authenticated SELECT is rejected (REVOKE ALL).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $$SELECT count(*) FROM email_verification_tokens$$,
  '42501',
  NULL,
  'authenticated SELECT on email_verification_tokens is rejected (REVOKE ALL)'::text
);

-- 3. authenticated INSERT is rejected (REVOKE ALL).
-- Note: token column is UUID — use a valid UUID literal so the type cast succeeds
-- and PostgreSQL reaches the permission check (which throws 42501).
SELECT throws_ok(
  $i$INSERT INTO email_verification_tokens (token, email, expires_at)
     VALUES ('ef000000-0000-4000-8000-000000000001'::uuid, 'victim@test.local', now() + interval '1 hour')$i$,
  '42501',
  NULL,
  'authenticated INSERT into email_verification_tokens is rejected (REVOKE ALL)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
