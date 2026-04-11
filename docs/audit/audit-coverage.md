# VERA Audit Log — Coverage Analysis

**Version:** Post-migration 043–047 (April 2026)
**Scope:** All audit write paths — DB triggers, RPCs, Edge Functions, frontend calls

---

## Executive Summary

Overall maturity: **GOOD — approximately 85% of meaningful business events are captured.**

### Strengths

- **Trigger coverage is comprehensive.** 14 core tables emit automatic CRUD events; anything inserted, updated, or deleted is logged without any developer effort at the call-site.
- **Critical juror lifecycle events are server-side guaranteed.** PIN lock/unlock, edit-mode grant/close, evaluation completion, and entry-token generation all log inside SECURITY DEFINER RPCs — no client crash can suppress them.
- **Migration 046 hardened the RPC write path.** `rpc_admin_write_audit_event` now enforces category/severity/actor classification server-side; clients cannot inject arbitrary action strings.
- **Migration 047 added anon-callable failed login audit.** `rpc_write_auth_failure_event` is callable without a session (`anon` role), captures `auth.admin.login.failure` with automatic severity escalation (low → medium → high as attempts accumulate) and rate-limiting (20/email/5min).
- **Period lock/unlock now emits a dedicated semantic event.** `setEvalLock()` calls `rpc_admin_log_period_lock` fire-and-forget alongside the existing `periods.update` trigger; the RPC resolves period name and actor name server-side and hardcodes `severity='high'`.
- **Criteria save now carries a diff.** `savePeriodCriteria()` emits `criteria.save` with `diff: {before: {key_max_score}, after: {key_max_score}}` fire-and-forget; the Changes tab in the drawer now renders before/after weight comparison.
- **Admin logout is now audited.** `signOut()` and `signOutAll()` in `AuthProvider` emit `admin.logout` fire-and-forget before the Supabase session is cleared.
- **Schema is forensics-ready.** Migrations 043–046 added `category`, `severity`, `actor_type`, `actor_name`, `ip_address`, `user_agent`, `session_id`, `diff`, and `correlation_id`. The columns exist; population varies by event source.
- **Pagination and search are production-grade.** Cursor-based keyset on `(created_at, id)`, multi-column ILIKE search, and saved views cover typical compliance workflows without full-table scans.

### Remaining Gaps

| # | Gap | Compliance Impact |
|---|-----|------------------|
| 1 | **Fire-and-forget frontend writes** — all exports (6), all notifications (6), `admin.login`, `admin.logout`, `period.lock/unlock`, `criteria.save` | Can silently disappear if client throws before the HTTP request leaves the browser |
| 2 | **`groupBulkEvents` is orphaned** | Bulk score submits flood the feed as individual rows; no collapse |
| 3 | **`ip_address` / `user_agent` empty on most events** | Context tab in the drawer always shows "no session data" for pre-2026 events |

### Resolved Gaps (this session)

| # | Gap | Resolution |
|---|-----|------------|
| ~~2~~ | ~~No failed login event~~ | `rpc_write_auth_failure_event` (migration 047) + `writeAuthFailureEvent` called from `AuthProvider.signIn()` |
| ~~3~~ | ~~Period lock/unlock is generic `periods.update`~~ | `setEvalLock()` now calls `rpc_admin_log_period_lock` fire-and-forget; semantic event with actor name, period name, `severity='high'` |
| ~~4~~ | ~~Criteria save has no semantic event or diff~~ | `savePeriodCriteria()` now emits `criteria.save` with `diff` object; Changes tab renders automatically |
| ~~5~~ | ~~Admin logout is unlogged~~ | `AuthProvider.signOut()` + `signOutAll()` emit `admin.logout` fire-and-forget before session clear |

### Verdict

> Sufficient for **operational monitoring and basic audit trails.** Failed login events are now captured with severity escalation. Period lock/unlock, criteria changes, and logout are audited. Insufficient for **forensic investigation or compliance certification** until the remaining fire-and-forget exports and notifications are moved to server-side write paths.

---

## Coverage Overview

Quick-reference table: feature or flow, expected event, implementation status, and priority.

