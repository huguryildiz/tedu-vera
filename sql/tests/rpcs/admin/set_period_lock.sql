-- RPC: rpc_admin_set_period_lock(p_period_id uuid, p_locked boolean) → jsonb
--
-- Contract (009_audit.sql):
--   * Unknown period                → 'period_not_found'
--   * Non-org-admin caller          → raises in _assert_org_admin
--   * Attempt to unlock when scores exist (org admin, not super) →
--       returns { ok: false, error_code: 'cannot_unlock_period_has_scores' }
--   * Super admin bypasses the scores guard.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

SELECT pgtap_test.seed_two_orgs();

-- Create period A3 UNLOCKED first so the period-locked triggers let us
-- insert a project + score rows. We flip is_locked=true at the end so the
-- "unlock with scores" guard has something to test against.
INSERT INTO periods (id, organization_id, name, season, is_locked) VALUES
  ('cccc0000-0000-4000-8000-0000000000a3'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap Period A3', 'Spring', false)
ON CONFLICT (id) DO NOTHING;

-- period B (for cross-tenant test) stays in seed_periods so we add that now.
SELECT pgtap_test.seed_periods();

INSERT INTO jurors (id, organization_id, juror_name, affiliation) VALUES
  ('55550000-0000-4000-8000-0000000000a3'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap Juror Lock', 'pgtap dept')
ON CONFLICT (id) DO NOTHING;

INSERT INTO period_criteria (id, period_id, key, label, max_score, weight, sort_order) VALUES
  ('a1110000-0000-4000-8000-0000000000a3'::uuid,
   'cccc0000-0000-4000-8000-0000000000a3'::uuid,
   'tech', 'Tech', 10, 1.0, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, period_id, title, advisor_name) VALUES
  ('33330000-0000-4000-8000-0000000000a3'::uuid,
   'cccc0000-0000-4000-8000-0000000000a3'::uuid,
   'pgtap Lock Project', 'Advisor L')
ON CONFLICT (id) DO NOTHING;

INSERT INTO score_sheets (id, juror_id, project_id, period_id, status) VALUES
  ('e1110000-0000-4000-8000-0000000000a3'::uuid,
   '55550000-0000-4000-8000-0000000000a3'::uuid,
   '33330000-0000-4000-8000-0000000000a3'::uuid,
   'cccc0000-0000-4000-8000-0000000000a3'::uuid, 'in_progress')
ON CONFLICT (juror_id, project_id) DO NOTHING;

INSERT INTO score_sheet_items (id, score_sheet_id, period_criterion_id, score_value) VALUES
  ('a8880000-0000-4000-8000-0000000000a3'::uuid,
   'e1110000-0000-4000-8000-0000000000a3'::uuid,
   'a1110000-0000-4000-8000-0000000000a3'::uuid, 5.0)
ON CONFLICT (id) DO NOTHING;

-- Now lock period A3 so the "unlock with scores" guard has something to hit.
UPDATE periods SET is_locked = true
WHERE id = 'cccc0000-0000-4000-8000-0000000000a3'::uuid;

-- ────────── 1. unknown period ──────────
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $c$SELECT rpc_admin_set_period_lock('00000000-0000-4000-8000-000000000abc'::uuid, true)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → error period_not_found'::text
);

-- ────────── 2. cross-tenant ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_set_period_lock('dddd0000-0000-4000-8000-000000000022'::uuid, true)$c$,
  NULL::text,
  NULL::text,
  'admin A cannot lock/unlock an org B period'::text
);

-- ────────── 3. org admin blocked from unlocking period with scores ──────────
SELECT is(
  (SELECT rpc_admin_set_period_lock(
     'cccc0000-0000-4000-8000-0000000000a3'::uuid, false
   )->>'error_code'),
  'cannot_unlock_period_has_scores'::text,
  'org admin cannot unlock a period that already has scores'::text
);

-- ────────── 4. super admin can unlock the same period (bypass) ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT is(
  (SELECT (rpc_admin_set_period_lock(
     'cccc0000-0000-4000-8000-0000000000a3'::uuid, false
   )->>'ok')::boolean),
  true,
  'super admin bypasses scores guard and unlocks'::text
);

-- ────────── 5. audit row written for period.unlock ──────────
SELECT ok(
  EXISTS(
    SELECT 1 FROM audit_logs
    WHERE action = 'period.unlock'
      AND resource_id = 'cccc0000-0000-4000-8000-0000000000a3'::uuid
  ),
  'rpc_admin_set_period_lock writes period.unlock to audit_logs'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
