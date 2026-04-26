-- RPC: rpc_get_public_feedback() → jsonb
--
-- Pins the public contract:
--   * Signature: () returning jsonb
--   * No auth required (anon + authenticated)
--   * Returns {avg_rating, total_count, testimonials}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_get_public_feedback',
  ARRAY[]::text[],
  'rpc_get_public_feedback() exists'
);

SELECT function_returns(
  'public', 'rpc_get_public_feedback',
  ARRAY[]::text[],
  'jsonb',
  'returns jsonb'
);

-- ────────── 2. anon can call ──────────
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_get_public_feedback()$c$,
  'anon role can call rpc_get_public_feedback'
);

-- ────────── 3. response is not null ──────────
SELECT ok(
  (SELECT rpc_get_public_feedback() IS NOT NULL),
  'response is not null'
);

-- ────────── 4. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_get_public_feedback()$c$,
  'authenticated role can call rpc_get_public_feedback'
);

-- ────────── 5. response has expected keys ──────────
SELECT ok(
  (SELECT (rpc_get_public_feedback() ? 'avg_rating')
     AND (rpc_get_public_feedback() ? 'total_count')
     AND (rpc_get_public_feedback() ? 'testimonials')),
  'response has avg_rating, total_count, testimonials keys'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
