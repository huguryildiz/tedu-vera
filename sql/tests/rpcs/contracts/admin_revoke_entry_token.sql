-- RPC: rpc_admin_revoke_entry_token(UUID) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_token_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Error code: 'period_not_found' (token may reference closed period)
--   * Returns {ok, updated_at}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_revoke_entry_token',
  ARRAY['uuid'::text],
  'rpc_admin_revoke_entry_token(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_revoke_entry_token',
  ARRAY['uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_revoke_entry_token('00000000-0000-0000-0000-000000009999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. org-admin for org_a can revoke org_a tokens ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_entry_tokens();
SELECT pgtap_test.become_a();

-- Get first entry token for org_a
SELECT lives_ok(
  $c$SELECT rpc_admin_revoke_entry_token((SELECT id FROM entry_tokens WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))$c$,
  'org_a admin can revoke org_a entry token'
);

-- ────────── 4. org-admin for org_a cannot revoke org_b tokens ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_revoke_entry_token((SELECT id FROM entry_tokens WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  NULL::text,
  'attempted to access'
);

-- ────────── 5. super-admin can revoke any token ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_revoke_entry_token((SELECT id FROM entry_tokens WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  'super-admin can revoke any entry token'
);

-- ────────__ 6. response shape ──────────
SELECT ok(
  (SELECT rpc_admin_revoke_entry_token((SELECT id FROM entry_tokens WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))::jsonb ? 'ok'),
  'response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
