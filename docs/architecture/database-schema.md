# Database Schema — TEDU VERA

Supabase Postgres. RLS is enabled on all tables with a default-deny policy. No
direct table access from the frontend — all reads and writes go through
SECURITY DEFINER RPC functions.

Multi-tenant: all data tables include a `tenant_id` column. Access is enforced
via `_assert_tenant_admin(p_tenant_id)` for admin RPCs and implicit tenant
resolution (entry token → semester → tenant) for jury RPCs.

---

## Tables

### `tenants`

Organizations (university departments) that own semesters and data.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `code` | text | Unique slug (e.g. `tedu-ee`, `boun-chem`) |
| `short_label` | text | Display label (e.g. `TEDU EE`) |
| `university` | text | University name |
| `department` | text | Department name |
| `status` | text | `active`, `disabled`, or `archived` |
| `created_at` | timestamptz | Default `now()` |

**Unique constraint:** `code` (case-insensitive, trimmed)

---

### `tenant_admin_memberships`

Maps Supabase Auth users to tenants with roles.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid FK → `tenants(id)` | NULL = super-admin (global scope) |
| `user_id` | uuid | Supabase Auth user ID |
| `role` | text | `super_admin` or `tenant_admin` |
| `created_at` | timestamptz | Default `now()` |

---

### `tenant_admin_applications`

Self-registration requests from prospective tenant admins.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `tenant_id` | uuid FK → `tenants(id)` | Target tenant |
| `applicant_email` | text | |
| `applicant_name` | text | |
| `university` | text | |
| `department` | text | |
| `status` | text | `pending`, `approved`, or `rejected` |
| `created_at` | timestamptz | Default `now()` |

---

### `admin_profiles`

Display names for admin users (optional, used for UI greeting).

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid PK | Supabase Auth user ID |
| `display_name` | text | Nullable (UI falls back to email) |

---

### `semesters`

Stores academic semesters. Only one semester per tenant should be active at a time.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid FK → `tenants(id)` | Owning tenant |
| `semester_name` | text | Display name (case-insensitive unique per tenant) |
| `is_current` | boolean | Default `false` |
| `is_locked` | boolean | Default `false` — when `true`, jurors cannot submit or edit |
| `poster_date` | date | Date of the poster day event |
| `criteria_template` | jsonb | Array of `{key, label, shortLabel, max}` objects |
| `mudek_template` | jsonb | Array of `{key, outcomes[]}` mappings |
| `entry_token_hash` | text | SHA-256 hash of the QR/URL entry token |
| `entry_token_enabled` | boolean | Default `false` |
| `entry_token_created_at` | timestamptz | When the token was generated |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

**Unique constraint:** `(tenant_id, semester_name)` (case-insensitive)

---

### `projects`

One row per student group in a semester.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `semester_id` | uuid FK → `semesters(id)` | `ON DELETE CASCADE` |
| `tenant_id` | uuid FK → `tenants(id)` | Denormalized for query efficiency |
| `group_no` | integer | Group number within the semester |
| `project_title` | text | |
| `group_students` | text | Student names, stored as free text |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

**Unique constraint:** `(semester_id, group_no)`

---

### `jurors`

Juror identity records. No Supabase Auth — authentication is PIN-based via
`juror_semester_auth`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `juror_name` | text | |
| `juror_inst` | text | Institution / department |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

**Unique constraint:** `(juror_name, juror_inst)` (normalized)

---

### `juror_semester_auth`

Per-semester PIN authentication state for each juror.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `juror_id` | uuid FK → `jurors(id)` | `ON DELETE CASCADE` |
| `semester_id` | uuid FK → `semesters(id)` | `ON DELETE CASCADE` |
| `tenant_id` | uuid FK → `tenants(id)` | Denormalized |
| `pin_hash` | text | bcrypt hash of the 4-digit PIN |
| `pin_reveal_pending` | boolean | `true` until juror acknowledges PIN |
| `pin_plain_once` | text | Encrypted for one-time PIN reveal |
| `failed_attempts` | integer | Default `0` — reset on success |
| `locked_until` | timestamptz | 3 failures → 15-minute lockout |
| `last_seen_at` | timestamptz | Updated on each successful PIN entry |
| `edit_enabled` | boolean | Default `false` — admin grants edit permission |
| `session_token_hash` | text | Hash of the current session token |
| `session_expires_at` | timestamptz | Session token expiry |
| `created_at` | timestamptz | Default `now()` |

**Unique constraint:** `(juror_id, semester_id)`

---

### `scores`

One row per (semester, project, juror) evaluation. Scores are stored in a JSONB
`criteria_scores` object keyed by criterion key from the semester's
`criteria_template`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `semester_id` | uuid FK → `semesters(id)` | `ON DELETE CASCADE` |
| `project_id` | uuid FK → `projects(id)` | `ON DELETE CASCADE` |
| `juror_id` | uuid FK → `jurors(id)` | `ON DELETE CASCADE` |
| `tenant_id` | uuid FK → `tenants(id)` | Denormalized |
| `criteria_scores` | jsonb | `{"technical": 25, "design": 22, ...}` |
| `comment` | text | Optional, one per score row |
| `final_submitted_at` | timestamptz | Set when juror explicitly finalizes |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

