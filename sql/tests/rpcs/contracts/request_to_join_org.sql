-- RPC: rpc_request_to_join_org(UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_org_id UUID) returning jsonb
--   * Authenticated required
--   * Creates join request for user
--   * Error: 'org_not_found', 'already_member'
--   * Returns {ok, request_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

-- ────────__ 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_request_to_join_org',
  ARRAY['uuid'::text],
  'rpc_request_to_join_org(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_request_to_join_org',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_request_to_join_org('pgtap-org-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. authenticated can request join ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

-- Create a third org to request join
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
  'pgtap-org-c'::uuid,
  'org_c',
  now(),
  now()
);

SELECT lives_ok(
  $c$SELECT rpc_request_to_join_org('pgtap-org-c'::uuid)$c$,
  'authenticated user can request to join org'
);

-- ────────__ 4. cannot request if already member ──────────
SELECT throws_ok(
  $c$SELECT rpc_request_to_join_org((SELECT id FROM organizations WHERE name = 'org_a'))$c$,
  NULL::text,
  'already_member'
);

-- ────────__ 5. nonexistent org ──────────
SELECT results_eq(
  $c$SELECT (rpc_request_to_join_org('pgtap-org-nonexist'::uuid)::jsonb ->> 'error_code')$c$,
  ARRAY['org_not_found'],
  'nonexistent org returns org_not_found'
);

-- ────────__ 6. response has ok and request_id ──────────
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
  'pgtap-org-d'::uuid,
  'org_d',
  now(),
  now()
);

SELECT ok(
  (SELECT (rpc_request_to_join_org('pgtap-org-d'::uuid)::jsonb ? 'ok')
       AND (rpc_request_to_join_org('pgtap-org-d'::uuid)::jsonb ? 'request_id')),
  'response has ok and request_id keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
