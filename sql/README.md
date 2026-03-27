# SQL — VERA

This directory contains the Supabase database schema, migration files, and seed
data for the VERA multi-tenant evaluation platform.

## Directory Structure

```text
sql/
├── schema_version.sql             ← Version tracking table
├── migrations/                    ← Modular migration files (apply in order)
│   ├── 001_core_schema.sql        ← Tables, extensions, types
│   ├── 002_triggers.sql           ← DB triggers (updated_at, computed total, immutability)
│   ├── 003_auth_helpers.sql       ← Internal auth: v1 password + v2 JWT helpers
│   ├── 004_jury_session_rpcs.sql  ← Jury auth RPCs (PIN, session, entry token)
│   ├── 005_jury_data_rpcs.sql     ← Jury data RPCs (projects, scores, submit)
│   ├── 006_admin_tenant_rpcs.sql  ← Admin tenant/org management RPCs
│   ├── 007_admin_semester_rpcs.sql← Admin semester CRUD RPCs (v1 + v2)
│   ├── 008_admin_project_rpcs.sql ← Admin project CRUD RPCs
│   ├── 009_admin_juror_rpcs.sql   ← Admin juror CRUD + PIN reset RPCs
│   ├── 010_admin_score_rpcs.sql   ← Admin score queries + analytics RPCs
│   ├── 011_admin_support_rpcs.sql ← Admin audit, export/import, settings RPCs
│   ├── 012_v1_auth_password_rpcs.sql ← Legacy v1 password management RPCs
│   └── 013_grants_rls.sql         ← GRANT statements + RLS policies
└── seeds/
    └── 001_multi_tenant_seed.sql  ← Multi-tenant demo/dev data (6 tenants)
```

## Migration Files (apply in order)

| # | File | Purpose |
|---|------|---------|
| 001 | `001_core_schema.sql` | Tables with tenant_id columns, extensions (pgcrypto, pgjwt) |
| 002 | `002_triggers.sql` | `updated_at`, `trg_scores_compute_total`, audit immutability |
| 003 | `003_auth_helpers.sql` | v1: `_verify_rpc_secret`, `_verify_admin_password`; v2: `_assert_tenant_admin`, `_get_auth_user_id` |
| 004 | `004_jury_session_rpcs.sql` | `rpc_create_or_get_juror_and_issue_pin`, `rpc_verify_juror_pin`, `rpc_verify_semester_entry_token` |
| 005 | `005_jury_data_rpcs.sql` | `rpc_list_projects`, `rpc_upsert_score`, `rpc_finalize_juror_submission` |
| 006 | `006_admin_tenant_rpcs.sql` | `rpc_admin_tenant_list`, `rpc_admin_tenant_create`, org management |
| 007 | `007_admin_semester_rpcs.sql` | `rpc_admin_semester_list`, `rpc_admin_semester_create/update/delete` (v1 + v2) |
| 008 | `008_admin_project_rpcs.sql` | `rpc_admin_create_project`, `rpc_admin_upsert_project`, `rpc_admin_delete_project` |
| 009 | `009_admin_juror_rpcs.sql` | `rpc_admin_create_juror`, `rpc_admin_reset_juror_pin`, edit mode RPCs |
| 010 | `010_admin_score_rpcs.sql` | `rpc_admin_get_scores`, `rpc_admin_project_summary`, `rpc_admin_outcome_trends` |
| 011 | `011_admin_support_rpcs.sql` | Audit logs, full export/import, settings, entry token RPCs |
| 012 | `012_v1_auth_password_rpcs.sql` | Legacy v1 password bootstrap/change RPCs (backward compat) |
| 013 | `013_grants_rls.sql` | `GRANT EXECUTE` for anon/service_role + RLS policies |

## Seed Data

| File | Purpose |
|------|---------|
| `001_multi_tenant_seed.sql` | 6 tenants (TEDU EE, TEDU CE, Boğaziçi CHEM, Boğaziçi CMPE, METU ME, METU IE), 3 semesters each, 20 jurors, curated domain-specific projects, realistic score distributions with workflow-state diversity |

> **Do not apply seeds to production.** For staging, dev, or demo environments only.

## Multi-Tenant Model

All data tables include a `tenant_id` column. Key concepts:

- **Tenants** have a `code` (e.g. `tedu-ee`), `short_label`, `university`, and `department`
- **Super-admin** has `tenant_id = NULL` in memberships (global scope)
- **Tenant-admin** has a specific `tenant_id` (single-tenant scope)
- **Jury flow** is tenant-implicit: entry token → semester → tenant

## Auth Layers

- **v1 (legacy):** `p_admin_password` + `p_rpc_secret` params per RPC call
- **v2 (Phase C):** JWT via `auth.uid()` + `_assert_tenant_admin(p_tenant_id)`

Both layers coexist. v2 RPCs use `rpc_admin_*` naming with `_assert_tenant_admin()`.

## How to Apply

### Fresh setup (migrations)

```bash
for f in sql/migrations/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

### Supabase Dashboard

1. Open SQL Editor → New query
2. Paste each migration file in order → Run
3. (Optional) Apply seed data for dev/demo environments

### Seed data (dev only)

```bash
psql "$DATABASE_URL" -f sql/seeds/001_multi_tenant_seed.sql
```

**Idempotent:** All migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` — safe to re-run.
