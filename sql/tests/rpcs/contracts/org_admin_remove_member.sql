-- RPC: rpc_org_admin_remove_member(uuid) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_membership_id uuid) returning jsonb
--   * Unknown / NULL membership   → RAISE 'target_not_found'
--   * Caller not org owner / super → RAISE 'unauthorized' (in _assert_tenant_owner)
--   * Removing the owner row       → RAISE 'cannot_remove_owner'
--   * Success                      → { ok: true, membership_id }
--
-- Critical: state-changing org-ownership RPC. Owner-only.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- Seed two extra users + memberships to remove. Avoids reusing admin A's
-- own user id (which already has a (user, org) row in seed_two_orgs and
-- would conflict on the unique index). Using fresh ids also makes the
-- "removed → second remove → target_not_found" assertion (test 6) clean.
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('77770000-0000-4000-8000-00000000a005'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_member_5@test.local'),
  ('77770000-0000-4000-8000-00000000a006'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_member_6@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name) VALUES
  ('77770000-0000-4000-8000-00000000a005'::uuid, 'pgtap Member 5'),
  ('77770000-0000-4000-8000-00000000a006'::uuid, 'pgtap Member 6')
ON CONFLICT (id) DO NOTHING;

-- Active org_admin members under org A (not owners). The role check
-- constraint accepts only 'org_admin' / 'super_admin'; new members go in
-- as org_admin with is_owner=false to remain removable.
INSERT INTO memberships (id, organization_id, user_id, status, role, is_owner) VALUES
  ('aaaa0000-0000-4000-8000-0000000abcd5'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   '77770000-0000-4000-8000-00000000a005'::uuid,
   'active', 'org_admin', false),
  ('aaaa0000-0000-4000-8000-0000000abcd6'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   '77770000-0000-4000-8000-00000000a006'::uuid,
   'active', 'org_admin', false)
ON CONFLICT (id) DO NOTHING;

-- ────────── 1-2. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_org_admin_remove_member',
  ARRAY['uuid'],
  'rpc_org_admin_remove_member(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_org_admin_remove_member',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
);

SELECT pgtap_test.become_a();

-- ────────── 3. unknown membership → target_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'unknown membership id → target_not_found'
);

-- ────────── 4. NULL membership_id → target_not_found ──────────
-- WHERE id = NULL matches no row; v_org_id stays NULL → raises target_not_found.
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member(NULL::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'NULL membership id → target_not_found'
);

-- ────────── 5. success: owner removes a non-owner member → ok=true ──────────
SELECT is(
  (rpc_org_admin_remove_member('aaaa0000-0000-4000-8000-0000000abcd5'::uuid)::jsonb->>'ok'),
  'true',
  'owner removing non-owner member → ok=true'
);

-- ────────── 6. already-removed membership → target_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member('aaaa0000-0000-4000-8000-0000000abcd5'::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'already-removed membership → target_not_found'
);

-- ────────── 7. cannot remove owner → cannot_remove_owner ──────────
-- Admin A is the owner of org A (seeded with is_owner=true). The owner row
-- passes the _assert_tenant_owner gate but trips the explicit owner guard.
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member((
      SELECT id FROM memberships
      WHERE organization_id = '11110000-0000-4000-8000-000000000001'::uuid
        AND is_owner = true
      LIMIT 1
    )::uuid)$c$,
  NULL::text,
  'cannot_remove_owner'::text,
  'attempting to remove owner row → cannot_remove_owner'
);

-- ────────── 8. unauthorized caller (no JWT) → unauthorized ──────────
SELECT pgtap_test.become_reset();
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member('aaaa0000-0000-4000-8000-0000000abcd6'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → unauthorized (_assert_tenant_owner)'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
