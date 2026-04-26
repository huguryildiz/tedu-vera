-- RLS isolation: unlock_requests.
--
-- Special-case shape: the table has ONE policy — SELECT — and writes are
-- only allowed via SECURITY DEFINER RPCs (rpc_admin_request_unlock,
-- rpc_super_admin_resolve_unlock). That means INSERT/UPDATE/DELETE from
-- direct table access must throw for *every* role including authenticated
-- admins. This is the "no write policies, RPC-only mutation" pattern that
-- shows up in 3 other tables (audit_logs, etc.) and is worth pinning here
-- as the canonical example.
--
-- Policies (sql/migrations/004_rls.sql §unlock_requests):
--   unlock_requests_select  — super_admin OR caller's org via memberships
--   (no INSERT, no UPDATE, no DELETE policies → RPC-only mutation)
--
-- Bug classes this file catches:
--   1. A future PR that adds a permissive INSERT policy "for convenience" —
--      tenant admins would bypass the RPC's reason-validation and audit
--      trail. The "all writes throw" assertions catch it immediately.
--   2. A regression in the SELECT policy that drops the org scope — admin A
--      starts seeing admin B's unlock requests.
--   3. The pending-request unique index dropping — duplicate requests
--      bypass the rpc_admin_request_unlock idempotency. Pinned here because
--      it is observable as a constraint violation on a second seed insert.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(8);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_unlock_requests();

-- ────────── 1. admin A sees only A's unlock requests ──────────
SELECT pgtap_test.become_a();
SELECT is(
  (SELECT count(*)::int FROM unlock_requests
   WHERE organization_id = '11110000-0000-4000-8000-000000000001'::uuid),
  1,
  'admin A sees own-org pending unlock request'::text
);

-- ────────── 2. admin A sees zero of B's unlock requests ──────────
SELECT is(
  (SELECT count(*)::int FROM unlock_requests
   WHERE organization_id = '22220000-0000-4000-8000-000000000002'::uuid),
  0,
  'admin A sees zero unlock requests in org B (silent filter)'::text
);

-- ────────── 3. admin A INSERT throws (no write policy → RPC-only) ──────────
SELECT throws_ok(
  $i$INSERT INTO unlock_requests
       (period_id, organization_id, requested_by, reason, status)
     VALUES ('cccc0000-0000-4000-8000-000000000011'::uuid,
             '11110000-0000-4000-8000-000000000001'::uuid,
             'aaaa0000-0000-4000-8000-000000000001'::uuid,
             'pgtap direct table insert attempt',
             'pending')$i$,
  '42501',
  NULL,
  'admin A direct-table INSERT is rejected (no INSERT policy → RPC-only)'::text
);

-- ────────── 4. admin A direct UPDATE throws — only SELECT is granted ──────────
--   The grant block in 002_tables.sql intentionally limits authenticated to
--   `GRANT SELECT ON unlock_requests`. Without UPDATE / DELETE / INSERT
--   table-level grants, Postgres rejects with 42501 *before* RLS evaluates.
--   That is stronger than RLS's silent 0-row filtering: a future PR that
--   adds a permissive UPDATE policy without the grant would still fail
--   loudly here. The "writes only via SECURITY DEFINER RPCs" architecture
--   depends on this being loud, not silent.
SELECT throws_ok(
  $u$UPDATE unlock_requests
       SET reason = 'pgtap pwned reason long enough to satisfy length CHECK'
     WHERE id = 'a3330000-0000-4000-8000-000000000a11'::uuid$u$,
  '42501',
  NULL,
  'admin A direct UPDATE rejected (no UPDATE grant — stronger than silent 0-row)'::text
);

-- ────────── 5. admin A direct DELETE throws — only SELECT is granted ──────────
SELECT throws_ok(
  $d$DELETE FROM unlock_requests
     WHERE id = 'a3330000-0000-4000-8000-000000000a11'::uuid$d$,
  '42501',
  NULL,
  'admin A direct DELETE rejected (no DELETE grant — RPC-only writes)'::text
);

-- ────────── 6. anon SELECT throws — no anon grant on this table ──────────
--   The unlock-request flow is admin-only end-to-end; there is intentionally
--   no anon SELECT grant. Postgres rejects with 42501 before RLS runs.
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_anon();
SELECT throws_ok(
  $s$SELECT count(*) FROM unlock_requests$s$,
  '42501',
  NULL,
  'anon SELECT rejected (no anon grant — admin-only feature)'::text
);

-- ────────── 7. super_admin sees both orgs' requests ──────────
SELECT pgtap_test.become_reset();
SELECT pgtap_test.become_super();
SELECT is(
  (SELECT count(*)::int FROM unlock_requests
   WHERE organization_id IN (
     '11110000-0000-4000-8000-000000000001'::uuid,
     '22220000-0000-4000-8000-000000000002'::uuid)),
  2,
  'super_admin sees all unlock requests (both orgs)'::text
);

-- ────────── 8. one-pending-per-period UNIQUE index is enforced ──────────
--   This is a structural pin, not RLS, but lives here because callers depend
--   on the idempotency it provides. Tested as superuser to bypass the
--   no-write-policy gate (we want the constraint, not the RLS, to fire).
SELECT pgtap_test.become_reset();
SELECT throws_ok(
  $i$INSERT INTO unlock_requests
       (period_id, organization_id, requested_by, reason, status)
     VALUES ('cccc0000-0000-4000-8000-000000000011'::uuid,
             '11110000-0000-4000-8000-000000000001'::uuid,
             'aaaa0000-0000-4000-8000-000000000001'::uuid,
             'pgtap dup pending — would race the rpc idempotency',
             'pending')$i$,
  '23505',
  NULL,
  'second pending request for same period violates one-pending-per-period unique index'::text
);

SELECT pgtap_test.become_reset();
SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
