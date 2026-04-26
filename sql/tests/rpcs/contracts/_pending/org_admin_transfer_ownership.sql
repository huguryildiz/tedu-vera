-- RPC: rpc_org_admin_transfer_ownership(UUID) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_target_membership_id uuid) returning jsonb
--   * Unknown membership                      → RAISE 'target_not_found'
--   * Non-owner caller                        → RAISE 'unauthorized' (via _assert_tenant_owner)
--   * Target already owner / not active admin → RAISE 'invalid_target'
--   * Success                                 → {ok: true, new_owner_user_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_org_admin_transfer_ownership',
  ARRAY['uuid'],
  'rpc_org_admin_transfer_ownership(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_org_admin_transfer_ownership',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown membership → target_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'unknown membership id → raises target_not_found'
);

-- ────────── 3. unauthenticated + unknown → target_not_found (lookup fires first) ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_transfer_ownership('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'target_not_found'::text,
  'unauthenticated + unknown id → target_not_found'
);

-- ────────── 4. cross-tenant: admin A on org-B membership → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  format(
    $c$SELECT rpc_org_admin_transfer_ownership(%L::uuid)$c$,
    (SELECT id FROM memberships
     WHERE user_id = 'bbbb0000-0000-4000-8000-000000000002'::uuid
       AND organization_id = '22220000-0000-4000-8000-000000000002'::uuid
     LIMIT 1)
  ),
  NULL::text,
  'unauthorized'::text,
  'org-A admin on org-B membership → raises unauthorized'
);

-- ────────── 5. invalid_target: target is already owner ──────────
-- Admin A is is_owner=true → invalid_target when super_admin targets their membership
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT throws_ok(
  format(
    $c$SELECT rpc_org_admin_transfer_ownership(%L::uuid)$c$,
    (SELECT id FROM memberships
     WHERE user_id = 'aaaa0000-0000-4000-8000-000000000001'::uuid
       AND organization_id = '11110000-0000-4000-8000-000000000001'::uuid
     LIMIT 1)
  ),
  NULL::text,
  'invalid_target'::text,
  'target is already owner → raises invalid_target'
);

-- ────────── 6. success: add a non-owner org_admin, then transfer ──────────
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('f00d0000-0000-4000-8000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_admin_a2@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name) VALUES
  ('f00d0000-0000-4000-8000-000000000001'::uuid, 'pgtap Admin A2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES ('dead0000-0000-4000-8000-000000000001'::uuid,
        'f00d0000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'org_admin', 'active', false)
ON CONFLICT (id) DO NOTHING;

SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

CREATE TEMP TABLE _transfer_resp ON COMMIT DROP AS
SELECT rpc_org_admin_transfer_ownership(
  'dead0000-0000-4000-8000-000000000001'::uuid
)::jsonb AS r;

SELECT is(
  (SELECT r->>'ok' FROM _transfer_resp),
  'true',
  'transfer response has ok=true'
);

SELECT ok(
  (SELECT r ? 'new_owner_user_id' FROM _transfer_resp),
  'transfer response has new_owner_user_id field'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
