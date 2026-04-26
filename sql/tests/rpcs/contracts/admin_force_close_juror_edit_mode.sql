-- RPC: rpc_admin_force_close_juror_edit_mode(UUID, UUID) → jsonb
--
-- Pins the public contract documented in 009_audit.sql:
--   * Signature: (p_juror_id UUID, p_period_id UUID) returning jsonb
--   * Authenticated required
--   * Calls _assert_org_admin
--   * Error codes: 'juror_id_and_period_id_required', 'juror_not_found'
--   * Returns {ok, affected_rows}

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(9);

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_force_close_juror_edit_mode',
  ARRAY['uuid'::text, 'uuid'::text],
  'rpc_admin_force_close_juror_edit_mode(uuid, uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_force_close_juror_edit_mode',
  ARRAY['uuid'::text, 'uuid'::text],
  'jsonb',
  'returns jsonb'
);

-- ────────__ 2. unauthenticated → cannot call ──────────
SELECT pgtap_test.become_anon();

SELECT throws_ok(
  $c$SELECT rpc_admin_force_close_juror_edit_mode('pgtap-juror-9999'::uuid, 'pgtap-period-9999'::uuid)$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 3. null parameters → required error ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_force_close_juror_edit_mode(NULL, NULL)$c$,
  NULL::text,
  'juror_id_and_period_id_required'
);

-- ────────__ 4. org-admin can close edit mode for org juror/period ──────────
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_jurors();

-- Get org_a's juror and period
SELECT lives_ok(
  $c$SELECT rpc_admin_force_close_juror_edit_mode(
    (SELECT id FROM jurors WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1),
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1)
  )$c$,
  'org_a admin can force close edit mode'
);

-- ────────__ 5. org-admin cannot close for other org ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_force_close_juror_edit_mode(
    (SELECT id FROM jurors WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_b') LIMIT 1),
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_b') LIMIT 1)
  )$c$,
  NULL::text,
  'attempted to access'
);

-- ────────__ 6. super-admin can close any juror/period ──────────
SELECT pgtap_test.become_super();

SELECT lives_ok(
  $c$SELECT rpc_admin_force_close_juror_edit_mode(
    (SELECT id FROM jurors WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_b') LIMIT 1),
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_b') LIMIT 1)
  )$c$,
  'super-admin can force close edit mode for any org'
);

-- ────────__ 7. response shape ──────────
SELECT ok(
  (SELECT rpc_admin_force_close_juror_edit_mode(
    (SELECT id FROM jurors WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1),
    (SELECT id FROM periods WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_a') LIMIT 1)
  )::jsonb ? 'ok'),
  'response has ok key'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
