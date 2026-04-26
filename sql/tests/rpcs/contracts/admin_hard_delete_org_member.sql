-- RPC: rpc_admin_hard_delete_org_member(UUID, UUID) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_user_id uuid, p_org_id uuid) returning jsonb
--   * Non-super-admin caller      → RAISE 'unauthorized' (via _assert_super_admin)
--   * Membership not found        → RAISE 'membership_not_found'
--   * Success                     → {ok: true}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_hard_delete_org_member',
  ARRAY['uuid', 'uuid'],
  'rpc_admin_hard_delete_org_member(uuid,uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_hard_delete_org_member',
  ARRAY['uuid', 'uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. org-admin → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_hard_delete_org_member(
    'bbbb0000-0000-4000-8000-000000000002'::uuid,
    '22220000-0000-4000-8000-000000000002'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'org-admin caller → raises unauthorized'
);

-- ────────── 3. unauthenticated → unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_hard_delete_org_member(
    'bbbb0000-0000-4000-8000-000000000002'::uuid,
    '22220000-0000-4000-8000-000000000002'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 4. super-admin + unknown membership → membership_not_found ──────────
SELECT pgtap_test.become_super();

SELECT throws_ok(
  $c$SELECT rpc_admin_hard_delete_org_member(
    '00000000-0000-4000-8000-000000000abc'::uuid,
    '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'membership_not_found'::text,
  'super-admin + unknown user_id → raises membership_not_found'
);

-- ────────── 5. super-admin success ──────────
-- Drop role for fixture seeding so RLS doesn't deny the disposable
-- profiles/memberships rows (profiles_insert policy requires id = auth.uid()).
SELECT pgtap_test.become_reset();

INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('d1500000-0000-4000-8000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_disposable@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name) VALUES
  ('d1500000-0000-4000-8000-000000000001'::uuid, 'pgtap Disposable')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES ('d1500000-0000-4000-8000-000000000001'::uuid,
        'd1500000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'org_admin', 'active', false)
ON CONFLICT (id) DO NOTHING;

SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_hard_delete_org_member(
    'd1500000-0000-4000-8000-000000000001'::uuid,
    '11110000-0000-4000-8000-000000000001'::uuid)$c$,
  'super-admin hard delete succeeds'
);

-- Re-insert and delete to verify response shape. The earlier rpc_admin_hard_delete_org_member
-- removed user d1500000-...0001 from auth.users (cascade), so seed a NEW user for this
-- assertion. Fixture seed runs under postgres (RLS bypass), then super-admin runs the rpc.
SELECT pgtap_test.become_reset();

INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('d1500000-0000-4000-8000-000000000002'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_disposable2@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name) VALUES
  ('d1500000-0000-4000-8000-000000000002'::uuid, 'pgtap Disposable Two')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES ('d1500000-0000-4000-8000-000000000002'::uuid,
        'd1500000-0000-4000-8000-000000000002'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'org_admin', 'active', false)
ON CONFLICT (id) DO NOTHING;

SELECT pgtap_test.become_super();

SELECT is(
  (SELECT rpc_admin_hard_delete_org_member(
    'd1500000-0000-4000-8000-000000000002'::uuid,
    '11110000-0000-4000-8000-000000000001'::uuid
  )::jsonb->>'ok'),
  'true',
  'delete response has ok=true'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