| Feature / Flow | Expected Event | Status | Mechanism | Priority |
|---|---|---|---|---|
| Admin signs in (success) | `auth.admin.login.success` | Partial — old string `admin.login`, no IP | Frontend fire-and-forget | High |
| Admin signs in (failure) | `auth.admin.login.failure` | Partial — fire-and-forget; severity escalates with attempt count (migration 047) | `rpc_write_auth_failure_event` (anon-callable) | — |
| Admin signs out | `auth.admin.logout` | Partial — fire-and-forget, emitted before session clear | Frontend fire-and-forget | — |
| Password reset completed | `auth.admin.password.reset.completed` | **Missing** | — | Low |
| Period created | `data.period.created` → trigger: `periods.insert` | Covered | DB trigger | — |
| Period locked | `data.period.locked` | Partial — `rpc_admin_log_period_lock` (fire-and-forget, actor/period resolved server-side) + `periods.update` trigger | RPC fire-and-forget + DB trigger | — |
| Period unlocked | `data.period.unlocked` | Partial — same as above | RPC fire-and-forget + DB trigger | — |
| Period current set | `period.set_current` | Partial — fire-and-forget | Frontend | High |
| Snapshot frozen | `snapshot.freeze` | Covered | RPC | — |
| Project created/updated/deleted | `projects.{insert\|update\|delete}` | Covered | DB trigger | — |
| Project updated — field-level diff | diff JSONB before/after | Partial — column exists, not populated | DB trigger | Medium |
| Juror created/updated/deleted | `jurors.{insert\|update\|delete}` | Covered | DB trigger | — |
| Juror PIN locked | `juror.pin_locked` | Covered | RPC | — |
| Juror PIN unlocked | `juror.pin_unlocked` | Covered | RPC | — |
| Juror PIN reset | `pin.reset` | Covered | RPC | — |
| Edit mode granted | `juror.edit_mode_enabled` | Covered | RPC | — |
| Edit mode closed (resubmit) | `juror.edit_mode_closed_on_resubmit` | Covered | RPC | — |
| Evaluation completed | `evaluation.complete` | Covered | RPC | — |
| Score sheet updated | `score_sheets.update` | Covered | DB trigger | — |
| Score sheet updated — field diff | diff JSONB per criterion | Partial — no diff | DB trigger | Low |
| Criteria weights saved | `criteria.save` | Partial — semantic event with before/after diff, fire-and-forget | Frontend fire-and-forget | — |
| Outcome CRUD | `framework_outcomes.{insert\|update\|delete}` | Covered | DB trigger | — |
| Criterion-outcome mapping updated | `period_criterion_outcome_maps.{delete\|insert}` | Covered | DB trigger | — |
| Framework CRUD | `frameworks.{insert\|update\|delete}` | Covered | DB trigger | — |
| Entry token generated | `token.generate` | Covered | RPC | — |
| Entry token revoked | `entry_tokens.update` (semantic revoke missing) | Partial | DB trigger | Low |
| Admin invited | `admin_invites.insert` | Covered | DB trigger | — |
| Application submitted | `org_applications.insert` | Covered | DB trigger | — |
| Application approved | `application.approved` | Covered (dual: RPC + trigger) | RPC + trigger | — |
| Application rejected | `application.rejected` | Covered (dual: RPC + trigger) | RPC + trigger | — |
| Organization status changed | `organization.status_changed` | Partial — fire-and-forget | Frontend | High |
| Scores exported | `export.scores` | Partial — fire-and-forget | Frontend | High |
| Rankings exported | `export.rankings` | Partial — fire-and-forget | Frontend | Medium |
| Heatmap exported | `export.heatmap` | Partial — fire-and-forget | Frontend | Medium |
| Analytics exported | `export.analytics` | Partial — fire-and-forget | Frontend | Low |
| Audit log exported | `export.audit` | Partial — fire-and-forget | Frontend | Medium |
| Notification sent (any type) | `notification.*` (6 variants) | Partial — fire-and-forget | Frontend | Medium |
| Backup created | `backup.created` | Covered | RPC | — |
| Backup deleted | `backup.deleted` | Covered | RPC | — |
| Backup downloaded | `backup.downloaded` | Covered | RPC | — |
| Super-admin impersonation | `access.admin.impersonate.*` | **Missing** | — | High |
| Admin role granted/revoked | `access.admin.role.*` | Partial — only `memberships.update` trigger | DB trigger | Medium |
| Profile display name changed | `profiles.update` | Covered | DB trigger | — |
| RLS policy change | — | **Missing** (out of scope for app layer) | — | N/A |

