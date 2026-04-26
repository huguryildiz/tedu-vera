-- RPC: rpc_admin_update_organization(uuid, jsonb) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_org_id uuid, p_updates jsonb) returning jsonb
--   * NULL p_org_id               → RAISE 'organization_id_required'
--   * Non-org-admin caller        → raises in _assert_org_admin
--   * Success                     → returns to_jsonb(organizations.*) with
--                                   id + name top-level keys
--
-- Used across admin drawers for org renaming/status change. Shape drift on
-- the returned row would break optimistic UI updates.
--
-- Lives in migration 009 alongside the audit system. CI caps at 007, so
-- the test detects the missing function via information_schema and emits
-- 5 SKIPped tests instead of failing.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'rpc_admin_update_organization'
) AS rpc_exists;

SELECT skip('migration 009 not applied — rpc_admin_update_organization missing', 6)
FROM _ctx WHERE NOT rpc_exists;

SELECT pgtap_test.seed_two_orgs() FROM _ctx WHERE rpc_exists;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_update_organization',
  ARRAY['uuid', 'jsonb'],
  'rpc_admin_update_organization(uuid,jsonb) exists'
) FROM _ctx WHERE rpc_exists;

SELECT function_returns(
  'public', 'rpc_admin_update_organization',
  ARRAY['uuid', 'jsonb'],
  'jsonb',
  'returns jsonb'
) FROM _ctx WHERE rpc_exists;

-- ────────── 2. NULL org_id → organization_id_required ──────────
SELECT pgtap_test.become_a() FROM _ctx WHERE rpc_exists;

SELECT throws_ok(
  $c$SELECT rpc_admin_update_organization(NULL::uuid, '{}'::jsonb)$c$,
  NULL::text,
  'organization_id_required'::text,
  'NULL org_id → organization_id_required'
) FROM _ctx WHERE rpc_exists;

-- ────────── 3. cross-tenant: admin A cannot update org B ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_update_organization(
      '22220000-0000-4000-8000-000000000002'::uuid,
      '{"name":"hacked"}'::jsonb
    )$c$,
  NULL::text,
  NULL::text,
  'admin A on org B → raises (cross-tenant blocked)'
) FROM _ctx WHERE rpc_exists;

-- ────────── 4. success: returned row has id and updated name ──────────
SELECT is(
  (rpc_admin_update_organization(
    '11110000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('name', 'pgtap Org A Renamed')
  )->>'name'),
  'pgtap Org A Renamed',
  'success return contains updated name'
) FROM _ctx WHERE rpc_exists;

SELECT ok(
  (rpc_admin_update_organization(
    '11110000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('name', 'pgtap Org A Renamed Again')
  ) ? 'id'),
  'success return has id'
) FROM _ctx WHERE rpc_exists;

SELECT pgtap_test.become_reset() FROM _ctx WHERE rpc_exists;
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
