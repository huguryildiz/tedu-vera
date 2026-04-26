-- RPC: rpc_admin_create_org_and_membership(TEXT, TEXT) → json
--
-- Pins the public contract:
--   * Signature: (p_name TEXT, p_org_name TEXT) returning json
--   * Self-serve signup: creates org + active org_admin membership for caller
--   * Callable by anon and authenticated
--   * Error codes: 'not_authenticated', 'org_name_required', 'org_name_taken'
--   * Returns {ok, organization_id, idempotent}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_create_org_and_membership',
  ARRAY['text'::text, 'text'::text],
  'rpc_admin_create_org_and_membership(text, text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_create_org_and_membership',
  ARRAY['text'::text, 'text'::text],
  'json',
  'returns json'
);

-- ────────── 2. unauthenticated → not_authenticated ──────────
SELECT pgtap_test.become_anon();

SELECT results_eq(
  $c$SELECT (rpc_admin_create_org_and_membership('Test User', 'Test Org')::jsonb ->> 'error_code')$c$,
  ARRAY['not_authenticated'],
  'unauthenticated caller gets not_authenticated error code'
);

-- ────────── 3. authenticated can create org and membership ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_super();

SELECT ok(
  (SELECT (r ? 'ok') AND (r ? 'organization_id')
   FROM (SELECT rpc_admin_create_org_and_membership('Super Name'::text, 'super-new-org'::text)::jsonb AS r) t),
  'authenticated can create org and get organization_id in response'
);

-- ────────── 4. idempotent: second call returns existing org ──────────
SELECT ok(
  (SELECT (r ->> 'idempotent')::boolean = true
   FROM (SELECT rpc_admin_create_org_and_membership('Super Name'::text, 'super-new-org-2'::text)::jsonb AS r) t),
  'second call for same user returns idempotent=true'
);

-- ────────── 5. empty org_name → org_name_required ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT results_eq(
  $c$SELECT (rpc_admin_create_org_and_membership('Test User'::text, ''::text)::jsonb ->> 'error_code')$c$,
  ARRAY['org_name_required'],
  'empty org_name returns org_name_required error code'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
