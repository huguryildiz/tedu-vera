-- RPC: rpc_admin_list_unlock_requests(UUID) → table
--
-- Pins the public contract:
--   * Signature: (p_org_id UUID) returning TABLE(...)
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Returns pending unlock requests for org

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────__ 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_list_unlock_requests',
  ARRAY['uuid'::text],
  'rpc_admin_list_unlock_requests(uuid) exists'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_list_unlock_requests('pgtap-org-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can list own org requests ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_unlock_requests();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_list_unlock_requests((SELECT id FROM organizations WHERE name = 'org_a'))$c$,
  'org_a admin can list unlock requests'
);

-- ────────__ 4. org-admin cannot list other org requests ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_list_unlock_requests((SELECT id FROM organizations WHERE name = 'org_b'))$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 5. super-admin can list any org requests ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_list_unlock_requests((SELECT id FROM organizations WHERE name = 'org_b'))$c$,
  'super-admin can list any org unlock requests'
);

-- ────────__ 6. returns result set (no error) ──────────
SELECT lives_ok(
  $c$SELECT * FROM rpc_admin_list_unlock_requests((SELECT id FROM organizations WHERE name = 'org_a'))$c$,
  'result set can be expanded'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
