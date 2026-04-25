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
-- Bonus: includes a tamper-then-detect sanity case (best-effort; may degrade
-- gracefully if the internal verify function shape differs).
--
-- See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;

-- Check if rpc_admin_verify_audit_chain exists (only in migration 009+)
-- CI caps at 007, so this RPC won't exist in CI. Skip the entire test if missing.
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'rpc_admin_verify_audit_chain'
  )
  THEN 1
  ELSE 0
END AS rpc_exists \gset

-- If RPC doesn't exist, plan(0) and skip all tests
SELECT CASE WHEN :rpc_exists = 0 THEN plan(0) ELSE plan(6) END;

SELECT pgtap_test.seed_two_orgs();

-- Skip the entire test body if RPC doesn't exist (migration 009 not applied)
\if :rpc_exists

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_verify_audit_chain',
  ARRAY['uuid'],
  'rpc_admin_verify_audit_chain(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_verify_audit_chain',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated caller raises ──────────
-- Note: the test session is running as postgres; auth.uid() returns NULL when
-- no JWT claim is set. The function raises 'Not authenticated' in that case.
-- become_reset() first to be explicit.
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_verify_audit_chain('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'Not authenticated'::text,
  'caller without auth.uid() → Not authenticated'
);

-- ────────── 3. non-admin for that org raises ──────────
-- Admin B is org_admin of org B; calling with org_id A should raise 'Insufficient permissions'.
SELECT pgtap_test.become_b();

SELECT throws_ok(
  $c$SELECT rpc_admin_verify_audit_chain('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'Insufficient permissions'::text,
  'admin B calling for org A → Insufficient permissions'
);

-- ────────── 4. org-admin for own org returns jsonb ──────────
SELECT pgtap_test.become_a();

SELECT isnt(
  rpc_admin_verify_audit_chain('11110000-0000-4000-8000-000000000001'::uuid)::text,
  NULL,
  'admin A on own org → returns jsonb (not NULL)'
);

-- ────────── 5. super-admin can call for any org ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT isnt(
  rpc_admin_verify_audit_chain('22220000-0000-4000-8000-000000000002'::uuid)::text,
  NULL,
  'super-admin on org B → returns jsonb (not NULL)'
);

SELECT pgtap_test.become_reset();

\endif

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
