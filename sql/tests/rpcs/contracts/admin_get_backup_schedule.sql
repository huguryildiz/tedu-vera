-- RPC: rpc_admin_get_backup_schedule() → json
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: () returning json
--   * Super-admin required
--   * Raises 'super_admin required' for non-super-admin
--   * Returns {schedule_cron, last_run_at, next_run_at, is_active}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_get_backup_schedule',
  ARRAY[]::text[],
  'rpc_admin_get_backup_schedule() exists'
);

SELECT function_returns(
  'public', 'rpc_admin_get_backup_schedule',
  ARRAY[]::text[],
  'json',
  'returns json'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_backup_schedule()$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin caller → raises super_admin required'
);

-- ────────── 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_get_backup_schedule()$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated caller → raises super_admin required'
);

-- ────────── 4. super-admin succeeds, shape verified ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_get_backup_schedule()$c$,
  'super-admin can call rpc_admin_get_backup_schedule'
);

SELECT ok(
  (SELECT (rpc_admin_get_backup_schedule()::jsonb ? 'schedule_cron')
       AND (rpc_admin_get_backup_schedule()::jsonb ? 'is_active')
       AND (rpc_admin_get_backup_schedule()::jsonb ? 'next_run_at')),
  'response has schedule_cron, is_active, next_run_at keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
