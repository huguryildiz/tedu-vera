# Audit Log Event Messages Reference

> _Last updated: 2026-04-30_

Source: [src/admin/utils/auditUtils.js](../../src/admin/utils/auditUtils.js)

Each audit log row renders as two lines:

1. **Sentence line** — `{ActorName} {verb} {resource}` format. `formatSentence()` calls `EVENT_META[action].narrative(log)` to get `{ verb, resource }`, then prepends the actor name.
2. **Meta line** — `{action code} · {extra context}` format, produced by `formatEventMeta()`.

---

## Rendering Pipeline

```
audit_logs row
  → getActorInfo(log)        → { type, name, role, initials }
  → formatSentence(log)      → { verb, resource }
  → formatEventMeta(log)     → monospace meta string
  → formatDiffChips(log)     → [ { key, from, to }, ... ]
  → detectAnomalies(logs)    → banner object | null
```

Rendered sentence: **`{actor.name} {verb} {resource}`**

Registered actor types: `admin`, `juror`, `system`, `anonymous`

---

## All Event Types and Messages

### Auth

| Action | Label | Sentence (verb · resource) |
|--------|-------|---------------------------|
| `admin.login` | Admin login | signed in *(via {method} if present)* |
| `auth.admin.login.success` | Admin signed in | signed in *(via {method} if present)* |
| `auth.admin.login.failure` | Failed sign-in attempt | failed sign-in attempt · *for {email}* |
| `admin.logout` | Admin signed out | signed out *(globally if present)* |
| `auth.admin.password.changed` | Admin changed password | changed their password |
| `auth.admin.password.reset.requested` | Password reset requested | requested password reset · *{email}* |
| `auth.admin.email_verified` | Admin email verified | verified email address · *{email}* |
| `auth.admin.email.changed` | Admin email address changed | changed email from *{old_email}* to *{new_email}* |

### Evaluation Flow (Juror-initiated)

| Action | Label | Sentence |
|--------|-------|---------|
| `data.juror.auth.created` | Juror authentication started | started evaluation authentication for *{affiliation}* |
| `evaluation.complete` | Evaluation completed | completed all evaluations *(for {periodName} if present)* |
| `data.score.submitted` | Score sheet submitted | submitted scores for *{project_title}* |
| `juror.pin_locked` | Juror locked (too many PIN attempts) | was locked out (failed PIN attempts) on *{periodName}* |
| `juror.edit_mode_closed_on_resubmit` | Edit mode closed (resubmit) | edit window closed on resubmit for *{periodName}* |

### Juror Admin Actions

| Action | Label | Sentence |
|--------|-------|---------|
| `pin.reset` | Juror PIN reset by admin | reset PIN for *{juror_name}* |
| `juror.pin_unlocked` | Juror unlocked by admin | unlocked *{juror_name}* |
| `juror.pin_unlocked_and_reset` | Juror unlocked and PIN reset by admin | unlocked and reset PIN for *{juror_name}* |
| `data.juror.pin.locked` *(legacy)* | Juror locked (too many PIN attempts) | was locked out (failed PIN attempts) on *{periodName}* |
| `data.juror.pin.unlocked` *(legacy)* | Juror unlocked by admin | unlocked *{juror_name}* |
| `data.juror.pin.reset` *(legacy)* | Juror PIN reset by admin | reset PIN for *{juror_name}* |
| `juror.edit_mode_enabled` | Edit mode granted | granted edit mode to *{juror_name}* |
| `juror.edit_mode_disabled` | Edit mode closed (admin) | closed edit mode for *{juror_name}* |
| `juror.edit_enabled` *(legacy)* | Edit mode granted | granted edit mode to *{juror_name}* |
| `juror.blocked` | Juror blocked | blocked juror *{juror_name}* |
| `juror.import` | Jurors imported | imported jurors *{count} jurors* |
| `juror.create` | Juror created | added juror *{juror_name}* |
| `data.juror.edit_mode.force_closed` | Juror edit mode force-closed | forced edit mode closure for *{juror_name}* |

### Tokens & Snapshots