---

## Currently Audited Events

### Auth & Access

| Action | Guaranteed? | Details Available | New Taxonomy |
|--------|-------------|-------------------|-------------|
| `admin.login` | No (fire-and-forget) | `method` (password/google) | `auth.admin.login.success` |
| `auth.admin.login.failure` | No (fire-and-forget, but RPC is anon-callable) | `email`, `method`, `attempt` count | — (new in migration 047) |
| `admin.logout` | No (fire-and-forget) | `scope` (local/global) | — (new) |
| `memberships.insert` | Yes (trigger) | — | maps to `access.membership.created` |
| `memberships.update` | Yes (trigger) | — | maps to `access.membership.updated` |
| `memberships.delete` | Yes (trigger) | — | maps to `access.membership.deleted` |
| `admin_invites.insert` | Yes (trigger) | — | — |
| `profiles.update` | Yes (trigger) | — | — |

### Juror Lifecycle

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `juror.pin_locked` | Yes (RPC) | `actor_name`, `failed_attempts`, `locked_until` |
| `juror.pin_unlocked` | Yes (RPC) | `juror_name` |
| `pin.reset` | Yes (RPC) | `juror_name` |
| `juror.edit_mode_enabled` | Yes (RPC) | `juror_name`, `reason`, `duration_minutes`, `expires_at` |
| `juror.edit_mode_closed_on_resubmit` | Yes (RPC) | `actor_name`, `closed_at`, `close_source` |
| `evaluation.complete` | Yes (RPC) | `actor_name`, `period_id`, `juror_id` |
| `jurors.insert` | Yes (trigger) | — |
| `jurors.update` | Yes (trigger) | — |
| `jurors.delete` | Yes (trigger) | — |

### Period & Framework Config

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `periods.insert` | Yes (trigger) | — |
| `periods.update` | Yes (trigger) | — (includes routine edits; semantic lock/unlock now also fire-and-forget RPC) |
| `period.lock` / `period.unlock` (via `rpc_admin_log_period_lock`) | No (fire-and-forget) | `periodName`, `actor_name` resolved server-side, `severity='high'` |
| `periods.delete` | Yes (trigger) | — |
| `snapshot.freeze` | Yes (RPC) | `criteriaCount`, etc. |
| `period_criteria.insert/delete` | Yes (trigger) | — (no before/after diff) |
| `period_criterion_outcome_maps.insert/delete` | Yes (trigger) | — |
| `framework_outcomes.insert/update/delete` | Yes (trigger) | — |
| `frameworks.insert/update/delete` | Yes (trigger) | — |

### Projects & Scoring

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `projects.insert` | Yes (trigger) | — |
| `projects.update` | Yes (trigger) | — (no field-level diff) |
| `projects.delete` | Yes (trigger) | — |
| `score_sheets.insert` | Yes (trigger) | — |
| `score_sheets.update` | Yes (trigger) | — (no per-criterion diff) |
| `score_sheets.delete` | Yes (trigger) | — |

### Applications & Org Admin

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `application.approved` | Yes (RPC) | `applicant_email`, `applicant_name` |
| `application.rejected` | Yes (RPC) | `applicant_email`, `applicant_name` |
| `org_applications.insert/update` | Yes (trigger) | — |
| `organizations.insert/update` | Yes (trigger) | — |

### Entry Tokens

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `token.generate` | Yes (RPC) | token metadata |
| `entry_tokens.insert/update/delete` | Yes (trigger) | — |

### Exports (fire-and-forget)

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `export.scores` | **No** | `format`, `rowCount` |
| `export.rankings` | **No** | `format`, `rowCount` |
| `export.heatmap` | **No** | `format`, `jurorCount`, `projectCount` |
| `export.analytics` | **No** | `format` |
| `export.audit` | **No** | `format`, `rowCount` |
| `export.backup` | **No** | `format` |

### Backups

