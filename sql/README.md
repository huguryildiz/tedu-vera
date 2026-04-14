# SQL — VERA

This directory contains the Supabase database schema, migration files, and seed
data for the VERA multi-tenant evaluation platform.

## Canonical Data Model

The schema is organized in five layers. Data flows top-down: Identity owns
everything; Frameworks define the evaluation rubric; Execution holds the live
runtime data; Snapshots freeze the rubric at period activation; Scoring stores
the actual juror work.

```text
┌─────────────────────────────────────────────────────────────────┐
│  IDENTITY                                                        │
│  organizations · profiles · memberships · org_applications       │
└────────────────────────────┬────────────────────────────────────┘
                             │ owns
          ┌──────────────────┴──────────────────────┐
          ▼                                         ▼
┌─────────────────────┐              ┌──────────────────────────┐
│  FRAMEWORKS         │              │  EXECUTION               │
│  frameworks         │◄─────────────┤  periods (framework_id)  │
│  framework_outcomes │  used by     │  projects                │
│  framework_criteria │              │  jurors                  │
│  criterion_outcome  │              │  juror_period_auth       │
│    _maps            │              │  entry_tokens            │
└─────────────────────┘              │  audit_logs              │
                                     └──────────────┬───────────┘
                                                    │ freeze
                                                    ▼
                                     ┌──────────────────────────┐
                                     │  SNAPSHOTS               │
                                     │  period_criteria         │
                                     │  period_outcomes         │
                                     │  period_criterion_       │
                                     │    outcome_maps          │
                                     └──────────────┬───────────┘
                                                    │ referenced by
                                                    ▼
                                     ┌──────────────────────────┐
                                     │  SCORING                 │
                                     │  score_sheets            │
                                     │  score_sheet_items       │
                                     │  scores_compat (view)    │
                                     └──────────────────────────┘
```

### Key relationships

```text
organizations ──< frameworks
organizations ──< periods
organizations ──< jurors

frameworks ──< framework_criteria
frameworks ──< framework_criteria ──< framework_criterion_outcome_maps  (criterion_id)
frameworks ──< framework_outcomes ──< framework_criterion_outcome_maps  (outcome_id)

periods >── frameworks              (period.framework_id)
periods ──< projects
periods ──< entry_tokens
periods ──< juror_period_auth       (via jurors)
periods ──< period_criteria         (snapshot on freeze)
periods ──< period_outcomes         (snapshot on freeze)

period_criteria ──< period_criterion_outcome_maps
period_outcomes ──< period_criterion_outcome_maps
period_criteria ──< score_sheet_items

jurors ──< juror_period_auth
jurors ──< score_sheets
projects ──< score_sheets
score_sheets ──< score_sheet_items
```

### Snapshot pattern

When a period is activated (`rpc_period_freeze_snapshot`), the live
`framework_criteria` / `framework_outcomes` / `framework_criterion_outcome_maps`
rows are copied into immutable `period_*` snapshot tables. All subsequent
scoring (`score_sheet_items`) references these snapshots — never the live
framework rows. This means the framework can be edited without corrupting
historical scores.

### scores_compat view

`score_sheet_items` is a normalized row-per-criterion model. The `scores_compat`
view pivots it back to the flat wide-row shape (columns: `technical`, `written`,
`oral`, `teamwork`, `comments`) that the current admin API and `fieldMapping.js`
expect. This view is the backward-compatibility bridge — admin reads go through
it; jury writes go through `rpc_jury_upsert_score`.

## Directory Structure

```text
sql/
├── migrations/                       ← Active schema — apply 000–009 in order on a fresh DB
│   ├── 000_dev_teardown.sql          ← Full teardown — DEV/TEST ONLY; never run on live prod
│   ├── 001_extensions.sql            ← Extensions: uuid-ossp, pgcrypto
│   ├── 002_tables.sql                ← All tables, ENUMs, views, indexes (final state)
│   ├── 003_helpers_and_triggers.sql  ← Helper functions + trigger functions + attachments
│   ├── 004_rls.sql                   ← Row-Level Security policies for all tables
│   ├── 005_rpcs_jury.sql             ← Jury RPC functions (auth, scoring, results, feedback)
│   ├── 006_rpcs_admin.sql            ← Admin RPC functions (jury mgmt, org, period, config, audit helpers)
│   ├── 007_identity.sql              ← Admin sessions, invite flow RPCs
│   ├── 008_platform.sql              ← Platform settings, maintenance, metrics, backups
│   ├── 009_audit.sql                 ← Audit system: backfills, auth-failure RPC, hash chain, cron
│   └── archive/                      ← Old incremental patches (008–063 + legacy); reference only
└── seeds/
    └── demo_seed.sql                 ← Multi-org demo seed — generated by scripts/generate_demo_seed.js
```