| Action | Label | Sentence |
|--------|-------|---------|
| `token.generate` | QR access code generated | generated QR access code for *{periodName}* |
| `token.revoke` | QR access code revoked | revoked QR access code for *{periodName}* |
| `security.entry_token.revoked` | Entry token revoked | revoked entry token for period *{revoked_count} token(s)* |
| `snapshot.freeze` | Snapshot frozen | froze framework snapshot for *{periodName}* |

### Application Workflow

| Action | Label | Sentence |
|--------|-------|---------|
| `application.submitted` | Application submitted | submitted an application *{applicant_email}* |
| `application.approved` | Application approved | approved application from *{applicant_email}* |
| `application.rejected` | Application rejected | rejected application from *{applicant_email}* |

### Period Management

| Action | Label | Sentence |
|--------|-------|---------|
| `period.lock` | Evaluation locked | locked evaluation period *{periodName}* |
| `period.unlock` | Evaluation unlocked | unlocked evaluation period *{periodName}* |
| `period.set_current` | Active period changed | set active period to *{periodName}* |
| `periods.insert` | Period created | created period *{periodName}* |
| `periods.update` | Period updated | updated period *{periodName}* |
| `periods.delete` | Period deleted | deleted period *{periodName}* |
| `period.duplicated` | Period duplicated | duplicated period *from {source_name}* |

### Criteria, Outcomes & Framework

| Action | Label | Sentence |
|--------|-------|---------|
| `criteria.save` | Criteria & outcomes saved | saved criteria configuration for *{periodName}* |
| `criteria.update` | Criteria updated | updated criteria for *{periodName}* |
| `outcome.create` / `outcome.created` / `config.outcome.created` | Outcome created | created outcome *{outcomeCode}* |
| `outcome.update` / `outcome.updated` / `config.outcome.updated` | Outcome updated | updated outcome *{outcome_code}* |
| `outcome.delete` / `outcome.deleted` / `config.outcome.deleted` | Outcome deleted | deleted outcome *{outcome_code}* |
| `frameworks.insert` | Framework created | created accreditation framework *{name}* |
| `frameworks.update` | Framework updated | updated accreditation framework *{name}* |
| `frameworks.delete` | Framework deleted | deleted accreditation framework *{name}* |
| `config.framework.unassigned` | Framework unassigned from period | unassigned framework from *{periodName}* |

### Project Management

| Action | Label | Sentence |
|--------|-------|---------|
| `project.import` | Projects imported | imported projects *{count} projects* |
| `project.create` / `projects.insert` | Project created | created project *{title}* |
| `project.update` / `projects.update` | Project updated | updated project *{title}* |
| `project.delete` / `projects.delete` | Project deleted | deleted project *{title}* |

### Juror Management (Trigger-based)

| Action | Label | Sentence |
|--------|-------|---------|
| `jurors.insert` | Juror created | created juror *{juror_name}* |
| `jurors.update` | Juror updated | updated juror *{juror_name}* |
| `jurors.delete` | Juror deleted | deleted juror *{juror_name}* |

### Membership (Trigger-based)

| Action | Label | Sentence |
|--------|-------|---------|
| `memberships.insert` | Membership created | added member |
| `memberships.update` | Membership updated | updated membership |
| `memberships.delete` | Membership deleted | removed member |

### Organizations

| Action | Label | Sentence |
|--------|-------|---------|
| `organizations.insert` | Organization created | created organization *{name}* |
| `organizations.update` | Organization updated | updated organization *{name}* |
| `organization.status_changed` | Organization status changed | changed organization status · *{orgCode} · {prev} → {new}* |
| `org_applications.insert` | Application submitted | submitted application *{contact_email}* |
| `org_applications.update` | Application status changed | updated application status *{contact_email}* |
| `org_applications.delete` | Application deleted | deleted application |

### Admin Invites (Trigger-based)

| Action | Label | Sentence |
|--------|-------|---------|
| `admin_invites.insert` | Admin invite created | created admin invite *{email}* |
| `admin_invites.update` | Admin invite updated | updated admin invite *{email}* |
| `admin_invites.delete` | Admin invite deleted | deleted admin invite *{email}* |

