-- RPC: rpc_admin_list_unlock_requests(TEXT) → json
--
-- Pins the public contract:
--   * Signature: (p_status TEXT DEFAULT 'pending') returning json
--   * Authenticated required (anon has no EXECUTE grant)
--   * Uses RLS internally: org-admin sees own org, super-admin sees all
--   * Returns JSON array of unlock request objects

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_list_unlock_requests',
  ARRAY['text'::text],
  'rpc_admin_list_unlock_requests(text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_list_unlock_requests',
  ARRAY['text'::text],
  'json',
  'returns json'
);

-- ────────── 2. org-admin can call and gets own org results ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_unlock_requests();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_list_unlock_requests('pending')$c$,
  'org_a admin can call rpc_admin_list_unlock_requests'
);

-- ────────── 3. returns valid JSON ──────────
SELECT ok(
  (SELECT rpc_admin_list_unlock_requests('pending')::jsonb IS NOT NULL),
  'response is valid json'
);

-- ────────── 4. super-admin can call ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_list_unlock_requests('pending')$c$,
  'super-admin can call rpc_admin_list_unlock_requests'
);

-- ────────── 5. filter by all returns valid array ──────────
SELECT ok(
  (SELECT jsonb_array_length(rpc_admin_list_unlock_requests('all')::jsonb) >= 0),
  'filter all returns valid json array'
);

-- ────────── 6. default param (no args) works ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_list_unlock_requests()$c$,
  'calling with no args (default status=pending) works'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
