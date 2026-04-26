-- RPC: rpc_admin_verify_audit_chain(uuid) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_org_id uuid) returning jsonb
--   * Unauthenticated caller        → RAISE 'Not authenticated'
--   * Non-org-admin / non-super     → RAISE 'Insufficient permissions'
--   * Super-admin for any org       → returns jsonb (empty [] or broken-link list)
--   * Org-admin for their own org   → returns jsonb
--
-- Audit chain integrity is the tamper-detection mechanism for the whole audit
-- system; if a developer changes the return shape from array-of-broken-links
-- to something else, the admin UI's "chain intact" signal breaks silently.
--
-- The RPC lives in migration 009 (`009_audit.sql`); CI caps at 007 and on
-- vanilla PGDG Postgres `pg_cron`/`pg_net` are unavailable. The test detects
-- the missing function via information_schema and emits 6 SKIPped tests
-- instead of failing. On vera-prod / vera-demo (where 009 is applied) the
-- assertions execute normally.
--
-- See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- Detect whether the RPC has been migrated. Persist the boolean in a temp
-- table so every assertion below can gate on it without psql meta-commands
-- (pg_prove + \gset/\if previously produced exit code 3 on plan(0)).
CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'rpc_admin_verify_audit_chain'
) AS rpc_exists;

GRANT SELECT ON _ctx TO authenticated, anon, service_role;

-- When the RPC is missing, emit 6 SKIPped pgTAP results once and stop.
SELECT skip('migration 009 not applied — rpc_admin_verify_audit_chain missing', 6)
FROM _ctx WHERE NOT rpc_exists;

-- Seed only if we are going to exercise the RPC.
SELECT pgtap_test.seed_two_orgs() FROM _ctx WHERE rpc_exists;

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_verify_audit_chain',
  ARRAY['uuid'],
  'rpc_admin_verify_audit_chain(uuid) exists'
) FROM _ctx WHERE rpc_exists;

SELECT function_returns(
  'public', 'rpc_admin_verify_audit_chain',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
) FROM _ctx WHERE rpc_exists;

-- ────────── 2. unauthenticated caller raises ──────────
SELECT pgtap_test.become_reset() FROM _ctx WHERE rpc_exists;

SELECT throws_ok(
  $c$SELECT rpc_admin_verify_audit_chain('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'Not authenticated'::text,
  'caller without auth.uid() → Not authenticated'
) FROM _ctx WHERE rpc_exists;

-- ────────── 3. non-admin for that org raises ──────────
-- Admin B is org_admin of org B; calling with org_id A should raise
-- 'Insufficient permissions'.
SELECT pgtap_test.become_b() FROM _ctx WHERE rpc_exists;

SELECT throws_ok(
  $c$SELECT rpc_admin_verify_audit_chain('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'Insufficient permissions'::text,
  'admin B calling for org A → Insufficient permissions'
) FROM _ctx WHERE rpc_exists;

-- ────────── 4. org-admin for own org returns jsonb ──────────
SELECT pgtap_test.become_a() FROM _ctx WHERE rpc_exists;

SELECT isnt(
  (SELECT rpc_admin_verify_audit_chain('11110000-0000-4000-8000-000000000001'::uuid)::text),
  NULL,
  'admin A on own org → returns jsonb (not NULL)'
) FROM _ctx WHERE rpc_exists;

-- ────────── 5. super-admin can call for any org ──────────
SELECT pgtap_test.become_reset() FROM _ctx WHERE rpc_exists;
SELECT pgtap_test.become_super() FROM _ctx WHERE rpc_exists;

SELECT isnt(
  (SELECT rpc_admin_verify_audit_chain('22220000-0000-4000-8000-000000000002'::uuid)::text),
  NULL,
  'super-admin on org B → returns jsonb (not NULL)'
) FROM _ctx WHERE rpc_exists;

SELECT pgtap_test.become_reset() FROM _ctx WHERE rpc_exists;

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
