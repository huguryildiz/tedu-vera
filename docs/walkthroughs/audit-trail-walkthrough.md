# Audit Trail Walkthrough

**Scenario.** An admin performs three actions in sequence: changes a
criterion weight, locks a period, and revokes an entry token. This
walkthrough shows what gets written to `public.audit_logs` for each action,
how the rendering pipeline turns a row into a human-readable sentence on the
Audit Log page, and how the hash chain guarantees nothing is silently
modified.

Reference: the canonical event taxonomy lives in
[`src/admin/utils/auditUtils.js`](../../src/admin/utils/auditUtils.js); the
event-message reference table is
[../operations/audit/audit-event-messages.md](../operations/audit/audit-event-messages.md).

---

## Actors

| Actor | Identity |
| --- | --- |
| Tenant-admin | Supabase Auth user (signed in). |
| Postgres trigger `audit_logs_hash_chain` | Computes `row_hash` on every insert. |
| Daily cron `audit_chain_validate` | Detects modifications to historical rows. |

---

## Anatomy of an audit row

`public.audit_logs` columns relevant to the walkthrough:

```
id                  uuid       — primary key
action              text       — e.g. "period.lock", "token.revoke"
organization_id     uuid       — tenant scope (NULL for super-admin platform actions)
actor_id            uuid       — auth.uid() of the admin (NULL for jurors / system)
actor_type          text       — admin | juror | system | anonymous
details             jsonb      — action-specific context
correlation_id      uuid       — groups related rows from one user gesture
row_hash            text       — sha256 of (id, action, organization_id, created_at, ...)
created_at          timestamptz
```

Every insert is **append-only**: there is no UPDATE/DELETE policy. The hash
chain pins each row to its predecessor.

---

## Action 1 — change a criterion weight (illegal after first score)

Tenant-admin opens Criteria page on a period that has zero scores yet, edits
a weight, hits save.

### Audit row

```jsonb
{
  "action": "criteria.update",
  "details": {
    "criterion_id": "...",
    "criterion_label": "Technical execution",
    "before": { "weight": 0.30 },
    "after":  { "weight": 0.35 }
  }
}
```

### Render pipeline

`src/admin/utils/auditUtils.js` converts the row:

1. `getActorInfo(log)` — `{ type: "admin", name: "Hugur Yildiz", role: "tenant-admin", initials: "HY" }`.
2. `formatSentence(log)` — `{ verb: "updated", resource: "criterion *Technical execution*" }`.
3. `formatEventMeta(log)` — `criteria.update · weight 0.30 → 0.35`.
4. `formatDiffChips(log)` — `[ { key: "weight", from: 0.30, to: 0.35 } ]`.

The Audit Log page renders:

> **Hugur Yildiz updated criterion *Technical execution*.**
> `criteria.update · weight 0.30 → 0.35`

### Negative case

If the admin had attempted this **after** the first score was written, the
RPC would have rejected the call. No audit row would be written for the
attempt — there is no "permission_denied" audit event by design (it would
flood the log with noise from polling UIs). Cross-tenant attempts are
similarly silent — RLS denies the read; no event fires.

---

## Action 2 — lock the period

Same admin clicks "Lock period" from the kebab menu.

### Audit row

```jsonb
{
  "action": "period.lock",
  "details": {
    "period_id": "...",
    "periodName": "EE 491/492 Spring 2026"
  },
  "correlation_id": "<same as the kebab menu's open-to-close gesture>"
}
```

### Render

> **Hugur Yildiz locked evaluation period *EE 491/492 Spring 2026*.**
> `period.lock`

### Side effects logged elsewhere

The lock does not write child audit rows for "all jurors implicitly stopped"
or "all editable fields became read-only" — those are *consequences* of the
lock, not separate user actions. The period state alone tells the story for
those derived behaviors.

---

## Action 3 — revoke an entry token

Admin opens Entry Control, kebab → "Revoke" on an unused token.

### Audit row

```jsonb
{
  "action": "token.revoke",
  "details": {
    "token_id": "...",
    "period_id": "...",
    "periodName": "EE 491/492 Spring 2026",
    "label": "Panel B"
  }
}
```

If the admin had bulk-revoked instead, the action would be
`security.entry_token.revoked` with `{ revoked_count: <n> }`.

### Render

> **Hugur Yildiz revoked QR access code for *EE 491/492 Spring 2026*.**
> `token.revoke · Panel B`

---

## Hash chain integrity

Every insert into `audit_logs` fires the `audit_logs_hash_chain` trigger
(defined in
[sql/migrations/009_audit.sql](../../sql/migrations/009_audit.sql)). The
trigger computes `row_hash = sha256(id || action || organization_id || created_at || details::text || prev_row_hash)`,
where `prev_row_hash` comes from the most recent row in the same tenant's
chain.

The `audit_chain_validate` cron job runs daily and re-walks the chain. If
any historical row was modified, the recomputed hash will not match the
stored hash, and the validator emits an alert.

This is enforced at the database layer; no client-side opt-in.

---

## Audit page UX

[Audit Log page](../../src/admin/features/audit/AuditLogPage.jsx) renders the
chain with filters (actor, action, date range) and a per-row drawer expanding
the full `details` JSON.

- Filter implementation: [`useAuditLogFilters`](../../src/admin/features/audit/useAuditLogFilters.js).
- Anomaly banner (e.g. detected gap or hash mismatch) renders at the top of
  the page when present.
- **Test:** [`e2e/admin/audit-log.spec.ts`](../../e2e/admin/audit-log.spec.ts).

---

## What is *not* in the audit log

| Action | Why not |
| --- | --- |
| Page navigation, list filters, sort changes | UI state, not state-changing actions. |
| Failed RLS / permission denials | Would flood the log with polling noise; absence of audit row is itself the signal. |
| Dev / sandbox actions | Audit trigger fires on every tenant; dev environments produce real rows but in a separate database. |
| Score writes by jurors | Single event `data.score.submitted` per submission; individual cell edits are not logged. |
| Schema migrations | Deploy-time only; tracked in git, not `audit_logs`. |

---

## Related

- [../operations/audit/audit-event-messages.md](../operations/audit/audit-event-messages.md) — full
  event taxonomy with sentence templates.
- [../operations/audit/audit-coverage.md](../operations/audit/audit-coverage.md) — gap analysis of
  what is and is not currently logged.
- [decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md) —
  why audit attribution is JWT-bound.
- [tenant-onboarding.md](tenant-onboarding.md) — application audit events
  (`application.submitted`, `.approved`, `.rejected`).

---
