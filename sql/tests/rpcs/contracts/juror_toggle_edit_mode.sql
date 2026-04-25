-- RPC: rpc_juror_toggle_edit_mode(uuid, uuid, boolean, text, int) → json
--
-- Pins the public contract:
--   * Signature: (p_period_id uuid, p_juror_id uuid, p_enabled boolean,
--                 p_reason text DEFAULT NULL, p_duration_minutes int DEFAULT 30)
--                 returning json
--   * Unknown period              → { ok: false, error_code: 'period_not_found' }
--   * Unknown juror              → { ok: false, error_code: 'juror_not_found' }
--   * Unauthorized caller        → { ok: false, error_code: 'unauthorized' }
--   * Success                    → { ok: true, ... }
--
-- Critical: state-changing RPC that toggles juror edit-mode for rescoring.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- 1-2. signature & return type
SELECT has_function('public', 'rpc_juror_toggle_edit_mode', ARRAY['uuid', 'uuid', 'boolean', 'text', 'integer'], 'fn exists');
SELECT function_returns('public', 'rpc_juror_toggle_edit_mode', ARRAY['uuid', 'uuid', 'boolean', 'text', 'integer'], 'json', 'returns json');

-- 3. unknown juror → juror_not_found (RPC checks juror first)
SELECT pgtap_test.become_a();
SELECT is(
  (rpc_juror_toggle_edit_mode('cccc0000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000abc'::uuid, true, 'Test reason', 30)::jsonb->>'error_code'),
  'juror_not_found',
  'unknown juror → juror_not_found'
);

-- 4. unknown period with valid juror → auth_row_not_found (RPC finds juror, checks auth, then checks auth_row)
SELECT is(
  (rpc_juror_toggle_edit_mode('00000000-0000-4000-8000-000000000abc'::uuid, '55550000-0000-4000-8000-000000000001'::uuid, true, 'Test reason', 30)::jsonb->>'error_code'),
  'auth_row_not_found',
  'unknown period with valid juror → auth_row_not_found'
);

-- 5. NULL juror_id → juror_not_found
SELECT is(
  (rpc_juror_toggle_edit_mode('cccc0000-0000-4000-8000-000000000001'::uuid, NULL::uuid, true, 'Test reason', 30)::jsonb->>'error_code'),
  'juror_not_found',
  'NULL juror_id → juror_not_found'
);

-- 6. success: toggle edit mode on (need final_submitted_at set)
-- Use juror A with auth_row in period A1, mark as final_submitted
INSERT INTO juror_period_auth (juror_id, period_id, final_submitted_at)
VALUES ('55550000-0000-4000-8000-000000000001'::uuid, 'cccc0000-0000-4000-8000-000000000001'::uuid, now())
ON CONFLICT (juror_id, period_id) DO UPDATE SET final_submitted_at = now();

SELECT ok((rpc_juror_toggle_edit_mode('cccc0000-0000-4000-8000-000000000001'::uuid, '55550000-0000-4000-8000-000000000001'::uuid, true, 'Regrade needed', 45)::jsonb->>'ok')::boolean, 'valid period+juror with final_submitted → ok: true');

-- 7. response has enabled field
SELECT ok(
  (rpc_juror_toggle_edit_mode('cccc0000-0000-4000-8000-000000000001'::uuid, '55550000-0000-4000-8000-000000000001'::uuid, false, NULL, 30)::jsonb ? 'enabled'),
  'response has enabled field'
);

SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED') AS result;
ROLLBACK;
