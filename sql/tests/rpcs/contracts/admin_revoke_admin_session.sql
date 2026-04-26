-- RPC: rpc_admin_revoke_admin_session(UUID) → json
--
-- Pins the public contract documented in 007_identity.sql:
--   * Signature: (p_session_id UUID) returning json
--   * Authenticated required
--   * Returns {ok, error_code, id} with audit logging
--   * Error codes: 'unauthenticated', 'session_not_found', 'unauthorized'

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

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

-- ────────── 2. unauthenticated → cannot call ──────────
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_revoke_admin_session(uuid)', 'execute'),
  'anon has no execute privilege on rpc_admin_revoke_admin_session'
);

-- ────────── seed data at postgres level (authenticated has no INSERT on admin_user_sessions) ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();

INSERT INTO admin_user_sessions (id, user_id, device_id, created_at, updated_at, first_seen_at, last_activity_at)
VALUES (
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'aaaa0000-0000-4000-8000-000000000001'::uuid,
  'device-a',
  now(), now(), now(), now()
);

INSERT INTO admin_user_sessions (id, user_id, device_id, created_at, updated_at, first_seen_at, last_activity_at)
VALUES (
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'bbbb0000-0000-4000-8000-000000000002'::uuid,
  'device-b',
  now(), now(), now(), now()
);

SELECT pgtap_test.become_a();

-- ────────── 3. session not found ──────────
SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('00000000-0000-0000-0000-000000009997'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['session_not_found'],
  'nonexistent session returns session_not_found'
);

-- ────────── 4. cannot revoke other user's session (non-super-admin) ──────────
SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('e0000000-0000-0000-0000-000000000002'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['unauthorized'],
  'non-super-admin cannot revoke another user session'
);

-- ────────── 5. can revoke own session ──────────
SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('e0000000-0000-0000-0000-000000000001'::uuid)::jsonb ->> 'ok')$c$,
  ARRAY['true'],
  'user can revoke own session'
);

-- Verify session was deleted
SELECT is(
  (SELECT COUNT(*) FROM admin_user_sessions WHERE id = 'e0000000-0000-0000-0000-000000000001'::uuid),
  0::bigint,
  'session row deleted after revocation'
);

-- ────────── 6. super-admin can revoke any session ──────────
SELECT pgtap_test.become_super();

SELECT results_eq(
  $c$SELECT (rpc_admin_revoke_admin_session('e0000000-0000-0000-0000-000000000002'::uuid)::jsonb ->> 'ok')$c$,
  ARRAY['true'],
  'super-admin can revoke any session'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
