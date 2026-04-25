-- RPC: rpc_admin_delete_organization(uuid) → void
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_org_id uuid) returning void
--   * Non-super-admin caller       → raises in _assert_super_admin
--   * Super-admin caller            → deletes organization (and CASCADE children)
--
-- Hard delete, super-admin only. Shape drift on the void return or wrong
-- auth gate both have real-world consequences (accidental or missed deletes).
-- See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_delete_organization',
  ARRAY['uuid'],
  'rpc_admin_delete_organization(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_delete_organization',
  ARRAY['uuid'],
  'void',
  'returns void'
);

-- ────────── 2. org-admin (not super) → raises ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_delete_organization('11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  NULL::text,
  'org_admin cannot delete organization (super-admin only)'
);

-- ────────── 3. super-admin can delete; org gone after call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

-- Call the RPC (returns void; just assert it did not raise).
SELECT lives_ok(
  $c$SELECT rpc_admin_delete_organization('22220000-0000-4000-8000-000000000002'::uuid)$c$,
  'super-admin can delete organization'
);

-- Verify the org row is gone.
SELECT is(
  (SELECT COUNT(*)::int
     FROM organizations
     WHERE id = '22220000-0000-4000-8000-000000000002'::uuid),
  0,
  'organization row removed after delete'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
