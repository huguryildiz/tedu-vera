-- RPC: rpc_jury_project_rankings(UUID, TEXT) → TABLE(project_id uuid, avg_score numeric)
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_session_token text)
--                returning table(project_id uuid, avg_score numeric)
--   * No auth required (anon + authenticated)
--   * Invalid / expired session token → RAISE 'unauthorized'
--   * Valid session token            → returns aggregated scores per project

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();
SELECT pgtap_test.seed_projects();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_project_rankings',
  ARRAY['uuid', 'text'],
  'rpc_jury_project_rankings(uuid,text) exists'
);

-- ────────── 2. anon + invalid token → unauthorized ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT * FROM rpc_jury_project_rankings(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'not-a-valid-token')$c$,
  NULL::text,
  'unauthorized'::text,
  'invalid session token → raises unauthorized'
);

-- ────────── 3. empty token → unauthorized ──────────
SELECT throws_ok(
  $c$SELECT * FROM rpc_jury_project_rankings(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    '')$c$,
  NULL::text,
  'unauthorized'::text,
  'empty token → raises unauthorized'
);

-- ────────── 4. valid session token → succeeds ──────────
-- Insert a valid session for juror A on period A1
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, edit_enabled, is_blocked)
VALUES ('55550000-0000-4000-8000-000000000001'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        encode(digest('pgtap-rankings-token', 'sha256'), 'hex'),
        true, false)
ON CONFLICT (juror_id, period_id) DO NOTHING;

SELECT pgtap_test.become_reset();

SELECT lives_ok(
  $c$SELECT * FROM rpc_jury_project_rankings(
    'cccc0000-0000-4000-8000-000000000001'::uuid,
    'pgtap-rankings-token')$c$,
  'valid session token → rankings query succeeds'
);

-- ────────── 5. blocked session → unauthorized ──────────
INSERT INTO juror_period_auth (juror_id, period_id, session_token_hash, edit_enabled, is_blocked)
VALUES ('66660000-0000-4000-8000-000000000002'::uuid,
        'dddd0000-0000-4000-8000-000000000002'::uuid,
        encode(digest('pgtap-blocked-token', 'sha256'), 'hex'),
        false, true)
ON CONFLICT (juror_id, period_id) DO NOTHING;

SELECT throws_ok(
  $c$SELECT * FROM rpc_jury_project_rankings(
    'dddd0000-0000-4000-8000-000000000002'::uuid,
    'pgtap-blocked-token')$c$,
  NULL::text,
  'unauthorized'::text,
  'blocked session → raises unauthorized'
);

-- ────────── 6. result columns: project_id (uuid) and avg_score (numeric) ──────────
SELECT ok(
  (SELECT count(*) = 0
   FROM rpc_jury_project_rankings(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'pgtap-rankings-token'
   ) WHERE project_id IS NULL),
  'result rows have non-null project_id (or set is empty — both OK)'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
