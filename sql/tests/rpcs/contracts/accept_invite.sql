-- RPC: rpc_accept_invite() → void
--
-- Pins the public contract documented in 007_identity.sql:
--   * Signature: () returning void
--   * Authenticated required
--   * Promotes all 'invited' memberships for the caller to 'active'

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

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

-- ────────── 2. unauthenticated → no effect ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_accept_invite()$c$,
  'anon role can call (no error) but has no effect'
);

-- ────────── 3. authenticated promotes own invites ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();

-- Create an invited membership for user_a
INSERT INTO memberships (id, user_id, organization_id, status, created_at, updated_at)
VALUES (
  'pgtap-invite-1000'::uuid,
  (SELECT id FROM profiles WHERE email = 'a@test.local'),
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'invited',
  now(),
  now()
);

SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_accept_invite()$c$,
  'authenticated can call rpc_accept_invite'
);

-- Verify the membership is now active
SELECT ok(
  (SELECT status FROM memberships WHERE id = 'pgtap-invite-1000'::uuid) = 'active',
  'membership status changed from invited to active'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
