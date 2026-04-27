-- RPC: rpc_jury_upsert_score(period_id, project_id, juror_id, session_token, scores, comment)
--
-- Contract:
--   * Bad session token → { ok: false, error_code: 'invalid_session' }
--   * No auth row       → { ok: false, error_code: 'session_not_found' }
--   * Valid session + matching criterion key → score_sheet + score_sheet_items
--     upserted; returns { ok: true, score_sheet_id, total }.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_projects();

-- Snapshot criterion required for score_sheet_items FK.
INSERT INTO period_criteria (id, period_id, key, label, max_score, weight, sort_order) VALUES
  ('a1110000-0000-4000-8000-0000000000aa'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'technical', 'Technical', 10, 1.0, 1)
ON CONFLICT (id) DO NOTHING;

-- Mint juror + PIN, then verify once to capture session_token.
CREATE TEMP TABLE _pgtap_ctx (juror_id uuid, session_token text) ON COMMIT DROP;

INSERT INTO _pgtap_ctx (juror_id, session_token)
SELECT
  (v->>'juror_id')::uuid,
   v->>'session_token'
FROM (
  WITH mint AS (
    SELECT (rpc_jury_authenticate(
      'cccc0000-0000-4000-8000-000000000001'::uuid,
      'pgtap Juror Score', 'pgtap dept', false, NULL
    )->>'pin_plain_once') AS pin
  )
  SELECT rpc_jury_verify_pin(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap Juror Score', 'pgtap dept',
    (SELECT pin FROM mint)
  ) AS v
) s;

-- ────────── 1. invalid_session on garbage token ──────────
SELECT is(
  (SELECT rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     (SELECT juror_id FROM _pgtap_ctx),
     'pgtap-garbage-session-token'::text,
     '[{"key":"technical","value":5}]'::jsonb,
     NULL
   )->>'error_code'),
  'invalid_session'::text,
  'garbage session_token → error_code=invalid_session'::text
);

-- ────────── 2. session_not_found on juror w/o auth row ──────────
SELECT is(
  (SELECT rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     '99999999-9999-4000-8000-999999999999'::uuid,
     'whatever'::text,
     '[{"key":"technical","value":5}]'::jsonb,
     NULL
   )->>'error_code'),
  'session_not_found'::text,
  'juror with no auth row → error_code=session_not_found'::text
);

-- ────────── 3. happy path: upsert returns ok=true ──────────
SELECT is(
  (SELECT (rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     (SELECT juror_id FROM _pgtap_ctx),
     (SELECT session_token FROM _pgtap_ctx),
     '[{"key":"technical","value":7}]'::jsonb,
     'pgtap-comment'
   )->>'ok')::boolean),
  true,
  'valid session → ok=true'::text
);

-- ────────── 4. score_sheet row created ──────────
SELECT is(
  (SELECT count(*)::int FROM score_sheets
   WHERE juror_id = (SELECT juror_id FROM _pgtap_ctx)
     AND project_id = '33330000-0000-4000-8000-000000000001'::uuid),
  1,
  'score_sheet row created for (juror, project)'::text
);

-- ────────── 5. score_sheet_items row created with expected value ──────────
SELECT is(
  (SELECT score_value FROM score_sheet_items
   WHERE score_sheet_id IN (
     SELECT id FROM score_sheets
     WHERE juror_id = (SELECT juror_id FROM _pgtap_ctx)
       AND project_id = '33330000-0000-4000-8000-000000000001'::uuid
   )),
  7::numeric,
  'score_sheet_items row holds the submitted value'::text
);

-- ────────── post-submit lock: simulate final submission ──────────
-- Set final_submitted_at on the juror_period_auth row. edit_enabled stays at
-- its default (false). This mirrors what rpc_jury_finalize_submission writes.
UPDATE juror_period_auth
SET final_submitted_at = now()
WHERE juror_id = (SELECT juror_id FROM _pgtap_ctx)
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

-- ────────── 6. post-submit upsert returns final_submit_required ──────────
SELECT is(
  (SELECT (rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     (SELECT juror_id FROM _pgtap_ctx),
     (SELECT session_token FROM _pgtap_ctx),
     '[{"key":"technical","value":9}]'::jsonb,
     'pgtap-tampering-attempt'
   )->>'error_code'),
  'final_submit_required'::text,
  'final_submitted_at set + edit_enabled=false → error_code=final_submit_required'::text
);

-- ────────── 7. score_sheet_items value unchanged (still 7, not 9) ──────────
SELECT is(
  (SELECT score_value FROM score_sheet_items
   WHERE score_sheet_id IN (
     SELECT id FROM score_sheets
     WHERE juror_id = (SELECT juror_id FROM _pgtap_ctx)
       AND project_id = '33330000-0000-4000-8000-000000000001'::uuid
   )),
  7::numeric,
  'rejected upsert leaves score_value untouched'::text
);

-- ────────── 8. idempotent reject: second call still final_submit_required ──────────
SELECT is(
  (SELECT (rpc_jury_upsert_score(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '33330000-0000-4000-8000-000000000001'::uuid,
     (SELECT juror_id FROM _pgtap_ctx),
     (SELECT session_token FROM _pgtap_ctx),
     '[{"key":"technical","value":9}]'::jsonb,
     NULL
   )->>'error_code'),
  'final_submit_required'::text,
  'second call after final_submitted_at also rejects (idempotent)'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
