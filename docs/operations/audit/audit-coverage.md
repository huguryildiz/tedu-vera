# VERA Audit Log

> _Last updated: 2026-05-03_

Every security-relevant action in VERA is recorded in a single append-only
`audit_logs` table. This document is the authoritative reference for what gets
logged, how it gets there, and how to verify it.

---

## Design Goals

1. **No silent drops.** A client crash, dropped request, or forgotten `.catch()`
   must not erase a high-severity action from history.
2. **Self-contained rows.** `actor_name`, `action`, `resource_type`, `diff`,
   `ip_address`, `user_agent` are populated at write time so a row read years
   later still tells the full story.
3. **Single taxonomy.** Action strings are dotted (`noun.verb`). The UI's
   labels, narratives, and icons live in one `EVENT_META` map in
   `src/admin/utils/auditUtils.js`.
4. **Append-only.** Nothing updates or deletes audit rows. Hard-delete RLS
   (`FOR DELETE USING (false)`) blocks even superadmin.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                          audit_logs                              │
│           (append-only, RLS-protected, org-scoped)               │
└──────────────────────────────────────────────────────────────────┘
              ▲            ▲                 ▲              ▲
              │            │                 │              │
   ┌──────────┴───┐ ┌──────┴──────┐ ┌────────┴───────┐ ┌────┴─────┐
   │ DB trigger   │ │ SECURITY    │ │ Edge Function  │ │ Blocking │
   │ on CRUD      │ │ DEFINER RPC │ │ (service role) │ │ client   │
   │ (15 tables)  │ │ (atomic tx) │ │ server-side    │ │ write    │
   └──────────────┘ └─────────────┘ └────────────────┘ └──────────┘
        automatic        atomic         server-side       available
        for every op    with the op    (email, cron)      but unused