### Admin Management

| Action | Label | Sentence |
|--------|-------|---------|
| `admin.create` | Admin created | created admin *{adminName \| adminEmail}* |
| `admin.updated` | Admin updated | updated admin *{adminName \| adminEmail}* |

### Entry Tokens (Trigger-based)

| Action | Label | Sentence |
|--------|-------|---------|
| `entry_tokens.insert` | QR access code created | created QR access code |
| `entry_tokens.update` | QR access code updated | updated QR access code |
| `entry_tokens.delete` | QR access code deleted | deleted QR access code |

### Profiles (Trigger-based)

| Action | Label | Sentence |
|--------|-------|---------|
| `profiles.insert` | Profile created | created profile *{display_name}* |
| `profiles.update` | Profile updated | updated profile *{display_name}* |

### Security Policy (Trigger-based)

| Action | Label | Sentence |
|--------|-------|---------|
| `security_policy.insert` | Security policy created | created security policy |
| `security_policy.update` | Security policy updated | updated security policy |
| `security_policy.delete` | Security policy deleted | deleted security policy |

### Platform Config

| Action | Label | Sentence |
|--------|-------|---------|
| `config.platform_settings.updated` | Platform settings updated | updated platform settings |
| `config.backup_schedule.updated` | Backup schedule updated | updated backup schedule *{cron_expr}* |
| `access.admin.session.revoked` | Admin session revoked | revoked admin session *{device_id \| browser}* |
| `maintenance.set` | Maintenance scheduled | set maintenance mode *{mode}* |
| `maintenance.cancelled` | Maintenance cancelled | cancelled maintenance mode |

### Score Management

| Action | Label | Sentence |
|--------|-------|---------|
| `score.update` | Score updated | updated scores for *{projectTitle}* |
| `score_sheets.insert` | Score sheet created | created score sheet for *project* |
| `score_sheets.update` | Score sheet updated | updated score sheet for |
| `score_sheets.delete` | Score sheet deleted | deleted score sheet |

### Backups

| Action | Label | Sentence |
|--------|-------|---------|
| `backup.created` | Backup created | created a backup *{fileName}* |
| `backup.deleted` | Backup deleted | deleted backup *{fileName}* |
| `backup.downloaded` | Backup downloaded | downloaded backup *{fileName}* |

### Exports (prefix-matched)

| Action | Label | Meta line format |
|--------|-------|-----------------|
| `export.scores` | Scores exported | `export.scores · {FORMAT} · {N} rows` |
| `export.rankings` | Rankings exported | same pattern |
| `export.heatmap` | Heatmap exported | same pattern |
| `export.analytics` | Analytics exported | same pattern |
| `export.audit` | Audit log exported | same pattern |
| `export.projects` | Projects exported | same pattern |
| `export.jurors` | Jurors exported | same pattern |
| `export.backup` | Backup exported | same pattern |

Sentence: `{actor} exported {type}` · *{period_name if present}*

### Notifications (prefix-matched)

| Action | Label | Sentence |
|--------|-------|---------|
| `notification.application` | Application notification sent | sent application to *{recipientEmail}* |
| `notification.admin_invite` | Admin invite email sent | sent admin invite to *{recipientEmail}* |
| `notification.entry_token` | QR access link emailed | sent entry token to *{recipientEmail}* |
| `notification.juror_pin` | Juror PIN emailed | sent juror pin to *{recipientEmail}* |
| `notification.export_report` | Report shared via email | sent export report to *{recipientEmail}* |
| `notification.password_reset` | Password reset email sent | sent password reset to *{recipientEmail}* |
| `notification.maintenance` | Maintenance notice sent | sent maintenance to *{recipientEmail}* |
| `notification.juror_reminder` | Juror reminder sent | sent juror reminder to *{recipientEmail}* |
| `notification.unlock_request` | Unlock request notification sent | sent unlock request to *{recipientEmail}* |
| `notification.email_verification` | Email verification link sent | sent email verification to *{recipient}* |

