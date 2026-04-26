-- RPC: rpc_jury_project_rankings + rpc_get_period_impact — scoring arithmetic
--
-- Pins the scoring math documented in sql/migrations/005_rpcs_jury.sql:
--
--   rpc_jury_project_rankings(p_period_id, p_session_token)
--     avg_score = ROUND(AVG(SUM(score_value per sheet)), 2)  — per project
--     All score_sheet rows for the period contribute regardless of calling juror.
--
--   rpc_get_period_impact(p_period_id, p_session_token)
--     avg_total  = ROUND(AVG(SUM(score_value per sheet)), 2)  — per project
--     Returned inside a JSONB envelope under the 'projects' key.
--
-- NOTE: Weighted scoring (score_value / max_score × 100 × weight / ΣW) lives
-- entirely in the front-end (src/shared/api/admin/scores.js).  These RPCs
-- return raw sums, not weighted averages.  Tests deliberately use concrete
-- integer values so rounding is deterministic.
--
-- Concrete arithmetic under test:
--   Juror A → criterion tech_a = 8, design_a = 6  → sheet total = 14
--   Juror C → criterion tech_a = 4, design_a = 2  → sheet total =  6
--   Expected avg across both sheets: ROUND(AVG(14, 6), 2) = 10.00
--
-- See docs/qa/vera-test-audit-report.md §9 P1-D1.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();
SELECT pgtap_test.seed_projects();
SELECT pgtap_test.seed_period_criteria();

-- ────────── Extra juror C for the multi-juror average test ──────────
INSERT INTO jurors (id, organization_id, juror_name, affiliation, email)
VALUES ('e5550000-0000-4000-8000-000000000099'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid,
        'pgtap Juror C', 'pgtap dept', 'pgtap_juror_c@test.local')
ON CONFLICT (id) DO NOTHING;

-- ────────── Session token for juror A (the caller for both RPCs) ──────────
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, session_expires_at)
VALUES ('55550000-0000-4000-8000-000000000001'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        encode(digest('test-scoring-token', 'sha256'), 'hex'),
        now() + interval '12 hours')
ON CONFLICT (juror_id, period_id) DO UPDATE SET
  session_token_hash = encode(digest('test-scoring-token', 'sha256'), 'hex'),
  session_expires_at = now() + interval '12 hours';

-- ────────── Score sheets ──────────
-- Juror A: tech_a=8, design_a=6 → sheet total = 14
INSERT INTO score_sheets (id, period_id, project_id, juror_id)
VALUES ('e1110000-0000-4000-8000-000000000001'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        '33330000-0000-4000-8000-000000000001'::uuid,
        '55550000-0000-4000-8000-000000000001'::uuid);

INSERT INTO score_sheet_items (score_sheet_id, period_criterion_id, score_value)
VALUES
  ('e1110000-0000-4000-8000-000000000001'::uuid,
   'a1110000-0000-4000-8000-000000000a01'::uuid, 8),  -- tech_a
  ('e1110000-0000-4000-8000-000000000001'::uuid,
   'a1110000-0000-4000-8000-000000000a02'::uuid, 6);  -- design_a

-- Juror C: tech_a=4, design_a=2 → sheet total = 6
INSERT INTO score_sheets (id, period_id, project_id, juror_id)
VALUES ('e1110000-0000-4000-8000-000000000002'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        '33330000-0000-4000-8000-000000000001'::uuid,
        'e5550000-0000-4000-8000-000000000099'::uuid);

INSERT INTO score_sheet_items (score_sheet_id, period_criterion_id, score_value)
VALUES
  ('e1110000-0000-4000-8000-000000000002'::uuid,
   'a1110000-0000-4000-8000-000000000a01'::uuid, 4),  -- tech_a
  ('e1110000-0000-4000-8000-000000000002'::uuid,
   'a1110000-0000-4000-8000-000000000a02'::uuid, 2);  -- design_a

-- ────────── 1. rpc_jury_project_rankings signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_project_rankings',
  ARRAY['uuid', 'text'],
  'rpc_jury_project_rankings(uuid, text) exists'
);

-- ────────── 2. rpc_get_period_impact signature pinned ──────────
SELECT has_function(
  'public', 'rpc_get_period_impact',
  ARRAY['uuid', 'text'],
  'rpc_get_period_impact(uuid, text) exists'
);

-- ────────── 3. rpc_jury_project_rankings: avg = ROUND(AVG(14,6), 2) = 10.00 ──────────
SELECT is(
  (SELECT avg_score
   FROM rpc_jury_project_rankings(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'test-scoring-token'
   )
   WHERE project_id = '33330000-0000-4000-8000-000000000001'::uuid),
  10.00::numeric,
  'rpc_jury_project_rankings: avg of (14,6) = 10.00 (ROUND(AVG(SUM(items)),2))'
);

-- ────────── 4. rpc_jury_project_rankings: exactly one project row for period ──────────
SELECT is(
  (SELECT COUNT(*)::int
   FROM rpc_jury_project_rankings(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'test-scoring-token'
   )),
  1,
  'rpc_jury_project_rankings returns exactly 1 row for single-project period'
);

-- ────────── 5. rpc_get_period_impact: project A avg_total = 10.00 ──────────
SELECT is(
  (SELECT (proj->>'avg_total')::numeric
   FROM jsonb_array_elements(
     rpc_get_period_impact(
       'cccc0000-0000-4000-8000-000000000001'::uuid,
       'test-scoring-token'
     )->'projects'
   ) AS proj
   WHERE (proj->>'id')::uuid = '33330000-0000-4000-8000-000000000001'::uuid),
  10.00::numeric,
  'rpc_get_period_impact: project A avg_total = ROUND(AVG(14,6),2) = 10.00'
);

-- ────────── 6. rpc_get_period_impact: total_projects = 1 ──────────
SELECT is(
  (rpc_get_period_impact(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'test-scoring-token'
   )->>'total_projects')::int,
  1,
  'rpc_get_period_impact total_projects = 1 for single-project period'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
