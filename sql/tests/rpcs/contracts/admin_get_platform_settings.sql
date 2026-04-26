-- RPC: rpc_admin_get_platform_settings() → json
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: () returning json
--   * Non-super-admin caller → RAISE 'super_admin required'
--   * Super-admin success   → {platform_name, support_email,
--                               auto_approve_new_orgs, backup_cron_expr,
--                               updated_at, updated_by}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_get_platform_settings',
  ARRAY[]::text[],
  'rpc_admin_get_platform_settings() exists'
);

SELECT function_returns(
  'public', 'rpc_admin_get_platform_settings',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_platform_settings()$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin caller → raises super_admin required'
);

-- ────────── 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_platform_settings()$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated caller → raises super_admin required'
);

-- ────────── 4. super-admin succeeds, shape verified ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_get_platform_settings()$c$,
  'super-admin can call rpc_admin_get_platform_settings'
);

SELECT ok(
  (SELECT (rpc_admin_get_platform_settings()::jsonb ? 'platform_name')
       AND (rpc_admin_get_platform_settings()::jsonb ? 'support_email')
       AND (rpc_admin_get_platform_settings()::jsonb ? 'auto_approve_new_orgs')),
  'response has platform_name, support_email, auto_approve_new_orgs keys'
);

SELECT ok(
  (SELECT (rpc_admin_get_platform_settings()::jsonb ? 'backup_cron_expr')
       AND (rpc_admin_get_platform_settings()::jsonb ? 'updated_at')),
  'response has backup_cron_expr and updated_at keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
