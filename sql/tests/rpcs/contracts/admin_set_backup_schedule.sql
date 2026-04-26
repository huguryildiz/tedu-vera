-- RPC: rpc_admin_set_backup_schedule(TEXT) → json
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_cron_expression TEXT) returning json
--   * Super-admin required
--   * Raises 'super_admin required', 'Invalid cron expression'
--   * Returns {ok, updated_at}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_set_backup_schedule',
  ARRAY['text'::text],
  'rpc_admin_set_backup_schedule(text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_set_backup_schedule',
  ARRAY['text'::text],
  'json',
  'returns json'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_backup_schedule('0 2 * * *')$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin caller → raises super_admin required'
);

-- ────────── 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_backup_schedule('0 2 * * *')$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated caller → raises super_admin required'
);

-- ────────── 4. invalid cron expression ──────────
SELECT pgtap_test.become_super();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_backup_schedule('invalid-cron')$c$,
  NULL::text,
  'Invalid cron expression'::text,
  'invalid cron string raises Invalid cron expression'
);

-- ────────── 5. valid cron expression succeeds ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_set_backup_schedule('0 2 * * *')$c$,
  'valid 5-field cron expression succeeds'
);

SELECT ok(
  (SELECT (rpc_admin_set_backup_schedule('0 3 * * *')::jsonb ->> 'ok')::boolean),
  'response ok is boolean true'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
