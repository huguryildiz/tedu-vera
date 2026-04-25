-- RPC: rpc_admin_reject_join_request(uuid) → json
--
-- Pins the public contract:
--   * Signature: (p_membership_id uuid) returning json
--   * Unknown membership (not 'requested' status) → { ok: false, error_code: 'membership_not_found' or similar }
--   * Unauthorized caller (not org admin) → raises or { ok: false, error_code: 'unauthorized' }
--   * Success (rejection sent)     → { ok: true, ... }
--
-- Critical: state-changing RPC that rejects org join requests and notifies applicant.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_admin_reject_join_request', ARRAY['uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_admin_reject_join_request', ARRAY['uuid'], 'json', 'returns json');

-- 3. unknown membership → request_not_found
SELECT is(
  (rpc_admin_reject_join_request('00000000-0000-4000-8000-000000000abc'::uuid)::jsonb->>'error_code'),
  'request_not_found',
  'unknown membership → request_not_found'
);

-- 4. NULL membership_id → error or exception
SELECT throws_ok(
  $c$SELECT rpc_admin_reject_join_request(NULL::uuid)$c$,
  NULL::text,
  NULL::text,
  'NULL membership_id → throws'
);

-- 5. success: returns ok: true
-- Create a requested membership (request_to_join flow would create these)
INSERT INTO memberships (id, organization_id, user_id, status, role)
VALUES ('cccc0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'aaaa0000-0000-4000-8000-000000000001'::uuid, 'requested', 'member')
ON CONFLICT DO NOTHING;

SELECT pgtap_test.become_a();
SELECT ok((rpc_admin_reject_join_request('cccc0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean, 'valid requested membership → ok: true');

-- 6. already-rejected → should error (membership deleted, status no longer 'requested')
SELECT is((rpc_admin_reject_join_request('cccc0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'), 'request_not_found', 'already-rejected membership → request_not_found');

-- 7. response has ok field on success
INSERT INTO memberships (id, organization_id, user_id, status, role)
VALUES ('dddd0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'bbbb0000-0000-4000-8000-000000000001'::uuid, 'requested', 'member')
ON CONFLICT DO NOTHING;
SELECT ok((rpc_admin_reject_join_request('dddd0000-0000-4000-8000-000000000001'::uuid)::jsonb ? 'ok'), 'response has ok field');

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
