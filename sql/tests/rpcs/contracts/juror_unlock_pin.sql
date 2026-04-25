-- RPC: rpc_juror_unlock_pin(uuid, uuid) → json
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid, p_juror_id uuid) returning json
--   * Unknown juror               → { ok: false, error_code: 'juror_not_found' }
--   * Non-admin caller            → { ok: false, error_code: 'unauthorized' }
--   * No auth row for juror+period → { ok: false, error_code: 'auth_row_not_found' }
--   * Success                     → { ok: true, pin_plain_once: '####' }
--
-- Called from the admin PIN-unlock modal on event day. Shape drift on the
-- pin_plain_once field would break the "show PIN once" modal instantly.
-- See audit §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_juror_unlock_pin',
  ARRAY['uuid', 'uuid'],
  'rpc_juror_unlock_pin(uuid,uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_juror_unlock_pin',
  ARRAY['uuid', 'uuid'],
  'json',
  'returns json'
);

-- ────────── 2. unknown juror → juror_not_found ──────────
SELECT pgtap_test.become_a();

SELECT is(
  (SELECT rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '00000000-0000-4000-8000-000000000abc'::uuid
   )::jsonb->>'error_code'),
  'juror_not_found',
  'unknown juror → error_code juror_not_found'
);

SELECT is(
  (SELECT rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '00000000-0000-4000-8000-000000000abc'::uuid
   )::jsonb->>'ok'),
  'false',
  'unknown juror → ok=false'
);

-- ────────── 3. admin B calling org-A juror → unauthorized ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_b();

SELECT is(
  (SELECT rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid
   )::jsonb->>'error_code'),
  'unauthorized',
  'admin B on org-A juror → error_code unauthorized'
);

-- ────────── 4. admin A on own-org juror without auth row → auth_row_not_found ──────────
-- seed_jurors() creates a juror but NOT a juror_period_auth row.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

SELECT is(
  (SELECT rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid
   )::jsonb->>'error_code'),
  'auth_row_not_found',
  'no auth row → error_code auth_row_not_found'
);

-- ────────── 5. success: returns ok=true + 4-digit pin_plain_once ──────────
-- Seed the auth row and call as admin A.
INSERT INTO juror_period_auth (juror_id, period_id, failed_attempts, is_blocked) VALUES
  ('55550000-0000-4000-8000-000000000001'::uuid,
   'cccc0000-0000-4000-8000-000000000001'::uuid,
   3, true)
ON CONFLICT (juror_id, period_id) DO UPDATE SET
  failed_attempts = 3, is_blocked = true;

SELECT is(
  (SELECT rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid
   )::jsonb->>'ok'),
  'true',
  'valid unlock → ok=true'
);

-- Re-seed the auth row (previous call consumed it).
UPDATE juror_period_auth
SET failed_attempts = 3, is_blocked = true
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT matches(
  (rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid
   )::jsonb->>'pin_plain_once')::text,
  '^\d{4}$',
  'pin_plain_once is exactly 4 digits'
);

-- ────────── 6. super-admin can also unlock (membership check allows super) ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();

UPDATE juror_period_auth
SET failed_attempts = 3, is_blocked = true
WHERE juror_id = '55550000-0000-4000-8000-000000000001'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT is(
  (SELECT rpc_juror_unlock_pin(
     'cccc0000-0000-4000-8000-000000000001'::uuid,
     '55550000-0000-4000-8000-000000000001'::uuid
   )::jsonb->>'ok'),
  'true',
  'super-admin can unlock any juror'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
