-- RPC: rpc_super_admin_resolve_unlock(UUID, TEXT, TEXT) → json
--
-- Pins the public contract:
--   * Signature: (p_request_id UUID, p_decision TEXT, p_note TEXT DEFAULT NULL) returning json
--   * Super-admin required (returns {ok:false, error_code:'unauthorized'} otherwise)
--   * Approves or rejects unlock requests
--   * Error codes: 'unauthorized', 'invalid_decision', 'request_not_found'
--   * Returns {ok, request_id, decision}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_super_admin_resolve_unlock',
  ARRAY['uuid'::text, 'text'::text, 'text'::text],
  'rpc_super_admin_resolve_unlock(uuid, text, text) exists'
);

SELECT function_returns(
  'public', 'rpc_super_admin_resolve_unlock',
  ARRAY['uuid'::text, 'text'::text, 'text'::text],
  'json',
  'returns json'
);

-- ────────── 2. org-admin → unauthorized ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT results_eq(
  $c$SELECT (rpc_super_admin_resolve_unlock('00000000-0000-0000-0000-000000009999'::uuid, 'approved', NULL)::jsonb ->> 'error_code')$c$,
  ARRAY['unauthorized'],
  'org-admin gets unauthorized error code'
);

-- ────────── 3. unauthenticated → unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT results_eq(
  $c$SELECT (rpc_super_admin_resolve_unlock('00000000-0000-0000-0000-000000009999'::uuid, 'approved', NULL)::jsonb ->> 'error_code')$c$,
  ARRAY['unauthorized'],
  'unauthenticated gets unauthorized error code'
);

-- ────────── seed data before switching to super role ──────────
-- The unlock_request INSERT runs in reset mode (before become_super) because
-- super_admin has no org and would fail the RLS INSERT policy on unlock_requests.
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_unlock_requests();

INSERT INTO unlock_requests (id, organization_id, period_id, requested_by, reason, status, created_at, updated_at)
SELECT
  '99990000-0000-0000-0000-000000000099'::uuid,
  (SELECT id FROM organizations WHERE name = 'pgtap Org A'),
  (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') AND is_locked = true LIMIT 1),
  (SELECT id FROM profiles WHERE id = 'aaaa0000-0000-4000-8000-000000000001'::uuid),
  'test unlock for shape check',
  'pending',
  now(),
  now()
ON CONFLICT (id) DO NOTHING;

SELECT pgtap_test.become_super();

-- ────────── 4. super-admin can approve unlock request ──────────
SELECT lives_ok(
  $c$SELECT rpc_super_admin_resolve_unlock('a3330000-0000-4000-8000-000000000a11'::uuid, 'approved', NULL)$c$,
  'super-admin can approve unlock request'
);

-- ────────── 5. super-admin can reject unlock request ──────────
SELECT lives_ok(
  $c$SELECT rpc_super_admin_resolve_unlock('a3330000-0000-4000-8000-000000000b22'::uuid, 'rejected', NULL)$c$,
  'super-admin can reject unlock request'
);

-- ────────── 6. response has ok, request_id, decision ──────────
SELECT ok(
  (SELECT (r ? 'ok') AND (r ? 'request_id') AND (r ? 'decision')
   FROM (SELECT rpc_super_admin_resolve_unlock('99990000-0000-0000-0000-000000000099'::uuid, 'approved', NULL)::jsonb AS r) t),
  'response has ok, request_id, decision keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
