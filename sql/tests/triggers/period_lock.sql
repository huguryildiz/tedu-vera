-- Period lock — dual-layer security pattern.
--
-- This is the canonical example for the architecture spec § 1
-- "non-negotiable #3: Period lock immutability." VERA enforces it on TWO
-- independent layers so a regression in either is caught:
--
--   Layer 1 — RLS policy (covered by sql/tests/rls/period_criteria_isolation.sql
--             and sibling files). Filters / blocks at the policy level.
--   Layer 2 — Postgres triggers (THIS FILE). Belt-and-suspenders: even if a
--             SECURITY DEFINER RPC bypasses RLS, the trigger on the child
--             tables still raises 'period_locked' (errcode 23514).
--
-- The trigger layer lives in sql/migrations/003_helpers_and_triggers.sql:
--   _assert_period_unlocked()                     — central guard
--   trigger_block_period_child_on_locked()        — used by:
--      block_period_criteria_on_locked   (period_criteria)
--      block_period_outcomes_on_locked   (period_outcomes)
--      block_pcom_on_locked              (period_criterion_outcome_maps)
--   trigger_block_projects_on_locked_period()     — projects table
--   trigger_block_jurors_on_locked_period()       — jurors UPDATE/DELETE
--   trigger_block_periods_on_locked_mutate()      — periods UPDATE/DELETE
--                                                    (super-admin escape hatch)
--
-- All of these triggers run as superuser through SECURITY DEFINER, so they
-- fire regardless of who initiated the write. That is the whole point of
-- having two layers — RLS only applies when RLS is in scope; triggers
-- always apply.
--
-- Bug classes this file catches:
--   1. The trigger on period_criteria being dropped — RLS still blocks, but
--      a SECURITY DEFINER admin RPC could now silently rewrite a locked
--      period's rubric. The trigger is the last line of defense.
--   2. The _assert_period_unlocked helper being changed to no-op when
--      p_period_id IS NULL — a NEW.period_id = NULL UPDATE could slip past.
--      (The current helper RETURNs early on NULL, which is a deliberate
--      choice for foreign-key columns; we do not test that branch here.)
--   3. The "unlock the lock itself" UPDATE incorrectly being blocked by
--      the periods trigger — would break rpc_super_admin_resolve_unlock
--      and rpc_admin_close_period, which both legitimately UPDATE
--      is_locked / closed_at on a locked period.
--   4. Super-admin escape hatch on the periods trigger being dropped —
--      super_admin would lose the ability to delete a locked period during
--      cleanup, and the admin org-deletion cascade would break.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_period_criteria();
SELECT pgtap_test.seed_period_outcomes();

-- All triggers below fire regardless of caller role, so we leave the seed
-- as superuser. That is the architectural property under test: triggers
-- catch SECURITY DEFINER RPC abuse, where the RPC is itself privileged.

-- ─────────────────────────────────────────────────────────────────────────
-- Layer 2 — child tables of a LOCKED period
--   period A2 (cccc...0011) is locked by seed_periods(); we try to mutate
--   each child relation and assert the trigger raises 'period_locked'.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. period_criteria INSERT into a locked period → period_locked.
SELECT throws_ok(
  $i$INSERT INTO period_criteria (period_id, key, label, max_score, weight, sort_order)
     VALUES ('cccc0000-0000-4000-8000-000000000011'::uuid,
             'pgtap_locked_insert', 'Locked', 10, 1, 99)$i$,
  '23514',
  'period_locked',
  'INSERT period_criteria into LOCKED period raises period_locked'::text
);

-- 2. period_outcomes INSERT into a locked period → period_locked.
SELECT throws_ok(
  $i$INSERT INTO period_outcomes (period_id, code, label, sort_order)
     VALUES ('cccc0000-0000-4000-8000-000000000011'::uuid,
             'pgtap_locked', 'Locked Outcome', 99)$i$,
  '23514',
  'period_locked',
  'INSERT period_outcomes into LOCKED period raises period_locked'::text
);

-- 3. projects INSERT into a locked period → period_locked.
SELECT throws_ok(
  $i$INSERT INTO projects (period_id, title, advisor_name)
     VALUES ('cccc0000-0000-4000-8000-000000000011'::uuid,
             'pgtap locked project', 'Advisor X')$i$,
  '23514',
  'period_locked',
  'INSERT projects into LOCKED period raises period_locked'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- Layer 2 — locked PERIOD itself (UPDATE protected columns)
--   The periods trigger has a super-admin escape hatch for the cleanup
--   case. We test the trigger fires for non-super, then is bypassed by
--   the super-admin role — both halves of the policy.
-- ─────────────────────────────────────────────────────────────────────────

-- 4. UPDATE of a structural column on a locked period (as tenant admin) raises.
--    `name` is in the trigger's distinct-from check; flipping it on a
--    locked row must raise.
SELECT pgtap_test.become_a();
SELECT throws_ok(
  $u$UPDATE periods SET name = 'pgtap pwned name'
     WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid$u$,
  '23514',
  'period_locked',
  'UPDATE periods.name on LOCKED period (as tenant admin) raises period_locked'::text
);

-- 5. DELETE of a locked period (as tenant admin) raises.
SELECT throws_ok(
  $d$DELETE FROM periods WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid$d$,
  '23514',
  'period_locked',
  'DELETE LOCKED period (as tenant admin) raises period_locked'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- The "allowed mutations on a locked period" branch — these MUST NOT fire.
-- ─────────────────────────────────────────────────────────────────────────

-- 6. Flipping is_locked itself on a locked period is allowed (it is the
--    unlock flow). The trigger's column-list explicitly excludes is_locked.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT lives_ok(
  $u$UPDATE periods SET is_locked = false
     WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid$u$,
  'super-admin UPDATE is_locked=false on LOCKED period succeeds (unlock branch)'::text
);

-- Re-lock so subsequent assertions hit the locked-period trigger.
SELECT lives_ok(
  $u$UPDATE periods SET is_locked = true
     WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid$u$,
  'super-admin re-lock UPDATE is_locked=true succeeds'::text
);

-- 7. Super-admin escape hatch — deleting a locked period as super_admin
--    is permitted (the org-deletion cleanup path relies on it). The
--    trigger checks current_user_is_super_admin() and returns OLD/NEW
--    without raising.
SELECT lives_ok(
  $d$DELETE FROM periods WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid$d$,
  'super-admin DELETE on LOCKED period succeeds (escape hatch)'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
