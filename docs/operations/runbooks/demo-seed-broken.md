# Runbook — Demo Environment Broken

**Use when:** the demo environment (`/demo/*` routes, vera-demo Supabase
project) shows missing data, login fails, or auto-login lands on an empty
admin dashboard.

The demo environment is the public face of VERA — broken demos cost
prospective tenants. Fix fast.

---

## Triage in 60 seconds

| Symptom | Most likely cause | First action |
| --- | --- | --- |
| `/demo` auto-login fails | Demo admin credentials in `.env*` rotated; or vera-demo Auth user deleted | Verify `VITE_DEMO_ADMIN_EMAIL` / `_PASSWORD`; re-create Auth user if needed |
| Auto-login succeeds, dashboard empty | Demo seed not applied or partially applied | Re-apply seed (manual; see Step 3) |
| Demo entry-token rejected at `/demo/eval` | Token expired or seed never created it | Re-apply seed; tokens regenerate |
| Demo data exists in vera-prod | Seed accidentally applied to prod (BAD) | Stop reading; see "Worst case: seed leaked to prod" below |

---

## Step 1 — Confirm which environment

The first thing to verify: is the failing URL actually pointed at vera-demo?

- `/demo/admin` → demo (per
  [decisions/0001-pathname-based-routing.md](../../decisions/0001-pathname-based-routing.md))
- `/admin` → prod
- The Supabase host in the Network panel must match `VITE_DEMO_SUPABASE_URL`
  for `/demo/*` URLs.

If `/admin` is broken, this is **not** a demo issue — see
[auth-outage.md](auth-outage.md) instead.

---

## Step 2 — Check vera-demo Supabase project health

```
mcp call get_project ref=<vera-demo-ref>
mcp call get_logs ref=<vera-demo-ref> service=postgres
```

If the project is paused or unreachable, the demo URL will fail with a
network error, not an empty dashboard. In that case, restore the project
before continuing.

---

## Step 3 — Re-apply the demo seed

The demo seed is a manual operation. **Never automated.**

Per [CLAUDE.md migration policy](../../../CLAUDE.md):

> Do not push `sql/seeds/demo_seed.sql` to any database: regenerate the
> file via `scripts/generate_demo_seed.js` when seed logic changes, but
> never execute it against prod or demo — the user applies demo seed
> manually.

Even though the seed is "manual", the recovery is a known sequence:

1. **Regenerate the seed file** (only if logic has changed since last run):

   ```bash
   node scripts/generate_demo_seed.js
   ```

   Output: `sql/seeds/demo_seed.sql` updated. Inspect the diff —
   especially any rows referencing deleted IDs.

2. **Apply the seed to vera-demo** (and only vera-demo) via the Supabase
   MCP server's SQL editor or CLI. The file is idempotent for the rows
   it inserts; it uses `ON CONFLICT DO NOTHING`.

3. **Verify**:

   ```sql
   -- After seed apply, expect non-zero counts in each:
   SELECT (SELECT COUNT(*) FROM organizations) AS orgs,
          (SELECT COUNT(*) FROM periods)       AS periods,
          (SELECT COUNT(*) FROM projects)      AS projects,
          (SELECT COUNT(*) FROM jurors)        AS jurors,
          (SELECT COUNT(*) FROM entry_tokens
           WHERE expires_at > NOW())           AS active_tokens;
   ```

   All five should be > 0.

---

## Step 4 — Verify demo Auth user

The auto-login on `/demo` uses a fixed email/password from env vars. If
auto-login fails after seed is applied:

1. Check the demo project's `auth.users` table:

   ```sql
   SELECT id, email, email_confirmed_at, last_sign_in_at
   FROM   auth.users
   WHERE  email = '<VITE_DEMO_ADMIN_EMAIL>';
   ```

2. If row is missing: re-create via Supabase Auth dashboard with
   `email_confirm = true` and the password from `.env*`.

3. After creating the auth user, ensure a `memberships` row points the
   user at the demo organization with `is_pending = false`.

4. Test auto-login: visit `/demo/admin`, expect dashboard within 3
   seconds.

---

## Worst case: seed leaked to prod

If `vera-prod` shows demo organization names, demo project titles, or
test juror "John Doe" entries:

1. **Stop**. Do not run more SQL.
2. Snapshot the affected tables in vera-prod via `pg_dump`.
3. Identify the time window: the audit log will show the inserts.
4. The recovery path depends on whether real tenant data was overwritten
   or only demo rows were added next to real ones.
   - If only added: delete by demo organization id.
   - If overwritten: this is a data loss incident; restore from the most
     recent backup.
5. Document in a post-mortem note linked from the relevant issue or PR.

The CLAUDE.md rule "do not push demo_seed.sql to any DB" exists to
prevent this. If a process change made it possible, that's the real
fix.

---

## Related

- [decisions/0005-snapshot-migrations.md](../../decisions/0005-snapshot-migrations.md)
- [deployment/migrations.md](../../deployment/migrations.md) (operational
  migrations guide)
- [walkthroughs/tenant-onboarding.md](../../walkthroughs/tenant-onboarding.md)
  (the flow the demo simulates)

---