| Action | Guaranteed? | Details Available |
|--------|-------------|-------------------|
| `backup.created` | Yes (RPC) | `origin`, `format`, `size_bytes`, `row_counts` |
| `backup.deleted` | Yes (RPC) | `storage_path`, `origin` |
| `backup.downloaded` | Yes (RPC) | — |

### Notifications (fire-and-forget)

| Action | Guaranteed? |
|--------|-------------|
| `notification.application` | **No** |
| `notification.admin_invite` | **No** |
| `notification.entry_token` | **No** |
| `notification.juror_pin` | **No** |
| `notification.export_report` | **No** |
| `notification.password_reset` | **No** |

---

## Missing Important Audit Events

Events that **should** be audited but produce no record today.

| Missing Event | Why It Matters | Compliance Impact | Priority | Suggested Payload |
|---|---|---|---|---|
| ~~`auth.admin.login.failure`~~ | ~~Failed logins are the primary signal for brute-force~~ | **Resolved in migration 047** — fire-and-forget via `rpc_write_auth_failure_event` | — | — |
| ~~`auth.admin.logout`~~ | ~~Session boundaries for compliance reports~~ | **Resolved** — `AuthProvider.signOut()` emits fire-and-forget | — | — |
| ~~`data.period.locked/unlocked` (semantic)~~ | ~~Generic `periods.update` hides lock actions~~ | **Resolved** — `setEvalLock()` calls `rpc_admin_log_period_lock` fire-and-forget | — | — |
| ~~`config.criteria.updated` (semantic w/ diff)~~ | ~~"What were the old weights?" unanswerable~~ | **Resolved** — `savePeriodCriteria()` emits `criteria.save` with `diff` fire-and-forget | — | — |
| `auth.admin.session.expired` | Distinguishes intentional logout from abandoned sessions | Low — but useful for anomaly detection | Medium | `{session_age_seconds}` |
| `access.admin.impersonate.start` | If super-admin can assume tenant-admin context, this must be logged | Impersonation without audit trail is a SOC 2 finding | High | `{target_user_id, target_org_id}` |
| `access.admin.impersonate.end` | Completes the impersonation session record | | High | `{session_duration_seconds}` |
| `auth.admin.password.reset.completed` | Password changes are security events | | Medium | `{method}` |
| `data.score.submitted` (semantic) | Score sheet trigger fires but carries no juror/project context in action label | Compliance query "when did juror X submit for project Y?" requires joining 3 tables | Medium | `{juror_name, project_title, period_name}` |
| `security.anomaly.detected` | Automated anomaly detection has no output channel | Security alerts are invisible to admins | Medium | `{anomaly_type, detail}` |
| `data.juror.edit_mode.force_closed` | `forceCloseJurorEditMode` flow has no audit | Unlogged admin action on locked evaluation state | Low | `{juror_name, reason}` |

---

## Partially Audited / Low-Quality Events

These events are logged, but the logged data is insufficiently structured for forensic use.

### Period Lock / Unlock

**Logged as:** `periods.update` (trigger) + `period.lock` / `period.unlock` (RPC fire-and-forget) ✓ **Improved**
**Status:** `setEvalLock()` in `src/shared/api/admin/periods.js` now calls `rpc_admin_log_period_lock` fire-and-forget after every lock/unlock. The RPC resolves `period_name` and `actor_name` from the DB server-side; category and severity are hardcoded to `data` / `high`. The trigger-based `periods.update` row remains as a safety net.
**Remaining gap:** Still fire-and-forget — a client crash before the RPC call resolves means no semantic log row (though the trigger-based `periods.update` always fires).
**Query impact:** The semantic event now exists; filtering `action = 'period.lock'` in the audit log returns the exact lock events.

### Criteria Save

**Logged as:** `period_criteria.delete` + `period_criteria.insert` (trigger) + `criteria.save` with diff (frontend fire-and-forget) ✓ **Improved**
**Status:** `savePeriodCriteria()` in `src/shared/api/admin/periods.js` now captures the before-state of all `(key, max_score)` pairs before the delete/insert cycle, then emits `criteria.save` with `diff: {before: {design_max_score: 30, …}, after: {design_max_score: 35, …}}` via `writeAuditLog`. The drawer's Changes tab (`formatDiffChips`) renders this diff automatically.
**Remaining gap:** Still fire-and-forget — the dynamic import is not awaited. If the JS engine crashes between the save and the audit write, the diff is lost (though the trigger rows for the individual deletes/inserts still fire).
**Query impact:** Filtering `action = 'criteria.save'` with drawer → Changes tab now answers "what did the weights look like before?".

