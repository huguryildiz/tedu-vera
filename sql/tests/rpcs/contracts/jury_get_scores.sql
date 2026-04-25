-- RPC: rpc_jury_get_scores(uuid, uuid, text) → jsonb
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_juror_id uuid, p_session_token text)
--                returning jsonb
--   * Unknown juror/period       → { ok: false, error_code: 'session_not_found' }
--   * Wrong session token        → { ok: false, error_code: 'invalid_session' }
--   * Expired session            → { ok: false, error_code: 'session_expired' }
--   * Valid session              → { ok: true, sheets: [...] }
--
-- This RPC is called on every resume/reload in the jury client — shape drift
-- here immediately breaks score display. See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_get_scores',
  ARRAY['uuid', 'uuid', 'text'],
  'rpc_jury_get_scores(uuid,uuid,text) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_get_scores',
  ARRAY['uuid', 'uuid', 'text'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. unknown juror/period ──────────
SELECT is(
  (SELECT rpc_jury_get_scores(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '00000000-0000-4000-8000-000000000999'::uuid,
     'irrelevant'
   )->>'error_code'),
  'session_not_found',
  'unknown juror → session_not_found'
);

-- Seed a valid auth row for the remaining cases.
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, session_expires_at) VALUES
  ('55550000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   encode(digest('valid-token', 'sha256'), 'hex'),
   now() + interval '1 hour')
ON CONFLICT (juror_id, period_id) DO UPDATE SET
  session_token_hash = EXCLUDED.session_token_hash,
  session_expires_at = EXCLUDED.session_expires_at;

-- ────────── 3. wrong token ──────────
SELECT is(
  (SELECT rpc_jury_get_scores(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'wrong-token'
   )->>'error_code'),
  'invalid_session',
  'wrong token → invalid_session'
);

-- ────────── 4. expired session ──────────
UPDATE juror_period_auth
SET session_expires_at = now() - interval '1 minute'
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (SELECT rpc_jury_get_scores(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'valid-token'
   )->>'error_code'),
  'session_expired',
  'expired session → session_expired'
);

-- ────────── 5. valid session → ok=true + sheets key ──────────
UPDATE juror_period_auth
SET session_expires_at = now() + interval '1 hour'
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (SELECT rpc_jury_get_scores(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'valid-token'
   )->>'ok'),
  'true',
  'valid session → ok=true'
);

SELECT ok(
  (SELECT rpc_jury_get_scores(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'valid-token'
   ) ? 'sheets'),
  'valid response has sheets key'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
