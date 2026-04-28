-- RPC: rpc_jury_finalize_submission(p_period_id uuid, p_juror_id uuid, p_session_token text, p_correlation_id uuid) → json
--
-- Contract (005_rpcs_jury.sql):
--   * Unknown juror/period combo   → { ok: false, error_code: 'session_not_found' }
--   * Wrong session token          → { ok: false, error_code: 'invalid_session' }
--   * Valid call                   → sets final_submitted_at, edit_enabled=false;
--                                    writes evaluation.complete audit row
--                                    → { ok: true }
--   * Idempotent repeat call       → ok: true again; final_submitted_at still set
--
-- State-mutation test: verifies the side-effects that a contract-only test cannot
-- assert (final_submitted_at IS NOT NULL, edit_enabled=false, audit row written).

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_jurors();
SELECT pgtap_test.seed_periods();

-- Seed a juror_period_auth row for Juror A / Period A1 with a known session token.
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, edit_enabled) VALUES
  ('55550000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   encode(digest('pgtap-session-token-a', 'sha256'), 'hex'),
   false);

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unknown juror/period → session_not_found
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_jury_finalize_submission(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     '00000000-0000-4000-8000-000000000abc'::uuid,
     'any-token',
     NULL
   )->>'error_code'),
  'session_not_found'::text,
  'unknown juror/period combo returns session_not_found'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Correct juror/period but wrong token → invalid_session
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'wrong-token',
     NULL
   )->>'error_code'),
  'invalid_session'::text,
  'wrong session token returns invalid_session'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Valid call → ok: true
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'pgtap-session-token-a',
     NULL
   )->>'ok'),
  'true'::text,
  'valid finalize call returns ok=true'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. final_submitted_at set after finalize
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT final_submitted_at IS NOT NULL
     FROM juror_period_auth
    WHERE juror_id  = '55550000-0000-4000-8000-000000000001'::uuid
      AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  'final_submitted_at set after finalize'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. edit_enabled set to false
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT edit_enabled::text
     FROM juror_period_auth
    WHERE juror_id  = '55550000-0000-4000-8000-000000000001'::uuid
      AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  'false'::text,
  'edit_enabled=false after finalize'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Idempotency: second call also returns ok: true
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_jury_finalize_submission(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid,
     'pgtap-session-token-a',
     NULL
   )->>'ok'),
  'true'::text,
  'second finalize call is idempotent (ok=true)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. final_submitted_at still set after idempotent second call
--    (now() is transaction-stable so the value is identical to the first call)
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT final_submitted_at IS NOT NULL
     FROM juror_period_auth
    WHERE juror_id  = '55550000-0000-4000-8000-000000000001'::uuid
      AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  'final_submitted_at still set after idempotent second call'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. evaluation.complete audit row written
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1 FROM audit_logs
     WHERE action      = 'evaluation.complete'
       AND resource_id = '55550000-0000-4000-8000-000000000001'::uuid
  ),
  'evaluation.complete audit row written'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
