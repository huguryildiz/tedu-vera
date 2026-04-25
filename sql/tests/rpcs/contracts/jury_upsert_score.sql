-- RPC: rpc_jury_upsert_score(uuid, uuid, uuid, text, jsonb, text) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_project_id uuid, p_juror_id uuid,
--                 p_session_token text, p_scores jsonb, p_comment text DEFAULT NULL)
--                 returning json
--   * Invalid session token     → { ok: false, error_code: 'invalid_session' }
--   * Valid session             → { ok: true, score_sheet_id: uuid, total: numeric }
--   * Locked/closed period      → { ok: false, error_code: 'period_closed' }
--   * Juror blocked             → { ok: false, error_code: 'juror_blocked' }
--   * Idempotent on same (juror_id, project_id) key
--
-- See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();
SELECT pgtap_test.seed_projects();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_upsert_score',
  ARRAY['uuid', 'uuid', 'uuid', 'text', 'jsonb', 'text'],
  'rpc_jury_upsert_score(uuid,uuid,uuid,text,jsonb,text) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_upsert_score',
  ARRAY['uuid', 'uuid', 'uuid', 'text', 'jsonb', 'text'],
  'json',
  'returns json'
);

-- ────────── 2. setup: create valid session token ──────────
-- Create juror_period_auth directly with known session token
-- (rpc_jury_authenticate may create new jurors with generated UUIDs)
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, session_expires_at)
VALUES ('55550000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid,
        encode(digest('test-session-token', 'sha256'), 'hex'), now() + interval '12 hours')
ON CONFLICT (juror_id, period_id) DO UPDATE SET
  session_token_hash = encode(digest('test-session-token', 'sha256'), 'hex'),
  session_expires_at = now() + interval '12 hours';

-- We also need at least one criterion in the period for scoring
INSERT INTO period_criteria (period_id, key, label, max_score, weight)
VALUES ('cccc0000-0000-4000-8000-000000000001'::uuid, 'design', 'Design', 10, 1)
ON CONFLICT DO NOTHING;

-- ────────── 3. invalid session token → error ──────────
SELECT is(
  (SELECT rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'wrong-session-token',
     '[]'::jsonb,
     NULL
   )::jsonb->>'error_code'),
  'invalid_session',
  'wrong session token → error_code invalid_session'
);

-- ────────── 4. valid session → ok=true + returns score_sheet_id ──────────
SELECT is(
  (SELECT rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'test-session-token',
     '[{"key":"design","value":"8"}]'::jsonb,
     'Test comment'
   )::jsonb->>'ok'),
  'true',
  'valid session → ok=true'
);

SELECT isnt(
  (SELECT (rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'test-session-token',
     '[{"key":"design","value":"7"}]'::jsonb,
     NULL
   )::jsonb->>'score_sheet_id')),
  NULL,
  'valid session → returns non-null score_sheet_id'
);

-- ────────── 5. return shape includes total (numeric) ──────────
SELECT ok(
  (SELECT (rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'test-session-token',
     '[{"key":"design","value":"9"}]'::jsonb,
     NULL
   )::jsonb ? 'total')),
  'response envelope has total field'
);

-- ────────── 6. idempotent: same (juror_id, project_id) updates existing row ──────────
-- First write (wrap in DO so the result is discarded; PERFORM is PL/pgSQL-only)
DO $$ BEGIN
  PERFORM rpc_jury_upsert_score(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '33330000-0000-4000-8000-000000000001'::uuid,
    '55550000-0000-4000-8000-000000000001'::uuid,
    'test-session-token',
    '[{"key":"design","value":"5"}]'::jsonb,
    'First comment'
  );
END $$;

-- Second write with same key: should update, not insert duplicate
SELECT is(
  (SELECT COUNT(*)::INT FROM score_sheets
   WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
     AND project_id = '33330000-0000-4000-8000-000000000001'::uuid),
  1,
  'second write to same (juror, project) updates, not inserts'
);

-- ────────── 7. blocked juror → error ──────────
-- Block the juror
UPDATE juror_period_auth
SET is_blocked = true
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (SELECT rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'test-session-token',
     '[{"key":"design","value":"6"}]'::jsonb,
     NULL
   )::jsonb->>'error_code'),
  'juror_blocked',
  'blocked juror → error_code juror_blocked'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
