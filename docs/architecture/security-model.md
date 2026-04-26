# Security Model

Single-page reference for VERA's security guarantees. Use this for compliance
review, vendor assessment, or any "how does VERA protect tenant data?"
question. Each guarantee is paired with the enforcement mechanism, the audit
trail, and the test that pins it.

For deeper context per topic, follow the cross-references at the end of each
section.

---

## Threat model (in scope)

| Threat | Defense |
| --- | --- |
| Tenant-admin reads another tenant's data | RLS denies cross-tenant SELECT at the SQL layer |
| Juror impersonates another juror | Identity + PIN + lockout after 3 failed attempts |
| Juror manipulates entry token URL to access another tenant | Token's `period_id` is the only tenant signal — server-resolved, not client-supplied |
| Admin elevates themselves to super-admin | Super-admin status is granted only by direct SQL; no admin UI path |
| Compromised admin modifies historical audit log | Append-only RLS + sha256 hash chain + daily integrity validation |
| Compromised database admin re-keys hash chain | Mitigated only partially — see "Known limitations" below |
| Edge Function bypasses tenant scope via service role | Every tenant-scoped Edge Function re-checks `memberships` server-side |
| Browser storage carries credentials | Storage policy bans secrets in localStorage / sessionStorage |
| MITM modifies request body to escalate privileges | TLS via Supabase + Vercel; JWT signed by Supabase Auth |

## Threat model (out of scope)

The following are not currently defended against in the application layer.
Document them when scoping a new tenant's compliance review.

