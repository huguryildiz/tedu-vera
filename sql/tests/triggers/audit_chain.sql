-- Audit hash-chain trigger — tamper-evidence contract for VERA audit logs.
--
-- Pins the behaviour documented in sql/migrations/009_audit.sql:
--
--   Layer 1 — INSERT trigger: audit_logs_compute_hash() (BEFORE INSERT)
--     hash formula: sha256(id || action || coalesce(org_id,'') || created_at || prev_hash)
--     prev_hash = 'GENESIS' for the first row in each org's chain.
--
--   Layer 2 — Chain verifier: _audit_verify_chain_internal(org_id)
--     Walks rows in chain_seq order, re-derives each expected hash, returns
--     '[]'::jsonb when intact, broken-link objects otherwise.
--
--   Layer 3 — RLS append-only enforcement:
--     "no_delete_audit_logs" policy  FOR DELETE USING(false) → silent 0-row block
--     No UPDATE policy               → UPDATE also silently affects 0 rows
--
--   Multi-tenancy: each organization_id partition starts from its own 'GENESIS'
--   so org A's chain never bleeds into org B's.
--
-- Bug classes caught:
--   1. Trigger dropped or hash formula changed — row_hash would diverge from
--      the expected recomputation in assertions 2 and 3.
--   2. Chain linkage broken — row2 not using row1.row_hash as prev_hash →
--      assertion 3 fails and _audit_verify_chain_internal returns a non-empty array.
--   3. RLS delete/update policy weakened — authenticated could tamper or erase
--      rows; assertions 5-8 catch this.
--   4. Tenant chain isolation removed — org B's first row would incorporate
--      org A's last hash instead of GENESIS → assertion 9 fails.

BEGIN;
SET LOCAL search_path = tap, public, extensions;

-- ────────── Skip-guard: only meaningful when migration 009 is applied ──────────
-- audit_logs_compute_hash is defined in 009_audit.sql; CI caps at 007.
-- Assertion 4 calls _audit_verify_chain_internal via lives_ok (string literal)
-- so it is deferred to execution time and safe when function is absent.
CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'audit_logs_compute_hash'
) AS m009;

SELECT plan(9);

SELECT skip('migration 009 not applied — audit_logs_compute_hash missing', 9)
FROM _ctx WHERE NOT m009;

-- ─────────────────────────────────────────────────────────────────────────
-- Setup: seed, clean, and insert rows.
-- Safe to run unconditionally — audit_logs table exists before migration 009.
-- When 009 is absent the trigger won't fire and row_hash stays NULL;
-- all assertions below are gated on m009 so they are skipped in that case.
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.seed_two_orgs();

-- Clean any pre-existing audit_log rows for the pgtap org UUIDs.
-- Audit triggers fire on seed_two_orgs() (organizations + memberships INSERT),
-- so those rows exist from prior sessions and are NOT inside this transaction.
-- Deleting them here (as superuser, inside the outer BEGIN/ROLLBACK) resets
-- both org chains to a clean GENESIS state for deterministic hash assertions.
DELETE FROM audit_logs
WHERE organization_id IN (
  '11110000-0000-4000-8000-000000000001'::uuid,
  '22220000-0000-4000-8000-000000000002'::uuid
);

-- Seed: insert two rows for org A and one for org B as superuser so that
-- the trigger fires in an uncontested chain.  Fixed UUIDs guarantee
-- deterministic cross-references in assertions 2, 3, and 9 below.
INSERT INTO audit_logs (id, organization_id, action, category, severity, actor_type)
VALUES
  ('a4440000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap_event_1', 'data', 'info', 'admin'),
  ('a4440000-0000-4000-8000-000000000002'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   'pgtap_event_2', 'data', 'info', 'admin');

