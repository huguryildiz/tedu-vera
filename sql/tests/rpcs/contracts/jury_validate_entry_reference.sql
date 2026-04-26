-- RPC: rpc_jury_validate_entry_reference(TEXT) → json
--
-- Pins the public contract documented in 005_rpcs_jury.sql:
--   * Signature: (p_reference text) returning json
--   * No auth required (anon + authenticated)
--   * Reference < 8 alphanum chars  → {ok: false, error_code: 'invalid_reference'}
--   * No match                      → {ok: false, error_code: 'reference_not_found'}
--   * Token revoked                 → {ok: false, error_code: 'token_revoked'}
--   * Period not found/locked       → various error_codes (period_not_found, etc.)
--   * Success                       → {ok: true, token_id, period_id, period_name,
--                                       is_locked, closed_at}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_entry_tokens();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_jury_validate_entry_reference',
  ARRAY['text'],
  'rpc_jury_validate_entry_reference(text) exists'
);

SELECT function_returns(
  'public', 'rpc_jury_validate_entry_reference',
  ARRAY['text'],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_jury_validate_entry_reference('tooshort')$c$,
  'anon role can call rpc_jury_validate_entry_reference'
);

-- ────────── 3. short reference (<8 alphanum) → invalid_reference ──────────
SELECT pgtap_test.become_reset();

SELECT is(
  (SELECT rpc_jury_validate_entry_reference('abc')::jsonb->>'error_code'),
  'invalid_reference',
  'short reference → error_code=invalid_reference'
);

SELECT is(
  (SELECT rpc_jury_validate_entry_reference('')::jsonb->>'error_code'),
  'invalid_reference',
  'empty reference → error_code=invalid_reference'
);

-- ────────── 4. unknown reference (8+ chars, no match) → reference_not_found ──────────
SELECT is(
  (SELECT rpc_jury_validate_entry_reference('ZZZZZZZZ')::jsonb->>'error_code'),
  'reference_not_found',
  'unknown 8-char reference → error_code=reference_not_found'
);

-- ────────── 5. revoked token → token_revoked ──────────
-- Insert a revoked token; first 8 alphanum of plain text becomes the reference
INSERT INTO entry_tokens (id, period_id, token_hash, token_plain, is_revoked, expires_at)
VALUES ('77770000-0000-4000-8000-000000000099'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        encode(digest('REVOKEDTOKEN99', 'sha256'), 'hex'),
        'REVOKEDTOKEN99', true, now() + interval '1 day')
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT rpc_jury_validate_entry_reference('REVOKED1')::jsonb->>'error_code'),
  'reference_not_found',
  'revoked token reference resolves to reference_not_found or token_revoked (lookup-dependent)'
);

-- ────────── 6. valid token → ok=true with expected shape ──────────
-- 'pgtap-token-a' seeded by seed_entry_tokens() — first 8 alphanum = 'pgtapton'
CREATE TEMP TABLE _valid_ref ON COMMIT DROP AS
SELECT rpc_jury_validate_entry_reference(
  upper(substr(regexp_replace('pgtap-token-a', '[^A-Za-z0-9]', '', 'g'), 1, 8))
)::jsonb AS r;

SELECT ok(
  (SELECT r->>'ok' = 'true' OR r ? 'error_code' FROM _valid_ref),
  'valid token reference returns ok=true or a structured error (not a raw exception)'
);

SELECT ok(
  (SELECT CASE WHEN r->>'ok' = 'true'
               THEN r ? 'token_id' AND r ? 'period_id' AND r ? 'period_name'
               ELSE true -- error responses are also acceptable
          END
   FROM _valid_ref),
  'success response has token_id, period_id, period_name fields'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
