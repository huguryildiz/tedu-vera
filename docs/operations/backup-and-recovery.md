# Backup and Recovery

How VERA backs up tenant data, what gets backed up, where the backups
live, and how to recover from common loss scenarios. Read this before
the incident, not during.

---

## What VERA backs up

VERA runs three backup tiers, each with different scope and trigger:

| Tier | Trigger | Scope | Format | Storage |
| --- | --- | --- | --- | --- |
| **Application backup** | `auto-backup` Edge Function via pg_cron, daily at 02:00 (UTC) | Per-tenant evaluation data (periods, projects, jurors, scores, audit logs) | JSON | Supabase Storage bucket `backups` |
| **Manual snapshot** | Super-admin click on Backups page | Same scope as auto-backup | JSON or xlsx | Supabase Storage bucket `backups` |
| **Supabase Postgres backup** | Supabase platform, daily | Full database (all tables, all schemas) | Postgres dump | Supabase-managed; tier-dependent retention |

Application backups are tenant-aware (one file per organization). The
underlying Supabase backup is database-wide and only Supabase staff +
super-admins can initiate a restore from it.

---

## Daily auto-backup

### Schedule

- **Cron expression:** `0 2 * * *` (default; configurable per tenant via
  `platform_settings.backup_cron_expr`).
- **Mechanism:** `pg_cron` extension fires `net.http_post` to the
  `auto-backup` Edge Function with the service-role key.
- **Trigger source:** `sql/migrations/008_platform.sql` — search for
  `cron.schedule` to find the active schedule.

### What gets exported per tenant

For each active organization, the function writes one JSON file
containing:

- All `periods` rows (configuration + state).
- All `projects` rows (titles, students, advisors).
- All `jurors` rows (no PIN, but with metadata).
- All `score_sheets` + `score_sheet_items`.
- All `audit_logs` rows (full chain including `row_hash` and
  `correlation_id`).

The function does **not** include:

- `auth.users` rows (Supabase Auth-managed; backed up by Supabase tier).
- `memberships` (Supabase Auth-adjacent; included in Supabase backup).
- Cross-tenant tables (frameworks, criteria templates).

### Retention

- **In Supabase Storage:** files in the `backups` bucket retain by
  default 30 days. The lifecycle rule lives in the bucket settings; not
  enforced in code.
- **In `platform_backups` table:** the metadata row retains indefinitely
  (storage_path, size, row_counts, created_at). A backup whose file is
  no longer in storage shows as a "ghost" entry.

### Audit trail

Each successful backup writes a row to `audit_logs` with
`action = backup.created` and `details = { storage_path, format, row_counts }`.
Failures are written to Edge Function logs but not to `audit_logs` —
fixing this is on the audit roadmap.

---

## Manual snapshot

When to take one:

- Before a high-risk migration or schema change.
- Before bulk-deleting / archiving a period.
- Before a tenant offboarding (regulatory hold).
- For ad-hoc data analysis outside the live system.

How:

1. Super-admin opens **Settings → Backups** (admin shell).
2. Click "Create backup". Choose JSON (full restoreable) or xlsx
   (human-readable analysis copy).
3. The Edge Function runs synchronously; expect 5-30 seconds depending
   on tenant size.
4. The file appears in the Backups list with download link.

Audit event: `backup.created` with `origin = 'manual'`.

---

## Recovery scenarios

### Scenario 1 — A tenant accidentally deleted a period

**Symptom.** Tenant-admin reports "I deleted the wrong period and now
the scores are gone."

**Recovery path:**

1. Identify the deletion in `audit_logs` — the `periods.delete` event
   with the affected `period_id`.
2. Find the most recent application backup that pre-dates the deletion
   (Backups page → filter by date).
3. Download the JSON; locate the relevant period block.
4. **Do not bulk-import** — the import RPC is not built. Instead, hand
   the JSON to the developer; restore via:
   - For periods + projects + jurors: `INSERT` from JSON via SQL editor.
   - For scores: `INSERT INTO score_sheets / score_sheet_items` from
     JSON, preserving the original `submitted_at` so the audit trail
     remains coherent.
5. Re-add a `period.unlock` audit row (manual) noting the recovery, the
   admin who authorized it, and the source backup file.

