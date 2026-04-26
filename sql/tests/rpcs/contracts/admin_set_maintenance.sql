-- RPC: rpc_admin_set_maintenance(TEXT, TIMESTAMPTZ, INT, TEXT, UUID[], BOOLEAN) → json
--      rpc_admin_cancel_maintenance() → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_mode text, p_start_time timestamptz DEFAULT NULL,
--                  p_duration_min int DEFAULT NULL, p_message text DEFAULT NULL,
--                  p_affected_org_ids uuid[] DEFAULT NULL,
--                  p_notify_admins boolean DEFAULT true) returning json
--   * Non-super-admin          → RAISE 'super_admin required'
--   * Mode not in allowed set  → RAISE 'invalid mode: <mode>'
--   * Success (immediate)      → {ok: true, start_time, end_time}
--   * rpc_admin_cancel_maintenance() → {ok: true}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_set_maintenance',
  ARRAY['text', 'timestamptz', 'integer', 'text', 'uuid[]', 'boolean'],
  'rpc_admin_set_maintenance(text,timestamptz,int,text,uuid[],boolean) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_set_maintenance',
  ARRAY['text', 'timestamptz', 'integer', 'text', 'uuid[]', 'boolean'],
  'json',
  'rpc_admin_set_maintenance returns json'
);

SELECT has_function(
  'public', 'rpc_admin_cancel_maintenance',
  ARRAY[]::text[],
  'rpc_admin_cancel_maintenance() exists'
);

SELECT function_returns(
  'public', 'rpc_admin_cancel_maintenance',
  ARRAY[]::text[],
  'json',
  'rpc_admin_cancel_maintenance returns json'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_maintenance('immediate')$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin caller → raises super_admin required'
);

SELECT throws_ok(
  $c$SELECT rpc_admin_cancel_maintenance()$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin cancel_maintenance → raises super_admin required'
);

-- ────────── 3. invalid mode → error ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT throws_ok(
  $c$SELECT rpc_admin_set_maintenance('totally_invalid_mode')$c$,
  NULL::text,
  'invalid mode: totally_invalid_mode'::text,
  'unknown mode → raises invalid mode: <value>'
);

-- ────────── 4. valid mode (immediate) succeeds ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_set_maintenance('immediate')$c$,
  'super-admin immediate mode call succeeds'
);

SELECT ok(
  (SELECT rpc_admin_set_maintenance('immediate')::jsonb->>'ok' = 'true'
       AND rpc_admin_set_maintenance('immediate')::jsonb ? 'start_time'),
  'success response has ok=true and start_time'
);

-- ────────── 5. cancel succeeds ──────────
SELECT is(
  (SELECT rpc_admin_cancel_maintenance()::jsonb->>'ok'),
  'true',
  'cancel_maintenance returns ok=true'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
