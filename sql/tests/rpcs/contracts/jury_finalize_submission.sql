-- RPC: rpc_jury_finalize_submission(uuid, uuid, text, uuid) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_juror_id uuid, p_session_token text,
--                 p_correlation_id uuid DEFAULT NULL) returning json
--   * Unknown juror/period pair       → { ok: false, error_code: 'session_not_found' }
--   * Wrong session token             → { ok: false, error_code: 'invalid_session' }
--   * Blocked juror                   → { ok: false, error_code: 'juror_blocked' }
--   * Integrity guard:
--       - Zero assigned sheets        → { ok: false, error_code: 'incomplete_evaluations' }
--       - Some sheets not 'submitted' → { ok: false, error_code: 'incomplete_evaluations' }
--       - All sheets 'submitted'      → { ok: true } and final_submitted_at is set
--
-- Contract drift (shape, error codes, signature) is the main risk this test
-- guards against — the admin UI + jury client rely on the { ok, error_code }
-- envelope. See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(12);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();
SELECT pgtap_test.seed_projects();

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

-- ────────── 5. integrity guard: zero assigned sheets → incomplete_evaluations ──────────
-- Unblock juror but DO NOT seed any score_sheets — RPC must reject.
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
   )::jsonb->>'error_code'),
  'incomplete_evaluations',
  'zero assigned sheets → error_code incomplete_evaluations'
);

SELECT is(
  (SELECT final_submitted_at FROM juror_period_auth
   WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
     AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  NULL::timestamptz,
  'rejected finalize must NOT write final_submitted_at'
);

-- ────────── 6. integrity guard: some sheets in_progress → incomplete_evaluations ──────────
-- Seed a second project in period A so we can have two sheets for this juror.
INSERT INTO projects (id, period_id, title, advisor_name) VALUES
  ('33330000-0000-4000-8000-000000000003'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid, 'pgtap Project A2', 'Advisor A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO score_sheets (id, juror_id, project_id, period_id, status) VALUES
  ('88880000-0000-4000-8000-000000000001'::uuid,
   '55550000-0000-4000-8000-000000000001'::uuid,
   '33330000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'submitted'),
  ('88880000-0000-4000-8000-000000000002'::uuid,
   '55550000-0000-4000-8000-000000000001'::uuid,
   '33330000-0000-4000-8000-000000000003'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'in_progress')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb->>'error_code'),
  'incomplete_evaluations',
  'one in_progress sheet → error_code incomplete_evaluations'
);

-- ────────── 7. happy path: all sheets submitted → ok=true + final_submitted_at written ──────────
UPDATE score_sheets SET status = 'submitted'
WHERE id IN (
  '88880000-0000-4000-8000-000000000001'::uuid,
  '88880000-0000-4000-8000-000000000002'::uuid
);

SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb->>'ok'),
  'true',
  'all sheets submitted → ok=true (3 args, default correlation_id)'
);

SELECT isnt(
  (SELECT final_submitted_at FROM juror_period_auth
   WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
     AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  NULL::timestamptz,
  'happy path writes final_submitted_at to juror_period_auth'
);

-- ────────── 8. response envelope shape ──────────
SELECT ok(
  (SELECT (rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'real-session-token'
   )::jsonb ? 'ok')),
  'response envelope has ok field'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
