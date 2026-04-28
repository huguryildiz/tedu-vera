# Glossary

VERA combines academic accreditation vocabulary with multi-tenant SaaS
patterns. This page defines the terms that appear in code, schema, audit
events, and the rest of the docs — in one place.

Terms are alphabetical. Cross-references use *italics*.

---

## ABET

US-based engineering accreditation body. One of the *frameworks* VERA
ships with as a starter template. Defines a fixed set of *programme
outcomes* (e.g., "an ability to apply engineering design to produce
solutions that meet specified needs").

---

## Affiliation

A juror's institution + department, stored as a single field. Replaces
the separate "Institution" / "Department" columns from earlier versions.
Display format is free-form text; not used for tenant scoping.

---

## Anomaly banner

A UI element shown above the [Audit Log page](../src/admin/features/audit/AuditLogPage.jsx)
when the system detects something unusual — a hash chain mismatch, a
missing event in a sequence, or a gap in expected activity. Output of
`detectAnomalies()` in `src/admin/utils/auditUtils.js`.

---

## Append-only

Property of `audit_logs`. Rows can be inserted, never UPDATEd or DELETEd.
Enforced by RLS (`FOR DELETE USING (false)`) and by the absence of any
RPC that mutates historical rows. Combined with the *hash chain*, makes
post-hoc tampering detectable.

---

## Archived (period status)

A *period* whose data is preserved but hidden from default Periods page
filters. Set via `rpc_admin_archive_period`. Read-only; rankings remain
queryable.

---

## Audit log

Single append-only `public.audit_logs` table that records every
state-changing action — admin sign-ins, score submissions, period locks,
token revocations, organization changes. See
[operations/audit/](operations/audit/) for the full reference.

---

## Audit row anatomy

Every audit row carries: `action` (dotted noun.verb), `organization_id`
(tenant scope, NULL for super-admin platform actions), `actor_id`,
`actor_name` (snapshot at write time), `actor_type`
(`admin|juror|system|anonymous`), `details` (jsonb context), `diff`
(before/after for updates), `correlation_id`, `row_hash`.

---

## Backfill

A SQL operation that retrofits new data onto existing rows after a
schema or logic change. Must be **idempotent** in VERA — use
`UPDATE ... WHERE column IS NULL` so re-runs are safe. See
[deployment/migrations.md](deployment/migrations.md) rule 5.

---

## Both-projects rule

Operational discipline: every database migration and every Edge Function
deployment runs on `vera-prod` and `vera-demo` in the same step. Skipping
one creates silent divergence. See
[deployment/migrations.md](deployment/migrations.md).

---

## Correlation ID

UUID stamped onto multiple audit rows that originated from a single user
gesture. Used to reconstruct multi-event operations (e.g., a juror's
final submission writes one `evaluation.complete` and N
`data.score.submitted` rows, all sharing the same `correlation_id`).

---

## Criterion (pl. criteria)

One of the dimensions a project is scored on. Examples: "Technical
execution", "Presentation quality". Belongs to a *framework*. Has a
*weight* (must sum to 1.0 within a rubric group) and *rubric bands*
(usually 5 levels). Editable in [Criteria page](../src/admin/features/criteria/CriteriaPage.jsx).

---

## Criterion → outcome map

Mapping that connects a criterion to one or more *outcomes*, with a
contribution weight. Used to compute *outcome attainment* from raw
scores. Stored in `framework_criterion_outcome_maps` (template) and
`period_criterion_outcome_maps` (frozen snapshot per *period*).

---

## Data layer (tenant)

The set of `public.*` tables scoped by `organization_id`. RLS policies
on each table enforce that a tenant-admin sees only their organization's
rows; super-admins see all. See
[architecture/multi-tenancy.md](architecture/multi-tenancy.md).

---

## Demo environment

The `vera-demo` Supabase project + the `/demo/*` route subtree on the
frontend. Public-facing showcase; auto-login at `/demo/admin` uses fixed
credentials from env vars. Seeded by
[`scripts/generate_demo_seed.js`](../scripts/generate_demo_seed.js); see
[operations/demo-environment.md](operations/demo-environment.md).

---

## Direct vs. indirect assessment

Accreditation distinction. **Direct** = jury-scored evidence of student
attainment (what VERA records). **Indirect** = surveys, reflections,
self-assessment. VERA stores only direct assessment data; indirect
attainment fields exist in the schema but are populated externally.

---

## Drift sentinel

A CI check that fails when generated artifacts (DB types, RLS coverage,
RPC test coverage, Edge Function arg shape) drift from the source.
Active sentinels: `check:db-types`, `check:rls-tests`, `check:rpc-tests`,
`check:edge-schema`, `check:no-native-select`, `check:no-nested-panels`.

---

## Edge Function

A Deno-based serverless function deployed to Supabase. Used for: sending
email, hourly anomaly sweep, daily backups, processing tenant
applications, session-touch tracking. Some bypass the Kong JWT gate via
custom auth — see [architecture/edge-functions-kong-jwt.md](architecture/edge-functions-kong-jwt.md).

---

## Entry token

Short-lived (24h default) revocable token bound to a *period*. Minted by
admin in Entry Control; shared with jurors as a URL or QR. The token's
`period_id` resolves the *tenant* implicitly — jurors never carry tenant
identity. See [decisions/0004-jury-entry-token.md](decisions/0004-jury-entry-token.md).

---

## Event taxonomy

The dotted-string format used for `audit_logs.action`: `noun.verb` (e.g.,
`period.lock`, `token.revoke`, `application.submitted`). Defined in one
`EVENT_META` map in `src/admin/utils/auditUtils.js`. Adding a new event
requires updating `EVENT_META` so the UI renders it correctly.

---

## Field locking (score-based)

Once any score is written into a *period*, certain fields become
read-only: criterion weights, rubric band thresholds, outcome mappings,
project metadata. Labels and descriptions remain editable. Enforced at
RLS + RPC level; UI mirrors with disabled inputs. See
[walkthroughs/evaluation-period-lifecycle.md](walkthroughs/evaluation-period-lifecycle.md).

---

## Framework

A versioned template defining a set of *outcomes*, *criteria*, and
*criterion → outcome maps*. Examples: "MÜDEK 2024", "ABET EAC 2025",
"Custom — University X". Each *period* selects one framework at
creation. See [architecture/framework-outcomes.md](architecture/framework-outcomes.md).

---

## Hash chain

Tamper-evidence mechanism on `audit_logs`. Each row's `row_hash` is
`sha256(row_data || prev_row_hash)`. Computed by trigger
`audit_logs_compute_hash` on insert. A daily cron recomputes the chain
and alerts on mismatch.

---

## Heatmap

Admin analytics view showing project × criterion scores as a colored
matrix. Row = project, column = criterion, cell color = average score.
[Heatmap page](../src/admin/features/heatmap/HeatmapPage.jsx).

---

## Identity step

First step of the jury flow — juror enters their full name + last 4
digits of national ID. Component: `src/jury/features/identity/IdentityStep.jsx`.

---

## JWT (admin)

Supabase Auth-issued JSON Web Token carrying the admin's `auth.uid()`.
Validated by Kong on every PostgREST request; carried into RPCs where
`_assert_tenant_admin()` resolves the tenant scope from the
`memberships` table. See
[decisions/0003-jwt-admin-auth.md](decisions/0003-jwt-admin-auth.md).

---

## Juror

Domain expert invited to evaluate student projects in a single session.
Has no Supabase Auth identity — accesses the platform via *entry token*
+ identity + PIN. Persisted in `jurors` (per-tenant) and
`juror_period_auth` (per-period instance with PIN, attempts, lock state).

---

## Kong

The API gateway in front of Supabase PostgREST. Validates JWT on
incoming requests. Some configurations reject ES256 tokens — the
workaround for Edge Functions that hit this is `verify_jwt: false` +
custom auth. See [architecture/edge-functions-kong-jwt.md](architecture/edge-functions-kong-jwt.md).

---

## Locked (period status)

A *period* after `rpc_admin_lock_period` runs. Jurors cannot save new
scores; all period-tied admin edits are blocked except cosmetic
(label/description) changes. Audit event: `period.lock`.

---

## Membership

A row in `public.memberships` linking a Supabase Auth user to an
organization. `organization_id IS NULL` → super-admin (full platform
scope). `organization_id` set → tenant-admin (that organization only).
`is_pending = true` → awaiting super-admin review.

---

## MÜDEK

Turkish engineering accreditation body (Mühendislik Eğitim Programları
Değerlendirme ve Akreditasyon Derneği). One of VERA's starter
*frameworks*. Defines programme outcomes specific to Turkish engineering
education.

---

## Outcome (programme outcome)

One of the high-level capabilities a degree programme commits to
producing in graduates. Examples: "ability to design experiments",
"ability to communicate effectively". Defined per *framework*. Computed
attainment is the headline output of an evaluation period.

---

## Outcome attainment

The percentage of students whose performance on outcome-mapped criteria
meets the framework's target threshold. Calculated by aggregating raw
scores up through the *criterion → outcome map*. The numerical
correctness pin: [`outcome-attainment.spec.ts`](../e2e/admin/outcome-attainment.spec.ts).

---

## Period

An evaluation event — one academic semester's jury for a specific
programme. Has a *framework*, dates, *projects*, *jurors*, *snapshots*
of the framework, and (eventually) scores. State machine: draft → ready
→ scoring → locked → archived.

---

## PIN

4-digit code issued to a juror on first visit. Required on subsequent
visits to resume their session. 3 failed attempts → lockout (audit event
`juror.pin_locked`). Admin can unlock + reset from PIN-blocking page.
No self-recovery by design.

---

## Programme outcome

See *outcome*. "Programme outcome" is the formal accreditation term;
"outcome" is used colloquially in code.

---

## Realtime (Supabase Realtime)

WebSocket-based subscription mechanism on Postgres tables. VERA uses it
on `scores` so the admin overview reflects juror writes within seconds.
Configured in `002_tables.sql` via Realtime publication.

---

## RLS (Row Level Security)

Postgres feature that filters table rows based on the calling user. VERA
uses RLS to enforce tenant isolation: every isolated table has a policy
that compares `organization_id` against the caller's resolved tenant
scope. See [`sql/tests/rls/`](../sql/tests/rls/) and
[architecture/multi-tenancy.md](architecture/multi-tenancy.md).

---

## RPC

Postgres function exposed via PostgREST. The application's data layer is
RPC-only — pages never call `supabase.rpc()` directly; all calls go
through wrappers in `src/shared/api/`. New admin RPCs go in `006a` or
`006b` migration modules; jury RPCs in `005`.

---

## Rubric band

One of the 5 score levels per *criterion* (typically: Excellent / Good /
Adequate / Marginal / Unacceptable). Each band has a numeric threshold
and a color. Frozen by snapshot at period publish.

---

## Score sheet

A juror's complete set of scores for one project, persisted in
`score_sheets` + `score_sheet_items`. Includes per-criterion scores,
optional comments, and a derived total. Audit event:
`data.score.submitted`.

---

## Semester

Calendar label for a *period* — e.g., "Spring 2026". Stored as a string,
not enforced by an enum. Multiple periods can share a semester label
(e.g., one programme's spring period + another's spring period).

---

## Snapshot (framework freeze)

Versioned copy of a *framework*'s criteria, weights, rubric bands, and
outcome mappings, taken when a period publishes. Lives in
`period_criteria`, `period_outcomes`, `period_criterion_outcome_maps`.
Subsequent edits to the framework template do not retroactively affect
past periods. Audit event: `snapshot.freeze`.

---

## Snapshot migrations

VERA's database migration approach. Each module file (`002_tables.sql`,
`004_rls.sql`, etc.) describes the **final** state of its part of the
schema — not a delta. See
[decisions/0005-snapshot-migrations.md](decisions/0005-snapshot-migrations.md).

---

## Super-admin

Platform operator with `memberships.organization_id IS NULL`. Can see
across all tenants, approve/reject organization applications, view
platform metrics. Granted only by direct SQL — there is no admin UI for
elevation.

---

## Tenant

Synonym for *organization*. A tenant is a university programme using
VERA. Tenant-admins see only their tenant's data; super-admins see all.

---

## Tenant-admin

Admin scoped to one organization. `memberships.organization_id` is set
to that organization's UUID. Cannot read or modify other tenants' data
(enforced at RLS layer).

---

## Verification (ADR)

Section in each ADR naming the audit events and tests that pin the
decision. Used to confirm a decision is still in force after months of
code churn. See
[decisions/](decisions/README.md).

---

## v1 RPCs (legacy)

Pre-multi-tenancy admin RPCs that used a shared password rather than
JWT. Retained for backward compatibility with the original admin user
pool that has not yet migrated. Not used by new code; subject to removal
once migration is complete. See
[decisions/0003-jwt-admin-auth.md](decisions/0003-jwt-admin-auth.md).

---
