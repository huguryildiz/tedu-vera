# Data Retention and Privacy

What personal data VERA stores, why it's retained, how long, and what
rights tenants and end-users have. This page is the canonical reference
for compliance reviews (GDPR, KVKK) and tenant onboarding privacy
questions.

For the security guarantees that protect the data described here, see
[architecture/security-model.md](architecture/security-model.md).

---

## Personal data inventory

### Admin users

| Field | Source | Storage | Required for |
| --- | --- | --- | --- |
| Email | Supabase Auth (sign-up / OAuth) | `auth.users.email` | Sign-in, password reset, invitation flow |
| Display name | User-provided on profile | `profiles.display_name` | Audit log attribution, UI greeting |
| Password (bcrypt hash) | Sign-up flow | `auth.users.encrypted_password` | Email/password authentication |
| Google identity (OAuth subject) | Google OAuth | Supabase Auth metadata | Federated sign-in |
| Last sign-in timestamp | Auth event | `auth.users.last_sign_in_at` | Inactivity detection |
| IP address (per audit row) | Request headers | `audit_logs.ip_address` | Forensics, anomaly detection |
| User agent (per audit row) | Request headers | `audit_logs.user_agent` | Forensics |

### Jurors

| Field | Source | Storage | Required for |
| --- | --- | --- | --- |
| Full name | Identity step | `jurors.juror_name`, `juror_period_auth.juror_name` | Sign-in, attribution |
| Last 4 digits of national ID | Identity step | `juror_period_auth.id_last4` | Identity confirmation |
| Affiliation (institution + dept) | Admin-entered or self-reported | `jurors.affiliation` | UI display, conflict-of-interest tracking |
| PIN (hashed) | First-visit reveal | `juror_period_auth.pin_hash` | Re-authentication |
| Session token | Server-issued | `juror_period_auth.session_token` | Session resume |

### Project metadata (tenant-controlled)

| Field | Storage | Required for |
| --- | --- | --- |
| Project title | `projects.title` | UI |
| Team member names | `projects.team_members` (jsonb) | UI, attribution |
| Advisor name | `projects.advisor_name` | UI, conflict-of-interest |

### What VERA does **not** store

- Full national ID numbers — only last 4 digits.
- Date of birth.
- Home address, phone number.
- GPA, academic transcripts.
- Credit card or payment information (no billing in current scope).
- Health information.
- Photos or biometric identifiers.

---

## Retention rules

### Audit logs

