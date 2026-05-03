# Supabase Setup — VERA

> _Last updated: 2026-05-03_

How to set up a Supabase project for VERA (new installation or new environment).

VERA uses two Supabase projects in production: **vera-prod** (real data) and
**vera-demo** (showcase / sandbox). Every schema change and Edge Function
deployment runs on **both** projects in the same step. See
[`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md) for
the full policy.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organization, name the project (e.g. `vera-prod` or `vera-demo`),
   set a database password, and select a region.
4. Wait for the project to finish provisioning (~2 minutes).

Repeat for the second environment if this is a fresh installation.

---

## 2. Apply the Database Schema

The schema is **snapshot-based**: every migration file represents the final
state of one subsystem rather than an incremental patch. Files live in
[`sql/migrations/`](../../sql/migrations/) and must be applied in numeric order
**from a fresh database**:

```text
000_dev_teardown            (dev only — never apply to live prod)
001_extensions
002_tables
003_helpers_and_triggers
004_rls
005_rpcs_jury
006a_rpcs_admin
006b_rpcs_admin
007_identity
008_platform
009_audit
```

### Option A — Supabase MCP (recommended)

If you have the Supabase MCP available, apply each file via
`mcp__claude_ai_Supabase__apply_migration` against the project ref. Apply to
both `vera-prod` and `vera-demo` in lockstep.

### Option B — Supabase Studio SQL Editor

1. In your Supabase project, open **SQL Editor**.
2. For each file `001_extensions.sql` … `009_audit.sql` (skip `000_dev_teardown`
   on prod), open the file from this repository, paste the contents, and run.
3. Verify there are no errors after each step.

`sql/README.md` is the authoritative module index.

> The `supabase/migrations/` folder is **not** the source of truth. The files
> under `sql/migrations/` are.

---

## 3. Load Demo Seed (demo project only)

For the demo environment, regenerate and apply the demo seed:

```bash
node scripts/generate_demo_seed.js
```

Then apply `sql/seeds/demo_seed.sql` against **vera-demo only**. Never apply
the demo seed to the production project. The seed file is regenerated, not
checked in as a manually maintained artifact.

---

## 4. Bootstrap the First Super-Admin

Admin auth is JWT-based (Supabase Auth). There is no shared admin password and
no `rpc_admin_bootstrap_password` RPC.

1. Sign up the founding admin via **Authentication → Users → Add user** in the
   Supabase dashboard, or via the email/password sign-up flow on the deployed
   app.
2. Insert their `memberships` row with `organization_id IS NULL` and
   `role = 'super_admin'` directly in the SQL Editor:

   ```sql
   INSERT INTO memberships (user_id, organization_id, role, status)
   VALUES ('<auth.users.id>', NULL, 'super_admin', 'active');
   ```

3. The user can now log in and reach the super-admin surfaces (Organizations,
   Audit Log, Maintenance Mode, …).

Subsequent tenant admins are added via the in-app invite flow
(`invite-org-admin` Edge Function) or by accepting an `org_application`.

---

## 5. Deploy the Edge Functions

VERA ships ~21 Edge Functions in [`supabase/functions/`](../../supabase/functions/).
They are deployed via the Supabase MCP (preferred) or the Supabase CLI, and
**must be deployed to both vera-prod and vera-demo** in the same step.

```bash
# CLI fallback (run twice, once per project):
supabase link --project-ref <project-ref>
supabase functions deploy <function-name>
```

Auth posture varies per function — see each function's `config.toml`. The full
catalog and deployment rules live in
[`docs/architecture/email-notifications.md`](../architecture/email-notifications.md)
and [`.claude/rules/edge-functions.md`](../../.claude/rules/edge-functions.md).

There is **no** `rpc-proxy` Edge Function in current VERA. Admin RPCs are
called directly via `supabase.rpc("rpc_admin_*", …)` and gated by
`_assert_tenant_admin()` / `_assert_super_admin()` on the JWT (see
[ADR 0003](../decisions/0003-jwt-admin-auth.md)).

---

## 6. Configure Edge Function Secrets

In **Project Settings → Edge Functions → Secrets**, set the secrets the email
and notification functions need. The full table lives in
[`environment-variables.md`](environment-variables.md). At minimum:

- `RESEND_API_KEY` — required for any function that sends email
- `NOTIFICATION_FROM`, `NOTIFICATION_LOGO_URL`, `NOTIFICATION_APP_URL` —
  optional branding overrides

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the
runtime; do not set them by hand.

---

## 7. Configure `.env.local`

Copy your project credentials to `.env.local` at the repo root:

```env
VITE_SUPABASE_URL=https://<prod-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-project-settings>

# Demo environment (drives /demo/* routes + auto-login)
VITE_DEMO_SUPABASE_URL=https://<demo-project-ref>.supabase.co
VITE_DEMO_SUPABASE_ANON_KEY=<demo-anon-key>
VITE_DEMO_ADMIN_EMAIL=<demo-admin-email>
VITE_DEMO_ADMIN_PASSWORD=<demo-admin-password>
VITE_DEMO_ENTRY_TOKEN=<demo-entry-token>
```

Find the URL and anon key in **Project Settings → API**.

---

## 8. Verify

Start the dev server:

```bash
npm run dev
```

1. Open `http://localhost:5173`.
2. Click **Login**, sign in with the super-admin you bootstrapped in step 4.
   The Overview page should load (empty data is fine on a fresh project).
3. From **Organizations**, create a test organization and assign yourself as
   its owner-admin (or invite a separate admin).
4. As the org admin, set up a Period via the Setup Wizard (`/admin/setup`):
   pick the framework, configure criteria, add a project + juror, generate an
   entry token.
5. Open the entry-token URL in a private window — you should land on the
   `/eval` gate, then progress through `identity → period → pin → progress
   → evaluate → complete`.

---

## RLS Note

Row Level Security is enabled on every tenant-scoped table by `004_rls.sql`.
All admin writes flow through `SECURITY DEFINER` RPC functions that re-assert
caller identity via `_assert_tenant_admin(p_org_id)` (or
`_assert_super_admin()` for platform-level RPCs). Never disable RLS on a
production table; the drift sentinel `npm run check:rls-tests` will fail CI
if a tenant-scoped table is added without matching RLS coverage.
