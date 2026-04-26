-- RPC: rpc_backup_list(UUID) → table
--
-- Pins the public contract documented in 008_platform.sql:
--   * Signature: (p_org_id UUID) returning TABLE(...)
--   * Authenticated required
--   * Calls _assert_org_admin (raises 'unauthorized' for non-admin)
--   * Returns backup records for org

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────__ 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_backup_list',
  ARRAY['uuid'::text],
  'rpc_backup_list(uuid) exists'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_backup_list('pgtap-org-1111'::uuid)$c$,
  NULL::text,
  'attempted to access' -- _assert_org_admin raises
);

-- ────────__ 3. org-admin for org_a can list org_a backups ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_backup_list((SELECT id FROM organizations WHERE name = 'org_a'))$c$,
  'org_a admin can list org_a backups'
);

-- ────────__ 4. org-admin for org_a cannot list org_b backups ──────────
SELECT throws_ok(
  $c$SELECT rpc_backup_list((SELECT id FROM organizations WHERE name = 'org_b'))$c$,
  NULL::text,
  'attempted to access' -- _assert_org_admin check fails
);

-- ────────__ 5. super-admin can list any org backups ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_backup_list((SELECT id FROM organizations WHERE name = 'org_a'))$c$,
  'super-admin can list org_a backups'
);

SELECT lives_ok(
  $c$SELECT rpc_backup_list((SELECT id FROM organizations WHERE name = 'org_b'))$c$,
  'super-admin can list org_b backups'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