### Score Updates

**Logged as:** `score_sheets.update` (trigger)
**Problem:** No criterion-level diff — only that the sheet was touched. No `juror_name` or `project_title` in `details`.
**Impact:** Medium — the trigger does capture the event; it's just not queryable by juror name or project without a join.
**Fix:** Enrich trigger with `actor_name` and `project_title` from joined tables, or emit a semantic `data.score.updated` RPC event.

### Admin Login

**Logged as:** `admin.login` (fire-and-forget, old taxonomy)
**Problem:** Fire-and-forget — if the component unmounts before the RPC resolves, the log row may not be written. No `ip_address` or `user_agent` captured. No failure variant.
**Fix:** Move auth logging into the Supabase Auth hook or Edge Function that handles login, where IP/UA is available. Add `auth.admin.login.failure` alongside success.

### Entry Token Revoke

**Logged as:** `entry_tokens.update` (trigger)
**Problem:** Token revocation and token expiry are both logged as generic updates. No semantic `token.revoke` action. The `token.generate` action is covered by RPC but revoke is not.
**Fix:** Emit `security.entry_token.revoked` inside the revoke RPC.

### Notification Events

**Logged as:** `notification.*` — 6 variants, all fire-and-forget
**Problem:** All 6 notification types are logged client-side after the Edge Function call returns. If the Edge Function fails, the log may still be written; if the client crashes, it is not. The inverse (Edge Function succeeds but client logs failure) would be more dangerous.
**Fix:** Move notification audit writes into the respective Edge Functions (`notify-application`, `admin-invite`, etc.) where execution is guaranteed.

### `groupBulkEvents` Not Wired

**Status:** Function is defined and correct in `auditUtils.js:562–599`. It is never called in the rendering path.
**Impact:** A juror submitting 12 projects in one session generates 12 individual `score_sheets.update` rows in the feed. Bulk import generates N `projects.insert` rows.
**Fix:** Call `groupBulkEvents(flatRows)` before passing the event list to the day-bucketed renderer in `AuditLogPage.jsx`.

---

## Audit Taxonomy Assessment

### Current State

The codebase contains two coexisting action string conventions:

| Convention | Examples | Source |
|---|---|---|
| **Legacy dot-notation** (pre-plan) | `admin.login`, `period.set_current`, `export.scores`, `juror.pin_locked` | Frontend + old RPCs |
| **New taxonomy** (`category.resource.action`) | `data.period.locked`, `auth.admin.login.success`, `config.criteria.updated` | Migration 046, new seed events, EVENT_META |

Both coexist in the live DB. Backfill migrations 044 and 045 map legacy strings to new category/severity/actor_type columns, so the UI renders both correctly. However, `formatSentence()` in `auditUtils.js` handles ~22 actions explicitly and falls back to a generic CRUD template for the rest.

### Issues

| Issue | Location | Impact |
|---|---|---|
| Duplicate keys in `ACTION_LABELS` | `auditUtils.js:251–308` | JS silently uses last definition; bakım tuzağı |
| `JUROR_ACTIONS` set has only 3 entries | `auditUtils.js:203–235` | Newer juror-context events render as "Admin" actor |
| `formatSentence()` coverage ~40% | `auditUtils.js:483–528` | Most events show generic "score sheets updated" style narrative |
| `EVENT_META` partially defined | `auditUtils.js` | Designed as single source of truth; not all events have entries yet |
| No `critical` severity events in use | Drawer, KPI strip | `security.anomaly.detected` should be `critical` but the field is empty for all current DB rows |

### Recommended Single Source

All of `ACTION_LABELS`, `formatSentence`, `JUROR_ACTIONS`, and `buildDetailRows` should converge into a single `EVENT_META` map:

