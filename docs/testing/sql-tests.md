# SQL Tests (pgTAP)

The pgTAP test suite under [`sql/tests/`](../../sql/tests/) runs against
an ephemeral Postgres seeded purely from the
[snapshot migrations](../decisions/0005-snapshot-migrations.md). It is
the only place where RLS policies, RPC contracts, and trigger behavior
get exercised against real Postgres semantics.

For the runner, see [`sql/tests/RUNNING.md`](../../sql/tests/RUNNING.md).

---

## What pgTAP covers

| Subdirectory | Tests |
| --- | --- |
| `sql/tests/rls/` | Row Level Security isolation per tenant-scoped table. Every isolated table has a paired `<table>_isolation.sql` test. |
| `sql/tests/rpcs/admin/` | Admin RPC contract tests (positional args, return shape, raise conditions). |
| `sql/tests/rpcs/jury/` | Jury RPC contract tests. |
| `sql/tests/rpcs/contracts/` | Cross-cutting RPC behavior (return-shape stability, error codes). |
| `sql/tests/migrations/` | Migration-shape assertions (e.g. expected enum values, indexed columns). |
| `sql/tests/constraints/` | NOT NULL / CHECK / FK assertions. |
| `sql/tests/triggers/` | Audit trigger, hash chain trigger, `setup_completed_at` trigger behavior. |

---

## Why pgTAP and not Vitest

| Concern | Tool |
| --- | --- |
| Component render | Vitest |
| Hook state | Vitest |
| Mocked RPC arg shape | Vitest |
| **Real RLS denial** | **pgTAP** |
| **Real RPC error class** | **pgTAP** |
| **Real trigger behavior** | **pgTAP** |
| **Real foreign-key cascade** | **pgTAP** |

Vitest cannot reach the SQL layer; the Supabase client is mocked. pgTAP
runs inside Postgres itself, so RLS and triggers fire normally.

---

## Running locally

The instructions in [`sql/tests/RUNNING.md`](../../sql/tests/RUNNING.md)
are authoritative; this is a quick reference.

```bash
# Boot a local Postgres with the snapshot schema applied
# (see RUNNING.md for the exact docker / supabase CLI invocation)

# Then run the suite:
psql ... -f sql/tests/_helpers.sql
psql ... -f sql/tests/rls/jurors_isolation.sql
# ...
```

CI runs the full suite on every PR via the pgTAP-suite GitHub Action.
A failing pgTAP test blocks merge — there is no soft mode.

---

## Drift sentinels

Two scripts under `scripts/` enforce coverage:

```bash
npm run check:rls-tests   # every isolated table has a paired RLS test
npm run check:rpc-tests   # every admin RPC has a paired contract test
```

Both fail CI when they detect a gap. The path forward when adding a new
isolated table or admin RPC is:

1. Add the table or RPC to its migration module.
2. Add the matching `<name>_isolation.sql` or
   `<rpc>.test.sql` to the appropriate subdirectory.
3. Run the sentinel locally; expect 0 missing.
4. Push.

---

## Patterns

### RLS isolation test

```sql
-- sql/tests/rls/jurors_isolation.sql (sketch)
BEGIN;
SELECT plan(N);

-- Set up two orgs + their admins
SELECT _helpers.setup_two_tenants();

-- Tenant A admin can read their own jurors
SET LOCAL request.jwt.claims = '{"sub":"<admin_a>","role":"authenticated"}';
SELECT cmp_ok(
  (SELECT count(*) FROM public.jurors WHERE organization_id = '<org_a>'),
  '>', 0::bigint, 'Tenant A admin sees own jurors'
);

-- Tenant A admin cannot read Tenant B jurors
SELECT is_empty(
  $$ SELECT id FROM public.jurors WHERE organization_id = '<org_b>' $$,
  'Tenant A admin cannot see Tenant B jurors'
);

SELECT * FROM finish();
ROLLBACK;
```

### RPC contract test

```sql
-- sql/tests/rpcs/admin/rpc_admin_lock_period.test.sql (sketch)
BEGIN;
SELECT plan(N);

-- Setup: period exists, admin authenticated
SELECT _helpers.setup_period();

-- Action
SELECT lives_ok(
  $$ SELECT public.rpc_admin_lock_period('<period_id>') $$,
  'rpc_admin_lock_period executes for active period'
);

-- Assertion: state changed
SELECT cmp_ok(
  (SELECT status FROM public.periods WHERE id = '<period_id>')::text,
  '=', 'locked', 'period is locked after RPC'
);

-- Assertion: audit row written
SELECT cmp_ok(
  (SELECT count(*) FROM public.audit_logs
   WHERE action = 'period.lock' AND details->>'period_id' = '<period_id>'),
  '=', 1::bigint, 'one period.lock audit row written'
);

SELECT * FROM finish();
ROLLBACK;
```

The wrap-in-`BEGIN;` / `ROLLBACK` pattern means tests do not pollute the
database — even when running against a long-lived dev instance.

---

## Reference patterns

When adding a new test, copy the closest match:

- **RLS isolation:** any file in `sql/tests/rls/`. They follow a
  consistent skeleton.
- **RPC contract:** any file in `sql/tests/rpcs/admin/` or
  `sql/tests/rpcs/jury/`.
- **Trigger:** `sql/tests/triggers/audit_logs_hash_chain.test.sql` is
  the canonical reference for assertions about derived columns.

---

## Anti-patterns

- **Skipping `ROLLBACK`.** The test will pollute the dev database and
  the next run will see leftover state.
- **Inlining setup data.** Use `_helpers.sql`; if a fixture is reused,
  factor it.
- **Fragile equality assertions.** Compare what you mean —
  `cmp_ok(... '=' ...)` for counts, `set_eq(...)` for unordered sets,
  `results_eq(...)` for ordered query results.
- **Testing migration internals from outside.** A pgTAP test in
  `sql/tests/migrations/` should assert the *result* of a migration,
  not the SQL text inside it.

---

## What pgTAP does **not** cover

- UI rendering — Vitest + Playwright.
- Network round-trips — Playwright.
- Edge Function logic — see [edge-function-tests.md](edge-function-tests.md).
- Performance under concurrency — `e2e/perf/`.
- Visual regressions — `e2e/visual/`.

If a behavior involves the application layer at all, it cannot be
asserted from pgTAP alone — even if the data layer is the bottleneck.

---

## Related

- [README.md](README.md)
- [`sql/tests/RUNNING.md`](../../sql/tests/RUNNING.md)
- [`sql/README.md`](../../sql/README.md) — schema + RPC catalog
- [../decisions/0005-snapshot-migrations.md](../decisions/0005-snapshot-migrations.md)
- [../architecture/security-model.md](../architecture/security-model.md) — RLS
  guarantees enforced by this suite

---

> *Last updated: 2026-04-24*
