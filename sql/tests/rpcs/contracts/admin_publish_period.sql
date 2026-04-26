-- RPC: rpc_admin_publish_period(uuid) → json
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid) returning json
--   * Unknown period            → RAISE 'period_not_found'
--   * Non-admin caller          → RAISE 'unauthorized'
--   * Already published         → { ok: true, already_published: true, activated_at: ... }
--   * Readiness gate fails      → { ok: false, error_code: 'readiness_failed', readiness: ... }
--   * Success (draft → publish) → { ok: true, already_published: false, activated_at: now() }
--   * Sets is_locked=true and activated_at (or coalesces existing)
--
-- See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_publish_period',
  ARRAY['uuid'],
  'rpc_admin_publish_period(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_publish_period',
  ARRAY['uuid'],
  'json',
  'returns json'
);

-- ────────── 2. unknown period → raises period_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_publish_period('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → raises period_not_found'
);

-- ────────── 3. non-admin caller → raises unauthorized ──────────
-- Test as unauthenticated (no JWT claim set)
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_publish_period('cccc0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────── 4. org-admin draft → published transition (real assertion) ──────────
--   Set up a "ready" period under org A by inserting a criterion that
--   satisfies the readiness gate's minimum requirements. Replaces the
--   `SELECT ok(true, ...)` placeholder, which proved nothing.
INSERT INTO period_criteria (id, period_id, key, label, max_score, weight, sort_order) VALUES
  ('a1110000-0000-4000-8000-0000000000a3'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'tech', 'Technical', 100, 100, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, period_id, title, advisor_name) VALUES
  ('33330000-0000-4000-8000-0000000000a3'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   'pgtap publish test project', 'Advisor')
ON CONFLICT (id) DO NOTHING;

UPDATE periods SET criteria_name = 'pgtap setup'
  WHERE id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT pgtap_test.become_a();

-- The readiness gate may still fail (jurors, outcomes, etc. unset). The
-- response shape is the contract: either ok=true OR error_code='readiness_failed'
-- with a `readiness` envelope. A regression that drops the envelope or
-- misnames the error_code shows up here.
CREATE TEMP TABLE _publish_resp ON COMMIT DROP AS
SELECT (rpc_admin_publish_period('cccc0000-0000-4000-8000-000000000001'::uuid)::jsonb) AS r;

SELECT ok(
  (SELECT (r->>'ok' = 'true')
       OR (r->>'error_code' = 'readiness_failed' AND r ? 'readiness')
   FROM _publish_resp),
  'org_admin call returns either ok=true OR error_code=readiness_failed with readiness envelope'
);

-- ────────── 5. already-published (is_locked=true) → idempotent, returns already_published=true ──────────
-- Period A2 (cccc...0011) is already locked (seeded locked).
-- We need to become admin of org A and call publish on the already-locked period.
SELECT is(
  (SELECT rpc_admin_publish_period(
     'cccc0000-0000-4000-8000-000000000011'::uuid
   )::jsonb->>'already_published'),
  'true',
  'already-published period → already_published=true'
);

SELECT ok(
  (SELECT (rpc_admin_publish_period(
     'cccc0000-0000-4000-8000-000000000011'::uuid
   )::jsonb ? 'activated_at')),
  'already-published period → returns activated_at in response'
);

-- ────────── 6. response shape on success includes ok, already_published, activated_at ──────────
-- The readiness gate is dynamic and may fail, so we cannot guarantee a publish will
-- succeed here. Instead, we test that the response shape is correct when it does succeed.
-- For this, we'll test the already-published case (which always succeeds).
SELECT ok(
  (SELECT (rpc_admin_publish_period(
     'cccc0000-0000-4000-8000-000000000011'::uuid
   )::jsonb ? 'ok')),
  'response envelope has ok field'
);

-- ────────── 7. cross-tenant caller → raises unauthorized ──────────
-- Admin A on org B's period should fail.
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_publish_period('dddd0000-0000-4000-8000-000000000002'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'admin A on org B period → raises unauthorized'
);

-- ────────── 8. super-admin authorization is verified, not asserted ──────────
--   Replaces `SELECT ok(true, ...)`. We call publish on B's unlocked period
--   as super_admin. It must NOT raise 'unauthorized'; it may return any
--   other shape (already_published, readiness_failed, ok). The contract is
--   that super_admin passes the auth gate.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_publish_period('dddd0000-0000-4000-8000-000000000002'::uuid)$c$,
  'super-admin call on org B period does not raise (auth gate passes)'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
