-- RPC: rpc_jury_finalize_submission(uuid, uuid, text, uuid) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_juror_id uuid, p_session_token text,
--                 p_correlation_id uuid DEFAULT NULL) returning json
--   * Unknown juror/period pair       → { ok: false, error_code: 'session_not_found' }
--   * Wrong session token             → { ok: false, error_code: 'invalid_session' }
--   * Blocked juror                   → { ok: false, error_code: 'juror_blocked' }
--
-- Contract drift (shape, error codes, signature) is the main risk this test
-- guards against — the admin UI + jury client rely on the { ok, error_code }
-- envelope. See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_finalize_submission',
  ARRAY['uuid', 'uuid', 'text', 'uuid'],
  'rpc_jury_finalize_submission(uuid,uuid,text,uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_finalize_submission',
  ARRAY['uuid', 'uuid', 'text', 'uuid'],
  'json',
  'returns json'
);

-- ────────── 2. unknown juror/period → session_not_found ──────────
SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '00000000-0000-4000-8000-000000000999'::uuid,
     'irrelevant'
   )::jsonb->>'ok'),
  'false',
  'unknown juror → ok=false'
);

SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '00000000-0000-4000-8000-000000000999'::uuid,
     'irrelevant'
   )::jsonb->>'error_code'),
  'session_not_found',
  'unknown juror → error_code session_not_found'
);

-- Seed a real juror_period_auth row so we can test invalid_session + juror_blocked.
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, session_expires_at, is_blocked) VALUES
  ('55550000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   encode(digest('real-session-token', 'sha256'), 'hex'),
   now() + interval '1 hour',
   false)
ON CONFLICT (juror_id, period_id) DO UPDATE SET
  session_token_hash = EXCLUDED.session_token_hash,
  session_expires_at = EXCLUDED.session_expires_at,
  is_blocked = false;

-- ────────── 3. wrong session token → invalid_session ──────────
SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'wrong-token'
   )::jsonb->>'error_code'),
  'invalid_session',
  'wrong session token → error_code invalid_session'
);

-- ────────── 4. blocked juror → juror_blocked ──────────
UPDATE juror_period_auth
SET is_blocked = true
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb->>'error_code'),
  'juror_blocked',
  'blocked juror → error_code juror_blocked'
);

-- ────────── 5. default 4th arg is optional ──────────
-- Verify the function can be called with 3 args (p_correlation_id defaults to NULL).
UPDATE juror_period_auth
SET is_blocked = false,
    final_submitted_at = NULL
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb->>'ok'),
  'true',
  'valid session (3 args, default correlation_id) → ok=true'
);

-- ────────── 6. return shape includes ok field on success ──────────
UPDATE juror_period_auth
SET final_submitted_at = NULL
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT ok(
  (SELECT (rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb ? 'ok')),
  'response envelope has ok field'
);

-- ────────── 9. state mutation: final_submitted_at written ──────────
-- Reset so we can call the RPC and observe the DB side-effect.
UPDATE juror_period_auth
SET final_submitted_at = NULL
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT ok(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb->>'ok') = 'true',
  'pre-condition: rpc call returned ok=true for state mutation test'
);

-- The RPC must have written final_submitted_at.
SELECT isnt(
  (SELECT final_submitted_at FROM juror_period_auth
   WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
     AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  NULL::timestamptz,
  'rpc_jury_finalize_submission writes final_submitted_at to juror_period_auth'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
