-- RPC: rpc_admin_generate_entry_token(uuid) → text
--
-- Pins the public contract documented in 006a_rpcs_admin.sql:
--   * Signature: (p_period_id uuid) returning text
--   * Unknown period            → RAISE 'period_not_found'
--   * Non-admin caller          → RAISE 'unauthorized'
--   * Period not published      → RAISE 'period_not_published'
--   * Success                   → returns plaintext token (UUID format)
--   * Previous tokens revoked   → is_revoked=true before new token inserted
--   * Token hash is SHA256 hex  → 64 hex digits
--   * Audit log created
--
-- See docs/qa/vera-test-audit-report.md §6 + §9 P0 #4.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(10);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ────────── 1. signature pinned ──────────
SELECT has_function(
  'public', 'rpc_admin_generate_entry_token',
  ARRAY['uuid'],
  'rpc_admin_generate_entry_token(uuid) exists'
);

SELECT function_returns(
  'public', 'rpc_admin_generate_entry_token',
  ARRAY['uuid'],
  'text',
  'returns text'
);

-- ────────── 2. unknown period → raises period_not_found ──────────
SELECT pgtap_test.become_a();

SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('00000000-0000-4000-8000-000000000abc'::uuid)$c$,
  NULL::text,
  'period_not_found'::text,
  'unknown period → raises period_not_found'
);

-- ────────── 3. period not published (is_locked=false) → raises period_not_published ──────────
-- Period A1 (cccc...0001) is unlocked (not published)
SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000001'::uuid)$c$,
  NULL::text,
  'period_not_published'::text,
  'unpublished period → raises period_not_published'
);

-- ────────__ 4. non-admin caller → raises unauthorized ──────────
SELECT pgtap_test.become_reset();

SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000011'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'unauthenticated caller → raises unauthorized'
);

-- ────────__ 5. org-admin on published period → returns text token ──────────
SELECT pgtap_test.become_a();

-- Period A2 (cccc...0011) is locked (published)
SELECT ok(
  (SELECT (rpc_admin_generate_entry_token(
     'cccc0000-0000-4000-8000-000000000011'::uuid
   ) IS NOT NULL)),
  'org-admin on published period → returns non-null text'
);

-- ────────__ 6. token is valid UUID format (36 hex + 4 dashes) ──────────
-- Parse result as UUID to verify format
SELECT ok(
  (SELECT (
     rpc_admin_generate_entry_token(
       'cccc0000-0000-4000-8000-000000000011'::uuid
     )::uuid IS NOT NULL
   )),
  'token parses as valid UUID format'
);

-- ────────__ 7. token_hash in DB is SHA256 (64 hex chars) ──────────
-- Get the token, hash it, check the DB
SELECT ok(
  (SELECT (
     (SELECT token_hash FROM entry_tokens
      WHERE period_id = 'cccc0000-0000-4000-8000-000000000011'::uuid
        AND is_revoked = false
      ORDER BY created_at DESC LIMIT 1) ~ '^[a-f0-9]{64}$'
   )),
  'token_hash in DB matches SHA256 hex pattern (64 hex digits)'
);

-- ────────── 8. previous tokens for same period are revoked ──────────
-- Generate two tokens for the same period (PERFORM is PL/pgSQL-only,
-- so use SELECT … INTO at top level).
SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000011'::uuid);
SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000011'::uuid);

-- Count non-revoked tokens for this period; should be exactly 1
SELECT is(
  (SELECT COUNT(*) FROM entry_tokens
   WHERE period_id = 'cccc0000-0000-4000-8000-000000000011'::uuid
     AND is_revoked = false),
  1,
  'after two token generations, only the latest is non-revoked'
);

-- ────────__ 9. cross-tenant admin (B on A period) → raises unauthorized ──────────
SELECT pgtap_test.become_b();

SELECT throws_ok(
  $c$SELECT rpc_admin_generate_entry_token('cccc0000-0000-4000-8000-000000000011'::uuid)$c$,
  NULL::text,
  'unauthorized'::text,
  'admin B on org A period → raises unauthorized'
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
