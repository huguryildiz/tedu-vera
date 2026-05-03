# 0005 — Snapshot-based database migrations

**Status:** Accepted
**Date:** 2026-04-24
**Last reviewed:** 2026-04-28

## Context

A typical SQL migration history accumulates one file per change ("incremental
patches"). Over months and years this produces hundreds of files. The
schema's *current* shape becomes hard to read — you must replay the entire
history mentally to know what a table looks like today.

VERA's schema went through such an incremental phase early in its life
(see `sql/migrations/archive/` — files 008–063). The cost of onboarding new
developers, debugging schema drift, and applying the suite to a fresh
database had become high.

## Decision

**Migrations are organized as a snapshot of the final schema state, not as
historical patches.** The active suite is a fixed-size set of nine modules:

```
000_dev_teardown           — dev-only full reset
001_extensions             — Postgres extensions
002_tables                 — all tables, ENUMs, views, indexes (final state)
003_helpers_and_triggers   — helper functions, trigger functions
004_rls                    — all RLS policies
005_rpcs_jury              — jury RPCs
006a_rpcs_admin            — admin RPCs Part A
006b_rpcs_admin            — admin RPCs Part B
007_identity               — invites, sessions, invite flow
008_platform               — platform settings, maintenance, metrics, backups
009_audit                  — audit system
```

When the schema changes:

1. **Edit the relevant module in place** — no new patch file. Schema column →
   `002`; RLS change → `004`; admin RPC → `006a` or `006b`; etc.
2. **Backfills must be idempotent.** Use `UPDATE ... WHERE column IS NULL` so
   the migration can run repeatedly on a database that has already received
   it.
3. **Apply to both environments simultaneously.** Every change runs on
   `vera-prod` and `vera-demo` in the same step via the Supabase MCP server.
4. **Test from zero.** After any migration change, applying `000→009` to a
   fresh database must produce the intended schema.

A new migration file is created **only** when (a) a wholly new subsystem is
added (e.g., a billing module), (b) a forward-only change must enter
production history, or (c) a one-time data migration must run exactly once.

The `sql/seeds/demo_seed.sql` file is **never** pushed to any database from
CI or scripts. The project owner regenerates it via
`scripts/generate_demo_seed.js` and applies it manually to demo only.

## Consequences

**Positive**

- A new developer reads `002_tables.sql` and sees the canonical table layout
  in one file, not reconstructed from 60+ patches.
- Schema drift between prod and demo is detectable by running the snapshot
  on a fresh DB and diffing against the live DB.
- Code review for schema changes shows the new shape, not just the delta.
- The pgTAP test suite can run against an ephemeral Postgres seeded purely
  from the active modules.

**Negative**

- "Edit the existing file" requires reviewers to look at the diff carefully,
  because the file's structure tells you less than a self-contained patch
  would.
- A genuinely once-only data migration must be carved out as a new file with
  clear comments — easy to overlook without discipline.
- The archive folder (`sql/migrations/archive/`) is retained for historical
  reference but is never applied to a fresh database; new developers can be
  confused about its role.

## Alternatives considered

- **Continue with incremental patches.** Rejected because the cost
  trajectory was visibly bad: every additional patch made the next debugging
  session slower.
- **Schema-only snapshot, runtime data via seeds.** Rejected partially — the
  active modules contain RPCs and triggers, which are runtime behavior, not
  static data; lumping them into "data" loses the type safety of having them
  in versioned SQL.

## Verification

How we know this decision is still in force:

- **Tests:**
  - [sql/tests/](../../sql/tests/) — pgTAP suite runs against an ephemeral
    Postgres seeded purely from the snapshot modules. CI runs this on every
    PR; failure blocks merge.
  - [sql/tests/RUNNING.md](../../sql/tests/RUNNING.md) — instructions for
    running the suite locally.
  - `sql/tests/rls/` — every isolated table has an RLS isolation pgTAP
    test (~15 files); all derived from the snapshot, not from history.
  - `sql/tests/rpcs/` — RPC contract tests run against the snapshot.
- **Drift sentinels:** `npm run check:db-types` — regenerates
  `db.generated.ts` from the live schema and fails if the committed file
  drifts. `npm run check:rls-tests`, `npm run check:rpc-tests` — verify
  every RLS-relevant table and admin RPC has a paired test.
- **Audit events:** schema changes themselves are not auditable from inside
  the application — they are deploy-time operations performed via the
  Supabase MCP server. The audit trail begins at the data layer (rows in
  the migrated tables); migration *history* lives in git, not in
  `audit_logs`.
- **Both-environments check:** `sql/README.md` + the migration policy
  require every change to land on `vera-prod` and `vera-demo` in the same
  step. There is no automated drift detector across the two projects yet —
  tracked as future work.

---
