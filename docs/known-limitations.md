# Known Limitations

What VERA does not yet do, or does only partially. Use this page when
scoping a tenant onboarding, a compliance review, or a vendor
assessment — every item below is also surfaced in a more specific
document, but having one consolidated list saves prospective tenants
time.

Categories:

- **Intentionally out of scope** — by design; not on any roadmap.
- **Planned, not yet built** — known gap, work tracked.
- **Operational gap** — process not yet formalized; works in practice
  but not by automation.

---

## Multi-tenancy and billing

| Item | Status | Tracked in |
| --- | --- | --- |
| Per-tenant billing | **Out of scope** | Free for approved tenants; no payment integration. |
| Tenant data export as a portable format | **Operational gap** | Application backup JSON exists but is not standardized; tenant downloads it via super-admin. See [operations/backup-and-recovery.md](operations/backup-and-recovery.md). |
| Per-tenant region selection | **Out of scope** | All tenants share one Supabase project; region is project-wide. See [data-retention-and-privacy.md](data-retention-and-privacy.md#data-residency). |
| Cross-tenant analytics for super-admin | **Out of scope** | Super-admin sees per-tenant metrics individually; no aggregation across tenants in the UI. Platform-metrics Edge Function provides high-level counts only. |
| Tenant offboarding workflow | **Planned, not yet built** | "Delete organization" works mechanically; formal export-then-delete process not codified. |

---

## Auth and identity

| Item | Status | Tracked in |
| --- | --- | --- |
| Self-service super-admin elevation | **Out of scope, by design** | Super-admin status is granted only via direct SQL — intentional friction. See [architecture/security-model.md](architecture/security-model.md). |
| Self-service juror PIN recovery | **Out of scope, by design** | No "forgot PIN" flow for jurors. Admin uses the PIN-blocking page. Decision rationale in [decisions/0004-jury-entry-token.md](decisions/0004-jury-entry-token.md). |
| Multi-factor authentication for admins | **Planned, not yet built** | Only password + Google OAuth today. No TOTP, no WebAuthn. |
| Persistent juror accounts | **Out of scope, by design** | Token-based entry is the model; rotating-panel use case makes accounts disproportionate. See [decisions/0004-jury-entry-token.md](decisions/0004-jury-entry-token.md). |
| Legacy v1 password RPC removal | **Planned, not yet built** | v1 RPCs retained for backward compat; removal blocked on full migration of legacy admin pool. See [decisions/0003-jwt-admin-auth.md](decisions/0003-jwt-admin-auth.md). |

---

## Audit and tamper evidence

| Item | Status | Tracked in |
| --- | --- | --- |
| Selective JSONB diffing in audit log | **Planned** | Trigger currently writes full row snapshots; storage grows aggressively. Item #1 in [operations/audit/audit-roadmap.md](operations/audit/audit-roadmap.md). |
| `ON DELETE SET NULL` for `audit_logs.user_id` | **Planned** | Hard FK currently blocks admin deletion. Item #2 in audit roadmap; affects Right-to-be-forgotten. |
| Trusted-proxy IP header validation | **Planned** | `X-Forwarded-For` is currently trusted blindly. Item #3 in audit roadmap. |
| External root anchoring (off-DB hash) | **Planned** | Hash chain lives in DB only; a compromised DB admin could re-key. Item #4 in audit roadmap. |
| Reliable sink to external (Axiom etc.) | **Planned** | `audit-log-sink` is currently fire-and-forget. Item #5 in audit roadmap. |
| Permission-denied audit events | **Out of scope, by design** | Cross-tenant denied reads do not produce audit rows — would flood with noise. Detection is visual + integrity validator. |

---

## Compliance and privacy

| Item | Status | Tracked in |
| --- | --- | --- |
| GDPR / KVKK Right-to-be-forgotten (full) | **Planned** | Audit `user_id` FK blocks user delete; PII can persist in `actor_name` snapshots. Procedural workaround documented. See [data-retention-and-privacy.md](data-retention-and-privacy.md). |
| Formal data retention policy | **Operational gap** | Audit logs retained indefinitely; tenant data retained for life of relationship. Documented but not enforced by automation. |
| SOC 2 / ISO 27001 attestation | **Out of scope** | Not pursued. |
| FERPA evaluation | **Operational gap** | Not formally evaluated; tenant-admin controls data per institution policy. |

---

## Backup, recovery, monitoring

| Item | Status | Tracked in |
| --- | --- | --- |
| Automated restore from application backup | **Planned** | Recovery is SQL-level today; no admin UI button. See [operations/backup-and-recovery.md](operations/backup-and-recovery.md). |
| Backup integrity verification | **Operational gap** | Files are written; not periodically read back to confirm intact. |
| Backup failure alerting | **Operational gap** | Edge Function failures appear in logs only; no email / Slack notification. |
| RTO drill | **Operational gap** | Target ≤ 4 hours; never drilled against the real procedure. |
| Cross-region replication | **Out of scope** | Single-region today. |
| Application performance monitoring (Datadog, Sentry) | **Out of scope** | Supabase logs + audit log only. |

---

## Testing

| Item | Status | Tracked in |
| --- | --- | --- |
| Tautology-mock pages refactored | **Planned (in progress)** | 1/9 admin page tests refactored. See [testing/page-test-mock-audit.md](testing/page-test-mock-audit.md). |
| Score-edit / unlock E2E | **Skipped** | RPC not yet implemented. See [testing/premium-saas-test-upgrade-plan.md](testing/premium-saas-test-upgrade-plan.md). |
| Lock-enforcement integration tests | **Skipped** | 12 placeholder `todo()` tests in `useManageJurors.lockEnforcement.test.js` and `useManageProjects.lockEnforcement.test.js`. |
| Allure report wiring | **Planned** | Reporter slot exists; not wired up. |
| Tenant-isolation E2E in CI hard gate | **Planned** | Currently runs as part of suite but not as a separate hard gate. |
| Coverage threshold ratchet to 60/50/65 | **Planned** | Current 53/38/57/53 thresholds are post-S33 levels. |

---

## UX and product features

| Item | Status | Tracked in |
| --- | --- | --- |
| Indirect assessment data | **Out of scope** | VERA stores direct (jury-scored) assessment only. Indirect attainment fields exist in schema but are populated externally. |
| Photo / file attachment per project | **Out of scope** | Project metadata is text-only. No file upload pipeline. |
| Inline juror chat / messaging | **Out of scope** | No in-app communication channel. |
| Mobile-native apps | **Out of scope** | Responsive web only; no React Native / iOS / Android. |
| Per-juror reminders / nudges | **Operational gap** | Tenant-admin manually nudges jurors via venue channel; no automated reminders. |

---

## Documentation

| Item | Status |
| --- | --- |
| Testing rewrite against current test reality | ✅ Complete (S6) |
| Glossary | ✅ Complete (S5) |
| Security model | ✅ Complete (S5) |
| Known limitations (this page) | ✅ Complete (S6) |
| Walkthroughs | ✅ Complete (S3) |
| ADRs | ✅ Complete (S3) |
| CLAUDE.md "Key Files" path audit | **Planned** | Some paths in CLAUDE.md drifted from actual codebase locations; tracked as a small follow-up. |

---

## How to use this list

- **Selling VERA to a new tenant:** read this list aloud. Anything in
  "Out of scope" is a deliberate boundary; anything "Planned" needs a
  conversation about timeline; anything in "Operational gap" works
  today but won't scale.
- **Compliance review:** the "Compliance and privacy" + "Audit and
  tamper evidence" sections capture the honest posture. Pair with
  [data-retention-and-privacy.md](data-retention-and-privacy.md) and
  [architecture/security-model.md](architecture/security-model.md).
- **Engineering planning:** the "Planned" rows are the canonical
  backlog of cross-system improvements. Per-area detail lives in the
  document linked under "Tracked in".

---

## What this page is **not**

- Not a feature roadmap with dates. Items move from "Planned" to "Done"
  silently; commitment to dates lives elsewhere (sprint plans,
  user-facing release notes).
- Not exhaustive. Per-feature limitations live in feature-specific
  docs. This page captures the cross-cutting items that come up
  repeatedly in tenant conversations.
- Not a complaint list. Items are framed in operational terms —
  what's missing, what works around it, and where the work to fix it
  is tracked.

---

## Related

- [data-retention-and-privacy.md](data-retention-and-privacy.md)
- [architecture/security-model.md](architecture/security-model.md)
- [operations/audit/audit-roadmap.md](operations/audit/audit-roadmap.md)
- [operations/backup-and-recovery.md](operations/backup-and-recovery.md)
- [testing/premium-saas-test-upgrade-plan.md](testing/premium-saas-test-upgrade-plan.md)

---

> *Last updated: 2026-04-24*
