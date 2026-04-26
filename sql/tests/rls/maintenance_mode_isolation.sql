-- RLS isolation: maintenance_mode.
--
-- Policies under test (sql/migrations/004_rls.sql §maintenance_mode):
--   maintenance_mode_super_admin_all  — super_admin FOR ALL (read + write)
--   maintenance_mode_public_read      — FOR SELECT USING (true) — any role may read
--
-- Grant situation: authenticated + anon have SELECT only (no INSERT/UPDATE/DELETE).
-- Write operations go through SECURITY DEFINER RPCs (e.g. rpc_admin_set_maintenance).
-- The super_admin_all policy is reachable only via those RPCs, not direct SQL.
--
-- Bug classes this file catches:
--   1. Non-super admin mutating maintenance state (unauthorized emergency toggle).
--   2. Public-read policy silently disappearing (client can no longer detect maintenance).
--   3. Anon reading maintenance flag (expected to work — drives client banner).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(4);

SELECT pgtap_test.seed_two_orgs();

-- maintenance_mode is a single-row table (id = 1) seeded by the migration.

-- ─────────────────────────────────────────────────────────────────────────
-- SELECT — public_read policy allows all roles that have SELECT grant.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. admin A can read the maintenance_mode row (SELECT grant + public_read policy).
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM maintenance_mode WHERE id = 1),
  1,
  'admin A sees maintenance_mode row (SELECT grant + public_read policy)'::text
);

-- 2. anon can read the maintenance_mode row (SELECT grant + public_read policy).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT is(
  (SELECT count(*)::int FROM maintenance_mode WHERE id = 1),
  1,
  'anon sees maintenance_mode row (SELECT grant + public_read policy)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- INSERT isolation — authenticated has no INSERT grant → permission denied.
-- ─────────────────────────────────────────────────────────────────────────

-- 3. admin A INSERT/UPSERT is rejected (no INSERT grant for authenticated).
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $i$INSERT INTO maintenance_mode (id, is_active, mode, message, notify_admins, updated_at)
     VALUES (1, true, 'immediate', 'pgtap takeover', false, now())
     ON CONFLICT (id) DO UPDATE SET is_active = true$i$,
  '42501',
  NULL,
  'admin A INSERT/UPSERT on maintenance_mode throws 42501 (no INSERT grant)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- UPDATE isolation — authenticated has no UPDATE grant → permission denied.
-- Note: writes are intentionally routed through SECURITY DEFINER RPCs only.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. admin A UPDATE is rejected (no UPDATE grant for authenticated).
SELECT throws_ok(
  $$UPDATE maintenance_mode SET is_active = true WHERE id = 1$$,
  '42501',
  NULL,
  'admin A UPDATE on maintenance_mode throws 42501 (no UPDATE grant)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
