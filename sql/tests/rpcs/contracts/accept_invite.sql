-- RPC: rpc_accept_invite() → void
--
-- Pins the public contract documented in 007_identity.sql:
--   * Signature: () returning void
--   * Authenticated required (anon has no EXECUTE grant)
--   * Promotes all 'invited' memberships for the caller to 'active'

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_accept_invite',
  ARRAY[]::text[],
  'rpc_accept_invite() exists'
);

SELECT function_returns(
  'public', 'rpc_accept_invite',
  ARRAY[]::text[],
  'void',
  'returns void'
);

-- ────────── 2. unauthenticated → permission denied ──────────
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_accept_invite()', 'execute'),
  'anon has no execute privilege on rpc_accept_invite'
);

-- ────────── 3. authenticated promotes own invites ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();

-- Create an invited membership for user_a in Org B (user_a is already active in Org A via seed)
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES (
  'f0000000-0000-0000-0000-000000001000'::uuid,
  'aaaa0000-0000-4000-8000-000000000001'::uuid,
  '22220000-0000-4000-8000-000000000002'::uuid,
  'org_admin',
  'invited',
  false
);

SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_accept_invite()$c$,
  'authenticated can call rpc_accept_invite'
);

-- Verify the membership is now active
SELECT ok(
  (SELECT status FROM memberships WHERE id = 'f0000000-0000-0000-0000-000000001000'::uuid) = 'active',
  'membership status changed from invited to active'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
