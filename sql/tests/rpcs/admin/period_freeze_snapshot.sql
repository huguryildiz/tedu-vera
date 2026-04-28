-- RPC: rpc_period_freeze_snapshot(p_period_id uuid, p_force boolean) → json
--
-- Contract (006b_rpcs_admin.sql §G):
--   * Unknown period               → { ok: false, error: 'period_not_found' }
--   * Period without framework_id  → { ok: false, error: 'period_has_no_framework' }
--   * First call (p_force=false)   → seeds period_criteria + period_outcomes
--                                    + period_criterion_outcome_maps from
--                                    framework_*; sets periods.snapshot_frozen_at
--                                    → { ok: true, already_frozen: false }
--   * Repeat call (p_force=false)  → idempotent; no duplicate rows;
--                                    → { ok: true, already_frozen: true }
--   * Force call  (p_force=true)   → wipes period_outcomes + maps, re-seeds
--                                    them from current framework, PRESERVES
--                                    period_criteria (architectural rule:
--                                    criteria are managed independently and
--                                    must survive a framework reassignment).
--
-- This is an RPC state-mutation test (not a contract-only test). The gap it
-- closes is the "RPC state mutation ~30%" backlog item in
-- docs/testing/page-test-coverage-map.md §1c. The freeze flow is the entry
-- point for outcomes-mapping data, so a regression here would silently
-- corrupt analytics for an entire period.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(11);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ─────────────────────────────────────────────────────────────────────────
-- Inline framework fixture (not in _helpers.sql because no other test needs
-- it yet). 2 criteria + 2 outcomes + 2 maps, attached to org A.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO frameworks (id, organization_id, name, default_threshold) VALUES
  ('f1110000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap Framework FS', 70);

INSERT INTO framework_criteria (id, framework_id, key, label, max_score, weight, sort_order) VALUES
  ('fc110000-0000-4000-8000-000000000001'::uuid,
   'f1110000-0000-4000-8000-000000000001'::uuid,
   'fs_tech', 'Technical', 10, 1.0, 1),
  ('fc110000-0000-4000-8000-000000000002'::uuid,
   'f1110000-0000-4000-8000-000000000001'::uuid,
   'fs_design', 'Design', 10, 1.0, 2);

INSERT INTO framework_outcomes (id, framework_id, code, label, sort_order) VALUES
  ('fa110000-0000-4000-8000-000000000001'::uuid,
   'f1110000-0000-4000-8000-000000000001'::uuid,
   'FS-O1', 'Outcome 1', 1),
  ('fa110000-0000-4000-8000-000000000002'::uuid,
   'f1110000-0000-4000-8000-000000000001'::uuid,
   'FS-O2', 'Outcome 2', 2);

INSERT INTO framework_criterion_outcome_maps (framework_id, criterion_id, outcome_id, coverage_type, weight) VALUES
  ('f1110000-0000-4000-8000-000000000001'::uuid,
   'fc110000-0000-4000-8000-000000000001'::uuid,
   'fa110000-0000-4000-8000-000000000001'::uuid,
   'direct', 1.0),
  ('f1110000-0000-4000-8000-000000000001'::uuid,
   'fc110000-0000-4000-8000-000000000002'::uuid,
   'fa110000-0000-4000-8000-000000000002'::uuid,
   'direct', 1.0);

-- Attach framework to unlocked period A1 (cccc...0001).
UPDATE periods
   SET framework_id = 'f1110000-0000-4000-8000-000000000001'::uuid
 WHERE id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unknown period → error: period_not_found
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     '00000000-0000-4000-8000-000000000abc'::uuid, false
   )->>'error'),
  'period_not_found'::text,
  'unknown period returns period_not_found'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Period without framework → error: period_has_no_framework
--    Period A2 (locked) was seeded without a framework.
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     'cccc0000-0000-4000-8000-000000000011'::uuid, false
   )->>'error'),
  'period_has_no_framework'::text,
  'period without framework_id returns period_has_no_framework'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. First freeze: ok=true, already_frozen=false
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     'cccc0000-0000-4000-8000-000000000001'::uuid, false
   )->>'already_frozen'),
  'false'::text,
  'first freeze reports already_frozen=false'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. period_criteria seeded (2 from framework, BUT seed_period_criteria()
--    inserted 2 unrelated rows earlier — total = 4)
--    NB: in production this collision cannot happen because period_criteria
--    is empty at framework-assign time. Here we only assert that the freeze
--    *added* its 2 framework criteria.
-- ─────────────────────────────────────────────────────────────────────────
-- (We did not call seed_period_criteria; only seed_periods. So count = 2.)
SELECT is(
  (SELECT COUNT(*)::int FROM period_criteria
    WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  2,
  'period_criteria seeded with 2 rows from framework'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. period_outcomes seeded
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT COUNT(*)::int FROM period_outcomes
    WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  2,
  'period_outcomes seeded with 2 rows from framework'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. period_criterion_outcome_maps seeded
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT COUNT(*)::int FROM period_criterion_outcome_maps
    WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  2,
  'period_criterion_outcome_maps seeded with 2 rows from framework'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. periods.snapshot_frozen_at set
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT snapshot_frozen_at IS NOT NULL FROM periods
     WHERE id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  'periods.snapshot_frozen_at set after first freeze'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Idempotency: second call (p_force=false) does NOT duplicate rows
--    and reports already_frozen=true.
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     'cccc0000-0000-4000-8000-000000000001'::uuid, false
   )->>'already_frozen'),
  'true'::text,
  'second freeze reports already_frozen=true'::text
);

SELECT is(
  (SELECT COUNT(*)::int FROM period_outcomes
    WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  2,
  'period_outcomes count unchanged after idempotent re-call (no duplicates)'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Force re-freeze (p_force=true): outcomes + maps wiped & re-seeded;
--    period_criteria preserved (count must stay 2).
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_period_freeze_snapshot(
     'cccc0000-0000-4000-8000-000000000001'::uuid, true
   )->>'ok'),
  'true'::text,
  'force re-freeze returns ok=true'::text
);

SELECT is(
  (SELECT COUNT(*)::int FROM period_criteria
    WHERE period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  2,
  'period_criteria preserved through force re-freeze (criteria are independent)'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
