-- RPC: rpc_admin_super_create_organization(TEXT) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_name TEXT) returning jsonb
--   * Super-admin required
--   * Creates new organization record
--   * Returns {id, name, created_at}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_super_create_organization',
  ARRAY['text'::text],
  'rpc_admin_super_create_organization(text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_super_create_organization',
  ARRAY['text'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_super_create_organization('unauthorized-org')$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin cannot create org'
);

-- ────────── 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_super_create_organization('unauthorized-org')$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated cannot create org'
);

-- ────────── 4. super-admin can create org ──────────
SELECT pgtap_test.become_super();

SELECT is_uuid(
  (rpc_admin_super_create_organization('super-created-org')::jsonb ->> 'id')::uuid,
  'super-admin can create org, returns valid uuid id'
);

-- ────────── 5. response has name and created_at ──────────
SELECT ok(
  (SELECT (rpc_admin_super_create_organization('another-super-org')::jsonb ? 'name')
       AND (rpc_admin_super_create_organization('another-super-org')::jsonb ? 'created_at')),
  'response has name and created_at keys'
);

-- ────────── 6. created org is queryable ──────────
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
  'pgtap-org-direct'::uuid,
  'direct-insert-org',
  now(),
  now()
);

SELECT is(
  (SELECT COUNT(*) FROM organizations WHERE id = 'pgtap-org-direct'::uuid),
  1::bigint,
  'created org exists in table'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
