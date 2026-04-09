# VERA Audit Coverage Report

Authoritative reference for audit logging in VERA. Three mechanisms: database triggers (automatic CRUD), RPC-emitted server-side logs (semantic business events), and frontend-instrumented logs (exports, notifications, login).

**Coverage:** 14 trigger-based CRUD tables + 8 RPC-emitted actions + 15 frontend-instrumented actions.

---

## 1. Overview

### Mechanisms

1. **DB Trigger-Based CRUD** (automatic) — INSERT/UPDATE/DELETE on 14 core tables
2. **RPC-Emitted** (server-side) — Semantic events from stored procedures (8 actions)
3. **Frontend-Instrumented** (via `rpc_admin_write_audit_log`) — Client-only events (15 actions)

### Every audit event stores

| Field | Description |
|-------|-------------|
| `organization_id` | Resolved from affected resource (NULL for cross-org `profiles`) |
| `user_id` | `auth.uid()` — NULL for juror and system actions |
| `action` | e.g. `periods.update`, `evaluation.complete`, `export.scores` |
| `resource_type` | Table name or logical type (e.g. `juror_period_auth`) |
| `resource_id` | UUID of affected row |
| `details` | JSONB — context varies by action |
| `created_at` | Server UTC timestamp, displayed in user's local timezone |

### Design principle

Server-side logging (triggers + RPCs) is the primary mechanism. Frontend fire-and-forget is used ONLY for actions that have no server-side hook. Duplicate logging is avoided.

---

## 2. Trigger-Based CRUD (14 tables)

Automatic audit logging on INSERT, UPDATE, DELETE. Implementation: `trigger_audit_log()` function (latest in migration 015).

| Table | Org Resolution | Added In |
|-------|----------------|----------|
| `organizations` | `self.id` | 003 |
| `periods` | `self.organization_id` | 003 |
| `projects` | `periods.organization_id` via `period_id` | 003 |
| `jurors` | `self.organization_id` | 003 |
| `score_sheets` | `periods.organization_id` via `period_id` | 003 |
| `memberships` | `self.organization_id` | 003 |
| `entry_tokens` | `periods.organization_id` via `period_id` | 003 |
| `org_applications` | `self.organization_id` | 013 |
| `framework_outcomes` | `frameworks.organization_id` via `framework_id` | 014 |
| `period_criteria` | `periods.organization_id` via `period_id` | 014 |
| `period_criterion_outcome_maps` | `periods.organization_id` via `period_id` | 014 |
| `admin_invites` | `self.org_id` | 015 |
| `frameworks` | `self.organization_id` | 015 |
| `profiles` | `NULL` (cross-org) | 015 |

**Action format:** `{table}.{insert|update|delete}`

**What triggers cover (user operations):**

| Operation | Trigger Action |
|-----------|---------------|
| Application submitted | `org_applications.insert` |
| Application approved/rejected (via RPC) | `org_applications.update` + RPC semantic log |
| Period locked/unlocked | `periods.update` |
| Current period changed | `periods.update` |
| Organization status toggled | `organizations.update` |
| Entry token revoked | `entry_tokens.update` |
| Criteria config saved | `period_criteria.delete` + `period_criteria.insert` |
| Outcome CRUD | `framework_outcomes.insert/update/delete` |
| Admin invited/accepted/cancelled | `admin_invites.insert/update` |
| Framework CRUD | `frameworks.insert/update/delete` |
| Profile display name changed | `profiles.update` |

---

## 3. RPC-Emitted Audit Logs (8 actions)

Server-side INSERT within SECURITY DEFINER functions.

### Juror-Initiated (3)

| Action | UI Label | Details |
|--------|----------|---------|
| `evaluation.complete` | Evaluation completed | `actor_name`, `period_id`, `juror_id` |
| `juror.pin_locked` | Juror locked (too many PIN attempts) | `actor_name`, `failed_attempts`, `locked_until` |
| `juror.edit_mode_closed_on_resubmit` | Edit mode closed (resubmit) | `actor_name`, `closed_at`, `close_source` |

Source: `rpc_jury_finalize_submission` (008), `rpc_jury_verify_pin` (008), enriched by (009)

### Admin-Initiated (3)

