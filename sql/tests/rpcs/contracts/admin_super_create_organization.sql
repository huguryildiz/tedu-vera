-- RPC: rpc_admin_super_create_organization(TEXT, TEXT, TEXT, TEXT) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_name TEXT, p_code TEXT, p_contact_email TEXT DEFAULT NULL, p_status TEXT DEFAULT 'active')
--   * Super-admin required
--   * Creates new organization record without a membership
--   * Returns full organization row as jsonb

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_super_create_organization',
  ARRAY['text'::text, 'text'::text, 'text'::text, 'text'::text],
  'rpc_admin_super_create_organization(text, text, text, text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_super_create_organization',
  ARRAY['text'::text, 'text'::text, 'text'::text, 'text'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. org-admin → unauthorized ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_super_create_organization('unauthorized-org', 'UNAUTH', NULL, 'active')$c$,
  NULL::text,
  'unauthorized'::text,
  'org-admin cannot create org'
);

-- ────────── 3. unauthenticated → unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_super_create_organization('unauthorized-org2', 'UNAUTH2', NULL, 'active')$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated cannot create org'
);

-- ────────── 4. super-admin can create org ──────────
SELECT pgtap_test.become_super();

SELECT ok(
  (rpc_admin_super_create_organization('super-created-org'::text, 'SUPCR', NULL, 'active')::jsonb ->> 'id')::uuid IS NOT NULL,
  'super-admin can create org, returns valid uuid id'
);

-- ────────── 5. response has name and created_at ──────────
SELECT ok(
  (SELECT (r ? 'name') AND (r ? 'created_at')
   FROM (SELECT rpc_admin_super_create_organization('another-super-org'::text, 'SUPANOT', NULL, 'active')::jsonb AS r) t),
  'response has name and created_at keys'
);

-- ────────── 6. created org is queryable ──────────
INSERT INTO organizations (id, code, name, created_at, updated_at)
VALUES (
  '33300000-0000-0000-0000-000000000099'::uuid,
  'DIRINS',
  'direct-insert-org',
  now(),
  now()
);

SELECT is(
  (SELECT COUNT(*) FROM organizations WHERE id = '33300000-0000-0000-0000-000000000099'::uuid),
  1::bigint,
  'created org exists in table'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
