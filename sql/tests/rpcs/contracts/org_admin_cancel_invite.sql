-- RPC: rpc_org_admin_cancel_invite(UUID) → jsonb
--
-- Pins the public contract documented in 007_identity.sql:
--   * Signature: (p_membership_id uuid) returning jsonb
--   * Unknown / non-invited membership → RAISE 'invite_not_found'
--   * Non-admin caller                 → RAISE 'unauthorized' (via _assert_can_invite)
--   * Success                          → {ok: true, membership_id}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_org_admin_cancel_invite',
  ARRAY['uuid'],
  'rpc_org_admin_cancel_invite(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_org_admin_cancel_invite',
  ARRAY['uuid'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown membership → invite_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_cancel_invite('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'invite_not_found'::text,
  'unknown membership id → raises invite_not_found'
);

-- ────────── 3. active (non-invited) membership → invite_not_found ──────────
-- Active memberships have status='active', not 'invited'; lookup returns NULL.
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES ('beef0000-0000-4000-8000-000000000001'::uuid,
        'aaaa0000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'org_admin', 'active', false)
ON CONFLICT (id) DO NOTHING;

SELECT throws_ok(
  $c$SELECT rpc_org_admin_cancel_invite('beef0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'invite_not_found'::text,
  'active (non-invited) membership → raises invite_not_found'
);

-- ────────── 4. unauthenticated + unknown id → invite_not_found (lookup first) ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_org_admin_cancel_invite('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'invite_not_found'::text,
  'unauthenticated + unknown id → invite_not_found (lookup gate fires first)'
);

-- ────────── 5. success: cancel a real invited membership ──────────
INSERT INTO memberships (id, user_id, organization_id, role, status, is_owner)
VALUES ('cafe0000-0000-4000-8000-000000000001'::uuid,
        'aaaa0000-0000-4000-8000-000000000001'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'org_admin', 'invited', false)
ON CONFLICT (id) DO NOTHING;

SELECT pgtap_test.become_a();

CREATE TEMP TABLE _cancel_resp ON COMMIT DROP AS
SELECT rpc_org_admin_cancel_invite(
  'cafe0000-0000-4000-8000-000000000001'::uuid
)::jsonb AS r;

SELECT is(
  (SELECT r->>'ok' FROM _cancel_resp),
  'true',
  'success response has ok=true'
);

SELECT ok(
  (SELECT r ? 'membership_id' FROM _cancel_resp),
  'success response has membership_id field'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
