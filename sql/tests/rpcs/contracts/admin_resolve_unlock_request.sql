-- RPC: rpc_super_admin_resolve_unlock(uuid, text, text DEFAULT NULL) → json
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_request_id uuid, p_decision text, p_note text DEFAULT NULL) → json
--   * Non-super-admin caller        → { ok: false, error_code: 'unauthorized' }
--   * Invalid decision               → { ok: false, error_code: 'invalid_decision' }
--   * Unknown request_id             → { ok: false, error_code: 'request_not_found' }
--   * approved → period.is_locked = false, request.status = 'approved'
--   * rejected → period.is_locked stays true, request.status = 'rejected'
--   * already-resolved request       → { ok: false, error_code: 'request_not_pending' }
--
-- Bug classes this file catches:
--   1. Tenant admin gaining the ability to resolve unlock requests by
--      bypassing current_user_is_super_admin().
--   2. Approve flow forgetting to flip period.is_locked (the whole point).
--   3. Reject flow accidentally flipping period.is_locked (anti-feature).
--   4. The double-resolve guard regressing — would let a rejected request
--      be re-approved by a second super_admin who didn't see the rejection.
--   5. Default p_note arg silently dropped from the signature (3-arg
--      overload removed) — frontend would suddenly fail compile.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(12);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_unlock_requests();

-- ────────── 1. signature — (uuid, text, text DEFAULT NULL) → json ──────────
SELECT has_function(
  'public', 'rpc_super_admin_resolve_unlock',
  ARRAY['uuid', 'text', 'text'],
  'rpc_super_admin_resolve_unlock(uuid,text,text) exists'
);

SELECT function_returns(
  'public', 'rpc_super_admin_resolve_unlock',
  ARRAY['uuid', 'text', 'text'],
  'json',
  'returns json'
);

-- ────────── 2. tenant-admin caller is rejected ──────────
SELECT pgtap_test.become_a();

SELECT is(
  (SELECT rpc_super_admin_resolve_unlock(
     'a3330000-0000-4000-8000-000000000a11'::uuid,
     'approved',
     'pgtap tenant-admin attempting super action'
   )::jsonb->>'error_code'),
  'unauthorized',
  'tenant-admin caller → error_code unauthorized'
);

-- ────────── 3. invalid decision is rejected ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT is(
  (SELECT rpc_super_admin_resolve_unlock(
     'a3330000-0000-4000-8000-000000000a11'::uuid,
     'maybe',  -- not 'approved' or 'rejected'
     NULL
   )::jsonb->>'error_code'),
  'invalid_decision',
  'invalid decision string → error_code invalid_decision'
);

-- ────────── 4. unknown request_id is rejected ──────────
SELECT is(
  (SELECT rpc_super_admin_resolve_unlock(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     'approved',
     NULL
   )::jsonb->>'error_code'),
  'request_not_found',
  'unknown request_id → error_code request_not_found'
);

-- ────────── 5. APPROVE path — request.status flips, period.is_locked=false ──────────
--   Capture the response to a temp table so we can re-call the RPC for
--   the double-resolve guard test below without re-running approve.
CREATE TEMP TABLE _approve ON COMMIT DROP AS
SELECT rpc_super_admin_resolve_unlock(
  'a3330000-0000-4000-8000-000000000a11'::uuid,
  'approved',
  'pgtap approve note'
)::jsonb AS resp;

SELECT is(
  (SELECT (resp->>'ok') FROM _approve),
  'true',
  'approve → ok=true'
);

SELECT is(
  (SELECT status FROM unlock_requests
    WHERE id = 'a3330000-0000-4000-8000-000000000a11'::uuid),
  'approved',
  'approve → unlock_requests.status = approved'
);

SELECT is(
  (SELECT is_locked FROM periods
    WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid),
  false,
  'approve → period.is_locked flipped to false'
);

-- ────────── 6. double-resolve guard — re-resolving an already-approved request ──────────
SELECT is(
  (SELECT rpc_super_admin_resolve_unlock(
     'a3330000-0000-4000-8000-000000000a11'::uuid,
     'rejected',
     'pgtap second resolution attempt'
   )::jsonb->>'error_code'),
  'request_not_pending',
  'second resolve on same request → error_code request_not_pending (state guard)'
);

-- ────────── 7. REJECT path — period stays locked, request.status=rejected ──────────
SELECT is(
  (SELECT rpc_super_admin_resolve_unlock(
     'a3330000-0000-4000-8000-000000000b22'::uuid,
     'rejected',
     'pgtap reject note'
   )::jsonb->>'ok'),
  'true',
  'reject → ok=true'
);

SELECT is(
  (SELECT status FROM unlock_requests
    WHERE id = 'a3330000-0000-4000-8000-000000000b22'::uuid),
  'rejected',
  'reject → unlock_requests.status = rejected'
);

SELECT is(
  (SELECT is_locked FROM periods
    WHERE id = 'dddd0000-0000-4000-8000-000000000022'::uuid),
  true,
  'reject → period.is_locked unchanged (stays true)'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
