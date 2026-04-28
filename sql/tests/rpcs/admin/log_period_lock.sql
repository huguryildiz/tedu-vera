-- RPC: rpc_admin_log_period_lock(p_period_id uuid, p_action text, p_ctx jsonb) → jsonb
--
-- Contract (006b_rpcs_admin.sql):
--   * auth.uid() IS NULL                  → { ok: false, error_code: 'unauthenticated' }
--   * Unknown period                      → { ok: false, error_code: 'period_not_found' }
--   * p_action not in period.lock|unlock  → { ok: false, error_code: 'invalid_action' }
--   * Non-org-admin caller                → raises in _assert_org_admin
--   * Happy path                          → { ok: true, periodName } + audit_logs row written

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

SELECT pgtap_test.become_a();

-- ────────── 1. unknown period → period_not_found ──────────
SELECT is(
  (SELECT rpc_admin_log_period_lock(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     'period.lock',
     '{}'::jsonb
   )->>'error_code'),
  'period_not_found'::text,
  'unknown period returns period_not_found'::text
);

-- ────────── 2. invalid action string → invalid_action ──────────
SELECT is(
  (SELECT rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000011'::uuid,
     'not.a.valid.action',
     '{}'::jsonb
   )->>'error_code'),
  'invalid_action'::text,
  'action not in (period.lock, period.unlock) returns invalid_action'::text
);

-- ────────── 3. cross-tenant: org A admin cannot log for org B period ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_log_period_lock(
     'dddd0000-0000-4000-8000-000000000022'::uuid,
     'period.lock',
     '{}'::jsonb
   )$c$,
  NULL::text,
  NULL::text,
  'org A admin cannot log lock for an org B period'::text
);

-- ────────── 4. happy path: period.lock → ok=true ──────────
SELECT is(
  (SELECT rpc_admin_log_period_lock(
     'cccc0000-0000-4000-8000-000000000011'::uuid,
     'period.lock',
     '{}'::jsonb
   )->>'ok'),
  'true'::text,
  'valid call with period.lock returns ok=true'::text
);

-- ────────── 5. audit row written for period.lock ──────────
SELECT ok(
  EXISTS(
    SELECT 1 FROM audit_logs
    WHERE action = 'period.lock'
      AND resource_id = 'cccc0000-0000-4000-8000-000000000011'::uuid
  ),
  'rpc_admin_log_period_lock writes period.lock to audit_logs'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
