-- RPC: rpc_admin_approve_join_request(UUID) → json
--
-- Pins the public contract:
--   * Signature: (p_membership_id UUID) returning json
--   * Authenticated required; caller must be org_admin of the membership's org
--   * Promotes a 'requested' membership to 'active'
--   * Error codes: 'request_not_found'
--   * Returns {ok}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_approve_join_request',
  ARRAY['uuid'::text],
  'rpc_admin_approve_join_request(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_approve_join_request',
  ARRAY['uuid'::text],
  'json',
  'returns json'
);

-- ────────── seed data before switching roles (profiles FK blocks inserts for unknown users) ──────────
-- Use existing seeded users: bbbb in Org A, eeee in Org B, eeee in Org A (for response shape)
SELECT pgtap_test.seed_two_orgs();

-- bbbb requesting to join Org A (bbbb is seeded in Org B, not Org A)
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES (
  'f0000000-0000-0000-0000-000000001001'::uuid,
  'bbbb0000-0000-4000-8000-000000000002'::uuid,
  '11110000-0000-4000-8000-000000000001'::uuid,
  'org_admin', 'requested', false
);

-- eeee (super) requesting to join Org B (for cross-org test)
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES (
  'f0000000-0000-0000-0000-000000001002'::uuid,
  'eeee0000-0000-4000-8000-00000000000e'::uuid,
  '22220000-0000-4000-8000-000000000002'::uuid,
  'org_admin', 'requested', false
);

-- eeee (super) requesting to join Org A (for response shape test)
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES (
  'f0000000-0000-0000-0000-000000001003'::uuid,
  'eeee0000-0000-4000-8000-00000000000e'::uuid,
  '11110000-0000-4000-8000-000000000001'::uuid,
  'org_admin', 'requested', false
);

SELECT pgtap_test.become_a();

-- ────────── 2. nonexistent membership → request_not_found ──────────
SELECT results_eq(
  $c$SELECT (rpc_admin_approve_join_request('00000000-0000-0000-0000-000000009998'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['request_not_found'],
  'nonexistent membership returns request_not_found'
);

-- ────────── 3. org-admin can approve own org requested membership ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_approve_join_request('f0000000-0000-0000-0000-000000001001'::uuid)$c$,
  'org_a admin can approve a requested membership in own org'
);

-- ────────── 4. org-admin cannot approve other org requested membership ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_approve_join_request('f0000000-0000-0000-0000-000000001002'::uuid)$c$,
  NULL::text,
  'org_a admin cannot approve Org B requested membership'
);

-- ────────── 5. super-admin can approve any ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_approve_join_request('f0000000-0000-0000-0000-000000001002'::uuid)$c$,
  'super-admin can approve any requested membership'
);

-- ────────── 6. response has ok key on success ──────────
SELECT pgtap_test.become_a();

SELECT ok(
  (SELECT (r ? 'ok')
   FROM (SELECT rpc_admin_approve_join_request('f0000000-0000-0000-0000-000000001003'::uuid)::jsonb AS r) t),
  'successful response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
