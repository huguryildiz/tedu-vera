-- RPC: rpc_admin_reject_join_request(uuid) → json
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_membership_id uuid) returning json
--   * Unknown / non-'requested' membership → { ok: false, error_code: 'request_not_found' }
--   * NULL membership_id                   → 'request_not_found' envelope
--                                            (RPC SELECT WHERE id = NULL → no row)
--   * Caller not org_admin of that org     → raises in _assert_org_admin
--   * Success                              → { ok: true } and membership row deleted
--
-- Critical: state-changing RPC. Drives the pending-review gate in admin UI.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();

-- Seed two extra auth.users + profiles to play the role of "joiners"
-- requesting membership to org A. Using admin_b's user_id as the joiner is
-- avoided because it would conflict with the (user_id, org_id) unique index
-- once future rows enter the same org. Two distinct synthetic users keep
-- tests 5 and 7 independent.
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('99990000-0000-4000-8000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_joiner_1@test.local'),
  ('99990000-0000-4000-8000-000000000002'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_joiner_2@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name) VALUES
  ('99990000-0000-4000-8000-000000000001'::uuid, 'pgtap Joiner 1'),
  ('99990000-0000-4000-8000-000000000002'::uuid, 'pgtap Joiner 2')
ON CONFLICT (id) DO NOTHING;

-- Two pending join requests against org A. Only roles allowed by
-- memberships_role_check are 'org_admin' / 'super_admin' — pending
-- joiners are seeded as 'org_admin' with status='requested'.
INSERT INTO memberships (id, organization_id, user_id, status, role) VALUES
  ('cccc0000-0000-4000-8000-00000000c001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   '99990000-0000-4000-8000-000000000001'::uuid,
   'requested', 'org_admin'),
  ('dddd0000-0000-4000-8000-00000000d001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   '99990000-0000-4000-8000-000000000002'::uuid,
   'requested', 'org_admin')
ON CONFLICT (id) DO NOTHING;

-- ────────── 1-2. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_reject_join_request',
  ARRAY['uuid'],
  'rpc_admin_reject_join_request(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_reject_join_request',
  ARRAY['uuid'],
  'json',
  'returns json'
);

-- ────────── 3. unknown membership → request_not_found ──────────
SELECT pgtap_test.become_a();

SELECT is(
  (rpc_admin_reject_join_request('00000000-0000-4000-8000-000000000abc'::uuid)::jsonb->>'error_code'),
  'request_not_found',
  'unknown membership id → error_code=request_not_found'
);

-- ────────── 4. NULL membership_id → request_not_found ──────────
-- WHERE id = NULL matches no row, so the RPC returns the standard not-found
-- envelope rather than throwing. Pin this behavior.
SELECT is(
  (rpc_admin_reject_join_request(NULL::uuid)::jsonb->>'error_code'),
  'request_not_found',
  'NULL membership id → error_code=request_not_found'
);

-- ────────── 5. success: org-admin rejects requested membership → ok=true ──────────
SELECT is(
  (rpc_admin_reject_join_request('cccc0000-0000-4000-8000-00000000c001'::uuid)::jsonb->>'ok'),
  'true',
  'org_admin rejecting requested membership → ok=true'
);

-- ────────── 6. already-deleted membership → request_not_found ──────────
-- Same id as test 5 — the RPC deleted the row, so subsequent calls find nothing.
SELECT is(
  (rpc_admin_reject_join_request('cccc0000-0000-4000-8000-00000000c001'::uuid)::jsonb->>'error_code'),
  'request_not_found',
  'already-rejected membership → error_code=request_not_found'
);

-- ────────── 7. success envelope shape includes ok ──────────
SELECT ok(
  (rpc_admin_reject_join_request('dddd0000-0000-4000-8000-00000000d001'::uuid)::jsonb ? 'ok'),
  'success response carries ok field'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
