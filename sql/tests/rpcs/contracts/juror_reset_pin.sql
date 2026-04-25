-- RPC: rpc_juror_reset_pin(uuid, uuid) → json
--
-- Pins the public contract:
--   * Signature: (p_period_id uuid, p_juror_id uuid) returning json
--   * Unknown period              → { ok: false, error_code: 'period_not_found' }
--   * Unknown juror              → { ok: false, error_code: 'juror_not_found' }
--   * Unauthorized caller        → { ok: false, error_code: 'unauthorized' }
--   * Success                    → { ok: true, pin: ..., needs_pin: true }
--
-- Critical: state-changing RPC that resets juror PIN for re-authentication.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_juror_reset_pin', ARRAY['uuid', 'uuid'], 'fn exists');
SELECT function_returns('public', 'rpc_juror_reset_pin', ARRAY['uuid', 'uuid'], 'json', 'returns json');

-- 3. unknown period → period_not_found
SELECT pgtap_test.become_a();
SELECT is(
  (rpc_juror_reset_pin('00000000-0000-4000-8000-000000000abc'::uuid, 'aaaa0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'),
  'period_not_found',
  'unknown period → period_not_found'
);

-- 4. unknown juror → juror_not_found
SELECT is(
  (rpc_juror_reset_pin('cccc0000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000abc'::uuid)::jsonb->>'error_code'),
  'juror_not_found',
  'unknown juror → juror_not_found'
);

-- 5. NULL period_id → period_not_found
SELECT is(
  (rpc_juror_reset_pin(NULL::uuid, 'aaaa0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'error_code'),
  'period_not_found',
  'NULL period_id → period_not_found'
);

-- 6. NULL juror_id → juror_not_found
SELECT is(
  (rpc_juror_reset_pin('cccc0000-0000-4000-8000-000000000001'::uuid, NULL::uuid)::jsonb->>'error_code'),
  'juror_not_found',
  'NULL juror_id → juror_not_found'
);

-- 7. success: returns ok: true and new pin
-- First create a juror auth record for this period
INSERT INTO jurors (id, name, affiliation)
VALUES ('eeee0000-0000-4000-8000-000000000001'::uuid, 'Test Juror', 'Test Affiliation')
ON CONFLICT DO NOTHING;

INSERT INTO juror_period_auth (juror_id, period_id, status)
VALUES ('eeee0000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid, 'active')
ON CONFLICT DO NOTHING;

SELECT ok((rpc_juror_reset_pin('cccc0000-0000-4000-8000-000000000001'::uuid, 'eeee0000-0000-4000-8000-000000000001'::uuid)::jsonb->>'ok')::boolean, 'valid period+juror → ok: true');

-- 8. response has pin_plain_once field
SELECT ok(
  (rpc_juror_reset_pin('cccc0000-0000-4000-8000-000000000001'::uuid, 'eeee0000-0000-4000-8000-000000000001'::uuid)::jsonb ? 'pin_plain_once'),
  'response has pin_plain_once field'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
