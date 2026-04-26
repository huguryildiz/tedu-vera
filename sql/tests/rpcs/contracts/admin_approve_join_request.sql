-- RPC: rpc_admin_approve_join_request(UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_request_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Converts request to active membership
--   * Returns {ok, membership_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_approve_join_request',
  ARRAY['uuid'::text],
  'rpc_admin_approve_join_request(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_approve_join_request',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_approve_join_request('pgtap-req-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can approve join request ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();

-- Create a join request
INSERT INTO join_requests (id, email, organization_id, status, requested_at, created_at, updated_at)
VALUES (
  'pgtap-req-001'::uuid,
  'joiner@test.local',
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'pending',
  now(),
  now(),
  now()
);

SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_approve_join_request('pgtap-req-001'::uuid)$c$,
  'org_a admin can approve join request'
);

-- ────────__ 4. org-admin cannot approve other org request ──────────
INSERT INTO join_requests (id, email, organization_id, status, requested_at, created_at, updated_at)
VALUES (
  'pgtap-req-002'::uuid,
  'joiner2@test.local',
  (SELECT id FROM organizations WHERE name = 'org_b'),
  'pending',
  now(),
  now(),
  now()
);

SELECT throws_ok(
  $c$SELECT rpc_admin_approve_join_request('pgtap-req-002'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. super-admin can approve any request ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_approve_join_request('pgtap-req-002'::uuid)$c$,
  'super-admin can approve any join request'
);

-- ────────__ 6. response has ok and membership_id ──────────
INSERT INTO join_requests (id, email, organization_id, status, requested_at, created_at, updated_at)
VALUES (
  'pgtap-req-003'::uuid,
  'joiner3@test.local',
  (SELECT id FROM organizations WHERE name = 'org_a'),
  'pending',
  now(),
  now(),
  now()
);

SELECT ok(
  (SELECT (rpc_admin_approve_join_request('pgtap-req-003'::uuid)::jsonb ? 'ok')
       AND (rpc_admin_approve_join_request('pgtap-req-003'::uuid)::jsonb ? 'membership_id')),
  'response has ok and membership_id keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
