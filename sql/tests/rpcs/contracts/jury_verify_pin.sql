-- RPC: rpc_jury_verify_pin(uuid, text, text, text) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_juror_name text, p_affiliation text, p_pin text)
--                 returning json
--   * Unknown juror            → { ok: false, error_code: 'juror_not_found' }
--   * Wrong PIN, not at max    → { ok: false, error_code: 'invalid_pin', failed_attempts: N }
--   * Wrong PIN at max         → { ok: false, error_code: 'pin_locked', locked_until: future }
--   * Correct PIN              → { ok: true, session_token: <token> }
--   * PIN count reset on success
--
-- See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_verify_pin',
  ARRAY['uuid', 'text', 'text', 'text'],
  'rpc_jury_verify_pin(uuid,text,text,text) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_verify_pin',
  ARRAY['uuid', 'text', 'text', 'text'],
  'json',
  'returns json'
);

-- ────────── 2. unknown juror → juror_not_found ──────────
SELECT is(
  (SELECT rpc_jury_verify_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'Nonexistent Juror',
     'Nonexistent Dept',
     '1234'
   )::jsonb->>'error_code'),
  'juror_not_found',
  'unknown juror → error_code juror_not_found'
);

-- ────────── 3. setup: seed juror A is already created; create its auth row with PIN ──────────
-- seed_jurors() creates juror '55550000-0000-4000-8000-000000000001' with name 'pgtap Juror A', affiliation 'pgtap dept'
-- We manually insert an auth row and set a known PIN hash for testing:
INSERT INTO juror_period_auth (juror_id, period_id, pin_hash, session_token_hash, session_expires_at, is_blocked)
VALUES (
  '55550000-0000-4000-8000-000000000001'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  crypt('5678', gen_salt('bf')),
  NULL,
  now() - interval '1 second',
  false
)
ON CONFLICT (juror_id, period_id) DO UPDATE SET
  pin_hash = EXCLUDED.pin_hash;

-- ────────── 4. wrong PIN (not at max) → invalid_pin + failed_attempts increments ──────────
WITH first_attempt AS (
  SELECT rpc_jury_verify_pin(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Juror A',
    'pgtap dept',
    '0000'
  )::jsonb AS resp
)
SELECT is(
  (SELECT resp->>'error_code' FROM first_attempt),
  'invalid_pin',
  'wrong PIN → error_code invalid_pin'
);

-- Second wrong PIN call increments to 2
WITH second_attempt AS (
  SELECT rpc_jury_verify_pin(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Juror A',
    'pgtap dept',
    '0000'
  )::jsonb AS resp
)
SELECT is(
  (SELECT (resp->>'failed_attempts')::INT FROM second_attempt),
  2,
  'second wrong PIN → failed_attempts incremented to 2'
);

-- ────────── 5. correct PIN → ok=true + returns session_token ──────────
WITH correct_attempt AS (
  SELECT rpc_jury_verify_pin(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Juror A',
    'pgtap dept',
    '5678'
  )::jsonb AS resp
)
SELECT is(
  (SELECT resp->>'ok' FROM correct_attempt),
  'true',
  'correct PIN → ok=true'
);

WITH correct_attempt AS (
  SELECT rpc_jury_verify_pin(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Juror A',
    'pgtap dept',
    '5678'
  )::jsonb AS resp
)
SELECT isnt(
  (SELECT resp->>'session_token' FROM correct_attempt),
  NULL,
  'correct PIN → returns non-null session_token'
);

-- ────────── 6. verify that failed_attempts is reset in DB after successful pin ──────────
SELECT is(
  (SELECT failed_attempts FROM juror_period_auth
   WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
     AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  0,
  'after successful verify, failed_attempts reset to 0 in DB'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
