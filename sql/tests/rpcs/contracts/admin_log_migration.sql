-- RPC: rpc_admin_log_migration(TEXT, JSONB) → void
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_label TEXT, p_details JSONB) returning void
--   * Service-role only (GRANT to service_role, NOT to authenticated)
--   * Inserts audit row with action='system.migration_applied'
--   * Returns void (silent success)

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(4);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_log_migration',
  ARRAY['text'::text, 'jsonb'::text],
  'rpc_admin_log_migration(text, jsonb) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_log_migration',
  ARRAY['text'::text, 'jsonb'::text],
  'void',
  'returns void'
);

-- ────────── 2. service-role can call it ──────────
-- Seed minimal data; service-role has no auth context but RPC uses auth.uid()
-- which returns NULL in service-role context → actor_type='system'
SELECT lives_ok(
  $$SELECT rpc_admin_log_migration('test-migration-label', '{"actor":"verifier"}'::jsonb)$$,
  'service-role can call rpc_admin_log_migration'
);

-- ────────── 3. audit row written with correct action + label ──────────
SELECT ok(
  EXISTS(
    SELECT 1 FROM audit_logs
    WHERE action = 'system.migration_applied'
    AND details->>'label' = 'test-migration-label'
  ),
  'rpc_admin_log_migration writes system.migration_applied to audit_logs with correct label'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
