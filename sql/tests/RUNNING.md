# Running pgTAP tests

SQL-level tests for VERA. Each file is **self-contained**: wraps its body in
`BEGIN … ROLLBACK`, seeds what it needs, asserts, and leaves the database
unchanged on exit. Safe to run against prod and demo without persisting any
fixture rows.

## Layout

```text
sql/tests/
├── _helpers.sql         Shared fixtures (pgtap_test schema).
│                        Install once per DB; idempotent.
├── rls/                 Row-Level Security isolation tests (9 files).
├── rpcs/
│   ├── jury/            Jury-facing RPC behavior tests (4 files).
│   ├── admin/           Admin-facing RPC behavior tests (5 files).
│   └── contracts/       RPC contract pinning — has_function +
│                        function_returns + auth-gate + error-code shape
│                        for the 9 most-critical RPCs (9 files).
├── migrations/          Migration idempotency tests (1 file).
└── RUNNING.md           This file.
```

Each test file ends with a single-row `result` column:

- `ALL TESTS PASSED` — every `plan()` assertion passed.
- `# Looks like you failed N tests of M` — pgTAP failure summary.

## Prereqs

The `pgtap` extension + grants must be in place:

```sql
-- sql/migrations/001_extensions.sql
CREATE EXTENSION IF NOT EXISTS "pgtap" SCHEMA tap;
GRANT USAGE   ON SCHEMA tap TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tap TO authenticated, anon;
```

And the test helpers must be installed (`sql/tests/_helpers.sql`) on **both**
`vera-prod` and `vera-demo`. The helpers create the `pgtap_test` schema and
define `seed_two_orgs()` / `seed_periods()` / `seed_projects()` /
`seed_jurors()` / `seed_entry_tokens()` / `become_a()` / `become_b()` /
`become_super()` / `become_reset()`.

## Running — option A: `pg_prove` (local)

```bash
# Install pg_prove if missing:
cpan TAP::Parser::SourceHandler::pgTAP

# Apply helpers once (idempotent):
psql "$DATABASE_URL" -f sql/tests/_helpers.sql

# Run a single suite:
pg_prove -d "$DATABASE_URL" sql/tests/rls/*.sql

# Run everything:
pg_prove -d "$DATABASE_URL" sql/tests/**/*.sql
```

## Running — option B: Supabase MCP `execute_sql`

Claude Code + the Supabase MCP can run each file by passing its contents to
`mcp__claude_ai_Supabase__execute_sql`. Every file is wrapped in
`BEGIN / ROLLBACK` so nothing persists. Concatenating multiple test files in
one call is NOT recommended — each file redefines the `plan()` count and
relies on its own transaction.

## Running — option C: Supabase SQL Editor

Paste the contents of a single test file into the SQL Editor and Run. The
result pane shows the final `result` column.

## Writing new tests

1. Start with `BEGIN;` + `SET LOCAL search_path = tap, public, extensions;`
   + `SELECT plan(N);`.
2. Call the `pgtap_test.seed_*` helpers you need (or inline your own seed for
   niche tables — keep ids prefixed with `pgtap-` / `pgtap_` so intent is
   obvious).
3. Use `pgtap_test.become_a()` / `become_b()` / `become_super()` /
   `become_reset()` to switch caller identity. These issue
   `SET LOCAL role authenticated` + set `request.jwt.claims.sub`, so RLS and
   `auth.uid()`-based RPC gates behave like real traffic.
4. Always cast the description argument: `SELECT is(x, y, 'desc'::text)`.
   Without the `::text` cast, pgTAP's polymorphic overload does not resolve
   when `x`/`y` come from subqueries.
5. Close with
   `SELECT COALESCE(NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''), 'ALL TESTS PASSED');`
   + `ROLLBACK;`.

## Known pitfalls

- `SET LOCAL role authenticated` is sticky until `RESET role` / `become_reset()`.
  Seed data BEFORE switching roles — `authenticated` cannot INSERT into
  `auth.users` / `profiles` / `memberships` / etc.
- `_assert_period_unlocked` triggers block writes to `projects`,
  `score_sheets`, `score_sheet_items` when `periods.is_locked = true`. If you
  need scores under a locked period, seed **before** locking and flip
  `is_locked=true` via a direct `UPDATE` after the inserts.
- Temp tables (`CREATE TEMP TABLE … ON COMMIT DROP`) are owned by
  `postgres`; add `GRANT SELECT ON …  TO authenticated` if a test reads them
  after `become_*`. Easier: use `SELECT … FROM (VALUES …)` or inline arrays.

## Current suite summary

| Folder                | Files | Assertions |
|-----------------------|------:|-----------:|
| `rls/`                |     9 |         36 |
| `rpcs/jury/`          |     4 |         19 |
| `rpcs/admin/`         |     5 |         19 |
| `rpcs/contracts/`     |     9 |         61 |
| `migrations/`         |     1 |  (legacy)  |
| **Total**             | **28**|    **135** |

All pgTAP files pass on `vera-prod` (RLS + behavior tests); the
`rpcs/contracts/` set was authored against `vera-demo` in the
2026-04-25 P0 sprint and verified there via Supabase MCP `execute_sql`
with `BEGIN / ROLLBACK` isolation. Schema parity policy keeps prod and
demo identical, so `contracts/` is expected to pass on prod as well —
re-run via `pg_prove` to confirm before treating it as such.

## About `rpcs/contracts/`

These tests are deliberately narrow: they pin **signature, return type,
auth gate, and error-code envelope** for the 9 most-called RPCs. They do
not exercise full business behavior (the per-RPC files in `rpcs/jury/`
and `rpcs/admin/` cover that). Their value is preventing silent shape
drift — e.g., a developer changing `rpc_jury_finalize_submission`'s
return from `{ok, error_code}` to `{success, msg}` would break every
client that consumes the envelope; this contract test would catch it on
the first PR.

Coverage list (audit ref: `docs/qa/vera-test-audit-report.md` §6 + §9 P0 #4):

- `rpc_jury_finalize_submission` (8 assertions)
- `rpc_jury_get_scores` (7)
- `rpc_period_freeze_snapshot` (6)
- `rpc_admin_save_period_criteria` (7)
- `rpc_admin_upsert_period_criterion_outcome_map` (7)
- `rpc_admin_verify_audit_chain` (6)
- `rpc_juror_unlock_pin` (9)
- `rpc_admin_update_organization` (6)
- `rpc_admin_delete_organization` (5)
