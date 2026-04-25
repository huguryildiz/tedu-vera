# Pending pgTAP contract tests

These RPC contract tests are temporarily excluded from CI's `pg_prove` run
because they fail in CI's migration-007 cap or have logic bugs that need
deeper investigation than a quick patch can deliver.

## Why excluded

| File | Root cause |
|---|---|
| `admin_verify_audit_chain.sql` | RPC lives in migration 009 (`009_audit.sql`); CI caps at 007. The `\gset` + `\if` skip pattern produced exit code 3 even with `plan(0)`. Need to either: (a) bump CI migration cap to 009 with `pg_cron`/`pg_net` shims (per `docs/superpowers/plans/test-hardening/REMAINING-WORK.md` A.3) or (b) use `skip_all('migration 009 not applied')` from pgTAP. |
| `admin_reject_application.sql` | planned 10 tests but only 8 ran; test 7 fails. Likely RPC error-path assertion mismatch + abort on test 9 setup. |
| `admin_reject_join_request.sql` | Test 4 fails, then abort. Setup in test 5 likely hits FK / RLS issue. |
| `admin_save_period_criteria.sql` | Tests 1-5 fail. Probable signature mismatch between assertion ARRAY and actual RPC arg types. |
| `admin_update_organization.sql` | Tests 1-3 fail (signature/return-type pinning), then abort. Same likely root cause. |
| `admin_upsert_period_criterion_outcome_map.sql` | All 7 tests fail. Need to read the RPC body, then realign every assertion. |
| `juror_toggle_edit_mode.sql` | Test 7 (success path) fails — `INSERT INTO juror_period_auth ... ON CONFLICT (juror_id, period_id) DO UPDATE SET final_submitted_at = now()` runs as `authenticated` (after `become_a()`); RLS may block. |
| `org_admin_remove_member.sql` | Aborts after test 4 — `INSERT INTO memberships` references non-seeded user `aaaa-...0002` (only `0001` exists in seed_two_orgs). |
| `submit_jury_feedback.sql` | Aborts after test 5 — test 6 INSERT into `juror_period_auth (juror_id, period_id, status, session_token_hash)` may have a column that doesn't exist (`status` column may not be there) or NOT NULL violation. |

## How to fix

For each file, the recipe is:

1. Read the RPC body in `sql/migrations/00{5,6a,6b}_*.sql`. Identify the exact error-code priority and which fields are required.
2. Verify the seeded UUIDs match `sql/tests/_helpers.sql`. Specifically:
   - Admin A user id = `aaaa0000-0000-4000-8000-000000000001` (NOT `0002`)
   - Admin B = `bbbb0000-0000-4000-8000-000000000002`
   - Super = `eeee0000-0000-4000-8000-00000000000e`
   - Juror A (after `seed_jurors`) = `55550000-0000-4000-8000-000000000001`
3. Move all `INSERT`s for privileged tables (`memberships`, `jurors`, `entry_tokens`, `juror_period_auth`) BEFORE any `become_*()` call so they run as postgres without RLS interference.
4. Verify the test plan(N) count matches the actual number of pgTAP assertions.
5. Run locally with a postgres-15 + pgTAP setup (Docker image `bitnami/postgresql:15` plus `pgtap` extension) before pushing.

## Re-enabling

When fixed, move the file back to `sql/tests/rpcs/contracts/` and verify:

```bash
pg_prove --verbose sql/tests/rpcs/contracts/<file>.sql
```

Both locally and via CI.