```

Every row is written by exactly one of these four mechanisms.

---

## Write Mechanisms

| Mechanism | Who writes | When to use |
| --- | --- | --- |
| **DB trigger** (`trigger_audit_log`) | Postgres, `AFTER INSERT/UPDATE/DELETE` | Any CRUD on a tracked table. Automatic, no client code needed. |
| **SECURITY DEFINER RPC** | The RPC itself, same transaction as the DB change | Richer semantic context than raw CRUD (score submission, period lock, criteria save, etc.). |
| **Edge Function** (service role) | The Edge Function, after primary work succeeds | Email sends, auth events (Database Webhook), file exports, hourly anomaly sweep. |
| **Blocking client write** | React app via `writeAuditLog()` with `await` | Infrastructure for future client-side needs. Currently unused. |

**Banned pattern:** `writeAuditLog(...).catch(...)` fire-and-forget calls. All audit
writes are either transactional (RPC), trigger-automatic, or Edge Function server-side.

**One documented exception — login failure audit.** `writeAuthFailureEvent()` in
`src/auth/shared/AuthProvider.jsx` is intentionally fire-and-forget on the *client*
because:

1. The actual audit insert happens inside the SECURITY DEFINER RPC
   `rpc_write_auth_failure_event` (009_audit.sql), which runs server-side and is
   the only blocking write. The "fire-and-forget" is the *RPC invocation*, not the
   audit insert itself.
2. Failing the login UX over an audit write would create a worse outcome than a
   missed audit row: a user who entered the right password on the second try would
   see a confusing error on the first attempt.
3. The RPC is rate-limited (20 failures per 5 minutes per email) and severity-
   escalating, so a momentary client→DB hiccup is recoverable on the next attempt.

This exception applies *only* to authentication failure events. Any new audit write
on a user-facing critical path must use one of the four blocking mechanisms above.

---

## Row Schema

```sql
CREATE TABLE audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz      DEFAULT now(),
  organization_id   uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES profiles(id)      ON DELETE SET NULL,
  actor_type        text,        -- 'admin' | 'juror' | 'system' | 'anonymous'
  actor_name        text,        -- snapshot of display name at write time
  action            text NOT NULL,
  resource_type     text,
  resource_id       uuid,
  category          text,        -- 'auth' | 'access' | 'data' | 'config' | 'security'
  severity          text,        -- 'info' | 'low' | 'medium' | 'high' | 'critical'
  details           jsonb DEFAULT '{}',
  diff              jsonb,       -- { before: {...}, after: {...} } — only changed keys
  ip_address        inet,
  user_agent        text,
  row_hash          text,        -- sha256 chain for tamper evidence
  chain_seq         bigserial,   -- monotonic insert-order counter (chain ordering)
  correlation_id    uuid,        -- groups related events from the same operation
  synced_to_ext     boolean NOT NULL DEFAULT false,  -- external sink delivery flag
  synced_to_ext_at  timestamptz                       -- when sink confirmed delivery
);
```

**Notable columns:**

- **`actor_name`** -- snapshot at write time. Profile renames don't affect
  historical rows.
- **`actor_type`** -- `'admin'` when `auth.uid()` is present (triggers and RPCs),
  `'system'` for cron/backend, `'juror'` for jury-side RPCs, `'anonymous'` for
  unauthenticated callers.
- **`diff`** -- `{ before, after }` with **only the changed keys** (selective
  diff via `_jsonb_diff`). Noisy keys (`updated_at`, `last_seen_at`,
  `last_activity_at`) are stripped. `score_sheets` is excluded entirely to
  avoid score-sheet-volume bloat.
- **`chain_seq`** -- BIGSERIAL on every insert. Hash chain ordering uses this
  (not `created_at`) so a row inserted with a backdated `created_at` cannot
  silently slip into the past.
- **`ip_address` / `user_agent`** -- extracted from `request.headers` GUC
  (PostgREST path) or request headers (Edge Function path) by the
  trusted-proxy-depth-aware parser. No manual passing.
- **`synced_to_ext` / `synced_to_ext_at`** -- delivery flags managed by the
  `audit-log-sink` Edge Function and the hourly drain pass. Rows that fail to
  forward stay `false` and are retried until they succeed.
- **`user_id`** -- FK to `profiles` with `ON DELETE SET NULL`. Deleting an
  admin keeps the historical rows intact (the snapshot in `actor_name` still
  identifies who acted) without blocking the deletion on FK violations.
- **`correlation_id`** -- groups related events from a single logical operation.
  `rpc_jury_finalize_submission` generates one UUID per call and stamps it on
  all three rows it writes (`evaluation.complete`, `data.score.submitted` × N,
  `juror.edit_mode_closed_on_resubmit`), making it possible to reconstruct a
  complete submission from audit logs.

---

## Tracked Tables (DB Trigger)

15 tables have `trigger_audit_log` attached. Every INSERT, UPDATE, and DELETE
on these tables produces an audit row automatically. Trigger-emitted rows
carry `ip_address` and `user_agent` (extracted from the PostgREST
`request.headers` GUC, mirroring `_audit_write`'s logic).

The diff column stores **only the changed keys** (per `_jsonb_diff` helper),
not full row snapshots — `updated_at`, `last_seen_at`, `last_activity_at` are
stripped as noise. UPDATEs whose only changes are noisy keys produce no audit
row at all (the trigger early-returns), preventing heartbeat-traffic flood.

| Table | Org resolution | Category |
| --- | --- | --- |
| `organizations` | self | data |
| `periods` | `organization_id` column | data |
| `projects` | via `periods.organization_id` | data |
| `jurors` | `organization_id` column | data |
| `score_sheets` | via `periods.organization_id` | data (diff: NULL — score volume) |
| `memberships` | `organization_id` column | data |
| `entry_tokens` | via `periods.organization_id` | data |
| `period_criteria` | via `periods.organization_id` | data |
| `period_criterion_outcome_maps` | via `periods.organization_id` | data |
| `framework_outcomes` | via `frameworks.organization_id` | data |
| `frameworks` | `organization_id` column | data |
| `profiles` | NULL (global) | data |
| `security_policy` | NULL (global) | config |
| `unlock_requests` | `organization_id` column | data |
| `juror_period_auth` | via `jurors.organization_id` | data (composite PK; resource_id=juror_id) |

Trigger actions follow the pattern `<table_name>.<operation>`, e.g.,
`periods.insert`, `jurors.update`, `juror_period_auth.update`.

**Note:** `org_applications` and `admin_invites` were previously listed here in
error — they have no trigger attached. Org-application lifecycle is captured by
the `application.approved` / `application.rejected` semantic events emitted from
the corresponding RPCs; admin-invite lifecycle by `access.admin.invited` /
`access.admin.accepted`.

---

## Event Catalog

### Auth and Access

| Action | Mechanism | Severity |
| --- | --- | --- |
| `auth.admin.login.success` | Edge Function (Database Webhook on `auth.sessions` INSERT) | info |
| `auth.admin.login.failure` | RPC (`rpc_write_auth_failure_event`) | medium |
| `admin.logout` | Edge Function (Database Webhook on `auth.sessions` DELETE) | info |
| `auth.admin.password.changed` | Edge Function (`password-changed-notify`) | medium |
| `auth.admin.password.reset.requested` | Edge Function (`password-reset-email`) | low |
| `auth.admin.email_verified` | Edge Function (`email-verification-confirm`, fail-closed) | low |
| `auth.admin.email.changed` | Edge Function (`on-auth-event` Database Webhook on `auth.users` UPDATE — fires only when `old.email != new.email`, carrying `old_email`, `new_email`, and `email_change_confirmed`) | medium |
| `admin.updated` | RPC (`rpc_admin_update_member_profile`) | info |
| `access.admin.invited` | Edge Function (`invite-org-admin`) | low |
| `access.admin.accepted` | RPC (`rpc_accept_invite`) — one row per activated org membership | medium |

### Configuration

Canonical taxonomy is `config.outcome.*`; legacy `outcome.*` aliases are still
accepted for historical rows and mapped to the same UI labels.

| Action | Mechanism | Severity |
| --- | --- | --- |
| `organization.status_changed` | RPC (`rpc_admin_update_organization`) with diff | high |
| `period.set_current` | RPC (`rpc_admin_set_current_period`) | info |
| `period.lock` / `period.unlock` | RPC (`rpc_admin_set_period_lock`) | high |
| `period.duplicated` | RPC (`rpc_admin_duplicate_period`) — details: `periodName`, `source_period_id`, `source_name` | low |
| `criteria.save` | RPC (`rpc_admin_save_period_criteria`) with diff — details: `criteriaCount`, `periodName` | medium |
| `config.framework.unassigned` | RPC (`rpc_admin_period_unassign_framework`) — details: `periodName`, `framework_id`, `outcomes_removed`, `mappings_removed` | medium |
| `config.outcome.created` / `.updated` / `.deleted` | RPC trio (`rpc_admin_create/update/delete_period_outcome` for `period_outcomes`; `rpc_admin_create/update/delete_framework_outcome` for `framework_outcomes`) — details for period_outcomes variants: `outcome_code`, `outcome_label`, `period_id`, `period_name`, `periodName` | info |
| `mapping.upsert` / `mapping.delete` | RPC (`rpc_admin_upsert/delete_period_criterion_outcome_map`) — details: `period_id`, `period_name`, `periodName`, `period_criterion_id`, `period_outcome_id`, `coverage_type` | low |
| `config.platform_settings.updated` | RPC (`rpc_admin_set_platform_settings`) with diff | medium |
| `config.backup_schedule.updated` | RPC (`rpc_admin_set_backup_schedule`) with diff | high |
| `application.approved` / `.rejected` | RPC (`rpc_admin_approve_application` / `rpc_admin_reject_application`) | medium |
| `security_policy.*` | DB trigger | high |

### Data

Canonical PIN taxonomy is `juror.pin_locked` / `juror.pin_unlocked` /
`pin.reset`; legacy `data.juror.pin.*` aliases are supported in UI mapping.

| Action | Mechanism | Severity |
| --- | --- | --- |
| `data.juror.auth.created` | RPC (`rpc_jury_authenticate`) — first auth per (juror, period) pair; details include `juror_name`, `juror_id`, `period_id`, `period_name`, `periodName`, `affiliation` | info |
| `data.score.submitted` | RPC (`rpc_jury_finalize_submission`) with per-criterion diff | info |
| `data.score.edit_requested` | Edge Function (`request-score-edit`) | low |
| `juror.pin_locked` / `juror.pin_unlocked` | RPC (juror auth) — details include `juror_id`, `period_id`, `period_name`, `periodName`, `failed_attempts`, `locked_until` | medium |
| `pin.reset` / `juror.pin_unlocked_and_reset` | RPC (`rpc_juror_reset_pin`, `rpc_juror_unlock_pin`) — admin reset; details: `juror_name`, `juror_id`, `period_id`, `period_name`/`periodName`, `reset_by` | medium |
| `data.juror.edit_mode.granted` / `.force_closed` / `.closed` | RPC | info-medium |
| `juror.edit_mode_enabled` / `juror.edit_mode_disabled` | RPC (`rpc_juror_toggle_edit_mode`, both paths) — details include `period_id`, `period_name`, `periodName`, `juror_id`, `juror_name`; enabled adds `reason`, `duration_minutes`, `expires_at`; disabled adds `previous_reason`, `close_source` | info |
| `evaluation.complete` | RPC (`rpc_jury_finalize_submission`) | info |
| CRUD on tracked tables (`<table>.insert/update/delete`) | DB trigger (`trigger_audit_log`) — enriches details with table-specific human-readable fields: `periods.*` → `periodName`; `projects.*` → `project_title` + `period_name` + `periodName`; `jurors.*` → `juror_name`; `juror_period_auth.insert` → `juror_name` + `period_name`; `entry_tokens.*` → `period_name`; `period_criteria.*` → `period_name` + `criterion_name`; `period_criterion_outcome_maps.*` → `period_name` + `criterion_name` + `outcome_code` + `outcome_label`; `memberships.*` → `member_email` + `role` | info-medium |

### Security

| Action | Mechanism | Severity |
| --- | --- | --- |
| `security.entry_token.revoked` | RPC (`rpc_admin_revoke_entry_token`) | high |
| `token.generate` | RPC | info |
| `security.pin_reset.requested` | Edge Function (`request-pin-reset`) | medium |
| `security.anomaly.detected` | Edge Function cron (`audit-anomaly-sweep`) | high |
| `security.chain.broken` | Edge Function cron (auto chain verify) | critical |
| `security.chain.root.signed` | Edge Function cron (`audit-anomaly-sweep`) — HMAC-SHA256 signed snapshot of the latest chain root, forwarded to the external sink each sweep | info |
| `system.migration_applied` | RPC (`rpc_admin_log_migration`, service_role only) — paper trail for manual `apply_migration` calls (label + actor + commit/migrations details) | high |
| `backup.*` | RPC (`rpc_platform_backups_*`) | info |
| `maintenance.set` / `maintenance.cancelled` | RPC (`rpc_admin_set_maintenance` / `rpc_admin_cancel_maintenance`) | high / medium |
| `access.admin.session.revoked` | RPC (`rpc_admin_revoke_admin_session`) | high |

### Notifications (all Edge Function server-side)

| Action | Edge Function |
| --- | --- |
| `notification.entry_token` | `send-entry-token-email` |
| `notification.juror_pin` | `send-juror-pin-email` |
| `notification.juror_reminder` | `notify-juror` |
| `notification.export_report` | `send-export-report` |
| `notification.admin_invite` | `invite-org-admin` |
| `notification.maintenance` | `notify-maintenance` |
| `notification.unlock_request` | `notify-unlock-request` |
| `notification.email_verification` | `email-verification-send` — fires whenever an admin requests a verification link, with `recipient`, `send_result` (`sent` / `skipped_no_key`), `send_error`, and `expires_at` in `details` |

Every notification row carries recipients, send result, and any error in
`details`.

### Exports (all server-side via `log-export-event` Edge Function)

| Action | Severity |
| --- | --- |
| `export.scores` / `export.rankings` / `export.heatmap` | info |
| `export.analytics` / `export.audit` / `export.projects` / `export.jurors` / `export.backup` | info |

Export audit write happens before file generation. If the audit write fails,
the export aborts (no file without a log).
Export details use one schema across all export types:
`format`, `row_count`, `period_name`, `project_count`, `juror_count`, `filters`.

---

## Anomaly Detection

### Server-side (persistent)

The `audit-anomaly-sweep` Edge Function runs hourly via cron. It scans the last
60 minutes and writes `security.anomaly.detected` rows (with 2h dedup window).

| Rule | Condition | Threshold |
| --- | --- | --- |
| `ip_multi_org` | Same IP across distinct orgs | >= 2 orgs |
| `pin_flood` | `juror.pin_locked` events per org | >= 10 |
| `login_failure_burst` | `auth.admin.login.failure` per org | >= 5 |
| `org_suspended` | `organization.status_changed` with `newStatus=suspended` | >= 1 |
| `token_revoke_burst` | `security.entry_token.revoked` per org | >= 2 |
| `export_burst` | `export.*` events per org | >= 5 |

Each sweep also runs `_audit_verify_chain_internal(null)` (service_role-only helper,
no auth check). Broken links write a `security.chain.broken` row (severity=critical).

The same sweep performs two additional passes after anomaly detection:

1. **External-sink drain** — fetches up to 500 audit rows whose `synced_to_ext`
   flag is `false` and whose `created_at` is older than 5 minutes, re-POSTs each
   to `AUDIT_SINK_WEBHOOK_URL`, and marks `synced_to_ext = true` on success.
   This guarantees eventual delivery even when the Database Webhook fires faster
   than the sink can ingest.

2. **Root anchoring** — if `AUDIT_ROOT_SIGNING_SECRET` is set, the sweep computes
   `HMAC-SHA256(id|chain_seq|row_hash|signed_at)` on the latest chain row and
   writes it as a `security.chain.root.signed` audit event. The signed root is
   then forwarded externally by the sink, creating an off-site copy of the chain
   tip that a compromised database administrator cannot tamper with without
   detection.

### Client-side (UI feedback only)

`detectAnomalies()` in `src/admin/utils/auditUtils.js` runs 6 rules on loaded
logs and shows an instant banner in the Audit Log page. These do not persist to
the database -- they are visual alerts only. The server-side cron is the
authoritative anomaly writer.

---

## Tamper Evidence

Five layers protect audit integrity:

1. **Hash chain.** Each row's `row_hash` = `sha256(id || action || org_id ||
   created_at || prev_hash)`, ordered by the `chain_seq` `BIGSERIAL` so a row
   inserted with a backdated `created_at` cannot break the order. Verified by
   `rpc_admin_verify_audit_chain` (UI button for super-admins + automatic check
   in every anomaly sweep).
2. **Append-only RLS.** `FOR DELETE USING (false)` prevents any deletion.
3. **`user_id` decoupled from rows.** `audit_logs.user_id` references
   `profiles(id) ON DELETE SET NULL`. Deleting an admin clears the FK pointer
   but the audit row survives — `actor_name` snapshot keeps the record readable
   without the live profile.
4. **External log sink with retry.** Every `audit_logs` INSERT is forwarded via
   the `audit-log-sink` Edge Function (Database Webhook) to an external
   observability platform (Axiom `vera-audit-logs` dataset). On success the
   row's `synced_to_ext` flag flips to `true`. Failed forwards stay `false` and
   are picked up by the hourly drain pass. No silent drops.
5. **Off-site signed roots.** When `AUDIT_ROOT_SIGNING_SECRET` is set, the
   hourly sweep emits a `security.chain.root.signed` event with an HMAC-SHA256
   signature of the latest chain tip. The sink forwards it externally; a DB
   admin who tampers with the in-DB chain cannot also forge the off-site
   signed roots without the secret.

### Trusted-proxy IP extraction

Both `_audit_write` (SQL) and the Edge-Function `extractClientIp` honor a
deployment-configurable trusted-proxy depth so spoofed `X-Forwarded-For`
entries can be rejected:

- SQL: `ALTER DATABASE postgres SET app.audit_proxy_depth = '1';`
- Edge: env `AUDIT_TRUSTED_PROXY_DEPTH=1`

When set to `N`, the parser walks the XFF chain from the right, skipping `N`
trusted hops (Supabase Edge, optional CDN). When unset, behavior falls back to
the legacy "trust XFF[0]" mode for backwards compatibility — but production
deployments should set both values explicitly. See `_audit_extract_client_ip`
in `003_helpers_and_triggers.sql` and `_shared/audit-log.ts:extractClientIp`.

---

## Verification Checklist

After any audit-related change, verify these produce visible rows:

**DB operations:**

- Set a period as current -> `period.set_current`
- Toggle period lock -> `period.lock` / `period.unlock`
- Save criteria -> `criteria.save` (with diff)
- Create/update/delete an outcome -> `config.outcome.created` / `.updated` / `.deleted`
- Update platform settings -> `config.platform_settings.updated`
- Update backup schedule -> `config.backup_schedule.updated`
- Revoke an admin session -> `access.admin.session.revoked`
- Change organization status -> `organization.status_changed` (with diff)
- Update admin profile -> `admin.updated`
- Revoke entry token -> `security.entry_token.revoked`
- Force-close juror edit mode -> `data.juror.edit_mode.force_closed`
- Submit jury scores -> `data.score.submitted` (with diff)
- Update security policy -> `security_policy.update` (with diff, actor_type=admin)
- Accept admin invitation -> `access.admin.accepted` (one row per activated org membership)
- Toggle juror edit mode (admin) -> `juror.edit_mode_enabled` / `juror.edit_mode_disabled` (symmetric pair)
- Apply a manual migration via `rpc_admin_log_migration` -> `system.migration_applied`

**Auth:**

- Log in -> `auth.admin.login.success`
- Fail to log in -> `auth.admin.login.failure`
- Log out -> `admin.logout`
- Verify admin email -> `auth.admin.email_verified` (fail-closed; 500 on audit failure)
- Request a fresh verification link -> `notification.email_verification` (fire-and-forget audit; recipient + send_result captured)
- Change admin email address -> `auth.admin.email.changed` (Database Webhook on `auth.users` UPDATE; old_email + new_email captured)

**Exports:**

- Any export type -> `export.<type>` (server-side, blocks on failure)

**Forensics (for any recent row):**

- `actor_name` is populated (not NULL)
- `actor_type` is `'admin'` for user-initiated actions (not `'system'`)
- `ip_address` is populated (incl. trigger-emitted rows)
- `user_agent` is populated (incl. trigger-emitted rows)
- `diff` carries only the changed keys, not full row snapshots
- `synced_to_ext` flips to `true` once forwarded to the external sink;
  rows older than 5 minutes with `false` get retried by the next sweep
- For each hourly sweep window: `security.chain.root.signed` row exists
  and the HMAC signature recomputes to its stored value

---

## Audit Query Reference

A human-readable map from investigative questions to the exact audit events that
answer them. All rows are in `audit_logs`; filter by `action` and optionally
`actor_type`, `resource_id`, or `details`.

### Juror Activity

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| When did a juror start their evaluation? | `data.juror.auth.created` | `juror_id`, `period_id` |
| When did a juror finish (submit) their evaluation? | `evaluation.complete` | `juror_id`, `period_id`, `correlation_id` |
| Did a juror lock their PIN? When? | `juror.pin_locked` | `juror_id`, `attempt_count` |
| When was a PIN reset performed? | `pin.reset` + `security.pin_reset.requested` | `juror_id`, `reset_by` (admin actor) |
| Did a juror request an edit after submission? | `data.score.edit_requested` | `juror_id`, `project_id`, `reason` |
| Was a juror's edit mode granted or force-closed by an admin? | `data.juror.edit_mode.granted` / `.force_closed` / `.closed` | `juror_id`, `granted_by` |

**Tip:** Use `correlation_id` to reconstruct a complete submission session —
`evaluation.complete`, all `data.score.submitted` rows, and
`juror.edit_mode_closed_on_resubmit` share the same `correlation_id`.

---

### Admin — Data Management

| Question | Action(s) to query | Notes |
| --- | --- | --- |
| Did admin add / edit / delete a juror? | `jurors.insert` / `jurors.update` / `jurors.delete` | DB trigger; `diff` carries before/after |
| Did admin add / edit / delete a project? | `projects.insert` / `projects.update` / `projects.delete` | DB trigger |
| Did admin add / edit / delete an evaluation period? | `periods.insert` / `periods.update` / `periods.delete` | DB trigger |
| Did admin lock or unlock a period? | `period.lock` / `period.unlock` | RPC; severity=high |
| Did admin change criteria weights or rubric bands? | `criteria.save` | RPC; `diff` shows changed weights |

---

### Admin — Exports and Notifications

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| What did admin export and when? | `export.scores` / `export.rankings` / `export.heatmap` / `export.analytics` / `export.audit` / `export.projects` / `export.jurors` / `export.backup` | `format`, `row_count`, `period_name`, `filters` |
| Who did admin email an export to? | `notification.export_report` | `recipients`, `send_result`, `export_type` |
| When were juror PINs sent by email? | `notification.juror_pin` | `recipients`, `juror_id` |
| When was an entry token emailed? | `notification.entry_token` | `recipients`, `token_id`, `period_id` |

---

### Admin — QR Codes / Entry Tokens

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| When did admin generate an entry token (QR code)? | `token.generate` or `entry_tokens.insert` (DB trigger) | `token_id`, `period_id`, `expires_at` |
| When did admin revoke an entry token? | `security.entry_token.revoked` | `token_id`, `period_id`; severity=high |

---

### Admin — PIN Management

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| Whose PIN block did admin remove? When? | `juror.pin_unlocked` | `juror_id`, `juror_name`; `actor_type='admin'` |
| When was a PIN reset requested by admin? | `security.pin_reset.requested` | `juror_id`, `requested_by` |

---

### Admin — Organization / Access Management

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| When did admin approve an organization application? | `application.approved` | `org_id`, `applicant_name` |
| When did admin reject an organization application? | `application.rejected` | `org_id`, `reason` |
| When did admin change an organization's status (suspend/activate)? | `organization.status_changed` | `diff` carries `before`/`after` status; severity=high |
| When was an admin invited to an organization? | `access.admin.invited` | `invitee_email`, `org_id` |
| When did an invited admin accept their invitation? | `access.admin.accepted` | `invitee_id`, `org_id` |
| When did admin revoke another admin's session? | `access.admin.session.revoked` | `revoked_user_id`, `session_id` |
| When did an admin verify their email address? | `auth.admin.email_verified` | `email`, `verified_at` |
| When did an admin request a verification email? | `notification.email_verification` | `recipient`, `send_result`, `send_error`, `expires_at` |
| When did an admin's email address change? | `auth.admin.email.changed` | `old_email`, `new_email`, `email_change_confirmed` |

---

### Admin — Juror Edit Mode (Symmetric Pair)

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| When did admin grant a juror an edit window? | `juror.edit_mode_enabled` | `juror_id`, `juror_name`, `reason`, `duration_minutes`, `expires_at` |
| When did admin manually close a juror's edit window? | `juror.edit_mode_disabled` | `juror_id`, `previous_reason`, `previous_expires_at`, `close_source='admin_manual'` |
| When did admin force-close a juror's edit window? | `data.juror.edit_mode.force_closed` | `juror_id`, `close_source='admin_force'`, `closed_at` |

---

### Operations — Migrations & Chain Integrity

| Question | Action(s) to query | Key `details` fields |
| --- | --- | --- |
| What manual migrations were applied recently? | `system.migration_applied` | `label`, `actor`, `migrations[]`, `plan` |
| Has the audit chain been verified recently? | `security.chain.broken` (only on failure) + `security.chain.root.signed` (every sweep) | `broken_count`, `earliest_break` / `chain_seq`, `row_hash`, `signature` |
| Did an audit row fail to forward to the external sink? | Query `audit_logs` with `synced_to_ext = false AND created_at < now() - interval '1 minute'` | (none — flag itself is the signal) |
| Was the latest off-site root signed? | `security.chain.root.signed` ordered DESC LIMIT 1 | `chain_seq`, `row_hash`, `signed_at`, `signature_alg`, `signature` |

---

## Conscious Exclusions

| Gap | Reason | Status |
| --- | --- | --- |
| `score_sheet_items` trigger | Would emit a row per blur/save during evaluation. `data.score.submitted` carries per-criterion diff on finalize. | By design |
| `juror_period_auth` trigger | PIN auth state managed by RPCs that write semantic events (`data.juror.auth.created`, `juror.pin_locked`, etc.). | Covered by RPCs |
| `auth.admin.session.expired` | Supabase Auth has no session-expiry event. | Would need polling |
| `access.admin.impersonate.*` | Impersonation feature does not exist. | Will add with feature |
| Historical rows (pre-migration 048) | `actor_name`, `ip_address`, `user_agent` are NULL. | UI shows "(unknown)" |

---