| Action | UI Label | Details |
|--------|----------|---------|
| `juror.pin_unlocked` | Juror unlocked by admin | `juror_name` |
| `juror.edit_mode_enabled` | Edit mode granted | `juror_name`, `reason`, `duration_minutes`, `expires_at` |
| `pin.reset` | Juror PIN reset by admin | `juror_name` |

Source: `rpc_juror_unlock_pin` (008/009), `rpc_juror_toggle_edit_mode_v2` (009), `rpc_juror_reset_pin` (008/009)

### Application Actions (2 — migration 013)

| Action | UI Label | Details |
|--------|----------|---------|
| `application.approved` | Application approved | `applicant_email`, `applicant_name` |
| `application.rejected` | Application rejected | `applicant_email`, `applicant_name` |

Source: `rpc_admin_approve_application` (013), `rpc_admin_reject_application` (013)

Note: `org_applications` trigger also fires `org_applications.update` — the RPC log is semantic, the trigger is a safety net.

---

## 4. Frontend-Instrumented Logs (15 actions)

Logged via `rpc_admin_write_audit_log`. Fire-and-forget with `console.warn` on failure.

### Data Export (6)

| Action | UI Label | Detail shown |
|--------|----------|-------------|
| `export.scores` | Scores exported | `CSV · 42 rows` |
| `export.rankings` | Rankings exported | `XLSX · 150 rows` |
| `export.heatmap` | Heatmap exported | `PDF · 12 jurors · 8 projects` |
| `export.analytics` | Analytics exported | `PDF` |
| `export.audit` | Audit log exported | `CSV · 200 rows` |
| `export.backup` | Backup exported | `XLSX · 3 periods` |

### Notification (6)

| Action | UI Label | Detail shown |
|--------|----------|-------------|
| `notification.application` | Application notification sent | `admin@email.com · application_approved` |
| `notification.admin_invite` | Admin invite email sent | `admin@email.com · invite` |
| `notification.entry_token` | QR access link emailed | `juror@email.com · bulk` |
| `notification.juror_pin` | Juror PIN emailed | `juror@email.com` |
| `notification.export_report` | Report shared via email | `recipient1@email.com, recipient2@email.com` |
| `notification.password_reset` | Password reset email sent | `admin@email.com` |

### Auth (1)

| Action | UI Label | Detail shown |
|--------|----------|-------------|
| `admin.login` | Admin login | `password` or `google` |

### Cross-Org Super-Admin (2)

| Action | UI Label | Detail shown |
|--------|----------|-------------|
| `period.set_current` | Active period changed | `Spring 2026 · TEDU-EE` |
| `organization.status_changed` | Organization status changed | `IEEE-APSSDC · active → disabled · reason` |

---

## 5. UI Display Reference

### Chip Labels (resource_type → UI badge)

| resource_type | Chip Label | Color Class |
|---------------|-----------|-------------|
| `entry_tokens` | QR Access | `token` |
| `score_sheets` | Evaluation | `eval` |
| `jurors` | Juror | `juror` |
| `juror_period_auth` | Juror | `juror` |
| `periods` | Period | `period` |
| `period_criteria` | Criteria | `period` |
| `framework_outcomes` | Outcome | `period` |
| `projects` | Project | `project` |
| `organizations` | Security | `security` |
| `memberships` | Security | `security` |
| `org_applications` | Application | `security` |
| `profiles` | Auth | `security` |
| `audit_logs` | Audit | `security` |
| `admin_invites` | Invite | `invite` |
| `frameworks` | Framework | `framework` |

Source: `CHIP_MAP` in `AuditLogPage.jsx:18`

### ACTION_LABELS (action → UI display text)

#### RPC-emitted

| Action | Label |
|--------|-------|
| `evaluation.complete` | Evaluation completed |
| `pin.reset` | Juror PIN reset by admin |
| `token.generate` | QR access code generated |
| `token.revoke` | QR access code revoked |
| `snapshot.freeze` | Snapshot frozen |
| `juror.pin_locked` | Juror locked (too many PIN attempts) |
| `juror.pin_unlocked` | Juror unlocked by admin |
| `juror.edit_mode_enabled` | Edit mode granted |
| `juror.edit_mode_closed_on_resubmit` | Edit mode closed (resubmit) |
| `application.approved` | Application approved |
| `application.rejected` | Application rejected |

#### Trigger-based CRUD

