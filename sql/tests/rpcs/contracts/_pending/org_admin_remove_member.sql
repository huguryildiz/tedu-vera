-- RPC: rpc_org_admin_remove_member(uuid) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_membership_id uuid) returning jsonb
--   * Unknown membership         → RAISE 'target_not_found'
--   * Unauthorized caller (not owner) → RAISE via _assert_tenant_owner
--   * Cannot remove owner        → RAISE 'cannot_remove_owner'
--   * Success                    → { ok: true, membership_id: ... }
--
-- Critical: state-changing RPC that removes organization members (requires org ownership).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_org_admin_remove_member', ARRAY['uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_org_admin_remove_member', ARRAY['uuid'], 'jsonb', 'returns jsonb');

-- 3. unknown membership → target_not_found (raises exception)
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'unknown membership → target_not_found'
);

-- 4. NULL membership_id → target_not_found (raises exception)
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member(NULL::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'NULL membership_id → target_not_found'
);

-- 5. success: returns ok: true
-- Create a member to remove (not the org owner)
INSERT INTO memberships (id, organization_id, user_id, status, role, is_owner)
VALUES ('kkkk0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'aaaa0000-0000-4000-8000-000000000002'::uuid, 'active', 'member', false)
ON CONFLICT DO NOTHING;

SELECT ok((rpc_org_admin_remove_member('kkkk0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean, 'valid membership → ok: true');

-- 6. removed member → cannot be removed again (raises target_not_found)
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member('kkkk0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'already-removed membership → target_not_found'
);

-- 7. cannot remove owner → raises cannot_remove_owner
-- Admin A is the owner of org A; try to remove their own membership
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member((SELECT id FROM memberships WHERE organization_id = '11110000-0000-4000-8000-000000000001'::uuid AND is_owner = true LIMIT 1)::uuid)$c$,
  NULL::text,
  'cannot_remove_owner'::text,
  'attempting to remove owner → cannot_remove_owner'
);

-- 8. non-owner caller → raises unauthorized (no JWT set)
-- Create another member, then try to remove without authentication
INSERT INTO memberships (id, organization_id, user_id, status, role, is_owner)
VALUES ('llll0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'bbbb0000-0000-4000-8000-000000000002'::uuid, 'active', 'member', false)
ON CONFLICT DO NOTHING;

SELECT pgtap_test.become_reset();
SELECT throws_ok(
  $c$SELECT rpc_org_admin_remove_member('llll0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → unauthorized'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
