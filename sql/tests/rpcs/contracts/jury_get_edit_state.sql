-- RPC: rpc_jury_get_edit_state(UUID, UUID) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_juror_id uuid, p_period_id uuid) returning json
--   * No auth required (anon + authenticated)
--   * Session not found → {ok: false, error_code: 'juror_session_not_found'}
--   * Session found     → {ok: true, edit_enabled, edit_expires_at, is_blocked,
--                           last_seen_at, final_submitted_at}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_get_edit_state',
  ARRAY['uuid', 'uuid'],
  'rpc_jury_get_edit_state(uuid,uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_get_edit_state',
  ARRAY['uuid', 'uuid'],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid)$c$,
  'anon role can call rpc_jury_get_edit_state'
);

-- ────────── 3. no session row → ok=false + juror_session_not_found ──────────
SELECT pgtap_test.become_reset();

SELECT is(
  (SELECT rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb->>'ok'),
  'false',
  'missing session → ok=false'
);

SELECT is(
  (SELECT rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb->>'error_code'),
  'juror_session_not_found',
  'missing session → error_code=juror_session_not_found'
);

-- ────────── 4. session exists → ok=true with expected shape ──────────
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, edit_enabled, is_blocked)
VALUES ('55550000-0000-4000-8000-000000000001'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        'pgtap-session-hash-001',
        true, false)
ON CONFLICT (juror_id, period_id) DO NOTHING;

SELECT is(
  (SELECT rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb->>'ok'),
  'true',
  'existing session → ok=true'
);

SELECT ok(
  (SELECT rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb ? 'edit_enabled'
    AND rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb ? 'is_blocked'),
  'session response has edit_enabled and is_blocked fields'
);

SELECT ok(
  (SELECT rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb ? 'last_seen_at'
    AND rpc_jury_get_edit_state(
    '55550000-0000-4000-8000-000000000001'::uuid,
    'cccc0000-0000-4000-8000-000000000001'::uuid
  )::jsonb ? 'final_submitted_at'),
  'session response has last_seen_at and final_submitted_at fields'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
