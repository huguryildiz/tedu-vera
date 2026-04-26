-- RPC: rpc_request_to_join_org(UUID) → json
--
-- Pins the public contract:
--   * Signature: (p_org_id UUID) returning json
--   * Authenticated required (anon has no EXECUTE grant)
--   * Creates a 'requested' membership for the caller
--   * Error codes: 'org_not_found', 'already_member', 'already_requested'
--   * Returns {ok, membership_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_request_to_join_org',
  ARRAY['uuid'::text],
  'rpc_request_to_join_org(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_request_to_join_org',
  ARRAY['uuid'::text],
  'json',
  'returns json'
);

-- ────────── 2. unauthenticated → permission denied ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_request_to_join_org('00000000-0000-0000-0000-000000009999'::uuid)$c$,
  NULL::text,
  'anon cannot call rpc_request_to_join_org'
);

-- ────────── 3. authenticated can request join ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

INSERT INTO organizations (id, code, name, created_at, updated_at)
VALUES (
  '33300000-0000-0000-0000-000000000003'::uuid,
  'ORG3',
  'org_c',
  now(),
  now()
);

SELECT lives_ok(
  $c$SELECT rpc_request_to_join_org('33300000-0000-0000-0000-000000000003'::uuid)$c$,
  'authenticated user can request to join org'
);

-- ────────── 4. cannot request if already member ──────────
SELECT results_eq(
  $c$SELECT (rpc_request_to_join_org((SELECT id FROM organizations WHERE name = 'pgtap Org A'))::jsonb ->> 'error_code')$c$,
  ARRAY['already_member'],
  'already member returns already_member error code'
);

-- ────────── 5. nonexistent org returns org_not_found ──────────
SELECT results_eq(
  $c$SELECT (rpc_request_to_join_org('00000000-0000-0000-0000-000000009996'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['org_not_found'],
  'nonexistent org returns org_not_found'
);

-- ────────── 6. response has ok and membership_id ──────────
INSERT INTO organizations (id, code, name, created_at, updated_at)
VALUES (
  '33300000-0000-0000-0000-000000000004'::uuid,
  'ORG4',
  'org_d',
  now(),
  now()
);

SELECT ok(
  (SELECT (r ? 'ok') AND (r ? 'membership_id')
   FROM (SELECT rpc_request_to_join_org('33300000-0000-0000-0000-000000000004'::uuid)::jsonb AS r) t),
  'response has ok and membership_id keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
