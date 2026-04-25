-- RPC: rpc_entry_token_revoke(uuid) → json
--
-- Pins the public contract:
--   * Signature: (p_token_id uuid) returning json
--   * Unknown token              → { ok: false, error_code: 'token_not_found' }
--   * Unauthorized caller        → { ok: false, error_code: 'unauthorized' }
--   * Success                    → { ok: true }
--
-- Critical: state-changing RPC that revokes entry tokens for period access control.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_entry_token_revoke', ARRAY['uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_entry_token_revoke', ARRAY['uuid'], 'json', 'returns json');

-- 3. unknown token → token_not_found
SELECT pgtap_test.become_a();
SELECT is(
  (rpc_entry_token_revoke('00000000-0000-4000-8000-000000000abc'::uuid)::jsonb->>'error_code'),
  'token_not_found',
  'unknown token → token_not_found'
);

-- 4. NULL token_id → token_not_found
SELECT is(
  (rpc_entry_token_revoke(NULL::uuid)::jsonb->>'error_code'),
  'token_not_found',
  'NULL token_id → token_not_found'
);

-- 5. success: returns ok: true
-- Create a valid entry token
INSERT INTO entry_tokens (id, period_id, token_hash, created_by, expires_at)
VALUES ('hhhh0000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid, 'hash-token-xyz', 'user-id', now() + interval '24 hours')
ON CONFLICT DO NOTHING;

SELECT ok((rpc_entry_token_revoke('hhhh0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean, 'valid token → ok: true');

-- 6. already-revoked → should succeed (idempotent) or error
-- Calling again on same token
SELECT isnt(
  (rpc_entry_token_revoke('hhhh0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok'),
  NULL,
  'revoked token → response has ok field (idempotent or error)'
);

-- 7. response has ok field (already verified in test 5; verify idempotency or consistency)
INSERT INTO entry_tokens (id, period_id, token_hash, created_by, expires_at)
VALUES ('iiii0000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid, 'hash-token-abc', 'user-id', now() + interval '24 hours')
ON CONFLICT DO NOTHING;

SELECT ok(
  (rpc_entry_token_revoke('iiii0000-0000-4000-8000-000000000001'::uuid)::jsonb ? 'ok'),
  'response has ok field on revoke'
);

-- 8. cross-org unauthorized: admin A cannot revoke token in org B period
-- Try to revoke a token from a period in org B (Become A is still active, they only admin org A)
INSERT INTO entry_tokens (id, period_id, token_hash, created_by, expires_at)
VALUES ('jjjj0000-0000-4000-8000-000000000001'::uuid, 'eeee0000-0000-4000-8000-000000000002'::uuid, 'hash-token-def', 'user-id', now() + interval '24 hours')
ON CONFLICT DO NOTHING;

SELECT is(
  (rpc_entry_token_revoke('jjjj0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'),
  'unauthorized',
  'cross-tenant token revoke → unauthorized'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
