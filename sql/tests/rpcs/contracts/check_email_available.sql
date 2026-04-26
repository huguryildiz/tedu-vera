-- RPC: rpc_check_email_available(TEXT) → jsonb
--
-- Pins the public contract documented in 006b_rpcs_admin.sql:
--   * Signature: (p_email text) returning jsonb
--   * No auth required (anon + authenticated)
--   * NULL/empty email   → {available: false, reason: 'email_required'}
--   * Already registered → {available: false, reason: 'email_already_registered'}
--   * Pending application→ {available: false, reason: 'application_already_pending'}
--   * Available email    → {available: true}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_check_email_available',
  ARRAY['text'],
  'rpc_check_email_available(text) exists'
);

SELECT function_returns(
  'public', 'rpc_check_email_available',
  ARRAY['text'],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_check_email_available('open@example.com')$c$,
  'anon role can call rpc_check_email_available'
);

-- ────────── 3. empty email → email_required ──────────
SELECT is(
  (SELECT rpc_check_email_available('')::jsonb->>'reason'),
  'email_required',
  'empty string → reason=email_required'
);

SELECT is(
  (SELECT rpc_check_email_available('')::jsonb->>'available'),
  'false',
  'empty string → available=false'
);

-- ────────── 4. NULL email → email_required ──────────
SELECT is(
  (SELECT rpc_check_email_available(NULL)::jsonb->>'reason'),
  'email_required',
  'NULL email → reason=email_required'
);

-- ────────── 5. already-registered email → email_already_registered ──────────
SELECT pgtap_test.become_reset();

SELECT is(
  (SELECT rpc_check_email_available('pgtap_admin_a@test.local')::jsonb->>'reason'),
  'email_already_registered',
  'existing auth.users email → reason=email_already_registered'
);

SELECT is(
  (SELECT rpc_check_email_available('pgtap_admin_a@test.local')::jsonb->>'available'),
  'false',
  'existing auth.users email → available=false'
);

-- ────────── 6. completely fresh email → available=true ──────────
SELECT is(
  (SELECT rpc_check_email_available('totally_new_xyz_123@nowhere.example')::jsonb->>'available'),
  'true',
  'fresh email → available=true'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