**Unique constraint:** `(semester_id, project_id, juror_id)` named `scores_unique_eval`

---

### `settings`

Key-value store for application configuration.

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text | e.g. `admin_password_hash`, `timezone` |
| `value` | text | |
| `tenant_id` | uuid FK → `tenants(id)` | NULL = global setting |
| `updated_at` | timestamptz | Default `now()` |

**Unique constraint:** `(key, tenant_id)`

---

### `audit_logs`

Immutable append-only log of critical admin and juror operations.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `created_at` | timestamptz | Default `now()` |
| `actor_type` | text | `'admin'`, `'juror'`, or `'system'` |
| `actor_id` | uuid | User ID or juror ID |
| `action` | text | Action identifier (e.g. `pin_reset`, `eval_lock`) |
| `entity_type` | text | What was acted on (e.g. `juror`, `semester`) |
| `entity_id` | uuid | ID of the affected record |
| `message` | text | Human-readable description |
| `metadata` | jsonb | Additional context |
| `tenant_id` | uuid FK → `tenants(id)` | Tenant scope |

**Immutability:** A trigger (`trg_audit_logs_immutable`) prevents `UPDATE` and
`DELETE` on this table.

---

## Auth Layers

### v1 (legacy, password-based)

Admin RPCs accept `p_admin_password` + `p_rpc_secret` parameters. The password
is verified via `_verify_admin_password()`, and the RPC secret is checked against
Supabase Vault via `_verify_rpc_secret()`. Production routes through the
`rpc-proxy` Edge Function so `rpc_secret` never reaches the browser.

### v2 (Phase C, JWT-based)

Admin RPCs use `auth.uid()` from the Supabase JWT. Key helpers:

| Function | Purpose |
| --- | --- |
| `_get_auth_user_id()` | Extract user ID from JWT, raise if missing |
| `_is_super_admin(p_user_id)` | Check super-admin status (no raise) |
| `_assert_super_admin()` | Raise if not super-admin |
| `_assert_tenant_admin(p_tenant_id)` | Raise if no access to tenant |
| `_get_semester_tenant(p_semester_id)` | Resolve tenant from semester |
| `_assert_semester_access(p_semester_id)` | Shorthand: semester → tenant → assert |

---

## DB Triggers

| Trigger | Table | Description |
| --- | --- | --- |
| `trg_set_updated_at` | `semesters`, `projects`, `jurors` | Sets `updated_at = now()` on every `UPDATE` |
| `trg_scores_updated_at` | `scores` | Sets `updated_at = now()` on every `UPDATE` |
| `trg_audit_logs_immutable` | `audit_logs` | Prevents `UPDATE` and `DELETE` |

---

## Migration Files

Schema is split into 13 modular migration files in `sql/migrations/`:

| # | File | Domain |
|---|------|--------|
| 001 | `001_core_schema.sql` | Tables, extensions, types |
| 002 | `002_triggers.sql` | All DB triggers |
| 003 | `003_auth_helpers.sql` | v1 + v2 auth internal helpers |
| 004 | `004_jury_session_rpcs.sql` | Jury auth (PIN, session, entry token) |
| 005 | `005_jury_data_rpcs.sql` | Jury data (projects, scores, submit) |
| 006 | `006_admin_tenant_rpcs.sql` | Tenant/org management |
| 007 | `007_admin_semester_rpcs.sql` | Semester CRUD (v1 + v2) |
| 008 | `008_admin_project_rpcs.sql` | Project CRUD |
| 009 | `009_admin_juror_rpcs.sql` | Juror CRUD + PIN reset |
| 010 | `010_admin_score_rpcs.sql` | Score queries + analytics |
| 011 | `011_admin_support_rpcs.sql` | Audit, export/import, settings |
| 012 | `012_v1_auth_password_rpcs.sql` | Legacy password management |
| 013 | `013_grants_rls.sql` | GRANT + RLS policies |

Seed data: `sql/seeds/001_multi_tenant_seed.sql`

Full SQL source: `sql/migrations/` (13 files, applied in order)

---

## Seed Data Tenants

| Code | Short Label | University | Department |
|------|-------------|------------|------------|
| `tedu-ee` | TEDU EE | TED University | Electrical & Electronics Engineering |
| `tedu-ce` | TEDU CE | TED University | Civil Engineering |
| `boun-chem` | Boğaziçi CHEM | Boğaziçi University | Chemical Engineering |
| `boun-cmpe` | Boğaziçi CMPE | Boğaziçi University | Computer Engineering |
| `metu-me` | METU ME | Middle East Technical University | Mechanical Engineering |
| `metu-ie` | METU IE | Middle East Technical University | Industrial Engineering |

---

## Production Security

In production, all admin RPC calls are proxied through the `rpc-proxy` Supabase
Edge Function (`supabase/functions/rpc-proxy/index.ts`). This ensures the
`rpc_secret` value (stored in Supabase Vault) is never sent to the browser.

The proxy is controlled by `USE_PROXY = !import.meta.env.DEV` in
`src/shared/api/transport.js`.