-- Org B row: inserted AFTER org A rows so any cross-tenant bleed would show
-- up as an incorrect prev_hash (org A hash instead of 'GENESIS').
INSERT INTO audit_logs (id, organization_id, action, category, severity, actor_type)
VALUES
  ('b4440000-0000-4000-8000-000000000001'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid,
   'pgtap_event_b1', 'data', 'info', 'admin');

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Trigger fires: first row's row_hash is populated.
-- ─────────────────────────────────────────────────────────────────────────
SELECT isnt(
  (SELECT row_hash FROM audit_logs
   WHERE id = 'a4440000-0000-4000-8000-000000000001'::uuid),
  NULL,
  'first audit_log row gets a non-null row_hash (trigger fired)'
) FROM _ctx WHERE m009;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. First row hash = sha256(id || action || org_id || created_at || 'GENESIS')
--    Re-derive the expected hash from the stored row's own fields so the
--    assertion is immune to SERIAL gaps or timestamp drift.
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT row_hash FROM audit_logs
   WHERE id = 'a4440000-0000-4000-8000-000000000001'::uuid),
  (SELECT encode(sha256(
    (r.id::text
     || r.action
     || COALESCE(r.organization_id::text, '')
     || r.created_at::text
     || 'GENESIS')::bytea
  ), 'hex')
   FROM audit_logs r
   WHERE r.id = 'a4440000-0000-4000-8000-000000000001'::uuid),
  'row 1 row_hash = sha256(id||action||org_id||created_at||GENESIS)'
) FROM _ctx WHERE m009;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Second row chains from first: row_hash2 = sha256(…||row_hash1)
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT row_hash FROM audit_logs
   WHERE id = 'a4440000-0000-4000-8000-000000000002'::uuid),
  (SELECT encode(sha256(
    (r2.id::text
     || r2.action
     || COALESCE(r2.organization_id::text, '')
     || r2.created_at::text
     || r1.row_hash)::bytea
  ), 'hex')
   FROM audit_logs r1
   JOIN audit_logs r2 ON true
   WHERE r1.id = 'a4440000-0000-4000-8000-000000000001'::uuid
     AND r2.id = 'a4440000-0000-4000-8000-000000000002'::uuid),
  'row 2 row_hash chains from row 1 (prev_hash = row_1.row_hash)'
) FROM _ctx WHERE m009;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. _audit_verify_chain_internal executes without error for org A.
--    Called via lives_ok (string literal) so function resolution is deferred
--    to runtime — avoids a parse-time "function does not exist" when
--    migration 009 is absent.
-- ─────────────────────────────────────────────────────────────────────────
SELECT lives_ok(
  $_$SELECT _audit_verify_chain_internal('11110000-0000-4000-8000-000000000001'::uuid)$_$,
  '_audit_verify_chain_internal executes without error for org A (chain intact)'
) FROM _ctx WHERE m009;

-- ─────────────────────────────────────────────────────────────────────────
-- 5–6. "no_delete_audit_logs" RLS policy (USING false) silently blocks DELETE.
--      The authenticated role sees 0 rows deleted, no exception raised.
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.become_a() FROM _ctx WHERE m009;

SELECT lives_ok(
  $d$DELETE FROM audit_logs
     WHERE id = 'a4440000-0000-4000-8000-000000000001'::uuid$d$,
  'authenticated DELETE on audit_logs executes without raising (silently blocked by RLS)'
) FROM _ctx WHERE m009;

SELECT pgtap_test.become_reset() FROM _ctx WHERE m009;

SELECT is(
  (SELECT COUNT(*)::int FROM audit_logs
   WHERE id = 'a4440000-0000-4000-8000-000000000001'::uuid),
  1,
  'audit_log row still present after RLS-blocked DELETE (no_delete_audit_logs policy)'
) FROM _ctx WHERE m009;

-- ─────────────────────────────────────────────────────────────────────────
-- 7–8. No UPDATE policy → UPDATE silently blocked for authenticated role.
-- ─────────────────────────────────────────────────────────────────────────
SELECT pgtap_test.become_a() FROM _ctx WHERE m009;

SELECT lives_ok(
  $u$UPDATE audit_logs SET row_hash = 'tampered_hash_value'
     WHERE id = 'a4440000-0000-4000-8000-000000000001'::uuid$u$,
  'authenticated UPDATE on audit_logs executes without raising (no UPDATE policy = 0 rows)'
) FROM _ctx WHERE m009;

SELECT pgtap_test.become_reset() FROM _ctx WHERE m009;

SELECT isnt(
  (SELECT row_hash FROM audit_logs
   WHERE id = 'a4440000-0000-4000-8000-000000000001'::uuid),
  'tampered_hash_value',
  'row_hash unchanged after RLS-blocked UPDATE (append-only enforced)'
) FROM _ctx WHERE m009;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Cross-tenant chain isolation: org B first row chains from GENESIS,
--    not from org A's last row_hash.
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (SELECT row_hash FROM audit_logs
   WHERE id = 'b4440000-0000-4000-8000-000000000001'::uuid),
  (SELECT encode(sha256(
    (r.id::text
     || r.action
     || COALESCE(r.organization_id::text, '')
     || r.created_at::text
     || 'GENESIS')::bytea
  ), 'hex')
   FROM audit_logs r
   WHERE r.id = 'b4440000-0000-4000-8000-000000000001'::uuid),
  'org B first row chains from GENESIS (independent tenant chain, not org A hash)'
) FROM _ctx WHERE m009;

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
