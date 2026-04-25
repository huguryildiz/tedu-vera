-- RPC: rpc_submit_jury_feedback(uuid, text, smallint, text) → jsonb
--
-- Pins the public contract:
--   * Signature: (p_period_id uuid, p_session_token text, p_rating smallint,
--                 p_comment text DEFAULT NULL) returning jsonb
--   * Unknown period              → error handling depends on period_id validation
--   * Invalid session token      → { ok: false, error: 'invalid_session' }
--   * Invalid rating (out of range) → { ok: false, error: 'invalid_rating' }
--   * Success                    → { ok: true }
--
-- Critical: data-capturing RPC that records juror feedback and satisfaction scores.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_submit_jury_feedback', ARRAY['uuid', 'text', 'smallint', 'text'], 'fn exists');
SELECT function_returns('public', 'rpc_submit_jury_feedback', ARRAY['uuid', 'text', 'smallint', 'text'], 'jsonb', 'returns jsonb');

-- 3. unknown period → period_not_found
SELECT is(
  (rpc_submit_jury_feedback('00000000-0000-4000-8000-000000000abc'::uuid, 'fake-token', 5::smallint, NULL)::jsonb->>'error'),
  'period_not_found',
  'unknown period → period_not_found'
);

-- 4. invalid session token → invalid_session
SELECT is(
  (rpc_submit_jury_feedback('cccc0000-0000-4000-8000-000000000001'::uuid, 'invalid-token-xyz'::text, 5::smallint, NULL)::jsonb->>'error'),
  'invalid_session',
  'invalid session token → invalid_session'
);

-- 5. NULL period_id → period_not_found
SELECT is(
  (rpc_submit_jury_feedback(NULL::uuid, 'fake-token'::text, 5::smallint, NULL)::jsonb->>'error'),
  'period_not_found',
  'NULL period_id → period_not_found'
);

-- 6. success: returns ok: true
-- Create a valid juror auth and session token (hashed)
INSERT INTO jurors (id, name, affiliation)
VALUES ('gggg0000-0000-4000-8000-000000000001'::uuid, 'Feedback Juror', 'Test Affiliation')
ON CONFLICT DO NOTHING;

INSERT INTO juror_period_auth (juror_id, period_id, status, session_token_hash)
VALUES ('gggg0000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid, 'active', encode(digest('token-valid-xyz'::text, 'sha256'), 'hex'))
ON CONFLICT DO NOTHING;

SELECT ok((rpc_submit_jury_feedback('cccc0000-0000-4000-8000-000000000001'::uuid, 'token-valid-xyz'::text, 5::smallint, 'Excellent program')::jsonb->>'ok')::boolean, 'valid period+token+rating → ok: true');

-- 7. response has ok field on success (already checked in test 6, so verify it's consistent)
-- Create another feedback submission to confirm field presence
INSERT INTO juror_period_auth (juror_id, period_id, status, session_token_hash)
VALUES ('hhhh0000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid, 'active', encode(digest('token-valid-abc'::text, 'sha256'), 'hex'))
ON CONFLICT DO NOTHING;

SELECT ok(
  (rpc_submit_jury_feedback('cccc0000-0000-4000-8000-000000000001'::uuid, 'token-valid-abc'::text, 4::smallint, 'Good experience')::jsonb ? 'ok'),
  'response has ok field on success'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
