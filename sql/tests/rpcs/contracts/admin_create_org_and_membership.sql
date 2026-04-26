-- RPC: rpc_admin_create_org_and_membership(TEXT, TEXT, UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_org_name TEXT, p_admin_email TEXT, p_admin_id UUID) returning jsonb
--   * Super-admin required
--   * Returns {org_id, org_name, membership_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_create_org_and_membership',
  ARRAY['text'::text, 'text'::text, 'uuid'::text],
  'rpc_admin_create_org_and_membership(text, text, uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_create_org_and_membership',
  ARRAY['text'::text, 'text'::text, 'uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_create_org_and_membership('new-org', 'admin@new.local', 'pgtap-user-9999'::uuid)$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin cannot create new org'
);

-- ────────── 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_create_org_and_membership('new-org', 'admin@new.local', 'pgtap-user-9999'::uuid)$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated cannot create org'
);

-- ────────__ 4. super-admin can create org and membership ──────────
SELECT pgtap_test.become_super();

SELECT ok(
  (SELECT (rpc_admin_create_org_and_membership('new-org-test', 'newadmin@test.local', 'pgtap-new-user'::uuid)::jsonb ? 'org_id')
       AND (rpc_admin_create_org_and_membership('new-org-test', 'newadmin@test.local', 'pgtap-new-user'::uuid)::jsonb ? 'membership_id')),
  'super-admin can create org and membership, returns org_id and membership_id'
);

-- ────────__ 5. response has org_name ──────────
SELECT ok(
  (SELECT rpc_admin_create_org_and_membership('newer-org', 'admin2@test.local', 'pgtap-user-2222'::uuid)::jsonb ? 'org_name'),
  'response has org_name key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
