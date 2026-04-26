# Pending pgTAP contract tests

This directory holds RPC contract tests that are temporarily excluded from
CI's `pg_prove` run. The drift sentinel `scripts/check-rpc-tests-exist.mjs`
explicitly excludes `_pending/` from its coverage scan, so files here do
**not** satisfy the gate.

## Current state

2 files quarantined. See table below.

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
| `backup_list.sql` | `rpc_backup_list` is defined in `008_platform.sql`. CI applies all migrations 001–009, but this test's INSERT/SELECT patterns need verification against the current `platform_backups` schema. | Read 008_platform.sql `rpc_backup_list` body; rewrite test with correct table/column names. |
| `get_period_impact.sql` | Test was written for an org-admin function, but `rpc_get_period_impact(UUID, TEXT)` is a jury RPC that takes `(p_period_id, p_session_token)` and authenticates via session token, not org JWT. All test assertions (signature, auth model, response shape) are wrong. | Rewrite test from scratch against actual jury RPC signature: `(uuid, text) → jsonb`. Tests should call with a valid session token obtained via `seed_jurors` + jury auth flow, or skip if setup is too complex. Response keys: `total_projects`, `projects`, `juror_scores`, `jurors`. |

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
4. For RPCs that depend on optional extensions (pg_cron, pg_net): CI applies
   all migrations 001–009 but these extensions may be absent. The test must
   skip cleanly when the function is absent. The canonical pattern is:

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