```js
export const EVENT_META = {
  "data.period.locked": {
    label: "Period locked",
    category: "data",
    defaultSeverity: "high",
    actorType: "admin",
    narrative: (log) => `${getActorInfo(log).name} locked period "${log.details?.periodName ?? '—'}"`,
  },
  // ... one entry per canonical event
};
```

This eliminates the 5 separate places where action metadata currently lives and removes the duplicate-key risk.

---

## Recommendations

### Must-Close (security and compliance blockers)

1. **Add `auth.admin.login.failure`** — Move login audit into the Edge Function or Supabase Auth hook so IP/UA are available and failure events are guaranteed. This is the single highest-value missing event.

2. **Move all fire-and-forget exports to server-side** — The 6 export actions (`export.scores`, `export.rankings`, `export.heatmap`, `export.analytics`, `export.audit`, `export.backup`) should be logged inside the export-generating RPC or Edge Function, not client-side. A crashed export tab must still leave a record.

3. **Move notification audits into Edge Functions** — `notify-application`, `admin-invite`, `notify-juror-pin`, and `notify-maintenance` already run server-side; move the audit `INSERT` into those functions.

4. **Emit semantic period lock/unlock events** — Add `rpc_period_lock` and `rpc_period_unlock` that (a) do the update and (b) emit `data.period.locked`/`data.period.unlocked` with `{periodName, reason, actor_name, ip_address}` inside the same transaction. The `periods.update` trigger remains as a safety net.

### Should-Close (audit quality improvements)

1. **Wire `groupBulkEvents` into `AuditLogPage`** — One-line change: call `groupBulkEvents(events)` before the `groupByDay` pass. Reduces feed noise dramatically on evaluation day.

2. **Enrich trigger events with `actor_name`** — Most trigger-based rows have `user_id` but no `actor_name`. A trigger-level `SELECT display_name FROM profiles WHERE id = auth.uid()` would populate the column and make the drawer actor block meaningful for 60% of events.

3. **Add criteria-save semantic event** — Emit `config.criteria.updated` with `diff: {before, after}` from the RPC that saves criteria. This enables the single most-asked compliance question about config: "what were the old weights?"

4. **Emit `data.score.submitted` alongside trigger** — From `rpc_jury_finalize_submission` or `rpc_jury_save_scores`, emit a semantic event with `juror_name`, `project_title`, and `period_name` in `details`. The trigger safety net remains.

### Nice-to-Have (forensics & UX)

1. **Impersonation logging** — If super-admin impersonation is ever implemented, log `access.admin.impersonate.start/end` with `correlation_id` so all actions taken during the session are linkable.

2. **Deduplicate `ACTION_LABELS`** — Remove the 6 known duplicate keys. Migrate everything to `EVENT_META` as the single source of truth. Estimated effort: 2–3 hours.

3. **Populate `critical` severity** — `security.anomaly.detected` events should use `severity = 'critical'`. Currently the severity column exists (migration 043) but all rows have the default `info`. The anomaly detection scaffold (`detectAnomalies` in `auditUtils.js:610`) needs to emit events, not just return UI annotations.

4. **`correlation_id` for bulk operations** — Assign a shared UUID for all audit rows produced by a single user action (e.g., a criteria save that fires N trigger rows). Enables the drawer's "Related" tab to show the full causal chain.

---

## Architecture Reference

### Three Write Mechanisms

| Mechanism | Guaranteed | Who controls | When to use |
|-----------|-----------|-------------|-------------|
| **DB Trigger** | Yes — fires in-transaction | DB layer, automatic | CRUD on any instrumented table |
| **RPC-Emitted** | Yes — fires in same transaction | RPC function | Semantic business events (lock, evaluation complete, token gen) |
| **Frontend fire-and-forget** | **No** | `writeAuditLog()` in client | Should be avoided; currently used for exports, notifications, login |

### Schema (post-migration 043–047)

