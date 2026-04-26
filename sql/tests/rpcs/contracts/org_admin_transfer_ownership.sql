-- RPC: rpc_org_admin_transfer_ownership(UUID) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_target_membership_id UUID) returning jsonb
--   * Caller must be owner of the org (or super-admin)
--   * Target must be an active org_admin in the same org who is not already the owner
--   * Returns {ok, new_owner_user_id}

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

-- ────────── 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('00000000-0000-0000-0000-000000009999'::uuid)$c$,
  NULL::text,
  'anon cannot call rpc_org_admin_transfer_ownership'
);

-- ────────── seed data before switching roles ──────────
-- Use existing seeded users: bbbb and eeee have profiles from seed_two_orgs.
-- bbbb seeded as Org B admin; eeee is super_admin with no org membership.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();

-- bbbb as active org_admin in Org A (not owner)
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES (
  'f0000000-0000-0000-0000-000000002001'::uuid,
  'bbbb0000-0000-4000-8000-000000000002'::uuid,
  '11110000-0000-4000-8000-000000000001'::uuid,
  'org_admin', 'active', false
);

-- eeee as active org_admin in Org A (not owner)
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES (
  'f0000000-0000-0000-0000-000000002002'::uuid,
  'eeee0000-0000-4000-8000-00000000000e'::uuid,
  '11110000-0000-4000-8000-000000000001'::uuid,
  'org_admin', 'active', false
);

-- ────────── 3. org-admin (owner) can transfer ownership ──────────
-- aaaa is the seeded owner of Org A; transfer to bbbb (f000...2001)
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('f0000000-0000-0000-0000-000000002001'::uuid)$c$,
  'org_a owner can transfer ownership to another active org_admin'
);

-- ────────── 4. non-owner cannot transfer ──────────
-- user_a is no longer owner after step 3; try to transfer to eeee → fails
SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('f0000000-0000-0000-0000-000000002002'::uuid)$c$,
  NULL::text,
  'non-owner cannot transfer org ownership'
);

-- ────────── 5. nonexistent membership → target_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('00000000-0000-0000-0000-000000009997'::uuid)$c$,
  NULL::text,
  'nonexistent membership throws target_not_found'
);

-- ────────── 6. super-admin can transfer ownership ──────────
-- Current owner is bbbb (after step 3). Super transfers to aaaa's seeded membership.
-- aaaa is still an active org_admin in Org A (is_owner=false after step 3).
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_org_admin_transfer_ownership(
    (SELECT id FROM memberships
     WHERE user_id = 'aaaa0000-0000-4000-8000-000000000001'::uuid
       AND organization_id = '11110000-0000-4000-8000-000000000001'::uuid
     LIMIT 1)
  )$c$,
  'super-admin can transfer org ownership'
);

-- ────────── 7. response has ok and new_owner_user_id ──────────
-- After step 6, aaaa is owner again. Super (eeee) transfers to bbbb (f000...2001, is_owner=false).
SELECT ok(
  (SELECT (r ? 'ok') AND (r ? 'new_owner_user_id')
   FROM (SELECT rpc_org_admin_transfer_ownership('f0000000-0000-0000-0000-000000002001'::uuid)::jsonb AS r) t),
  'response has ok and new_owner_user_id keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
