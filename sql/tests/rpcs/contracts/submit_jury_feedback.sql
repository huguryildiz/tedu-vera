-- RPC: rpc_submit_jury_feedback(uuid, text, smallint, text) → jsonb
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_session_token text, p_rating smallint,
--                 p_comment text DEFAULT NULL) returning jsonb
--   * Unknown / blocked / invalid session token → { ok:false, error:'invalid_session' }
--   * NULL period_id (no matching row)          → invalid_session
--   * Rating outside 1..5                       → { ok:false, error:'invalid_rating' }
--   * Success                                   → { ok:true } and upserts a
--                                                 jury_feedback row keyed on
--                                                 (period_id, juror_id)
--
-- Critical: jury day data-capture path. Drives satisfaction analytics + the
-- public feedback strip on the landing page.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- Seed a valid juror_period_auth row for juror A in period A1 with a hashed
-- session token we can submit against. juror_period_auth has no `status`
-- column; the previous test asserted it and aborted setup. Required columns
-- are juror_id + period_id; session_token_hash carries the lookup key.
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash)
VALUES (
  '55550000-0000-4000-8000-000000000001'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  encode(digest('pgtap-feedback-token'::text, 'sha256'), 'hex')
)
ON CONFLICT (juror_id, period_id) DO UPDATE
  SET session_token_hash = EXCLUDED.session_token_hash;

-- ────────── 1-2. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_submit_jury_feedback',
  ARRAY['uuid', 'text', 'smallint', 'text'],
  'rpc_submit_jury_feedback(uuid,text,smallint,text) exists'
);

SELECT function_returns(
  'public', 'rpc_submit_jury_feedback',
  ARRAY['uuid', 'text', 'smallint', 'text'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 3. unknown period + any token → invalid_session ──────────
SELECT is(
  (rpc_submit_jury_feedback(
    '00000000-0000-4000-8000-000000000abc'::uuid,
    'fake-token',
    5::smallint,
    NULL
  )::jsonb->>'error'),
  'invalid_session',
  'unknown period → no auth row → error=invalid_session'
);

-- ────────── 4. valid period + invalid token → invalid_session ──────────
SELECT is(
  (rpc_submit_jury_feedback(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'invalid-token-xyz',
    5::smallint,
    NULL
  )::jsonb->>'error'),
  'invalid_session',
  'token hash mismatch → error=invalid_session'
);

-- ────────── 5. NULL period_id + any token → invalid_session ──────────
-- WHERE period_id = NULL matches no row → invalid_session envelope.
SELECT is(
  (rpc_submit_jury_feedback(
    NULL::uuid,
    'pgtap-feedback-token',
    5::smallint,
    NULL
  )::jsonb->>'error'),
  'invalid_session',
  'NULL period_id → error=invalid_session'
);

-- ────────── 6. rating below 1 → invalid_rating ──────────
SELECT is(
  (rpc_submit_jury_feedback(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap-feedback-token',
    0::smallint,
    NULL
  )::jsonb->>'error'),
  'invalid_rating',
  'rating 0 (< 1) → error=invalid_rating'
);

-- ────────── 7. success: ok=true ──────────
SELECT is(
  (rpc_submit_jury_feedback(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap-feedback-token',
    5::smallint,
    'Excellent program'
  )::jsonb->>'ok'),
  'true',
  'valid period + token + rating → ok=true'
);

-- ────────── 8. success envelope shape ──────────
-- Re-submit (ON CONFLICT DO UPDATE path) and confirm response carries 'ok'.
SELECT ok(
  (rpc_submit_jury_feedback(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap-feedback-token',
    4::smallint,
    'Good experience'
  )::jsonb ? 'ok'),
  'success response carries ok field'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
