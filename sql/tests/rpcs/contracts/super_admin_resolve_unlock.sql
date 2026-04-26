-- RPC: rpc_super_admin_resolve_unlock(UUID, TEXT) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_request_id UUID, p_decision TEXT) returning jsonb
--   * Super-admin required
--   * Approves or rejects unlock requests
--   * Error: 'super_admin required', 'invalid_decision'
--   * Returns {ok, request_id, decision}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_super_admin_resolve_unlock',
  ARRAY['uuid'::text, 'text'::text],
  'rpc_super_admin_resolve_unlock(uuid, text) exists'
);

SELECT function_returns(
  'public', 'rpc_super_admin_resolve_unlock',
  ARRAY['uuid'::text, 'text'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. org-admin → super_admin required ──────────
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_super_admin_resolve_unlock('pgtap-req-9999'::uuid, 'approve')$c$,
  NULL::text,
  'super_admin required'::text,
  'org-admin cannot resolve unlock'
);

-- ────────__ 3. unauthenticated → super_admin required ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_super_admin_resolve_unlock('pgtap-req-9999'::uuid, 'approve')$c$,
  NULL::text,
  'super_admin required'::text,
  'unauthenticated cannot resolve'
);

-- ────────__ 4. super-admin can approve unlock request ──────────
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_unlock_requests();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_super_admin_resolve_unlock((SELECT id FROM unlock_requests LIMIT 1), 'approve')$c$,
  'super-admin can approve unlock request'
);

-- ────────__ 5. super-admin can reject unlock request ──────────
SELECT lives_ok(
  $c$SELECT rpc_super_admin_resolve_unlock((SELECT id FROM unlock_requests WHERE id NOT IN (SELECT id FROM unlock_requests WHERE status = 'approved' LIMIT 1) LIMIT 1), 'reject')$c$,
  'super-admin can reject unlock request'
);

-- ────────__ 6. response has ok, request_id, decision ──────────
SELECT ok(
  (SELECT (rpc_super_admin_resolve_unlock((SELECT id FROM unlock_requests WHERE status = 'pending' LIMIT 1), 'approve')::jsonb ? 'ok')
       AND (rpc_super_admin_resolve_unlock((SELECT id FROM unlock_requests WHERE status = 'pending' LIMIT 1), 'approve')::jsonb ? 'request_id')
       AND (rpc_super_admin_resolve_unlock((SELECT id FROM unlock_requests WHERE status = 'pending' LIMIT 1), 'approve')::jsonb ? 'decision')),
  'response has ok, request_id, decision keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
