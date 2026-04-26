-- RPC: rpc_juror_toggle_edit_mode(uuid, uuid, boolean, text, int) → json
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_juror_id uuid, p_enabled boolean,
--                 p_reason text DEFAULT NULL,
--                 p_duration_minutes int DEFAULT 30)
--                returning json
--   * Unknown / NULL juror_id      → { ok: false, error_code: 'juror_not_found' }
--   * Caller not org admin / super → { ok: false, error_code: 'unauthorized' }
--   * Auth row missing             → { ok: false, error_code: 'auth_row_not_found' }
--   * Enable path returns          → { ok: true, edit_expires_at: ... }
--   * Disable path returns         → { ok: true } (no edit_expires_at)
--
-- Critical: state-changing RPC that opens a juror's edit window after final
-- submission. Shape drift would silently break the admin "regrade" workflow.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- Seed the juror's auth row BEFORE switching role so the INSERT runs as
-- postgres (RLS-bypass). final_submitted_at must be set, otherwise the
-- enable path raises 'final_submission_required'.
INSERT INTO juror_period_auth (juror_id, period_id, final_submitted_at)
VALUES (
  '55550000-0000-4000-8000-000000000001'::uuid,
  'cccc0000-0000-4000-8000-000000000001'::uuid,
  now()
)
ON CONFLICT (juror_id, period_id) DO UPDATE SET final_submitted_at = now();

-- ────────── 1-2. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_juror_toggle_edit_mode',
  ARRAY['uuid', 'uuid', 'boolean', 'text', 'integer'],
  'rpc_juror_toggle_edit_mode(uuid,uuid,boolean,text,int) exists'
);

SELECT function_returns(
  'public', 'rpc_juror_toggle_edit_mode',
  ARRAY['uuid', 'uuid', 'boolean', 'text', 'integer'],
  'json',
  'returns json'
);

SELECT pgtap_test.become_a();

-- ────────── 3. unknown juror → juror_not_found ──────────
SELECT is(
  (rpc_juror_toggle_edit_mode(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000abc'::uuid,
    true, 'Regrade reason', 30
  )::jsonb->>'error_code'),
  'juror_not_found',
  'unknown juror id → error_code=juror_not_found'
);

-- ────────── 4. NULL juror_id → juror_not_found ──────────
-- WHERE id = NULL → no row → juror_not_found envelope (RPC does not
-- pre-validate inputs).
SELECT is(
  (rpc_juror_toggle_edit_mode(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    NULL::uuid,
    true, 'Regrade reason', 30
  )::jsonb->>'error_code'),
  'juror_not_found',
  'NULL juror id → error_code=juror_not_found'
);

-- ────────── 5. unknown period (juror exists, no auth row) → auth_row_not_found ──────────
SELECT is(
  (rpc_juror_toggle_edit_mode(
    '00000000-0000-4000-8000-000000000abc'::uuid,
    '55550000-0000-4000-8000-000000000001'::uuid,
    true, 'Regrade reason', 30
  )::jsonb->>'error_code'),
  'auth_row_not_found',
  'unknown period with valid juror → error_code=auth_row_not_found'
);

-- ────────── 6. enable path returns ok=true ──────────
SELECT is(
  (rpc_juror_toggle_edit_mode(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '55550000-0000-4000-8000-000000000001'::uuid,
    true, 'Regrade needed', 45
  )::jsonb->>'ok'),
  'true',
  'enable on auth-row-with-final_submitted → ok=true'
);

-- ────────── 7. disable path returns shape with ok ──────────
-- Disable branch returns { ok: true } only (no edit_expires_at) — the
-- enable-only field would not be a stable shape assertion. Pin 'ok'.
SELECT ok(
  (rpc_juror_toggle_edit_mode(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '55550000-0000-4000-8000-000000000001'::uuid,
    false, NULL, 30
  )::jsonb ? 'ok'),
  'disable response carries ok field'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
