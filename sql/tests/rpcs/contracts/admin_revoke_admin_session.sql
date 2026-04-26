-- RPC: rpc_admin_revoke_admin_session(UUID) → json
--
-- Pins the public contract documented in 007_identity.sql:
--   * Signature: (p_session_id UUID) returning json
--   * Authenticated required
--   * Returns {ok, error_code, id} with audit logging
--   * Error codes: 'unauthenticated', 'session_not_found', 'unauthorized'

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_revoke_admin_session',
  ARRAY['uuid'::text],
  'rpc_admin_revoke_admin_session(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_revoke_admin_session',
  ARRAY['uuid'::text],
  'json',
  'returns json'
);

-- ────────── 2. unauthenticated → unauthenticated error ──────────
SELECT pgtap_test.become_anon();

SELECT results_eq(
  $c$SELECT rpc_admin_revoke_admin_session('pgtap-sess-9999'::uuid)::jsonb ? 'error_code'$c$,
  ARRAY[true],
  'anon caller returns error_code field'
);

-- ────────── 3. session not found ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('pgtap-sess-nonexist'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['session_not_found'],
  'nonexistent session returns session_not_found'
);

-- ────────── 4. cannot revoke other user's session (non-super-admin) ──────────
-- Create sessions for user_a and user_b
INSERT INTO admin_user_sessions (id, user_id, device_id, created_at, updated_at, first_seen_at, last_activity_at)
VALUES (
  'pgtap-sess-user-a'::uuid,
  (SELECT id FROM profiles WHERE email = 'a@test.local'),
  'device-a',
  now(),
  now(),
  now(),
  now()
);

INSERT INTO admin_user_sessions (id, user_id, device_id, created_at, updated_at, first_seen_at, last_activity_at)
VALUES (
  'pgtap-sess-user-b'::uuid,
  (SELECT id FROM profiles WHERE email = 'b@test.local'),
  'device-b',
  now(),
  now(),
  now(),
  now()
);

SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('pgtap-sess-user-b'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['unauthorized'],
  'non-super-admin cannot revoke another user session'
);

-- ────────── 5. can revoke own session ──────────
SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('pgtap-sess-user-a'::uuid)::jsonb ->> 'ok')$c$,
  ARRAY['true'],
  'user can revoke own session'
);

-- Verify session was deleted
SELECT is(
  (SELECT COUNT(*) FROM admin_user_sessions WHERE id = 'pgtap-sess-user-a'::uuid),
  0::bigint,
  'session row deleted after revocation'
);

-- ────────── 6. super-admin can revoke any session ──────────
SELECT pgtap_test.become_super();

SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('pgtap-sess-user-b'::uuid)::jsonb ->> 'ok')$c$,
  ARRAY['true'],
  'super-admin can revoke any session'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
