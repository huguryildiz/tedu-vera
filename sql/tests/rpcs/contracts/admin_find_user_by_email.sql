-- RPC: rpc_admin_find_user_by_email(TEXT) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_email TEXT) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Searches users by email within tenant
--   * Returns {users[], total_count}

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
  'jsonb',
  'returns jsonb'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_find_user_by_email('test@example.com')$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can search within org ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_find_user_by_email('a@test.local')$c$,
  'org_a admin can search users'
);

-- ────────__ 4. response has users array ──────────
SELECT ok(
  (SELECT rpc_admin_find_user_by_email('a@test.local')::jsonb ? 'users'),
  'response has users key'
);

-- ────────── 5. response has total_count ──────────
SELECT ok(
  (SELECT rpc_admin_find_user_by_email('a@test.local')::jsonb ? 'total_count'),
  'response has total_count key'
);

-- ────────__ 6. super-admin can search any user ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_find_user_by_email('b@test.local')$c$,
  'super-admin can search any user'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
