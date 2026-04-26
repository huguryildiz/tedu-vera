-- RPC: rpc_org_admin_transfer_ownership(UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_new_owner_id UUID) returning jsonb
--   * Authenticated org-admin required
--   * Transfers org ownership to new admin
--   * Returns {ok, org_id, new_owner_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_org_admin_transfer_ownership',
  ARRAY['uuid'::text],
  'rpc_org_admin_transfer_ownership(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_org_admin_transfer_ownership',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('pgtap-user-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin can transfer ownership ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

-- Get org_a and org_b admin IDs
SELECT lives_ok(
  $c$SELECT rpc_org_admin_transfer_ownership((SELECT id FROM profiles WHERE email = 'b@test.local'))$c$,
  'org_a admin can transfer ownership to another user'
);

-- ────────── 4. cannot transfer to same user ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership((SELECT id FROM profiles WHERE email = 'a@test.local'))$c$,
  NULL::text,
  'cannot transfer'
);

-- ────────__ 5. super-admin can also transfer ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_org_admin_transfer_ownership((SELECT id FROM profiles WHERE email = 'a@test.local'))$c$,
  'super-admin can transfer org ownership'
);

-- ────────__ 6. response has ok, org_id, new_owner_id ──────────
SELECT ok(
  (SELECT (rpc_org_admin_transfer_ownership((SELECT id FROM profiles WHERE email = 'b@test.local'))::jsonb ? 'ok')
       AND (rpc_org_admin_transfer_ownership((SELECT id FROM profiles WHERE email = 'b@test.local'))::jsonb ? 'org_id')
       AND (rpc_org_admin_transfer_ownership((SELECT id FROM profiles WHERE email = 'b@test.local'))::jsonb ? 'new_owner_id')),
  'response has ok, org_id, new_owner_id keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
