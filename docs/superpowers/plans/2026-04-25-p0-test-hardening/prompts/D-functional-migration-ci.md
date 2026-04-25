# D — Functional migration CI workflow (Pazartesi)

**You are a Sonnet 4.6 subagent dispatched by the main Opus session.**

**Repo root:** `/Users/huguryildiz/Documents/GitHub/VERA`
**Your scope:** Create `.github/workflows/migration-ci.yml` that functionally validates DB migrations.

---

## Goal

Write a GitHub Actions workflow that:

1. Spins up a Postgres 15 container as a service
2. Installs pgTAP + pg_prove
3. Applies `sql/migrations/001_extensions.sql` through `sql/migrations/009_audit.sql` in order
4. Runs `pg_prove sql/tests/**/*.sql` against the fresh DB
5. Fails the PR if any migration fails OR any pgTAP test fails

This enforces the `CLAUDE.md` rule: **"Test from zero: After any migration change, apply 000→009 on a fresh DB and verify."**

## Context

VERA's migration structure (see `sql/README.md`):

- `000_dev_teardown.sql` — dev-only, skip in CI
- `001_extensions.sql` — uuid-ossp, pgcrypto
- `002_tables.sql` — tables, enums, views, indexes
- `003_helpers_and_triggers.sql` — helper functions, triggers
- `004_rls.sql` — RLS policies
- `005_rpcs_jury.sql` — jury RPCs
- `006a_rpcs_admin.sql`, `006b_rpcs_admin.sql` — admin RPCs (two parts)
- `007_identity.sql` — admin_invites, sessions
- `008_platform.sql` — platform settings, metrics, backups
- `009_audit.sql` — audit system

Apply in this order: 001, 002, 003, 004, 005, 006a, 006b, 007, 008, 009 (skip 000).

Existing pgTAP tests at `sql/tests/**/*.sql`:

- `_helpers.sql` (must load first)
- `rls/*.sql` (9 files)
- `rpcs/jury/*.sql` (4 files)
- `rpcs/admin/*.sql` (5 files)
- After Parça C, also: `rpcs/contracts/*.sql` (9 new files)

## Files to read FIRST

1. `sql/README.md` — full migration policy
2. `sql/tests/RUNNING.md` — current test runner instructions (to understand pg_prove invocation)
3. `.github/workflows/e2e.yml` — existing workflow for structure reference
4. `sql/migrations/001_extensions.sql` (just the extensions list) — to know what pgcrypto/uuid-ossp setup needs
5. One of the test files (e.g., `sql/tests/rls/organizations_isolation.sql`) — to understand pgTAP requirements

## Workflow structure

Create `.github/workflows/migration-ci.yml`:

```yaml
name: Migration CI

on:
  pull_request:
    paths:
      - 'sql/**'
      - '.github/workflows/migration-ci.yml'
  push:
    branches: [main]
    paths:
      - 'sql/**'
  workflow_dispatch:

jobs:
  migration-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_USER: postgres
          POSTGRES_DB: vera_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      PGHOST: localhost
      PGPORT: 5432
      PGUSER: postgres
      PGPASSWORD: postgres
      PGDATABASE: vera_test

    steps:
      - uses: actions/checkout@v4

      - name: Install psql + pgTAP + pg_prove
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client postgresql-15-pgtap libtap-parser-sourcehandler-pgtap-perl

      - name: Wait for Postgres
        run: |
          until pg_isready; do sleep 1; done

      - name: Enable extensions
        run: |
          psql -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
          psql -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

      - name: Apply migrations in order
        run: |
          for f in 001_extensions 002_tables 003_helpers_and_triggers 004_rls 005_rpcs_jury 006a_rpcs_admin 006b_rpcs_admin 007_identity 008_platform 009_audit; do
            echo "--- Applying $f.sql ---"
            psql -v ON_ERROR_STOP=1 -f sql/migrations/$f.sql
          done

      - name: Load test helpers
        run: psql -v ON_ERROR_STOP=1 -f sql/tests/_helpers.sql

      - name: Run pgTAP tests
        run: |
          pg_prove --verbose \
            sql/tests/rls/*.sql \
            sql/tests/rpcs/jury/*.sql \
            sql/tests/rpcs/admin/*.sql \
            sql/tests/rpcs/contracts/*.sql
```

**BUT VERIFY EACH LINE** — the exact `apt-get install` package names may vary between Ubuntu runner versions; check actions/runner-images docs or similar recent workflows.

## What to consider / possible issues

1. **`postgresql-15-pgtap` package name** — may need to use `postgresql-common` + manual install. If `apt` doesn't find it, try: `sudo apt-get install -y postgresql-server-dev-15 git build-essential make` then `git clone https://github.com/theory/pgtap` + `make install`. Document the choice in the workflow comments.

2. **`pg_prove` availability** — `libtap-parser-sourcehandler-pgtap-perl` ships `pg_prove`. Verify.

3. **Order of test files matters** — `_helpers.sql` must be loaded BEFORE `pg_prove` runs. The workflow above does this.

4. **`sql/tests/migrations/idempotency.test.js`** — this is a JS lint test, NOT pgTAP. Exclude it from `pg_prove` (the glob above already does — it's in `migrations/` not `rls/`/`rpcs/`).

5. **The `rpcs/contracts/` subdirectory** — will exist after Parça C. If your workflow runs BEFORE Parça C is committed, make the glob tolerant (e.g., `sql/tests/rpcs/*/*.sql` to cover all current + future subdirs).

6. **Idempotency test** — consider adding a separate job or step that runs the existing `sql/tests/migrations/idempotency.test.js` (via `node` or `vitest`). Low priority; document as optional.

## What you MUST do

1. Read the "files to read FIRST" list
2. Draft the workflow per the structure above
3. **Validate locally if possible:** `actionlint .github/workflows/migration-ci.yml` (if actionlint is installed; if not, skip)
4. Run a dry syntax check: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/migration-ci.yml'))"`
5. Add a comment at the top of the workflow referencing `docs/qa/vera-test-audit-report.md §9 P0 #2` and `CLAUDE.md` "Test from zero" rule

## What you MUST NOT do

- ❌ Do NOT modify existing migrations to make them CI-friendly (they must already be — this is a test of them)
- ❌ Do NOT push to vera-prod or vera-demo
- ❌ Do NOT use Supabase branching (local Postgres container is simpler + free + deterministic)
- ❌ Do NOT add secrets; this workflow uses only local ephemeral Postgres

## Output format

Return:

1. The created workflow file path
2. Whether you validated syntax (yes/no; which tool)
3. Any assumptions you had to make (e.g., which pgTAP install method)
4. Known risks or gotchas the user should be aware of before merging

Do NOT commit. Main session will commit after review.

## Environment reminder

- Read tool with absolute paths
- Write tool for new file creation
- Time budget: ~60-90 minutes
- If the pgTAP install path is unclear, pick the most documented option (apt if available, else git+make) and document your reasoning

Begin.
