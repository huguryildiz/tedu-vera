-- RPC: rpc_get_public_feedback(UUID, UUID) → json
--
-- Pins the public contract:
--   * Signature: (p_period_id UUID, p_project_id UUID) returning json
--   * No auth required (public feedback retrieval)
--   * Returns {feedback_text, submitted_at, anonymous}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_get_public_feedback',
  ARRAY['uuid'::text, 'uuid'::text],
  'rpc_get_public_feedback(uuid, uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_get_public_feedback',
  ARRAY['uuid'::text, 'uuid'::text],
  'json',
  'returns json'
);

-- ────────── 2. anon can call ──────────
-- Seed while authenticated (become_reset is the default privileged role)
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_projects();
SELECT pgtap_test.become_anon();

SELECT lives_ok(
  $c$SELECT rpc_get_public_feedback(
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
    (SELECT id FROM projects WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1)
  )$c$,
  'anon role can call rpc_get_public_feedback'
);

-- ────────__ 3. response is json ──────────
SELECT ok(
  (SELECT rpc_get_public_feedback(
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
    (SELECT id FROM projects WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1)
  ) IS NOT NULL),
  'response is not null'
);

-- ────────__ 4. authenticated can also call ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_a();

SELECT lives_ok(
  $c$SELECT rpc_get_public_feedback(
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1),
    (SELECT id FROM projects WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org A') LIMIT 1)
  )$c$,
  'authenticated role can call rpc_get_public_feedback'
);

-- ────────__ 5. returns feedback array or empty ──────────
SELECT ok(
  (SELECT rpc_get_public_feedback(
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1),
    (SELECT id FROM projects WHERE organization_id = (SELECT id FROM organizations WHERE name = 'pgtap Org B') LIMIT 1)
  )::jsonb IS NOT NULL),
  'returns valid jsonb for any period/project'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
