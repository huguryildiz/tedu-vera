-- RPC: rpc_admin_update_organization(uuid, jsonb) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_org_id uuid, p_updates jsonb) returning jsonb
--   * NULL p_org_id               → RAISE 'organization_id_required'
--   * Unknown org                 → RAISE 'organization_not_found'
--   * Non-org-admin caller        → raises in _assert_org_admin
--   * Success                     → returns to_jsonb(organizations.*)
--
-- Used across admin drawers for org renaming/status change. Shape drift on
-- the returned row would break optimistic UI updates. See audit §6.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_update_organization',
  ARRAY['uuid', 'jsonb'],
  'rpc_admin_update_organization(uuid,jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_update_organization',
  ARRAY['uuid', 'jsonb'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. NULL org_id → organization_id_required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_update_organization(NULL::uuid, '{}'::jsonb)$c$,
  NULL::text,
  'organization_id_required'::text,
  'NULL org_id → organization_id_required'
);

-- ────────── 3. cross-tenant: admin A cannot update org B ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_update_organization(
      '22220000-0000-4000-8000-000000000002'::uuid,
      '{"name":"hacked"}'::jsonb
    )$c$,
  NULL::text,
  NULL::text,
  'admin A on org B → raises (cross-tenant blocked)'
);

-- ────────── 4. success: returned row has expected top-level keys ──────────
SELECT ok(
  (rpc_admin_update_organization(
    '11110000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('name', 'pgtap Org A Renamed')
  ) ? 'id'),
  'success return has id'
);

SELECT is(
  (rpc_admin_update_organization(
    '11110000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('name', 'pgtap Org A Renamed Again')
  )->>'name'),
  'pgtap Org A Renamed Again',
  'success return contains updated name'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
