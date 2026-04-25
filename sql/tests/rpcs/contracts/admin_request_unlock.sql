-- RPC: rpc_admin_request_unlock(uuid, text) → json
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_reason text) returning json
--   * Reason < 10 chars         → { ok: false, error_code: 'reason_too_short' }
--   * Unknown period            → { ok: false, error_code: 'period_not_found' }
--   * Period not locked         → { ok: false, error_code: 'period_not_locked' }
--   * Non-admin caller          → { ok: false, error_code: 'unauthorized' }
--   * Period has no scores      → { ok: false, error_code: 'period_has_no_scores' }
--   * Pending request exists    → { ok: false, error_code: 'pending_request_exists' }
--   * Success (first request)   → { ok: true, request_id: uuid }
--
-- See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_projects();
SELECT pgtap_test.seed_jurors();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_request_unlock',
  ARRAY['uuid', 'text'],
  'rpc_admin_request_unlock(uuid,text) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_request_unlock',
  ARRAY['uuid', 'text'],
  'json',
  'returns json'
);

-- ────────── 2. reason too short (< 10 chars) → reason_too_short ──────────
SELECT pgtap_test.become_a();

SELECT is(
  (SELECT rpc_admin_request_unlock(
     'cccc0000-0000-4000-8000-000000000011'::uuid,
     'short'
   )::jsonb->>'error_code'),
  'reason_too_short',
  'reason < 10 chars → error_code reason_too_short'
);

-- ────────── 3. unknown period → period_not_found ──────────
SELECT is(
  (SELECT rpc_admin_request_unlock(
     '00000000-0000-4000-8000-000000000abc'::uuid,
     'This is a long enough reason'
   )::jsonb->>'error_code'),
  'period_not_found',
  'unknown period → error_code period_not_found'
);

-- ────────── 4. period not locked → period_not_locked ──────────
-- Period A1 (cccc...0001) is unlocked
SELECT is(
  (SELECT rpc_admin_request_unlock(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     'This period is not locked'
   )::jsonb->>'error_code'),
  'period_not_locked',
  'unlocked period → error_code period_not_locked'
);

-- ────────── 5. period has no scores → period_has_no_scores ──────────
-- Period A2 (cccc...0011) is locked but empty of scores
SELECT is(
  (SELECT rpc_admin_request_unlock(
     'cccc0000-0000-4000-8000-000000000011'::uuid,
     'No scores have been entered'
   )::jsonb->>'error_code'),
  'period_has_no_scores',
  'locked period with no scores → error_code period_has_no_scores'
);

-- ────────── 6. setup: locked period with project + score for the success path ──────────
-- The RPC's "has scores" check joins score_sheets→projects WHERE projects.period_id = p_period_id.
-- Period A2 (cccc...0011) is locked from seed and has no projects. We need a project under
-- A2 + a score_sheet for it. Workaround: temporarily unlock A2 (the trigger only blocks
-- INSERTs into a locked period's child rows, not UPDATEs to the period itself), insert the
-- project + score_sheet, then re-lock.
UPDATE periods SET is_locked = false WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid;

INSERT INTO projects (id, period_id, title, advisor_name)
VALUES ('33330000-0000-4000-8000-000000000099'::uuid,
        'cccc0000-0000-4000-8000-000000000011'::uuid,
        'pgtap Project for Unlock Test',
        'Advisor X')
ON CONFLICT (id) DO NOTHING;

INSERT INTO score_sheets (juror_id, project_id, period_id, status, started_at, last_activity_at)
VALUES ('55550000-0000-4000-8000-000000000001'::uuid,
        '33330000-0000-4000-8000-000000000099'::uuid,
        'cccc0000-0000-4000-8000-000000000011'::uuid,
        'in_progress',
        now(),
        now())
ON CONFLICT DO NOTHING;

UPDATE periods SET is_locked = true WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid;

-- ────────── 7. valid request (locked period + scores + valid reason) → ok=true + request_id ──────────
-- Capture the first call's response once; assert both ok and request_id from it,
-- since a second call would hit pending_request_exists and lose request_id.
CREATE TEMP TABLE _first_request AS
SELECT rpc_admin_request_unlock(
  'cccc0000-0000-4000-8000-000000000011'::uuid,
  'We need to make important corrections'
)::jsonb AS resp;

SELECT is(
  (SELECT resp->>'ok' FROM _first_request),
  'true',
  'valid unlock request → ok=true'
);

SELECT isnt(
  (SELECT resp->>'request_id' FROM _first_request),
  NULL,
  'valid unlock request → returns non-null request_id'
);

-- ────────── 8. pending request exists → pending_request_exists ──────────
SELECT is(
  (SELECT rpc_admin_request_unlock(
     'cccc0000-0000-4000-8000-000000000011'::uuid,
     'Another reason for unlock attempt'
   )::jsonb->>'error_code'),
  'pending_request_exists',
  'duplicate request while pending → error_code pending_request_exists'
);

-- ────────__ 9. cross-tenant admin (B on A period) → unauthorized ──────────
SELECT pgtap_test.become_b();

SELECT is(
  (SELECT rpc_admin_request_unlock(
     'cccc0000-0000-4000-8000-000000000011'::uuid,
     'Admin B trying to unlock org A period'
   )::jsonb->>'error_code'),
  'unauthorized',
  'admin B on org A period → error_code unauthorized'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
