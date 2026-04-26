# Pending pgTAP contract tests

This directory holds RPC contract tests that are temporarily excluded from
CI's `pg_prove` run. The drift sentinel `scripts/check-rpc-tests-exist.mjs`
explicitly excludes `_pending/` from its coverage scan, so files here do
**not** satisfy the gate.

## Current state

5 files quarantined. See table below.

## When to put a file here

Use `_pending/` only when a contract is genuinely blocked — e.g. the RPC's
behavior is intentionally in flux during a refactor and rewriting the test
now would just churn. For tests that fail because of test-side mismatches
(arg names, error envelope shape, missing seed data), fix the test in
place rather than quarantining.

## Quarantine recipe

If you must quarantine:

1. Move the file from `sql/tests/rpcs/contracts/<file>.sql` into this dir.
2. Add a row to the table below describing the root cause + fix recipe.
3. Open a follow-up issue and reference it in the row.
4. Schedule re-promotion as soon as the upstream change lands.

| File | Root cause | Fix recipe |
|---|---|---|
| `backup_list.sql` | `rpc_backup_list` is defined in `008_platform.sql`; CI caps at 007. Function and `platform_backups` table do not exist in CI. | Apply 008_platform in CI (requires pg_cron/pg_net Supabase extensions) or add skip-guard pattern. |
| `backup_record_download.sql` | `rpc_backup_record_download` + `platform_backups` table both live in 008_platform; CI caps at 007. Also: INSERT into `platform_backups` under `become_a()` context after fix would be needed. | Same as backup_list — enable 008 in CI or add skip-guard. |
| `backup_register.sql` | `rpc_backup_register` + `platform_backups` table live in 008_platform; CI caps at 007. | Same as backup_list — enable 008 in CI or add skip-guard. |
| `public_platform_settings.sql` | `rpc_public_platform_settings` is in 008_platform; CI caps at 007. Function does not exist in CI. | Enable 008 in CI or add skip-guard pattern (see Re-promotion checklist §4). |
| `org_admin_transfer_ownership.sql` | Test 5 asserts `unauthorized` for cross-tenant call but RPC raises `target_not_found` when the org lookup returns empty first. Test 6 success block INSERTs into `auth.users` under `become_super()` context (authenticated role lacks write access to auth schema). | Read 006b RPC body to confirm error order; move `auth.users` INSERT before any `become_*()` call; verify test 5 expected error code. |

## Re-promotion checklist

When fixing a quarantined test:

1. Read the current RPC body in `sql/migrations/00{5,6a,6b,9}_*.sql` to
   confirm the actual error codes, return shape, and pre-conditions.
2. Verify seed UUIDs against `sql/tests/_helpers.sql`:
   - Admin A user id = `aaaa0000-0000-4000-8000-000000000001`
   - Admin B user id = `bbbb0000-0000-4000-8000-000000000002`
   - Super       = `eeee0000-0000-4000-8000-00000000000e`
   - Juror A (after `seed_jurors`) = `55550000-0000-4000-8000-000000000001`
3. Move all `INSERT`s for privileged tables (`memberships`, `jurors`,
   `entry_tokens`, `juror_period_auth`) BEFORE any `become_*()` call so they
   run as postgres without RLS interference.
4. For RPCs that live in migration 009 (audit module): CI caps at 007,
   so the test must skip cleanly when the function is absent. The
   canonical pattern is:

   ```sql
   CREATE TEMP TABLE _ctx ON COMMIT DROP AS
   SELECT EXISTS (
     SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '<rpc_name>'
   ) AS rpc_exists;

   SELECT skip('migration 009 not applied — <rpc_name> missing', N)
   FROM _ctx WHERE NOT rpc_exists;

   -- Each assertion gates on rpc_exists:
   SELECT has_function(...) FROM _ctx WHERE rpc_exists;
   SELECT pgtap_test.become_a() FROM _ctx WHERE rpc_exists;
   SELECT throws_ok(...) FROM _ctx WHERE rpc_exists;
   ```

   Avoid `\if` / `\gset` psql meta-commands — they previously produced
   `pg_prove` exit code 3 even with `plan(0)`.
5. Verify the test plan(N) matches the actual assertion count.
6. Move file back to `sql/tests/rpcs/contracts/` and run:

   ```bash
   pg_prove --verbose sql/tests/rpcs/contracts/<file>.sql
   ```

   …both locally and via CI. The file will then be picked up by
   `check:rpc-tests`.
