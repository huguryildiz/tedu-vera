-- RPC: rpc_admin_publish_period(p_period_id uuid) → json
--
-- Contract (006a_rpcs_admin.sql):
--   * Unknown period              → RAISE EXCEPTION 'period_not_found'
--   * Readiness check fails       → { ok: false, error_code: 'readiness_failed' }
--   * Valid call                  → sets is_locked=true, activated_at=now();
--                                   writes period.publish audit row
--                                   → { ok: true, already_published: false }
--   * Idempotent repeat call      → { ok: true, already_published: true }
--
-- Readiness gate (rpc_admin_check_period_readiness) requires: criteria_name set,
-- ≥1 criterion with total weight=100 and non-empty rubric_bands, ≥1 project.
-- Period A1 from seed_periods() satisfies none of these and is used for the
-- readiness_failed assertion; Period A3 (inline fixture) satisfies all of them.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- Publishable period: Org A, unlocked, criteria_name set, one criterion
-- (weight=100, non-empty rubric_bands), one project.
INSERT INTO periods (id, organization_id, name, season, is_locked, criteria_name) VALUES
  ('cccc0000-0000-4000-8000-000000000003'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap Period A3 (publish test)', 'Spring', false, 'pgtap Criteria Set');

INSERT INTO period_criteria (id, period_id, key, label, max_score, weight, sort_order, rubric_bands) VALUES
  ('a1110000-0000-4000-8000-000000000a03'::uuid,
   'cccc0000-0000-4000-8000-000000000003'::uuid,
   'pub_tech', 'Technical', 10, 100, 1,
   '[{"min":0,"max":5,"label":"Fail"},{"min":6,"max":10,"label":"Pass"}]'::jsonb);

INSERT INTO projects (id, period_id, title, advisor_name) VALUES
  ('33330000-0000-4000-8000-000000000003'::uuid,
   'cccc0000-0000-4000-8000-000000000003'::uuid,
   'pgtap Project A3', 'Advisor A3');

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unknown period → RAISE EXCEPTION 'period_not_found'
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $c$SELECT rpc_admin_publish_period('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period raises period_not_found'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Period failing readiness → error_code: readiness_failed
--    Period A1 has no criteria_name, no criteria, and no projects seeded here.
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_admin_publish_period(
     'cccc0000-0000-4000-8000-000000000001'::uuid
   )->>'error_code'),
  'readiness_failed'::text,
  'period failing readiness returns error_code=readiness_failed'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Valid call on Period A3 → already_published: false
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_admin_publish_period(
     'cccc0000-0000-4000-8000-000000000003'::uuid
   )->>'already_published'),
  'false'::text,
  'first publish call reports already_published=false'::text
);

SELECT pgtap_test.become_reset();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. is_locked set to true
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT is_locked::text FROM periods
    WHERE id = 'cccc0000-0000-4000-8000-000000000003'::uuid),
  'true'::text,
  'is_locked=true after publish'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. activated_at set
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT activated_at IS NOT NULL FROM periods
    WHERE id = 'cccc0000-0000-4000-8000-000000000003'::uuid),
  'activated_at set after publish'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Idempotency: second call → already_published: true
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT rpc_admin_publish_period(
     'cccc0000-0000-4000-8000-000000000003'::uuid
   )->>'already_published'),
  'true'::text,
  'second publish call reports already_published=true'::text
);

SELECT pgtap_test.become_reset();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. period.publish audit row written
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1 FROM audit_logs
     WHERE action      = 'period.publish'
       AND resource_id = 'cccc0000-0000-4000-8000-000000000003'::uuid
  ),
  'period.publish audit row written'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