### Security / Anomaly Detection

| Action | Label | Sentence |
|--------|-------|---------|
| `security.pin_reset.requested` | PIN reset requested | requested PIN reset for juror *{jurorName}* |
| `data.score.edit_requested` | Score edit requested | requested score edit for juror *{jurorName}* |
| `security.anomaly.detected` | Anomaly Detected | flagged *{anomaly_type}* |
| `security.chain.broken` | Hash Chain Broken | detected tampering in *audit chain ({N} break(s))* |
| `security.chain.root.signed` | Audit chain root signed | signed audit chain root · *seq={chain_seq}* |

### Access (Admin Membership)

| Action | Label | Sentence |
|--------|-------|---------|
| `access.admin.invited` | Admin invited | invited admin · *{invitee_email}* |
| `access.admin.accepted` | Admin invitation accepted | accepted admin invitation · *{role}* |
| `access.admin.session.revoked` | Admin session revoked | revoked admin session *{device_id \| browser}* |

### System / Operations

| Action | Label | Sentence |
|--------|-------|---------|
| `system.migration_applied` | Database migration applied | applied database migration · *{label}* |

---

## Anomaly Banner Messages

`detectAnomalies(logs)` en yüksek öncelikli anomaliyi döner. Bannerda gösterilen başlık ve açıklama:

| Rule key | Trigger | Title | Description |
|----------|---------|-------|-------------|
| `auth.login_failure.burst` | ≥3 failed login in 24h | `Failed login attempts detected · {timeAgo}` | `{N} failed sign-ins in the last 24 hours. Source: {ip}.` |
| `org.status.suspended` | ≥1 org suspended in 24h | `Organization suspended · {timeAgo}` | `"{orgCode}" was suspended.` |
| `token.revoke.burst` | ≥2 token revocations in 1h | `Entry token revocations · {timeAgo}` | `{N} access tokens revoked in the last hour.` |
| `pin.reset.burst` | ≥3 PIN resets in 1h | `PIN resets detected · {timeAgo}` | `{N} juror PINs reset in the last hour.` |
| `export.burst` | ≥5 exports in 1h | `Unusual export activity · {timeAgo}` | `{N} export events in the last hour.` |
| `juror.pin_locked` | ≥1 PIN lockout in 24h | `Unusual activity detected · {timeAgo}` | `{name} triggered too many failed PIN attempts and was locked.` |

---

## Meta Satırı Formatı (`formatEventMeta`)

Tablodaki ikinci satır, her zaman raw action code ile başlar ve şu kurallara göre ek bağlam ekler:

- **Bulk grubu**: `{action} × {N} · within {M} min`
- **Auth failure with count**: `{action} × {N} · {ip}`
- **Export events**: `{action} · {FORMAT} · {N} rows`
- **Config changes (array)**: `{action} · {key} {from}→{to}`
- **Diff events**: `{action} · {key} {from}→{to}`
- **Generic with IP**: `{action} · {ip}`
- **Default**: `{action}`

---

## Bulk Event Grouping

Aynı aktörün aynı `resource_type` üzerinde 5 dakika içinde ≥3 event'i if present, bunlar tek bir bulk item olarak gösterilir:

> `{Actor} performed {N} {resource_type} operations within {M} min`

---

## Diff Chips

`update` event'lerinde değişen alanlar chip olarak gösterilir (`{from} → {to}`):

- `criteria.save`: `details.changes` objesinden (max 4 chip)
- `period.update` / `periods.update`: `details.changedFields` arrayından (max 3 chip)
- Trigger-based: `log.diff.before` vs `log.diff.after` karşılaştırması (max 4 chip, `id`/`created_at`/`updated_at` atlanır)

---

## Fallback Behavior

`EVENT_META`'da tanımlı olmayan action'lar için:

- **Label**: `{Table} {created|updated|deleted}` (e.g. `some_table.insert` → `Some table created`)
- **Sentence**: `{op} a {table}` (e.g. `created a some table`)
- Prefix matchers (`export.*`, `notification.*`) önce kontrol edilir
