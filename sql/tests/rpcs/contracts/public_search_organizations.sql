-- RPC: rpc_public_search_organizations(TEXT) → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_query text) returning json
--   * No auth required (anon + authenticated)
--   * Query < 2 chars → returns '[]' (empty array)
--   * Query >= 2 chars → returns array of {id, name, member_count}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_public_search_organizations',
  ARRAY['text'],
  'rpc_public_search_organizations(text) exists'
);

SELECT function_returns(
  'public', 'rpc_public_search_organizations',
  ARRAY['text'],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_public_search_organizations('pgtap')$c$,
  'anon role can call rpc_public_search_organizations'
);

-- ────────── 3. query < 2 chars → empty array ──────────
SELECT is(
  (SELECT rpc_public_search_organizations('x')::jsonb),
  '[]'::jsonb,
  'single char query → returns empty array []'
);

SELECT is(
  (SELECT rpc_public_search_organizations('')::jsonb),
  '[]'::jsonb,
  'empty string query → returns empty array []'
);

-- ────────── 4. valid query matches seeded orgs ──────────
SELECT ok(
  (SELECT jsonb_array_length(rpc_public_search_organizations('pgtap')::jsonb) > 0),
  'query "pgtap" matches seeded orgs (length > 0)'
);

-- ────────── 5. result array items have expected shape ──────────
SELECT ok(
  (SELECT (rpc_public_search_organizations('pgtap')::jsonb -> 0) ? 'id'
       AND (rpc_public_search_organizations('pgtap')::jsonb -> 0) ? 'name'),
  'result items have id and name fields'
);

-- ────────── 6. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_public_search_organizations('pgtap')$c$,
  'authenticated role can call rpc_public_search_organizations'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