| Action | Label |
|--------|-------|
| `score_sheets.insert` | Score sheet created |
| `score_sheets.update` | Score sheet updated |
| `score_sheets.delete` | Score sheet deleted |
| `projects.insert` | Project created |
| `projects.update` | Project updated |
| `projects.delete` | Project deleted |
| `jurors.insert` | Juror created |
| `jurors.update` | Juror updated |
| `jurors.delete` | Juror deleted |
| `periods.insert` | Period created |
| `periods.update` | Period updated |
| `periods.delete` | Period deleted |
| `entry_tokens.insert` | QR access code created |
| `entry_tokens.update` | QR access code updated |
| `entry_tokens.delete` | QR access code deleted |
| `memberships.insert` | Membership created |
| `memberships.update` | Membership updated |
| `memberships.delete` | Membership deleted |
| `organizations.insert` | Organization created |
| `organizations.update` | Organization updated |
| `org_applications.insert` | Application submitted |
| `org_applications.update` | Application status changed |
| `org_applications.delete` | Application deleted |
| `admin_invites.insert` | Admin invite created |
| `admin_invites.update` | Admin invite updated |
| `admin_invites.delete` | Admin invite deleted |
| `frameworks.insert` | Framework created |
| `frameworks.update` | Framework updated |
| `frameworks.delete` | Framework deleted |
| `profiles.insert` | Profile created |
| `profiles.update` | Profile updated |

#### Frontend-instrumented

| Action | Label |
|--------|-------|
| `admin.login` | Admin login |
| `export.scores` | Scores exported |
| `export.rankings` | Rankings exported |
| `export.heatmap` | Heatmap exported |
| `export.analytics` | Analytics exported |
| `export.audit` | Audit log exported |
| `export.backup` | Backup exported |
| `period.set_current` | Active period changed |
| `organization.status_changed` | Organization status changed |
| `notification.application` | Application notification sent |
| `notification.admin_invite` | Admin invite email sent |
| `notification.entry_token` | QR access link emailed |
| `notification.juror_pin` | Juror PIN emailed |
| `notification.export_report` | Report shared via email |
| `notification.password_reset` | Password reset email sent |

Fallback: unknown actions → `{table} {operation}` (e.g., "Score sheets created")

Source: `ACTION_LABELS` in `auditUtils.js:239`

### Detail Line Logic

The detail line under each action label is built by `formatActionDetail()` in `auditUtils.js:350`. Priority order:

| Condition | Detail shown | Example |
|-----------|-------------|---------|
| `details.juror_name` | Juror name | `Ahmet Yılmaz` |
| `details.actor_name` (juror action) | Actor name | `Elif Kaya` |
| `details.applicant_name/email` | Applicant info | `John Doe · john@email.com` |
| `details.periodName` | Period + org | `Spring 2026 · TEDU-EE` |
| `details.previousStatus + newStatus` | Status transition | `IEEE-APSSDC · active → disabled` |
| `details.recipientEmail` | Recipient + type | `admin@email.com · invite` |
| `details.recipients` (array) | Comma-joined list | `a@email.com, b@email.com` |
| `details.format` | Export format + counts | `XLSX · 42 rows · 12 jurors` |
| `details.adminName/adminEmail` | Admin info | `John Doe · john@email.com` |
| `details.email` | Email | `admin@email.com` |
| `details.method` | Auth method | `password` |
| `details.criteriaCount` | Criteria summary | `5 criteria · 12 mappings` |
| `details.operation + table` | Trigger fallback | `UPDATE · periods` |

---

## 6. Actor Classification

| Type | Condition | Display |
|------|-----------|---------|
| **Admin** | `user_id IS NOT NULL` | Display name from `profiles.display_name` + "Organization Admin" |
| **Juror** | `user_id IS NULL` + juror action | Actor name from `details.actor_name` + "Juror" |
| **System** | `user_id IS NULL` + trigger action | "System" + "Automated" |

Juror actions: `evaluation.complete`, `juror.pin_locked`, `juror.edit_mode_closed_on_resubmit`

Source: `getActorInfo()` in `auditUtils.js:225`

---

## 7. Conscious Exclusions

