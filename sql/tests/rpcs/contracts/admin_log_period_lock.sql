-- RPC: rpc_admin_log_period_lock(uuid, text, jsonb) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_action text, p_ctx jsonb) returning jsonb
--   * Unauthenticated caller        → { ok: false, error_code: 'unauthenticated' }
--   * Unknown period                → { ok: false, error_code: 'period_not_found' }
--   * Invalid action string         → { ok: false, error_code: 'invalid_action' }
--   * Caller not org admin          → RAISE 'unauthorized'
--   * Success                       → { ok: true, periodName: <name> }
--
-- See docs/qa/vera-test-audit-report.md P0-B4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_log_period_lock',
  ARRAY['uuid', 'text', 'jsonb'],
  'rpc_admin_log_period_lock(uuid,text,jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_log_period_lock',
  ARRAY['uuid', 'text', 'jsonb'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → error envelope ──────────
SELECT pgtap_test.become_reset();

SELECT is(
  (SELECT rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'period.lock',
     '{}'::jsonb
   )->>'error_code'),
  'unauthenticated',
  'unauthenticated caller → error_code=unauthenticated'
);

SELECT is(
  (SELECT rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'period.lock',
     '{}'::jsonb
   )->>'ok'),
  'false',
  'unauthenticated caller → ok=false'
);

-- ────────── 3. unknown period → period_not_found ──────────
SELECT pgtap_test.become_a();

SELECT is(
  (SELECT rpc_admin_log_period_lock(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     'period.lock',
     '{}'::jsonb
   )->>'error_code'),
  'period_not_found',
  'unknown period → error_code=period_not_found'
);

-- ────────── 4. invalid action string → invalid_action ──────────
SELECT is(
  (SELECT rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'period.publish',
     '{}'::jsonb
   )->>'error_code'),
  'invalid_action',
  'invalid action string → error_code=invalid_action'
);

-- ────────── 5. cross-tenant caller → raises unauthorized ──────────
-- Admin A on org B's period.
SELECT throws_ok(
  $c$SELECT rpc_admin_log_period_lock(
       'dddd0000-0000-4000-8000-000000000002'::uuid,
       'period.lock',
       '{}'::jsonb
     )$c$,
  NULL::text,
  'unauthorized',
  'admin A on org B period → raises unauthorized'
);

-- ────────── 6. success → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'period.lock',
     '{"ip":"127.0.0.1"}'::jsonb
   )->>'ok'),
  'true',
  'valid call → ok=true'
);

-- ────────── 7. success → returns periodName ──────────
SELECT ok(
  (SELECT (rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'period.unlock',
     '{}'::jsonb
   ) ? 'periodName')),
  'success response contains periodName'
);

-- ────────── 8. period.unlock also accepted ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_log_period_lock(
       'cccc0000-0000-4000-8000-000000000001'::uuid,
       'period.unlock',
       '{"session_id": "00000000-0000-4000-8000-000000000099"}'::jsonb
     )$c$,
  'period.unlock action does not raise'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
