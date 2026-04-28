-- RPC: rpc_admin_generate_entry_token(p_period_id uuid) → text
--
-- Contract (006a_rpcs_admin.sql):
--   * Unknown period          → 'period_not_found'
--   * Non-member caller       → 'unauthorized'
--   * Period is_locked=false  → 'period_not_published'
--   * Happy path              → returns plaintext token AND writes an
--                               entry_tokens row whose SHA-256 hash matches;
--                               any previously-active token is revoked.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();  -- A1 unlocked, A2 locked, B1 unlocked, B2 locked
SELECT pgtap_test.seed_entry_tokens();

-- Move the pre-seeded A1 token to the locked period A2 so we can verify that
-- generating a new token revokes the previous one on the SAME period.
UPDATE entry_tokens
SET period_id = 'cccc0000-0000-4000-8000-000000000011'::uuid
WHERE id = '77770000-0000-4000-8000-000000000001'::uuid;

SELECT pgtap_test.become_a();

-- ────────── 1. unknown period ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period_id raises period_not_found'::text
);

-- ────────── 2. cross-tenant (period in org B) ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('dddd0000-0000-4000-8000-000000000022'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'admin A cannot generate token for org B period'::text
);

-- ────────── 3. unlocked period is blocked ──────────
SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'period_not_published'::text,
  'unlocked period raises period_not_published'::text
);

-- ────────── 4. happy path on locked period A2 ──────────
CREATE TEMP TABLE _pgtap_tok (token text) ON COMMIT DROP;
INSERT INTO _pgtap_tok (token)
SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000011'::uuid);

SELECT isnt(
  (SELECT token FROM _pgtap_tok LIMIT 1),
  NULL::text,
  'admin A generates a plaintext token for locked period A2'::text
);

-- ────────── 5. previous active token on same period was revoked ──────────
SELECT pgtap_test.become_reset();
SELECT is(
  (SELECT is_revoked FROM entry_tokens
   WHERE id = '77770000-0000-4000-8000-000000000001'::uuid),
  true,
  'previous active token on the period was revoked during generation'::text
);

-- ────────── 6. audit row written for token.generate ──────────
SELECT ok(
  EXISTS(
    SELECT 1 FROM audit_logs
    WHERE action = 'token.generate'
  ),
  'rpc_admin_generate_entry_token writes token.generate to audit_logs'::text
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
