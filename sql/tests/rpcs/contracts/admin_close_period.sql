-- RPC: rpc_admin_close_period(uuid) → json
--
-- Pins the public contract:
--   * Signature: (p_period_id uuid) returning json
--   * Unknown period              → RAISE 'period_not_found'
--   * Unauthorized caller         → RAISE 'unauthorized'
--   * Period not published        → { ok: false, error_code: 'period_not_published' }
--   * Already closed              → { ok: true, already_closed: true, closed_at: ... }
--   * Success                     → { ok: true, already_closed: false, closed_at: ..., tokens_revoked: N }
--
-- Critical: state-changing RPC that closes evaluation periods and revokes tokens.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(11);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_close_period',
  ARRAY['uuid'],
  'rpc_admin_close_period(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_close_period',
  ARRAY['uuid'],
  'json',
  'returns json'
);

-- ────────── 2. unknown period → period_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_close_period('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → period_not_found'
);

-- ────────── 3. unauthorized: non-admin caller cannot close period ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_close_period('cccc0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'non-org-admin caller → unauthorized'
);

-- ────────── 4. period not published (is_locked = false) → error_code ──────────
-- First insert an unlocked period
INSERT INTO periods (id, organization_id, name, is_locked)
VALUES ('dddd0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'Unpublished', false)
ON CONFLICT DO NOTHING;

SELECT pgtap_test.become_a();

SELECT is(
  (rpc_admin_close_period('dddd0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'),
  'period_not_published',
  'unpublished period → error_code: period_not_published'
);

-- ────────── 5. already closed → returns already_closed: true ──────────
-- Close the period once
DELETE FROM periods WHERE id = 'dddd0000-0000-4000-8000-000000000001'::uuid;
INSERT INTO periods (id, organization_id, name, is_locked, closed_at)
VALUES ('eeee0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'Already Closed', true, now())
ON CONFLICT DO NOTHING;

SELECT ok(
  (rpc_admin_close_period('eeee0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'already_closed')::boolean,
  'already-closed period → already_closed: true'
);

-- ────────── 6. success: returns ok: true and closed_at timestamp ──────────
DELETE FROM periods WHERE id = 'ffff0000-0000-4000-8000-000000000001'::uuid;
INSERT INTO periods (id, organization_id, name, is_locked, closed_at)
VALUES ('ffff0000-0000-4000-8000-000000000001'::uuid, '11110000-0000-4000-8000-000000000001'::uuid, 'To Close', true, NULL)
ON CONFLICT DO NOTHING;

SELECT ok(
  (rpc_admin_close_period('ffff0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean,
  'publishable period → ok: true'
);

SELECT isnt(
  (rpc_admin_close_period('ffff0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'closed_at'),
  NULL,
  'success → closed_at is not null'
);

-- ────────── 7. tokens_revoked count in response ──────────
SELECT ok(
  (rpc_admin_close_period('ffff0000-0000-4000-8000-000000000001'::uuid)::jsonb ? 'tokens_revoked'),
  'response envelope has tokens_revoked field'
);

-- ────────── 8. wrong param type (text instead of uuid) → error ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_close_period('not-a-uuid'::text::uuid)$c$,
  NULL::text,
  NULL::text,
  'invalid uuid cast → raises'
);

-- ────────── 9. NULL period_id → period_not_found ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_close_period(NULL::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'NULL period_id → period_not_found'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