- DDoS at the Supabase / Vercel edge — handled by upstream providers.
- Insider threat at Supabase or Vercel itself.
- Physical access to a juror's device during a session.
- Phishing of an admin's Supabase Auth credentials.
- Sophisticated post-compromise hash-chain re-keying (see "Known
  limitations").

---

## Identity and authentication

### Admin identity

- **Mechanism:** Supabase Auth (email+password or Google OAuth) issues a
  JWT carrying `auth.uid()`.
- **Tenant scope resolution:** SQL helper `_assert_tenant_admin()` reads
  `auth.uid()`, looks up `memberships.organization_id`, returns it as the
  active scope. RPCs reject when no membership row exists.
- **Roles:**
  - Super-admin: `memberships.organization_id IS NULL`.
  - Tenant-admin: `memberships.organization_id` set to a real org.
- **Audit events:** `auth.admin.login.success`, `auth.admin.login.failure`,
  `auth.admin.password.changed`, `auth.admin.password.reset.requested`.
- **Tests:** `src/auth/shared/__tests__/AuthProvider.test.jsx`,
  `src/auth/shared/__tests__/AuthProvider.googleOAuth.test.jsx`.

See [decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md).

### Juror identity

- **Mechanism:** Server-issued session token after presenting a valid
  *entry token* + name + last 4 digits of national ID + PIN.
- **Tenant scope resolution:** The entry token carries `period_id`; the
  period carries `organization_id`. Tenant is server-resolved, not
  client-supplied — a juror cannot spoof a tenant by manipulating client
  state.
- **Lockout:** 3 failed PIN attempts → account locked, audit event
  `juror.pin_locked`. Admin unlock writes `juror.pin_unlocked` or
  `juror.pin_unlocked_and_reset`.
- **Tests:** [`e2e/jury/lock.spec.ts`](../../e2e/jury/lock.spec.ts),
  [`e2e/jury/expired-session.spec.ts`](../../e2e/jury/expired-session.spec.ts).

See [decisions/0004-jury-entry-token.md](../decisions/0004-jury-entry-token.md).

### Anonymous applicants

The "Apply for VERA" form on the landing page accepts a submission with no
auth. The submission lands in `org_applications` with `status='pending'`.
Cannot read existing data; can only insert a single application row.

---

## Tenant isolation (RLS)

Every tenant-scoped table carries an RLS policy that filters by
`organization_id` matching the caller's resolved tenant. The pattern:

```sql
CREATE POLICY tenant_select_own ON jurors
  FOR SELECT USING (
    organization_id = current_admin_org_id()
    OR is_super_admin()
  );
```

`current_admin_org_id()` reads the same `auth.uid()` → `memberships`
chain that `_assert_tenant_admin()` does. JWT validation and RLS share
one source of truth.

### Coverage gate

A new isolated table is required to ship with a paired pgTAP isolation
test in [`sql/tests/rls/`](../../sql/tests/rls/). The drift sentinel
`npm run check:rls-tests` fails CI if a table has no test.

### Cross-tenant access fails silently

A tenant-admin who tries to read another tenant's data does not produce
an audit event — RLS denies the read at the SQL layer with no row written.
The signal is *visual* (the page renders empty / 404) and the test that
pins this is [`e2e/security/tenant-isolation.spec.ts`](../../e2e/security/tenant-isolation.spec.ts).

This is an intentional choice: logging every denied read would flood the
audit log with polling noise. If detection becomes a requirement, the
audit roadmap covers external sink + anomaly correlation as the path.

See [architecture/multi-tenancy.md](multi-tenancy.md).

---

## Authorization (admin RPCs)

### The `_assert_tenant_admin()` gate

Every admin RPC begins with:

```sql
DECLARE
  v_org_id uuid := _assert_tenant_admin();
BEGIN
```

This:

1. Reads `auth.uid()`.
2. Looks up `memberships`.
3. Returns the org id (or NULL for super-admin).
4. Raises `permission_denied` if no membership row exists.

There is no admin-RPC code path that skips this gate.

### Edge Function authorization

Edge Functions that hit Kong's ES256 JWT rejection use `verify_jwt: false`
+ in-function custom auth:

1. Validate token via `auth.getUser(token)` (tolerates ES256).
2. Look up `memberships` for the resolved user.
3. Use the service role for the actual DB operation **only after** the
   membership lookup confirms permission.

Reference implementations: `platform-metrics/index.ts`,
`admin-session-touch/index.ts`. See
[architecture/edge-functions-kong-jwt.md](edge-functions-kong-jwt.md).

### Coverage gate

`npm run check:rpc-tests` fails CI if an admin RPC lacks a paired test.

---

## Audit trail integrity

### Append-only

`audit_logs` has `FOR DELETE USING (false)` and `FOR UPDATE USING (false)`
RLS policies. Even a super-admin cannot modify or delete a historical row
through application code. Direct DB access can — see "Known limitations".

### Hash chain

Every insert fires `audit_logs_compute_hash` trigger:

```
row_hash = sha256(id || action || organization_id || created_at
                  || details::text || prev_row_hash)
```

`prev_row_hash` is the most recent row's hash in the same tenant chain.
A daily cron `audit_chain_validate` walks the chain and emits an alert
on mismatch.

### Coverage

48 / 48 audited operations as of the last audit (see
[operations/audit/audit-coverage.md](../operations/audit/audit-coverage.md)).
27 explicit (RPC-emitted) actions + 7 trigger-based CRUD tables (covering
all tenant-scoped tables that mutate).

### Known limitations

The hash chain lives entirely inside the database. A compromised database
admin who can both modify rows and re-key the chain would defeat
detection. The roadmap ([operations/audit/audit-roadmap.md](../operations/audit/audit-roadmap.md))
addresses this with **external root anchoring** — periodic signing of
the chain head to an external sink (Axiom, CloudWatch). Not yet
implemented.

---

## Browser storage policy

Full text: [storage-policy.md](storage-policy.md).

### Forbidden

- Passwords, API keys, service-role tokens — never touch browser storage.
- Score data — always fetched fresh; live evaluation days need real-time
  truth.
- Hardcoded storage key strings outside `src/shared/storage/keys.js`.
- Raw `localStorage.setItem()` outside the storage abstraction layer
  (`juryStorage.js`, `adminStorage.js`, `persist.js`).

### Allowed

- User preferences (theme, filter selections, sort order) in localStorage.
- Per-tab ephemeral state (guided tour flags) in sessionStorage.
- Jury access grants (dual-write to both for tab + restart persistence).
- Supabase Auth tokens — SDK-managed only; never read or write directly.

### Server is truth

Browser storage is convenience, not authorization. Jury session tokens,
access grants, and tenant membership are always validated server-side.

---

## Encryption in transit

- TLS via Supabase (database, Realtime, Edge Functions) and Vercel
  (frontend). No application-level TLS configuration; the upstream
  providers handle certificate provisioning and renewal.
- JWT signed by Supabase Auth (HS256 by default; ES256 in some project
  configurations).

## Encryption at rest

- Supabase Postgres uses AWS-level disk encryption for the underlying
  storage. Application-level field encryption is not used.
- PII fields (juror name, last-4 of national ID) are stored in
  plaintext inside the tenant-scoped tables. RLS prevents cross-tenant
  read; database-level read by super-admin is intentional.

---

## Secrets management

- **Supabase keys:** anon key in `VITE_SUPABASE_ANON_KEY` (public,
  safe to bundle); service role key never appears in frontend code.
- **Vault:** `VITE_RPC_SECRET` is dev-only and refers to a Supabase Vault
  secret used by some legacy RPCs. Not required in production deployment.
- **Demo credentials:** `VITE_DEMO_*` env vars carry demo admin email +
  password + entry token. Demo project is intentionally low-stakes; no
  real tenant data lives there.
- **Rotation:** No automated key rotation. Manual rotation requires
  updating Vercel env vars + Supabase project secrets in the same
  window; sessions invalidate on JWT secret rotation.

---

## PII inventory

| Field | Where stored | Tenant-scoped? | Reachable by super-admin? |
| --- | --- | --- | --- |
| Admin name, email | `auth.users`, `profiles` | Yes (via `memberships`) | Yes |
| Juror name | `jurors` | Yes | Yes |
| Juror last-4 national ID | `juror_period_auth` | Yes | Yes |
| Juror affiliation | `jurors` | Yes | Yes |
| Project team member names | `projects` (jsonb) | Yes | Yes |
| Project advisor name | `projects` | Yes | Yes |
| IP address (per audit row) | `audit_logs.ip_address` | Yes (per row's org) | Yes |

**Not stored:** full national ID numbers, dates of birth, addresses,
phone numbers, GPA, academic transcripts, credit card information.

---

## Compliance posture (current state)

- **GDPR / KVKK:** VERA stores PII (juror names, last-4 IDs). A formal
  data retention policy is not yet documented; tenant-initiated PII
  delete is supported via "delete organization" flow but the audit log
  retains the historical actor names (snapshot at write time, not by
  reference).
- **Right to be forgotten:** partially supported — `auth.users` rows
  can be deleted, but `audit_logs.user_id` is currently a hard FK
  preventing user deletion when audit rows exist. The audit roadmap
  item #2 plans `ON DELETE SET NULL` to fix this.
- **Data residency:** depends on the Supabase project region. VERA does
  not pin region; tenant deployments choose their own.
- **SOC 2 / ISO 27001:** not pursued.

---

## Verification at a glance

| Guarantee | How to verify it's still in force |
| --- | --- |
| Tenant isolation | `npm run check:rls-tests` + `e2e/security/tenant-isolation.spec.ts` |
| Admin auth | `src/auth/shared/__tests__/AuthProvider.*.test.jsx` |
| Juror entry token | `e2e/admin/entry-tokens.spec.ts` + `e2e/jury/expired-session.spec.ts` |
| Audit append-only | RLS policies in `004_rls.sql` (manual review) |
| Audit hash chain | Daily `audit_chain_validate` cron |
| RPC contracts | `npm run check:rpc-tests` + `npm run check:db-types` |
| Storage policy | Manual review; no automated check |
| Edge Function authorization | Per-function review; no automated check |

---

## Related

- [decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md)
- [decisions/0004-jury-entry-token.md](../decisions/0004-jury-entry-token.md)
- [architecture/multi-tenancy.md](multi-tenancy.md)
- [architecture/storage-policy.md](storage-policy.md)
- [architecture/edge-functions-kong-jwt.md](edge-functions-kong-jwt.md)
- [operations/audit/audit-coverage.md](../operations/audit/audit-coverage.md)
- [operations/audit/audit-roadmap.md](../operations/audit/audit-roadmap.md)
- [walkthroughs/multi-tenant-data-flow.md](../walkthroughs/multi-tenant-data-flow.md)

---

> *Last updated: 2026-04-24*
