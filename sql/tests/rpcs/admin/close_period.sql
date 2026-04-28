-- RPC: rpc_admin_close_period(p_period_id uuid) → json
--
-- Contract (006a_rpcs_admin.sql):
--   * Unlocked period             → { ok: false, error_code: 'period_not_published' }
--   * Valid call on locked period → sets closed_at, revokes active entry tokens;
--                                   writes period.close audit row
--                                   → { ok: true, already_closed: false }
--   * Idempotent repeat call      → { ok: true, already_closed: true }
--
-- Period A1 (unlocked) is used for the period_not_published assertion.
-- Period A2 (locked) is used for the success / idempotency / audit assertions.
-- An entry token seeded for A2 verifies that the token-revoke side-effect fires.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- Seed one active entry token for the locked period (A2) so the revoke path runs.
INSERT INTO entry_tokens (id, period_id, token_hash, token_plain, is_revoked, expires_at) VALUES
  ('77770000-0000-4000-8000-000000000011'::uuid,
   'cccc0000-0000-4000-8000-000000000011'::uuid,
   encode(digest('pgtap-token-a2', 'sha256'), 'hex'),
   'pgtap-token-a2', false, now() + interval '1 day');

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unlocked period → error_code: period_not_published
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT rpc_admin_close_period(
     'cccc0000-0000-4000-8000-000000000001'::uuid
   )->>'error_code'),
  'period_not_published'::text,
  'unlocked period returns error_code=period_not_published'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Valid call on locked period (A2) → ok: true
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT rpc_admin_close_period(
     'cccc0000-0000-4000-8000-000000000011'::uuid
   )->>'ok'),
  'true'::text,
  'valid close call returns ok=true'::text
);

SELECT pgtap_test.become_reset();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. closed_at set
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT closed_at IS NOT NULL FROM periods
    WHERE id = 'cccc0000-0000-4000-8000-000000000011'::uuid),
  'closed_at set after close'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Active entry token for this period revoked
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT is_revoked FROM entry_tokens
    WHERE id = '77770000-0000-4000-8000-000000000011'::uuid),
  'entry token revoked when period is closed'::text
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Idempotency: second call → already_closed: true
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT rpc_admin_close_period(
     'cccc0000-0000-4000-8000-000000000011'::uuid
   )->>'already_closed'),
  'true'::text,
  'second close call reports already_closed=true'::text
);

SELECT pgtap_test.become_reset();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. period.close audit row written
-- ─────────────────────────────────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1 FROM audit_logs
     WHERE action      = 'period.close'
       AND resource_id = 'cccc0000-0000-4000-8000-000000000011'::uuid
  ),
  'period.close audit row written'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
