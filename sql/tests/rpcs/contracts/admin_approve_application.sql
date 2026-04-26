-- RPC: rpc_admin_approve_application(uuid) → json
--
-- Pins the public contract:
--   * Signature: (p_application_id uuid) returning json
--   * Non-super-admin caller     → { ok: false, error_code: 'unauthorized' }
--   * Unknown application        → { ok: false, error_code: 'application_not_found' }
--   * Invalid status (not pending) → { ok: false, error_code: 'invalid_status' }
--   * Success                    → { ok: true, ... }
--
-- Critical: super-admin only RPC, changes org application status to approved.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_admin_approve_application', ARRAY['uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_admin_approve_application', ARRAY['uuid'], 'json', 'returns json');

-- 3. non-super-admin caller → unauthorized
INSERT INTO org_applications (id, organization_id, applicant_name, contact_email, status)
VALUES ('aaaa0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'Test', 'test@org.local', 'pending')
ON CONFLICT DO NOTHING;

SELECT pgtap_test.become_a();
SELECT is((rpc_admin_approve_application('aaaa0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'), 'unauthorized', 'non-super-admin → unauthorized');

-- 4. super-admin success
SELECT pgtap_test.become_super();
SELECT ok((rpc_admin_approve_application('aaaa0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean, 'super-admin approve → ok: true');

-- 5. already-approved → invalid_status
SELECT is((rpc_admin_approve_application('aaaa0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'), 'invalid_status', 'non-pending app → invalid_status');

-- 6. unknown application
SELECT ok((rpc_admin_approve_application('00000000-0000-4000-8000-000000000abc'::uuid)::jsonb->>'error_code')::text LIKE 'application_not_found', 'unknown app → application_not_found');

-- 7. NULL application_id → envelope with application_not_found (RPC returns envelope, not throw)
SELECT is(
  (rpc_admin_approve_application(NULL::uuid)::jsonb->>'error_code'),
  'application_not_found',
  'NULL id → application_not_found envelope'
);

-- 8. response has ok field
INSERT INTO org_applications (id, organization_id, applicant_name, contact_email, status)
VALUES ('bbbb0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'Test2', 'test2@org.local', 'pending')
ON CONFLICT DO NOTHING;
SELECT ok((rpc_admin_approve_application('bbbb0000-0000-4000-8000-000000000001'::uuid)::jsonb ? 'ok'), 'response has ok field');

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