## Migration Files (apply in order)

| # | File | Purpose |
|---|------|---------|
| 000 | `000_dev_teardown.sql` | **DEV/TEST ONLY** — drops all v1 objects; never run on live prod |
| 001 | `001_extensions.sql` | `uuid-ossp`, `pgcrypto` |
| 002 | `002_tables.sql` | All tables, ENUMs (including audit taxonomy), views, indexes in FK dependency order; Realtime publication (7 tables); single-row config tables seeded inline |
| 003 | `003_helpers_and_triggers.sql` | `current_user_is_super_admin()`, `_assert_super_admin()`, `_assert_org_admin()`, `trigger_set_updated_at()`, `trigger_audit_log()` (with category/severity/actor_type/diff); trigger attachments on all tables |
| 004 | `004_rls.sql` | RLS policies for all tables — including audit no-delete policy and backup storage policies |
| 005 | `005_rpcs_jury.sql` | Jury RPCs: entry-token validation, authenticate, verify PIN, upsert score, finalize submission, rankings, feedback |
| 006 | `006_rpcs_admin.sql` | Admin RPCs: jury mgmt, org lifecycle, entry tokens, period config, system config, audit write helpers (`_audit_write`, `rpc_admin_write_audit_event`, `rpc_admin_log_period_lock`), public auth helpers |
| 007 | `007_identity.sql` | `admin_user_sessions` table + RLS; invite-flow RPCs (`rpc_org_admin_cancel_invite`, `rpc_accept_invite`); `rpc_admin_revoke_admin_session` (audited) |
| 008 | `008_platform.sql` | `platform_settings` + `platform_backups` tables; maintenance, metrics, backup CRUD RPCs; auto-backup + maintenance-countdown cron jobs; seeds platform frameworks (MÜDEK v3.1, ABET 2026–2027) |
| 009 | `009_audit.sql` | Idempotent backfills (periodName, taxonomy); `rpc_write_auth_failure_event` (anon-callable, rate-limited); hash-chain trigger + `_audit_verify_chain_internal` + `rpc_admin_verify_audit_chain`; anomaly-sweep cron; atomic mutation RPCs (period, framework, org, token, juror edit-mode) |

