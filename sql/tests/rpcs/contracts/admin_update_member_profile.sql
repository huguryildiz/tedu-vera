-- RPC: rpc_admin_update_member_profile(UUID, TEXT, UUID) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_user_id uuid, p_display_name text,
--                  p_organization_id uuid) returning jsonb
--   * NULL p_user_id         → RAISE 'user_id_required'
--   * NULL p_organization_id → RAISE 'organization_id_required'
--   * Non-org-admin          → RAISE 'unauthorized' (via _assert_org_admin)
--   * Success                → {ok: true, user_id, display_name}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_update_member_profile',
  ARRAY['uuid', 'text', 'uuid'],
  'rpc_admin_update_member_profile(uuid,text,uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_update_member_profile',
  ARRAY['uuid', 'text', 'uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. validation errors (as super-admin for easy setup) ──────────
SELECT pgtap_test.become_super();

SELECT throws_ok(
  $c$SELECT rpc_admin_update_member_profile(
    NULL::uuid, 'Test', '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'user_id_required'::text,
  'NULL user_id → raises user_id_required'
);

SELECT throws_ok(
  $c$SELECT rpc_admin_update_member_profile(
    'aaaa0000-0000-4000-8000-000000000001'::uuid, 'Test', NULL::uuid)$c$,
  NULL::text,
  'organization_id_required'::text,
  'NULL organization_id → raises organization_id_required'
);

-- ────────── 3. unauthenticated → unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_update_member_profile(
    'aaaa0000-0000-4000-8000-000000000001'::uuid,
    'New Name',
    '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 4. cross-tenant org-admin → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_update_member_profile(
    'bbbb0000-0000-4000-8000-000000000002'::uuid,
    'Hijack',
    '22220000-0000-4000-8000-000000000002'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'org-A admin on org-B → raises unauthorized'
);

-- ────────── 5. own-org success ──────────
SELECT lives_ok(
  $c$SELECT rpc_admin_update_member_profile(
    'aaaa0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Updated Name',
    '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  'org-admin updating own-org member succeeds'
);

SELECT is(
  (SELECT rpc_admin_update_member_profile(
    'aaaa0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Updated Name',
    '11110000-0000-4000-8000-000000000001'::uuid
  )::jsonb->>'ok'),
  'true',
  'success response has ok=true'
);

SELECT ok(
  (SELECT rpc_admin_update_member_profile(
    'aaaa0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Updated Name',
    '11110000-0000-4000-8000-000000000001'::uuid
  )::jsonb ? 'user_id'
    AND rpc_admin_update_member_profile(
    'aaaa0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Updated Name',
    '11110000-0000-4000-8000-000000000001'::uuid
  )::jsonb ? 'display_name'),
  'response has user_id and display_name fields'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
