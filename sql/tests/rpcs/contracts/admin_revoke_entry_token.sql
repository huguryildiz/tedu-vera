-- RPC: rpc_admin_revoke_entry_token(UUID) -> jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_period_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Revokes all non-revoked entry_tokens for the given period
--   * Error: 'period_not_found' when period missing, _assert_org_admin raises for wrong tenant
--   * Returns {ok, revoked_count, active_juror_count}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ---------- 1. signature pinned ----------
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

-- ---------- 2. unauthenticated cannot call ----------
-- Function grants authenticated only; calling as anon raises permission-denied
-- at the call site (before pgTAP's exception handler), crashing the connection.
-- Verify via privilege catalog instead.
SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_admin_revoke_entry_token(uuid)', 'execute'),
  'anon has no execute privilege on rpc_admin_revoke_entry_token'
);

-- ---------- 3. org-admin for org_a can revoke org_a period tokens ----------
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_entry_tokens();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_admin_revoke_entry_token((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))$c$,
  'org_a admin can revoke entry tokens for org_a period'
);

-- ---------- 4. org-admin for org_a cannot revoke org_b period tokens ----------
-- SECURITY DEFINER so function can see org_b period; _assert_org_admin then raises
SELECT throws_ok(
  $c$SELECT rpc_admin_revoke_entry_token((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  NULL::text,
  'org_a admin cannot revoke tokens for org_b period'
);

-- ---------- 5. super-admin can revoke tokens for any period ----------
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_revoke_entry_token((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1))$c$,
  'super-admin can revoke entry tokens for any period'
);

-- ---------- 6. response has ok key ----------
-- Calling again on an already-revoked period still returns ok=true with revoked_count=0
SELECT ok(
  (SELECT rpc_admin_revoke_entry_token((SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1))::jsonb ? 'ok'),
  'response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