> **archive/** contains old incremental patch files for reference only.
> Never apply them to a fresh database — use the active files above instead.

## Tables

### Identity (4)

| Table | Key columns |
|-------|-------------|
| `organizations` | `code` UNIQUE, `name`, `institution`, `status`, `settings JSONB` |
| `profiles` | `id` → `auth.users`, `display_name`, `avatar_url` |
| `memberships` | `user_id`, `organization_id` (NULL = super_admin), `role` (`org_admin` \| `super_admin`), `status` (`active` \| `invited`) |
| `org_applications` | `organization_id`, `applicant_name`, `contact_email`, `status` |

### Admin Sessions (1)

| Table | Key columns |
|-------|-------------|
| `admin_user_sessions` | `user_id`, `device_id` UNIQUE pair, `browser`, `os`, `ip_address`, `country_code`, `auth_method`, `signed_in_at`, `last_activity_at`, `expires_at` |

### Frameworks (4)

| Table | Key columns |
|-------|-------------|
| `frameworks` | `organization_id`, `name`, `default_threshold`, `created_at` |
| `framework_outcomes` | `framework_id`, `code` UNIQUE per framework, `short_label`, `label`, `description`, `sort_order` |
| `framework_criteria` | `framework_id`, `key` UNIQUE per framework, `label`, `max_score`, `weight`, `rubric_bands JSONB` |
| `framework_criterion_outcome_maps` | `framework_id`, `period_id` → `periods`, `criterion_id` → `period_criteria`, `outcome_id` → `framework_outcomes`, `coverage_type` (`direct` \| `indirect`) |

### Execution (6)

| Table | Key columns |
|-------|-------------|
| `periods` | `organization_id`, `framework_id`, `name`, `season`, `is_current`, `is_locked`, `snapshot_frozen_at` |
| `projects` | `period_id`, `project_no`, `title`, `members JSONB`, `advisor_name`, `advisor_affiliation` |
| `jurors` | `organization_id`, `juror_name`, `affiliation`, `email`, `avatar_color` |
| `juror_period_auth` | PK(`juror_id`, `period_id`), `pin_hash` (bcrypt), `session_token_hash` (SHA-256), `session_expires_at`, `failed_attempts`, `locked_until`, `edit_enabled`, `edit_reason`, `edit_expires_at`, `final_submitted_at` |
| `entry_tokens` | `period_id`, `token_hash` (SHA-256, UNIQUE), `is_revoked`, `revoked_at`, `expires_at`, `last_used_at` |
| `audit_logs` | `organization_id`, `user_id`, `action`, `category` (`auth`\|`access`\|`config`\|`data`\|`security`), `severity` (`critical`\|`high`\|`medium`\|`low`\|`info`), `actor_type` (`admin`\|`juror`\|`system`\|`anonymous`), `actor_name`, `resource_type`, `resource_id`, `details JSONB`, `row_hash` (SHA-256 chain), `correlation_id` |

### Snapshots (3)

Immutable copies of framework criteria/outcomes frozen when a period is activated.
`score_sheet_items` references these, never the live `framework_criteria`.

| Table | Key columns |
|-------|-------------|
| `period_criteria` | `period_id`, `source_criterion_id`, `key` UNIQUE per period, `max_score`, `weight`, `rubric_bands JSONB` |
| `period_outcomes` | `period_id`, `source_outcome_id`, `code` UNIQUE per period |
| `period_criterion_outcome_maps` | `period_id`, `period_criterion_id`, `period_outcome_id`, `coverage_type` |

### Scoring (2 + 1 view)

| Object | Key columns |
|--------|-------------|
| `score_sheets` | PK(`juror_id`, `project_id`), `period_id`, `comment`, `status` (`draft` \| `in_progress` \| `submitted`) |
| `score_sheet_items` | `score_sheet_id`, `period_criterion_id`, `score_value` |
| `scores_compat` (view) | Flat wide-row shape for backward-compatible admin reads: `technical`, `written`, `oral`, `teamwork`, `comments` |

### Platform (3)

| Table | Key columns |
|-------|-------------|
| `platform_settings` | `key` UNIQUE, `value JSONB` — runtime feature flags and config |
| `platform_backups` | `organization_id`, `filename`, `storage_path`, `size_bytes`, `status`, `created_by` |
| `maintenance_mode` | `is_active`, `message`, `planned_end_at`, `updated_by` |

### Config (1)

Single-row configuration table seeded inline in `002_tables.sql`.

| Table | Key columns |
|-------|-------------|
| `security_policy` | `policy JSONB` — keys: `maxLoginAttempts`, `tokenTtl`, `ccOnPinReset`, `ccOnScoreEdit` |

### Misc (1)

| Table | Key columns |
|-------|-------------|
| `jury_feedback` | `juror_id`, `period_id`, `rating`, `comment`, `submitted_at` |

## RPCs

### Jury RPCs (anon + authenticated)

| Function | Purpose |
|----------|---------|
| `rpc_jury_authenticate(period_id, juror_name, affiliation, force_reissue, email)` | Find/create juror; generate bcrypt PIN; write `data.juror.auth.created` on first auth |
| `rpc_jury_verify_pin(period_id, juror_name, affiliation, pin)` | Verify bcrypt PIN; issue session token; lockout on failure |
| `rpc_jury_validate_entry_token(token)` | Validate entry token (SHA-256 lookup, revocation check, TTL) |
| `rpc_jury_validate_entry_reference(reference)` | Resolve short access reference ID to token/period payload |
| `rpc_jury_upsert_score(period_id, project_id, juror_id, session_token, scores, comment)` | Upsert `score_sheets` + `score_sheet_items`; enforces edit-window check |
| `rpc_jury_finalize_submission(period_id, juror_id, session_token)` | Set `final_submitted_at`; write per-criterion diff audit event |
| `rpc_jury_get_scores(period_id, juror_id, session_token)` | Return all scores for a juror in a period |
| `rpc_jury_project_rankings(period_id, juror_id, session_token)` | Return ranked project list for a juror |
| `rpc_submit_jury_feedback(period_id, juror_id, session_token, rating, comment)` | Submit post-eval feedback |

### Admin RPCs (authenticated)

| Function | Purpose |
|----------|---------|
| `rpc_period_freeze_snapshot(period_id)` | Copy framework criteria/outcomes into period snapshot tables; idempotent |
| `rpc_juror_reset_pin(period_id, juror_id)` | Generate + hash new PIN; clear lockout; write audit event |
| `rpc_juror_toggle_edit_mode(period_id, juror_id, enabled, reason, duration_minutes)` | Open/close juror edit window; write audit event |
| `rpc_juror_unlock_pin(period_id, juror_id)` | Clear PIN lockout; generate and return new PIN; write audit event |
| `rpc_admin_approve_application(application_id)` | Super-admin: mark application approved; write audit event |
| `rpc_admin_reject_application(application_id)` | Super-admin: reject application; write audit event |
| `rpc_admin_list_organizations()` | List organizations (super-admin scope) |
| `rpc_admin_generate_entry_token(period_id)` | Create entry token; revokes any existing non-revoked token first; write audit event |
| `rpc_entry_token_revoke(token_id)` | Revoke entry token; write audit event |
| `rpc_get_period_impact(period_id)` | Return before/after score metrics for impact analytics |
| `rpc_admin_revoke_admin_session(session_id)` | Revoke device session (audited); own sessions or super-admin for others |
| `rpc_admin_write_audit_event(action, resource_type, resource_id, details, category, severity)` | Explicit admin-initiated audit write |
| `rpc_admin_verify_audit_chain(org_id)` | Verify hash-chain integrity; returns broken-link JSONB array or `[]` |
| `rpc_admin_set_current_period(period_id)` | Mark a period as current; write audit event |
| `rpc_admin_set_period_lock(period_id, locked)` | Lock/unlock evaluation period; write audit event |
| `rpc_admin_save_period_criteria(period_id, criteria)` | Upsert period criteria config (delete + re-insert); write audit event |
| `rpc_admin_reorder_period_criteria(period_id, keys)` | Update `sort_order` for existing criteria without deleting rows; safe when `score_sheet_items` exist |
| `rpc_admin_create_framework_outcome(framework_id, code, label, description, sort_order)` | Create framework outcome; write audit event |
| `rpc_admin_update_framework_outcome(outcome_id, updates)` | Update framework outcome; write audit event |
| `rpc_admin_delete_framework_outcome(outcome_id)` | Delete framework outcome; write audit event |
| `rpc_admin_update_organization(org_id, updates)` | Update organization fields; write audit event |
| `rpc_admin_update_member_profile(user_id, display_name, org_id)` | Update member display name; write audit event |
| `rpc_admin_revoke_entry_token(token_id)` | Revoke entry token; write audit event |
| `rpc_admin_force_close_juror_edit_mode(period_id, juror_id)` | Force-close juror edit window; write audit event |

### Audit RPCs

| Function | Purpose |
|----------|---------|
| `rpc_write_auth_failure_event(email, method)` | **Anon-callable** — log failed admin login; rate-limited 20/5 min per email; severity escalates with repeated failures |
| `_audit_write(org_id, action, resource_type, resource_id, category, severity, details)` | Internal SECURITY DEFINER audit helper; all audit RPCs call this |
| `_audit_verify_chain_internal(org_id)` | Service-role-only chain verification helper (used by anomaly sweep cron) |

### Identity RPCs

| Function | Purpose |
|----------|---------|
| `rpc_org_admin_cancel_invite(membership_id)` | Delete an `invited` membership (cancel invite) |
| `rpc_accept_invite()` | Promote caller's own `invited` memberships to `active` |

### Platform RPCs

| Function | Purpose |
|----------|---------|
| `rpc_admin_get_maintenance()` | Read current maintenance mode row |
| `rpc_admin_set_maintenance(message, planned_end_at)` | Activate maintenance mode; write audit event |
| `rpc_admin_cancel_maintenance()` | Deactivate maintenance mode; write audit event |
| `rpc_public_maintenance_status()` | Anon-accessible: returns `is_active` + `message` |
| `rpc_admin_get_security_policy()` | Read `security_policy.policy` JSONB |
| `rpc_admin_set_security_policy(p_policy)` | Replace `security_policy.policy`; validates required keys |
| `rpc_platform_metrics()` | Aggregated platform-wide metrics (org/juror/project/eval counts) |
| `rpc_admin_list_backups(org_id)` | List backup records for an organization |
| `rpc_admin_create_backup(org_id, filename, storage_path, size_bytes)` | Register a new backup; write audit event |
| `rpc_admin_delete_backup(backup_id)` | Delete backup record + storage object; write audit event |
| `rpc_admin_set_backup_schedule(org_id, schedule)` | Update backup schedule setting |

### Public RPCs (anon)

| Function | Purpose |
|----------|---------|
| `rpc_landing_stats()` | Organization / juror / project / evaluation counts for landing page |
| `rpc_get_public_feedback()` | Return published jury feedback entries |
| `rpc_public_auth_flags()` | Return public auth configuration flags |

## Realtime

Seven tables are added to the `supabase_realtime` Postgres publication (migration `002`).
Only these tables are published to minimise WAL overhead.

| Table | Consumer | Event |
|-------|----------|-------|
| `score_sheets` | `useAdminRealtime` | `*` — live score progress on admin panel |
| `score_sheet_items` | `useAdminRealtime` | `*` — individual criterion updates |
| `juror_period_auth` | `useAdminRealtime` | `*` — juror session / edit-mode changes |
| `projects` | `useAdminRealtime` | `*` — project list changes |
| `periods` | `useAdminRealtime` | `*` — period lock / activation changes |
| `jurors` | `useAdminRealtime` | `*` — juror roster changes |
| `audit_logs` | `usePageRealtime` (AuditLogPage) | `INSERT` — new audit entries |

RLS still applies to all Realtime channels — clients only receive rows they are
authorised to read regardless of publication membership.

## Auth Model

Single JWT-based auth via Supabase Auth. No legacy password layer.

| Concept | Detail |
|---------|--------|
| `org_admin` | Member of one organization (`organization_id NOT NULL`) |
| `super_admin` | Member row with `organization_id IS NULL` (global scope) |
| `current_user_is_super_admin()` | Security-definer helper used in RLS policies to avoid recursion |
| Jury auth | Stateless token — `session_token_hash` in `juror_period_auth`; validated per RPC call |

### Google OAuth Setup

Google sign-in is handled entirely by Supabase Auth — no client-side secrets required.

**Supabase Dashboard** (per project):

```text
Authentication → Providers → Google
  → Client ID:     <Google Cloud OAuth Client ID>
  → Client Secret: <Google Cloud OAuth Client Secret>
```

**Google Cloud Console:**

```text
APIs & Services → Credentials → OAuth 2.0 Client IDs
  → Authorized redirect URIs:
      https://<project-ref>.supabase.co/auth/v1/callback
```

**First-time Google user flow** (see `src/shared/auth/AuthProvider.jsx`):

1. `signInWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: "google", redirectTo: ...?admin })`
2. After redirect, `onAuthStateChange` fires → `handleAuthChange` detects `provider === "google"` with no memberships and `profile_completed` not set
3. `profileIncomplete = true` → `CompleteProfileForm` shown to user
4. User submits name + organization → `completeProfile()` → sets `user_metadata.profile_completed = true` + calls `rpc_admin_application_submit`
5. Application enters pending review → `PendingReviewGate` shown until approved

## Seed Data

| File | Purpose |
|------|---------|
| `demo_seed.sql` | Multi-org demo seed with realistic score distributions and workflow-state diversity — generated by `scripts/generate_demo_seed.js` |

> **Do not apply seeds to production.** For dev or demo environments only.

## How to Apply

### Fresh setup

```bash
# Teardown (skip if starting fresh on an empty DB)
# WARNING: 000_dev_teardown drops everything — never run on live prod
psql "$DATABASE_URL" -f sql/migrations/000_dev_teardown.sql

# Apply migrations in order (001 → 009)
for f in sql/migrations/[0-9][0-9][0-9]_*.sql; do
  [[ "$f" == *"000_dev_teardown"* ]] && continue
  psql "$DATABASE_URL" -f "$f"
done
```

### Supabase Dashboard

1. Open SQL Editor → New query
2. Paste each migration file in order (`001` → `009`) → Run
3. Optionally apply the seed for dev/demo

### Seed data (dev only)

```bash
node scripts/generate_demo_seed.js
psql "$DATABASE_URL" -f sql/seeds/demo_seed.sql
```

**Idempotency:** All migrations are safe to re-run (`CREATE OR REPLACE FUNCTION`,
`CREATE TABLE IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS`). Backfill
statements in `009_audit.sql` use `WHERE category IS NULL` / `WHERE NOT (details ? 'periodName')`
guards to skip already-processed rows.