Audit logs are **append-only and retained indefinitely**. The
[append-only RLS policy](architecture/security-model.md#audit-trail-integrity)
prevents deletion. Retention is justified as:

- **Legal:** evidentiary trail for academic accreditation reports and
  any post-event integrity dispute.
- **Operational:** anomaly detection cross-references months of past
  activity.
- **Forensic:** the hash chain depends on continuity — deleting a row
  invalidates every subsequent row's hash.

If a tenant requests removal of historical audit data containing their
PII, the trade-off is: the chain integrity for that tenant's segment
breaks at the deletion point. This must be a deliberate decision — see
"Right to be forgotten" below.

### Active tenant data

Periods, projects, jurors, scores: retained for the life of the
tenant's relationship with VERA. No automated retention expiry.

### Application backups (Supabase Storage `backups` bucket)

- Retention default: 30 days (lifecycle rule on the bucket).
- Backups beyond 30 days are deleted, but the `platform_backups` row
  retains metadata (creation time, size, row counts) indefinitely.

### Supabase platform backups

- Tier-dependent. On Pro tier: ≤ 24 hour RPO, ≤ 7 day retention.
- Outside VERA's direct control. See
  [operations/backup-and-recovery.md](operations/backup-and-recovery.md).

### Demo environment

Re-seedable on demand. Demo data is intentionally synthetic — no real
PII lives in `vera-demo`. The fixtures in
[`scripts/generate_demo_seed.js`](../scripts/generate_demo_seed.js) use
generated names like "Prof. Marcus Reynolds" and "demo-admin@vera-eval.app",
not any real person's identity.

---

## Right to be forgotten (current state)

GDPR Article 17 / KVKK Article 7 grant individuals the right to request
deletion of personal data. VERA's support is **partial**:

### What works today

- **`auth.users` deletion.** Supabase Auth supports `DELETE FROM auth.users`
  — removes credentials and identity records.
- **`memberships` deletion.** Cascades cleanly when the org or user is
  removed.
- **`profiles` deletion.** `ON DELETE CASCADE` from `auth.users`.
- **Tenant deletion.** "Delete organization" flow removes
  `organizations` + cascades to all tenant-scoped tables (periods,
  projects, jurors, scores).

### What does not work today

- **`audit_logs.user_id` is a hard FK** to `auth.users`. Attempting to
  delete an admin who has audit history fails with FK violation.
  - **Workaround:** the audit log carries `actor_name` as a snapshot at
    write time. The name is preserved historically; pseudonymizing the
    user (renaming display_name) does not change `actor_name` on past
    rows.
  - **Long-term fix:** roadmap item #2 in
    [operations/audit/audit-roadmap.md](operations/audit/audit-roadmap.md)
    plans `ON DELETE SET NULL` for `audit_logs.user_id`.

### Trade-off: hash chain vs. deletion

Even if `user_id` becomes nullable, the audit row's `actor_name`,
`details` JSON, and `ip_address` may still contain PII. Deleting these
fields would break the `row_hash` integrity check.

**Current policy:** when a deletion request requires modifying historical
audit rows, the integrity break is a deliberate cost. The procedure is:

1. Document the request in `.claude/internal/post-mortems/privacy-requests/`.
2. Record the decision in an audit event of type `privacy.deletion`
   (planned event type — not yet implemented).
3. Apply the requested redaction.
4. Note that `row_hash` for that segment becomes unverifiable.
5. Document for compliance auditor that a deletion was performed.

This is operational, not automated. A formal Right-to-be-forgotten
workflow is on the roadmap but not yet built.

---

## Tenant data export

A tenant can request all data VERA holds about them. Current
mechanisms:

| Mechanism | Status |
| --- | --- |
| Application backup (per-tenant JSON) | ✅ Available — see [operations/backup-and-recovery.md](operations/backup-and-recovery.md). Super-admin generates on demand. |
| Rankings xlsx export | ✅ Available — per-period only. |
| Heatmap / analytics export | ✅ Available — per-period only. |
| Audit log export | 🔶 Available via SQL query; no admin UI button. |
| Full machine-readable tenant export | 🔶 Available as the application backup; but the format is implementation-specific, not a standardized portability format. |

---

## Cookies and browser storage

VERA uses browser storage **only** for:

- User preferences (theme, filter state, sort order) — localStorage.
- Per-tab ephemeral UI flags (guided tour, one-time prompts) — sessionStorage.
- Jury access grants (dual-write to both for tab + restart persistence).
- Supabase Auth session (managed by the SDK, not by VERA application code).

VERA does **not** use:

- Third-party tracking cookies.
- Analytics cookies (no Google Analytics, Mixpanel, or similar).
- Advertising cookies.
- Cross-site tracking pixels.

The full storage policy is in
[architecture/storage-policy.md](architecture/storage-policy.md).

---

## Data residency

Tenant data resides in the Supabase project's region. VERA's `vera-prod`
project's region is set at project creation in the Supabase dashboard;
VERA does not pin a specific region in code. Multi-region replication is
not enabled.

If a tenant's compliance posture requires a specific region, that must
be confirmed at onboarding by checking the Supabase project's region
setting. There is currently no per-tenant region selection — every
tenant's data lives in the same Supabase project.

---

## Sub-processors

VERA's data path involves:

| Sub-processor | Purpose | Data exposed |
| --- | --- | --- |
| Supabase | Database, Auth, Edge Functions, Storage | All application data |
| Vercel | Frontend hosting | No PII (frontend serves static assets only) |
| Google (when OAuth used) | Federated identity | Email + Google subject only |

No tenant data flows to any other third party. Email delivery uses
Supabase's built-in mail; no separate ESP is configured.

---

## Compliance posture summary

| Standard | Status |
| --- | --- |
| GDPR | Partial — see Right to be forgotten gap |
| KVKK (Turkey) | Partial — same gap |
| FERPA (US) | Not formally evaluated; tenant-admin controls data per the institution's existing policies |
| SOC 2 | Not pursued |
| ISO 27001 | Not pursued |

This is the documented current state, not an aspiration. Any tenant
considering VERA for a regulated environment must evaluate the gaps in
this document against their own compliance requirements before signing.

---

## Related

- [architecture/security-model.md](architecture/security-model.md) —
  security guarantees protecting the data inventoried here.
- [architecture/storage-policy.md](architecture/storage-policy.md) —
  browser-side storage rules.
- [operations/audit/audit-coverage.md](operations/audit/audit-coverage.md) —
  what's logged.
- [operations/audit/audit-roadmap.md](operations/audit/audit-roadmap.md) —
  improvements that affect retention (notably FK relaxation for
  Right-to-be-forgotten).
- [operations/backup-and-recovery.md](operations/backup-and-recovery.md) —
  backup retention details.
- [known-limitations.md](known-limitations.md) — broader gap list.

---

> *Last updated: 2026-04-24*
