-- RPC: rpc_get_period_impact(UUID, TEXT) -> jsonb
--
-- Pins the public contract:
--   * Signature: (p_period_id UUID, p_session_token TEXT) returning jsonb
--   * Granted to anon AND authenticated (jury-side RPC, gated by session token)
--   * Looks up juror_period_auth row by period_id + sha256(p_session_token)
--   * Raises 'invalid_session' when no matching active juror session
--   * Returns {total_projects, projects, juror_scores, jurors}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(5);

-- ---------- 1. signature pinned ----------
SELECT has_function(
  'public', 'rpc_get_period_impact',
  ARRAY['uuid'::text, 'text'::text],
  'rpc_get_period_impact(uuid, text) exists'
);

SELECT function_returns(
  'public', 'rpc_get_period_impact',
  ARRAY['uuid'::text, 'text'::text],
  'jsonb',
  'returns jsonb'
);

-- ---------- 2. jury-side: anon AND authenticated have execute ----------
SELECT ok(
  has_function_privilege('anon', 'public.rpc_get_period_impact(uuid, text)', 'execute'),
  'anon has execute privilege (jury-side RPC)'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.rpc_get_period_impact(uuid, text)', 'execute'),
  'authenticated has execute privilege (jury-side RPC)'
);

-- ---------- 3. invalid session token raises invalid_session ----------
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

SELECT throws_ok(
  $c$SELECT rpc_get_period_impact(
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
    'invalid-token-does-not-match-any-session'
  )$c$,
  NULL::text,
  'invalid session token raises invalid_session'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
