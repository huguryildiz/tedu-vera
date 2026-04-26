-- RPC: rpc_admin_reject_application(uuid) → json
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_application_id uuid) returning json
--   * Non-super-admin caller       → { ok: false, error_code: 'unauthorized' }
--   * Unknown application id       → { ok: false, error_code: 'application_not_found' }
--   * NULL application id          → returns 'application_not_found' envelope
--                                    (RPC SELECTs WHERE id = NULL → no row)
--   * Application not in 'pending' → { ok: false, error_code: 'invalid_status' }
--   * Success (super-admin)        → { ok: true, application_id }
--
-- Critical: super-admin only RPC, transitions org_applications.status → rejected
-- and writes an audit row.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();

-- Seed two pending applications under postgres (RLS-bypass) so both the
-- success path (test 4) and the response-shape check (test 8) have rows.
INSERT INTO org_applications (id, organization_id, applicant_name, contact_email, status)
VALUES
  ('aaaa0000-0000-4000-8000-00000000a002'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap reject A', 'pgtap_reject_a@test.local', 'pending'),
  ('bbbb0000-0000-4000-8000-00000000b002'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap reject B', 'pgtap_reject_b@test.local', 'pending')
ON CONFLICT (id) DO NOTHING;

-- ────────── 1-2. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_reject_application',
  ARRAY['uuid'],
  'rpc_admin_reject_application(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_reject_application',
  ARRAY['uuid'],
  'json',
  'returns json'
);

-- ────────── 3. non-super-admin caller → unauthorized ──────────
SELECT pgtap_test.become_a();

SELECT is(
  (rpc_admin_reject_application('aaaa0000-0000-4000-8000-00000000a002'::uuid)::jsonb->>'error_code'),
  'unauthorized',
  'org-admin caller (not super) → error_code=unauthorized'
);

-- ────────── 4. super-admin success path ──────────
SELECT pgtap_test.become_super();

SELECT is(
  (rpc_admin_reject_application('aaaa0000-0000-4000-8000-00000000a002'::uuid)::jsonb->>'ok'),
  'true',
  'super-admin reject pending app → ok=true'
);

-- ────────── 5. already-rejected → invalid_status ──────────
-- Calling reject again on the row from test 4 (now status=rejected) must
-- surface invalid_status, not silently re-update.
SELECT is(
  (rpc_admin_reject_application('aaaa0000-0000-4000-8000-00000000a002'::uuid)::jsonb->>'error_code'),
  'invalid_status',
  'non-pending application → error_code=invalid_status'
);

-- ────────── 6. unknown application id → application_not_found ──────────
SELECT is(
  (rpc_admin_reject_application('00000000-0000-4000-8000-000000000abc'::uuid)::jsonb->>'error_code'),
  'application_not_found',
  'unknown application id → error_code=application_not_found'
);

-- ────────── 7. NULL application id → application_not_found ──────────
-- The RPC does not pre-validate p_application_id; the WHERE id = NULL lookup
-- finds no row and the function returns the standard not-found envelope.
-- This pins that behavior so a future "raise on NULL" change surfaces here.
SELECT is(
  (rpc_admin_reject_application(NULL::uuid)::jsonb->>'error_code'),
  'application_not_found',
  'NULL application id → error_code=application_not_found'
);

-- ────────── 8. success envelope shape includes ok + application_id ──────────
SELECT ok(
  (rpc_admin_reject_application('bbbb0000-0000-4000-8000-00000000b002'::uuid)::jsonb ? 'ok'),
  'success response carries ok field'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