| Table/Operation | Reason |
|----------------|--------|
| `audit_logs` | Self-referential logging is meaningless |
| `security_policy` | Very rare, low risk |
| `maintenance_mode` | Very rare, low risk |
| `framework_criteria` | No frontend CRUD — populated via snapshot freeze into `period_criteria` |
| `framework_criterion_outcome_maps` | No frontend CRUD — only SELECT |
| `period_outcomes` | No frontend CRUD — only SELECT |
| `score_sheet_items` | `score_sheets` trigger provides coverage; item-level too noisy |
| `juror_period_auth` | PIN/session events covered by 3 dedicated RPCs |
| `jury_feedback` | Low priority |
| Profile upsert on login | Fires every login; noise without value |
| `forceCloseJurorEditMode` | Edge case; toggle RPC covers normal path |
| `password-changed-notify` email | Low-value informational notification |
| `request-pin-reset` / `request-score-edit` emails | Juror-initiated; RPC already logs the action |
| `notify-maintenance` email | Very rare |
| `platform-metrics` ping | Health check, not auditable |

---

## 8. Architecture

### Database Schema

```sql
CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id),
  user_id          UUID REFERENCES profiles(id),
  action           TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      UUID,
  details          JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_organization_created
  ON audit_logs (organization_id, created_at DESC);
```

### RPC Layer

Frontend logging endpoint:

```sql
rpc_admin_write_audit_log(p_action, p_resource_type, p_resource_id, p_details, p_organization_id)
```

- `p_organization_id`: explicit org override (required for super-admin cross-org actions)
- Fallback: resolves from `memberships WHERE user_id = auth.uid() LIMIT 1`
- Location: `sql/migrations/010_audit_write_rpc.sql`

### Pagination

Cursor-based keyset using `(created_at, id)` composite. Implemented in `listAuditLogs()`:

```js
query.or(`created_at.lt.${beforeAt},and(created_at.eq.${beforeAt},id.lt.${beforeId})`)
```

### Search

Multi-column ILIKE across `action`, `resource_type`, and JSONB `details` fields (`applicant_email`, `applicant_name`, `actor_name`, `juror_name`).

---

## 9. Implementation References

### Migrations

| File | Purpose |
|------|---------|
| `002_tables.sql` | `audit_logs` table + indexes |
| `003_helpers_and_triggers.sql` | `trigger_audit_log()` + initial 7 triggers |
| `008_audit_logs.sql` | 6 RPC-emitted actions |
| `009_audit_actor_enrichment.sql` | Actor name enrichment |
| `010_audit_write_rpc.sql` | `rpc_admin_write_audit_log` |
| `013_audit_completeness.sql` | Application RPCs + `org_applications` trigger |
| `014_audit_trigger_expansion.sql` | `framework_outcomes`, `period_criteria`, `period_criterion_outcome_maps` triggers |
| `015_audit_trigger_phase3.sql` | `admin_invites`, `frameworks`, `profiles` triggers |

### Frontend

| File | Purpose |
|------|---------|
| `src/shared/api/admin/audit.js` | `writeAuditLog()`, `listAuditLogs()` |
| `src/admin/hooks/useAuditLogFilters.js` | Pagination + filtering state |
| `src/admin/utils/auditUtils.js` | `ACTION_LABELS`, `formatActionLabel()`, `formatActionDetail()`, `getActorInfo()` |
| `src/admin/pages/AuditLogPage.jsx` | `CHIP_MAP`, UI rendering |

### RPC Functions

| Function | Logs |
|----------|------|
| `rpc_jury_finalize_submission` | `evaluation.complete` |
| `rpc_jury_verify_pin` | `juror.pin_locked` |
| `rpc_juror_reset_pin` | `pin.reset` |
| `rpc_juror_unlock_pin` | `juror.pin_unlocked` |
| `rpc_juror_toggle_edit_mode_v2` | `juror.edit_mode_enabled` |
| `rpc_admin_generate_entry_token` | `token.generate` |
| `rpc_period_freeze_snapshot` | `snapshot.freeze` |
| `rpc_admin_approve_application` | `application.approved` |
| `rpc_admin_reject_application` | `application.rejected` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-09 | Full rewrite: UI display reference (chip labels, action labels, detail line logic), QR naming, improved PIN labels |
| 2026-04-09 | Phase 3: `admin_invites`/`frameworks`/`profiles` triggers (015), notification audit (6 actions) |
| 2026-04-09 | Phase 2: removed 11 duplicates, `framework_outcomes`/`period_criteria`/`period_criterion_outcome_maps` triggers (014) |
| 2026-04-09 | Phase 1: application RPCs + `org_applications` trigger (013), cursor pagination, multi-column search |
| 2026-04-09 | Initial report |
