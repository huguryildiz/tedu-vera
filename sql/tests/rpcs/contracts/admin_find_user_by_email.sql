-- RPC: rpc_admin_find_user_by_email(TEXT) → TABLE(id UUID, email_confirmed_at TIMESTAMPTZ)
--
-- Pins the public contract:
--   * Signature: (p_email TEXT) returning TABLE(id uuid, email_confirmed_at timestamptz)
--   * Restricted to service_role only — anon and authenticated have no EXECUTE grant
--   * Used by Edge Functions to look up Supabase Auth users by email

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_find_user_by_email',
  ARRAY['text'::text],
  'rpc_admin_find_user_by_email(text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_find_user_by_email',
  ARRAY['text'::text],
  'record',
  'returns record set'
);

-- ────────── 2. anon cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_find_user_by_email('test@example.com')$c$,
  NULL::text,
  'anon cannot call rpc_admin_find_user_by_email'
);

-- ────────── 3. authenticated (org-admin) cannot call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_find_user_by_email('pgtap_admin_a@test.local')$c$,
  NULL::text,
  'authenticated cannot call rpc_admin_find_user_by_email'
);

-- ────────── 4. service_role (postgres) can call ──────────
SELECT pgtap_test.become_reset();

SELECT lives_ok(
  $c$SELECT rpc_admin_find_user_by_email('pgtap_admin_a@test.local')$c$,
  'service_role can call rpc_admin_find_user_by_email'
);

-- ────────── 5. result has non-null id for seeded user ──────────
SELECT ok(
  (SELECT id IS NOT NULL FROM rpc_admin_find_user_by_email('pgtap_admin_a@test.local')),
  'result row has non-null id for known email'
);

-- ────────── 6. returns empty set for unknown email ──────────
SELECT is(
  (SELECT COUNT(*) FROM rpc_admin_find_user_by_email('unknown@does-not-exist.local')),
  0::bigint,
  'returns empty set for unknown email'
);

-- ────────── 7. super-admin (authenticated role) cannot call ──────────
SELECT pgtap_test.become_super();

SELECT throws_ok(
  $c$SELECT rpc_admin_find_user_by_email('pgtap_admin_a@test.local')$c$,
  NULL::text,
  'super-admin (authenticated role) cannot call rpc_admin_find_user_by_email'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