```sql
CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id),
  user_id          UUID REFERENCES profiles(id),
  action           TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      UUID,
  details          JSONB,
  -- Added in migrations 043–046:
  category         audit_category,       -- auth | access | data | config | security
  severity         audit_severity,       -- info | low | medium | high | critical
  actor_type       audit_actor_type,     -- admin | juror | system | anonymous
  actor_name       TEXT,
  ip_address       INET,
  user_agent       TEXT,
  session_id       UUID,
  correlation_id   UUID,
  diff             JSONB,                -- {before: {...}, after: {...}}
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### Key Indexes

```sql
-- Primary query path: org + time
idx_audit_logs_organization_created  ON (organization_id, created_at DESC)
-- Category filtering
idx_audit_logs_category_created      ON (organization_id, category, created_at DESC)
-- Severity alerting (partial — only ≥medium)
idx_audit_logs_severity              ON (organization_id, severity, created_at DESC)
  WHERE severity IN ('medium', 'high', 'critical')
-- Actor type
idx_audit_logs_actor_type            ON (organization_id, actor_type, created_at DESC)
```

### Frontend Layer

| File | Purpose |
|------|---------|
| `src/shared/api/admin/audit.js` | `writeAuditLog()`, `listAuditLogs()` |
| `src/admin/hooks/useAuditLogFilters.js` | Pagination + filtering state |
| `src/admin/utils/auditUtils.js` | `EVENT_META`, `ACTION_LABELS`, `CATEGORY_META`, `SEVERITY_META`, `formatNarrative`, `formatSentence`, `getActorInfo`, `groupBulkEvents`, `detectAnomalies` |
| `src/admin/pages/AuditLogPage.jsx` | `CHIP_MAP`, UI render, saved views, KPI strip |
| `src/admin/components/AuditEventDrawer.jsx` | Tabbed drawer (Overview / Context / Changes / Raw) |
| `src/admin/components/SecuritySignalPill.jsx` | Severity badge |

### Migration Chain

| Migration | Purpose |
|-----------|---------|
| `002_tables.sql` | `audit_logs` table + initial index |
| `003_helpers_and_triggers.sql` | `trigger_audit_log()` + initial 7 triggers |
| `008_audit_logs.sql` | 6 RPC-emitted actions (juror lifecycle) |
| `009_audit_actor_enrichment.sql` | Actor name enrichment in juror RPCs |
| `010_audit_write_rpc.sql` | `rpc_admin_write_audit_log` (frontend endpoint) |
| `013_audit_completeness.sql` | Application RPCs + `org_applications` trigger |
| `014_audit_trigger_expansion.sql` | `framework_outcomes`, `period_criteria`, maps triggers |
| `015_audit_trigger_phase3.sql` | `admin_invites`, `frameworks`, `profiles` triggers |
| `036_platform_backups_rpcs.sql` | Backup RPCs |
| `041_audit_eval_period_name.sql` | `periodName` enrichment |
| `043_audit_taxonomy.sql` | New columns: category, severity, actor_type, actor_name, ip, ua, session, diff, correlation_id |
| `044_audit_backfill_taxonomy.sql` | Backfill existing rows with category/severity/actor_type from action string |
| `045_audit_trigger_diff.sql` | Trigger-level before/after diff in `diff` column |
| `046_audit_rpc_hardening.sql` | Hardened `rpc_admin_write_audit_event`; server-side category/severity enforcement |
| `047_audit_anon_auth_failure.sql` | Anon-callable `rpc_write_auth_failure_event`; severity escalation (low→medium→high) by attempt count; rate-limit 20/email/5min; GRANT to `anon` + `authenticated` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Gap closures: migration 047 (`rpc_write_auth_failure_event`); `setEvalLock` wired to `rpc_admin_log_period_lock`; `savePeriodCriteria` emits `criteria.save` with diff; `AuthProvider.signOut` emits `admin.logout`; document updated to post-043–047 |
| 2026-04-12 | Full rewrite — post-migration 043–046 state, coverage table, gap analysis, taxonomy assessment, recommendations |
| 2026-04-11 | Backups (3 RPC-emitted actions) via migration 036 |
| 2026-04-09 | Phase 3: triggers for `admin_invites`, `frameworks`, `profiles`; notification audit |
| 2026-04-09 | Phase 2: deduplicated, added `framework_outcomes`/`period_criteria` triggers |
| 2026-04-09 | Phase 1: application RPCs + `org_applications` trigger, cursor pagination, multi-column search |
| 2026-04-09 | Initial report |
