-- RPC: rpc_write_auth_failure_event(TEXT, TEXT) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_email TEXT, p_auth_method TEXT DEFAULT 'password') returning jsonb
--   * No auth required (anon + authenticated)
--   * Rate-limited: 20 failures per 5 minutes per email
--   * Error codes: 'invalid_email', 'rate_limited'
--   * Returns {ok, severity} on success, {ok: false, error_code} on failure

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_write_auth_failure_event',
  ARRAY['text'::text, 'text'::text],
  'rpc_write_auth_failure_event(text, text) exists'
);

SELECT function_returns(
  'public', 'rpc_write_auth_failure_event',
  ARRAY['text'::text, 'text'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_write_auth_failure_event('test@example.com', 'password')$c$,
  'anon role can call rpc_write_auth_failure_event'
);

-- ────────__ 3. invalid email returns error ──────────
SELECT ok(
  (SELECT rpc_write_auth_failure_event('', 'password')::jsonb ->> 'error_code' = 'invalid_email'),
  'empty email returns error_code invalid_email'
);

-- ────────__ 4. valid email returns ok:true ──────────
SELECT ok(
  (SELECT rpc_write_auth_failure_event('valid@example.com', 'password')::jsonb ->> 'ok' = 'true'),
  'valid email returns ok:true'
);

-- ────────__ 5. response has severity key ──────────
SELECT ok(
  (SELECT rpc_write_auth_failure_event('another@example.com', 'password')::jsonb ? 'severity'),
  'response includes severity key'
);

-- ────────__ 6. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_write_auth_failure_event('test2@example.com', 'password')$c$,
  'authenticated role can call rpc_write_auth_failure_event'
);

-- ────────__ 7. default auth_method parameter works ──────────
SELECT lives_ok(
  $c$SELECT rpc_write_auth_failure_event('test3@example.com')$c$,
  'defaults p_auth_method to password'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
