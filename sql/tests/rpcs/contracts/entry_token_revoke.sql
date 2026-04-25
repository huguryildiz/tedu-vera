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
SELECT pgtap_test.seed_entry_tokens();

-- Seed an extra org-A token + an org-B token for cross-org test (as postgres, before become_a)
INSERT INTO entry_tokens (id, period_id, token_hash, token_plain, is_revoked, expires_at)
VALUES
  ('77770000-0000-4000-8000-00000000aaaa'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   encode(digest('pgtap-token-extra-a', 'sha256'), 'hex'),
   'pgtap-token-extra-a', false, now() + interval '1 day'),
  ('77770000-0000-4000-8000-00000000bbbb'::uuid,
   'dddd0000-0000-4000-8000-000000000002'::uuid,
   encode(digest('pgtap-token-extra-b', 'sha256'), 'hex'),
   'pgtap-token-extra-b', false, now() + interval '1 day')
ON CONFLICT (id) DO NOTHING;

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

-- 5. success: revoke a valid org-A token (admin A is owner of org A)
SELECT ok(
  (rpc_entry_token_revoke('77770000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean,
  'valid token in own org → ok: true'
);

-- 6. revoking an already-revoked token: response shape preserved
SELECT ok(
  (rpc_entry_token_revoke('77770000-0000-4000-8000-000000000001'::uuid)::jsonb ? 'ok'),
  'second revoke on same token → response still has ok field'
);

-- 7. response has ok field for a fresh token revoke
SELECT ok(
  (rpc_entry_token_revoke('77770000-0000-4000-8000-00000000aaaa'::uuid)::jsonb ? 'ok'),
  'fresh org-A token revoke → response has ok field'
);

-- 8. cross-org unauthorized: admin A cannot revoke token in org B's period
SELECT is(
  (rpc_entry_token_revoke('77770000-0000-4000-8000-00000000bbbb'::uuid)::jsonb->>'error_code'),
  'unauthorized',
  'cross-tenant token revoke → unauthorized'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
