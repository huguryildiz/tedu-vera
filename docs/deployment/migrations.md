# Database Migrations — Operational Guide

> _Last updated: 2026-04-28_

How migrations are applied, in what order, to which projects. Why migrations
are organized this way is in
[decisions/0005-snapshot-migrations.md](../decisions/0005-snapshot-migrations.md);
this document is the runtime checklist.

---

## Module map

The `sql/migrations/` directory contains a fixed set of nine modules. Apply
in numerical order against any fresh database; the result is the canonical
schema.

| File | Contents |
| --- | --- |
| `000_dev_teardown.sql` | Dev-only full reset. **Never run on a live database.** |
| `001_extensions.sql` | Postgres extensions (`uuid-ossp`, `pgcrypto`). |
| `002_tables.sql` | All tables, ENUMs, views, indexes, Realtime publication. Final state. |
| `003_helpers_and_triggers.sql` | Helper functions (e.g. `current_admin_org_id`), trigger functions. |
| `004_rls.sql` | All RLS policies. Every isolated table has its policy here. |
| `005_rpcs_jury.sql` | Jury RPCs (`rpc_juror_*`) — auth, scoring, results, feedback. |
| `006a_rpcs_admin.sql` | Admin RPCs Part A: jury management, org admin helpers, org & token, public stats. |
| `006b_rpcs_admin.sql` | Admin RPCs Part B: period management, system config, audit helpers, public auth, join flow. |
| `007_identity.sql` | Admin invites, user sessions, invite flow. |
| `008_platform.sql` | Platform settings, maintenance, metrics, backups. |
| `009_audit.sql` | Audit system — backfills, RPCs, triggers, cron. |

The full canonical map and rules live in `sql/README.md` (the SQL-side
README is authoritative; this doc paraphrases for application developers).

---

## Operational rules

These eight rules are mandatory. Violating any one creates drift that the
next developer pays for.

1. **Update `sql/README.md` on every migration change.** Any time a
   migration file is added, removed, or its purpose changes, update
   `sql/README.md` in the same step.
2. **Fix the source, not with a patch.** If a bug is found in a migration,
   edit that migration file directly. Do not open a new patch file.
3. **Small change = add to the relevant module.** Schema column / ENUM
   addition → `002`; RLS change → `004`; jury RPC → `005`; admin RPC
   → `006a` or `006b`. No separate file.
4. **New migration file only when:**
   - A wholly new module / subsystem is added (e.g., billing).
   - A forward-only change must enter production history.
   - A data migration must run exactly once on prod.
5. **Backfills must be idempotent.** Use `UPDATE ... WHERE column IS NULL`
   so the migration can re-run without harm.
6. **Apply to both environments simultaneously.** Every migration runs on
   `vera-prod` and `vera-demo` in the same step via the Supabase MCP server.
   Never one before the other.
7. **`000_dev_teardown.sql` is dev-only.** Never run it against a live
   production database. No exceptions.
8. **Do not push `sql/seeds/demo_seed.sql` to any database.** Regenerate
   via `scripts/generate_demo_seed.js` when seed logic changes; the project
   owner applies the seed manually to demo only.

---

## How to apply a change

### Workflow

1. **Edit the relevant module** in `sql/migrations/`.
2. **Test locally** — apply `000 → 009` to a fresh local Postgres instance
   and verify the resulting schema and behavior. The pgTAP suite in
   `sql/tests/` runs against this fresh DB.
3. **Run the drift sentinels:**

   ```bash
   npm run check:db-types     # regenerate db.generated.ts; commit if changed
   npm run check:rls-tests    # every isolated table must have an RLS test
   npm run check:rpc-tests    # every admin RPC must have a paired test
   ```

4. **Apply to live projects via Supabase MCP** — both vera-prod and
   vera-demo, in the same step:

   ```
   mcp call apply_migration ref=<vera-prod-ref> name=<migration-slug> query=<SQL>
   mcp call apply_migration ref=<vera-demo-ref> name=<migration-slug> query=<SQL>
   ```

5. **Verify both projects** via `list_migrations` MCP call to confirm
   the new migration row landed:

   ```
   mcp call list_migrations ref=<vera-prod-ref>
   mcp call list_migrations ref=<vera-demo-ref>
   ```

6. **Update `sql/README.md`** if the file purposes shifted. Commit the
   migration edit + sql/README.md + any regenerated `db.generated.ts` in
   one commit.

### When something goes wrong

- **Migration partially applied.** A migration is partially applied if the
  Postgres logs show `function not found` errors for a function the file
  defines. Re-apply the full module to the affected project; idempotent
  patterns (`CREATE OR REPLACE`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  make this safe.
- **Migration applied to one project, not the other.** Compare
  `list_migrations` output between projects. Apply the missing migration
  to the lagging project. Until both match, a class of "works in demo,
  fails in prod" bugs is on the table.
- **Schema regression detected by `check:db-types`.** The committed
  `db.generated.ts` has drifted from the live schema. Run the regen,
  commit the new file, and figure out which migration introduced the
  discrepancy.

---

## Edge Function deployments

Edge Functions are not migrations but follow a parallel rule:

> Always deploy Edge Functions to both vera-prod and vera-demo in the same
> step.

```
mcp call deploy_edge_function ref=<vera-prod-ref> name=<fn-slug> ...
mcp call deploy_edge_function ref=<vera-demo-ref> name=<fn-slug> ...
```

Skipping demo for an Edge Function deploy creates a silent divergence —
demo will keep using the old function until someone notices.

---

## Archive folder

`sql/migrations/archive/` holds historical incremental patch files (008 →
063 plus legacy files) from before the snapshot model. **Never applied to
a fresh database.** They exist for git-archaeology purposes only — when a
developer asks "why does this column have NOT NULL with this specific
default", the archive may contain the answer.

When a new developer is told "look at the migrations to learn the schema",
direct them at `001 → 009` only. Mention archive only if they need
historical context for a specific decision.

---

## Verification

How to confirm migrations are applied correctly:

- **`sql/tests/` pgTAP suite** — runs against a fresh Postgres seeded
  purely from the snapshot modules. CI runs this on every PR.
- **Drift sentinels** —
  - `npm run check:db-types` (schema)
  - `npm run check:rls-tests` (RLS coverage)
  - `npm run check:rpc-tests` (RPC coverage)
  - `npm run check:edge-schema` (Edge Function arg shape)
- **`list_migrations` MCP call** — confirms applied state in each live
  project.

---

## Related

- [decisions/0005-snapshot-migrations.md](../decisions/0005-snapshot-migrations.md)
  — full rationale.
- `sql/README.md` — authoritative SQL-side docs.
- `sql/tests/RUNNING.md` — pgTAP test runner.
- [operations/runbooks/demo-seed-broken.md](../operations/runbooks/demo-seed-broken.md)
  — demo seed recovery.

---
