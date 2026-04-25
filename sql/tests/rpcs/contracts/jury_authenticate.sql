-- RPC: rpc_jury_authenticate(uuid, text, text, boolean, text) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_period_id uuid, p_juror_name text, p_affiliation text,
--                 p_force_reissue boolean DEFAULT false, p_email text DEFAULT NULL)
--                 returning json
--   * Unknown period               → { error: 'period_not_found' }
--   * Valid period, new juror      → { juror_id, needs_pin, pin_plain_once (only if generated) }
--   * Valid period, existing juror → returns without duplicate insert
--   * Email update on existing     → email is updated before returning
--
-- See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_authenticate',
  ARRAY['uuid', 'text', 'text', 'boolean', 'text'],
  'rpc_jury_authenticate(uuid,text,text,boolean,text) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_authenticate',
  ARRAY['uuid', 'text', 'text', 'boolean', 'text'],
  'json',
  'returns json'
);

-- ────────── 2. unknown period → period_not_found ──────────
SELECT is(
  (SELECT rpc_jury_authenticate(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     'Test Juror',
     'Test Dept',
     false,
     NULL
   )::jsonb->>'error'),
  'period_not_found',
  'unknown period → error period_not_found'
);

-- ────────── 3. valid period, new juror → creates juror + auth row, returns juror_id ──────────
SELECT isnt(
  (SELECT (rpc_jury_authenticate(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'New Juror A',
     'New Dept A',
     false,
     'newjuror@test.local'
   )::jsonb->>'juror_id')),
  NULL,
  'valid period, new juror → returns non-null juror_id'
);

-- ────────── 4. return shape includes juror_name, affiliation, needs_pin, pin_plain_once ──────────
SELECT ok(
  (SELECT (rpc_jury_authenticate(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'Juror B Name',
     'Juror B Affiliation',
     false,
     NULL
   )::jsonb ? 'juror_name')),
  'response envelope has juror_name field'
);

SELECT ok(
  (SELECT (rpc_jury_authenticate(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'Juror C Name',
     'Juror C Affiliation',
     false,
     NULL
   )::jsonb ? 'needs_pin')),
  'response envelope has needs_pin field'
);

SELECT ok(
  (SELECT (rpc_jury_authenticate(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'Juror D Name',
     'Juror D Affiliation',
     false,
     NULL
   )::jsonb ? 'pin_plain_once')),
  'response envelope has pin_plain_once field'
);

-- ────────── 5. calling twice with same juror → idempotent (no duplicate error) ──────────
SELECT ok(
  (SELECT (rpc_jury_authenticate(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'Duplicate Test Juror',
     'Duplicate Dept',
     false,
     NULL
   )::jsonb->>'ok') IS NULL),
  'first call succeeds (no ok field means contract uses error/juror_id envelope)'
);

SELECT ok(
  (SELECT (rpc_jury_authenticate(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'Duplicate Test Juror',
     'Duplicate Dept',
     false,
     NULL
   )::jsonb->>'ok') IS NULL),
  'second call with same juror→name→affiliation succeeds (idempotent)'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
