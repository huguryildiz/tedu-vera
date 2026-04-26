-- RPC: rpc_org_admin_set_admins_can_invite(UUID, BOOLEAN) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_org_id uuid, p_enabled boolean) returning jsonb
--   * Non-owner caller  → RAISE 'unauthorized' (via _assert_tenant_owner)
--   * Owner success     → {ok: true, enabled: <value>}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_org_admin_set_admins_can_invite',
  ARRAY['uuid', 'boolean'],
  'rpc_org_admin_set_admins_can_invite(uuid,boolean) exists'
);

SELECT function_returns(
  'public', 'rpc_org_admin_set_admins_can_invite',
  ARRAY['uuid', 'boolean'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT rpc_org_admin_set_admins_can_invite(
    '11110000-0000-4000-8000-000000000001'::uuid, true)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 3. cross-tenant admin (not owner) → unauthorized ──────────
-- Admin B is not a member of Org A at all → unauthorized
SELECT pgtap_test.become_b();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_set_admins_can_invite(
    '11110000-0000-4000-8000-000000000001'::uuid, true)$c$,
  NULL::text,
  'unauthorized'::text,
  'org-B admin on org-A → raises unauthorized'
);

-- ────────── 4. owner success: enable ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_org_admin_set_admins_can_invite(
    '11110000-0000-4000-8000-000000000001'::uuid, true)$c$,
  'org-A owner can enable admins_can_invite'
);

SELECT is(
  (SELECT rpc_org_admin_set_admins_can_invite(
    '11110000-0000-4000-8000-000000000001'::uuid, true
  )::jsonb->>'ok'),
  'true',
  'enable response has ok=true'
);

SELECT is(
  (SELECT rpc_org_admin_set_admins_can_invite(
    '11110000-0000-4000-8000-000000000001'::uuid, false
  )::jsonb->>'enabled'),
  'false',
  'disable response has enabled=false'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
