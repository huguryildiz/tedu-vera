# Evaluation Period Lifecycle

**Scenario.** A tenant-admin runs an evaluation period from creation through
publication of results. This walkthrough traces the period's state machine —
the conditions for each transition, what becomes editable and what becomes
locked, and the audit trail at every step.

For *what* a period is and the canonical state machine, see
[architecture/period-lifecycle.md](../architecture/period-lifecycle.md).

---

## Actors

| Actor | Role |
| --- | --- |
| Tenant-admin | Creates, configures, locks, archives the period. |
| Juror | Writes scores during the active window. |
| System | Triggers, audit log writes, snapshot freeze. |

---

## States

```
        created                    published                 active
   ┌──────────────┐  publish    ┌──────────────┐  jurors   ┌──────────────┐
   │ draft        │ ──────────► │ ready        │ ────────► │ scoring      │
   │ (no jurors)  │             │ (frozen      │  start    │ (live writes)│
   └──────────────┘             │  snapshot)   │           └──────┬───────┘
                                └──────────────┘                  │ lock
                                                                  ▼
                                                         ┌──────────────┐
                                                         │ locked       │
                                                         │ (read-only,  │
                                                         │  rankings    │
                                                         │  available)  │
                                                         └──────┬───────┘
                                                                │ archive
                                                                ▼
                                                         ┌──────────────┐
                                                         │ archived     │
                                                         │ (historical) │
                                                         └──────────────┘
```

The actual `status` ENUM in the schema may differ in spelling; the canonical
column meaning lives in
[architecture/period-lifecycle.md](../architecture/period-lifecycle.md).

---

## Step-by-step

### 1. Create the period

Tenant-admin opens
[Periods page](../../src/admin/features/periods/PeriodsPage.jsx) → "Add
period". Drawer collects: name, semester label, framework, start/end dates.

- **RPC:** `rpc_admin_create_period(...)`.
- **Audit event:** `periods.insert` with `{ periodName, framework }`.
- **Test:** [`e2e/admin/periods.spec.ts`](../../e2e/admin/periods.spec.ts).

### 2. Configure criteria and outcomes

The period's framework dictates the criteria template. Tenant-admin opens
[Criteria page](../../src/admin/features/criteria/CriteriaPage.jsx) and
[Outcomes page](../../src/admin/features/outcomes/OutcomesPage.jsx) to:

- Adjust criterion weights (must sum to 1.0 within each rubric group).
- Assign rubric bands (5 levels per criterion).
- Map criteria → outcomes for accreditation reports.

While the period has **no scores yet**, all of these fields remain editable.

### 3. Add projects and jurors

Tenant-admin imports projects (CSV or manual entry) and jurors via
[Projects page](../../src/admin/features/projects/ProjectsPage.jsx) and
[Jurors page](../../src/admin/features/jurors/JurorsPage.jsx).

- **Audit events:** `juror.create`, `juror.import`, project equivalents.

### 4. Publish — snapshot freeze

When configuration is final, the admin "publishes" the period. The system
freezes a framework snapshot — a versioned copy of the criteria, weights,
rubric bands, and outcome mappings — so subsequent edits to the templates do
not retroactively change historical scoring.

- **RPC:** `rpc_admin_freeze_period_snapshot(period_id)`.
- **Audit event:** `snapshot.freeze` with `{ periodName }`.
- After this step, the period's criteria and outcomes are fully read-only
  — names, descriptions, weights, rubric bands, mappings, coverage types,
  and acceptance thresholds are all frozen until the period is unlocked.

### 5. Mint entry tokens

See [jury-day-end-to-end.md](jury-day-end-to-end.md) — token minting is the
gateway between an admin-configured period and live juror scoring.

### 6. Period-based field locking kicks in

From the moment the period is locked (QR generated / activated), all
configuration fields on the period's criteria, outcomes, and project list
become read-only and stay that way until the period is unlocked. The
table below captures the lock surface:

| Field | Editable while period is unlocked? | Editable while period is locked? |
| --- | --- | --- |
| Criterion names & descriptions | Yes | No |
| Criterion weights & max scores | Yes | No |
| Rubric band thresholds & labels | Yes | No |
| Outcome codes, labels, descriptions | Yes | No |
| Criterion ↔ outcome mappings | Yes | No |
| Outcome coverage types | Yes | No |
| Acceptance threshold | Yes | No |
| Project names, advisors, team | Yes | No |
| Juror names, affiliations | Yes | Yes (cosmetic only) |

This rule is enforced at the SQL layer (RLS + RPC checks); the UI mirrors
it by disabling inputs and surfacing a top-of-page lock banner on the
Criteria and Outcomes pages.

### 7. Live scoring window

Jurors arrive and score per
[jury-day-end-to-end.md](jury-day-end-to-end.md). The admin watches the
Overview and Reviews pages. No client caching means every refresh is fresh
truth.

### 8. Lock the period

When the session is over, the admin locks. State transitions to
`locked`.

- **RPC:** `rpc_admin_lock_period(period_id)`.
- **Audit event:** `period.lock` with `{ periodName }`.
- After lock: jurors cannot save scores; admins cannot edit anything tied to
  the period (projects, jurors, criteria, mappings) without a formal unlock
  request.

### 9. Unlock requests (rare)

If a critical correction is needed after lock, the admin opens an unlock
request from Periods page → kebab → "Request unlock".

- **RPC:** `rpc_admin_request_period_unlock(...)`.
- **Audit event:** `period.unlock` with `{ periodName, reason }`.
- The action is logged; the unlock is time-bounded; on close, the period
  re-locks.
- **Test:** unlock-request specs (E2E) — note the negative-path
  authorization tests are still on the W2-W6 sprint backlog (see
  [docs/testing/premium-saas-test-upgrade-plan.md](../testing/premium-saas-test-upgrade-plan.md)).

### 10. Publish rankings + export

Rankings page renders the locked-period results; admin exports the xlsx
report.

- **Page:** [Rankings](../../src/admin/features/rankings/RankingsPage.jsx).
- **Test:** [`e2e/admin/rankings-export.spec.ts`](../../e2e/admin/rankings-export.spec.ts).

### 11. Archive (optional)

Past periods can be archived to declutter the active list. Archived periods
remain queryable; they do not appear in default Periods page filters.

- **RPC:** `rpc_admin_archive_period(...)`.
- **Audit event:** `periods.update` with `{ status: 'archived' }`.

---

## Failure modes

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Cannot edit criteria after configuration | A score is already written; field locking rule kicked in | `scores` table for the period |
| Lock action fails | An open unlock request still active | `unlock_requests` table |
| Rankings page shows zero rows | Period not yet locked, or no scores submitted | `period.status` + `scores` count |
| Snapshot freeze fails | Criterion weights do not sum to 1.0 | Validation error message in the drawer |
| Audit log gap between two events | Hash chain validation will detect; cron job runs daily | `audit_logs.row_hash` chain |

---

## Related

- [architecture/period-lifecycle.md](../architecture/period-lifecycle.md)
- [decisions/0005-snapshot-migrations.md](../decisions/0005-snapshot-migrations.md)
- [jury-day-end-to-end.md](jury-day-end-to-end.md)
- [audit-trail-walkthrough.md](audit-trail-walkthrough.md)

---