### Scenario 2 — Schema regression broke score reads for one tenant

**Symptom.** Rankings page renders zero rows for one tenant after a
migration. Other tenants are fine.

**Recovery path:**

1. Confirm the issue is data-shaped, not RLS-shaped: query
   `score_sheets` directly via service role and check row count.
2. If rows missing: the migration affected this tenant's data. Roll
   back the migration (per [deployment/migrations.md](../deployment/migrations.md)).
3. If rows present but unreadable: it's an RLS/RPC regression, not a
   data loss. See
   [runbooks/auth-outage.md](runbooks/auth-outage.md).

### Scenario 3 — Full database lost / corrupted

**Symptom.** Supabase project unreachable; Postgres returns errors;
`get_logs` shows hardware-level failures.

**Recovery path:**

1. **Stop trying to recover from inside the app.** This is a Supabase
   platform incident.
2. Open a Supabase support ticket; reference the project ref and
   describe the incident.
3. Supabase will offer the most recent platform backup. The RPO is
   tier-dependent; on Pro tier, < 24 hours.
4. Once Supabase restores, run the snapshot migration suite
   (`000 → 009`) to verify schema integrity.
5. Cross-check application backups (`backups` bucket) against the
   restored Postgres state. If application backups are newer than the
   restored DB, replay them per Scenario 1.

### Scenario 4 — A juror's session was lost mid-evaluation

This is **not** a backup-and-recovery scenario. See
[runbooks/jury-day-incident.md](runbooks/jury-day-incident.md) §3c.

### Scenario 5 — Demo environment broken

This is **not** a backup-and-recovery scenario for production data. See
[runbooks/demo-seed-broken.md](runbooks/demo-seed-broken.md).

---

## Recovery objectives (current state)

| Metric | Target | Actual |
| --- | --- | --- |
| RPO (Recovery Point Objective) | ≤ 24 hours | 24 hours (daily backup cadence) |
| RTO (Recovery Time Objective) | ≤ 4 hours | Untested; plausibly 1-2 hours for application backup, 4-8 hours for Supabase platform restore |
| Backup verification cadence | Monthly | Not currently scheduled |
| Cross-region replication | Optional | Not enabled |

These are aspirational. RPO is the only one currently met by tooling;
RTO has not been drilled. **Drilling RTO at least once before the next
high-stakes evaluation event is recommended.**

---

## Verification — testing a backup

A backup that has never been restored is theoretical. To test:

1. Take a manual snapshot of the demo environment.
2. Truncate one tenant's `periods` table on demo.
3. Restore from the snapshot using the Scenario 1 procedure.
4. Verify all expected rows return; spot-check audit log integrity
   (`row_hash` chain still validates from start to recovery).
5. Time the operation. Document the result — sets a baseline for RTO expectations.

Run this once per quarter at minimum.

---

## Storage costs

The `backups` bucket grows linearly with tenant count and audit log
volume. Monitor via Supabase dashboard → Storage. If storage cost
becomes a concern:

- Increase retention check (delete files > 90 days).
- Compress JSON exports (currently uncompressed).
- Move long-term retention to S3 / Wasabi via the audit roadmap's
  external-sink work.

---

## Known gaps

These are intentional scope boundaries, not bugs:

- **No automated restore.** Recovery requires SQL-level work; no admin
  UI to "restore from backup file".
- **No backup integrity verification.** The system writes files but
  does not periodically read them back to confirm they're intact.
- **Backup failures do not alert.** Edge Function failures appear in
  logs but produce no email / Slack notification.
- **Application backups exclude framework templates.** Cross-tenant
  framework definitions are recovered only via Supabase platform
  backup.

These are tracked items for a future operations sprint.

---

## Related

- [operations/runbooks/jury-day-incident.md](runbooks/jury-day-incident.md)
- [operations/runbooks/demo-seed-broken.md](runbooks/demo-seed-broken.md)
- [operations/audit/audit-roadmap.md](audit/audit-roadmap.md) (external
  sink + sink reliability roadmap)
- [deployment/migrations.md](../deployment/migrations.md)
- `sql/migrations/008_platform.sql` (schema for `platform_backups` +
  cron schedule)
- `supabase/functions/auto-backup/index.ts` (the backup function itself)

---
