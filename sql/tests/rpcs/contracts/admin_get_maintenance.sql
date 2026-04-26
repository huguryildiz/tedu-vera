-- RPC: rpc_admin_get_maintenance() → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: () returning json
--   * Non-super-admin caller → RAISE 'super_admin required'
--   * Super-admin success   → {is_active, mode, start_time, end_time,
--                               message, affected_org_ids, notify_admins,
--                               updated_at}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_get_maintenance',
  ARRAY[]::text[],
  'rpc_admin_get_maintenance() exists'
);

SELECT function_returns(
  'public', 'rpc_admin_get_maintenance',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_maintenance()$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin caller → raises super_admin required'
);

-- ────────── 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_maintenance()$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated caller → raises super_admin required'
);

-- ────────── 4. super-admin succeeds, shape verified ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_get_maintenance()$c$,
  'super-admin can call rpc_admin_get_maintenance'
);

SELECT ok(
  (SELECT (rpc_admin_get_maintenance()::jsonb ? 'is_active')
       AND (rpc_admin_get_maintenance()::jsonb ? 'mode')
       AND (rpc_admin_get_maintenance()::jsonb ? 'notify_admins')
       AND (rpc_admin_get_maintenance()::jsonb ? 'updated_at')),
  'response has is_active, mode, notify_admins, updated_at keys'
);

SELECT ok(
  (SELECT (rpc_admin_get_maintenance()::jsonb ? 'start_time')
       AND (rpc_admin_get_maintenance()::jsonb ? 'end_time')
       AND (rpc_admin_get_maintenance()::jsonb ? 'message')
       AND (rpc_admin_get_maintenance()::jsonb ? 'affected_org_ids')),
  'response has start_time, end_time, message, affected_org_ids keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
