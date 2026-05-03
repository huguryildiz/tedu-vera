# Multi-Tenancy

> _Last updated: 2026-05-03_

VERA is a multi-tenant SaaS. Every record belongs to an organization (a
"tenant"); every admin action is performed in the context of one tenant; every
read or write is bound by RLS to the caller's tenant scope. This document
walks through how tenancy is modeled, resolved, and enforced.

For the *why* behind specific choices, see
[decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md) and
[decisions/0004-jury-entry-token.md](../decisions/0004-jury-entry-token.md).

---

## Roles

Two admin roles, distinguished by a single column:

| Role | `memberships.organization_id` | Scope |
| --- | --- | --- |
| Super-admin | `IS NULL` | Full platform — all tenants, all settings. |
| Tenant-admin | A specific organization's UUID | Only that organization's data. |

A super-admin row exists once per super-admin user. A tenant-admin user has
one membership row per organization they administer (typically one).

Jurors are not admins. They have no `memberships` row; their access is bound
by an entry token rather than a JWT identity.

---

## Identity sources

| Identity | Mechanism | Where it lives |
| --- | --- | --- |
| Super-admin | Supabase Auth user + `memberships` row with `organization_id IS NULL` | `auth.users`, `public.memberships` |
| Tenant-admin | Supabase Auth user + `memberships` row pointing at an org | `auth.users`, `public.memberships`, `public.organizations` |
| Juror | Server-issued session token, no Auth identity | `public.juror_sessions`, browser storage |
| Anonymous tenant applicant | Email + form submission, no account | `public.org_applications` |

---

## Tenant resolution

How the system determines "which tenant am I working with?" depends on the
caller:

### Admin (JWT-based)

1. The admin signs in via Supabase Auth (email/password or Google OAuth).
   See [`src/auth/shared/AuthProvider.jsx`](../../src/auth/shared/AuthProvider.jsx).
2. The Auth session yields a JWT with the user's `auth.uid()`.
3. On admin RPC calls, the SQL helper `_assert_tenant_admin()` reads
   `auth.uid()`, looks up `memberships.organization_id`, and returns it as
   the active tenant scope. RPCs reject if no membership row exists.
4. RLS policies on tenant tables filter rows by `organization_id` matching
   the caller's resolved scope, with a super-admin bypass for `NULL` scope.

### Juror (token-based)

1. The juror reaches `/eval` with an entry token in the URL or QR.
2. The server validates the token against `public.entry_tokens`, which
   carries `period_id`. The period's `organization_id` is the tenant.
3. Tenant identity is **implicit** — derived server-side from the token, not
   accepted from the client. A juror cannot spoof a tenant by manipulating
   client state.
4. The juror's session token is bound to that tenant for its lifetime.

### Anonymous applicant

1. The "Apply for VERA" form on the landing page accepts email + organization
   metadata with no auth.
2. The submission lands in `public.org_applications` with status `pending`.
3. A super-admin reviews; on approval, an Edge Function provisions a Supabase
   Auth user, an `organizations` row, and a `memberships` row in one
   transaction.
4. The new tenant-admin receives an invite email and joins via the standard
   admin flow.

---

## Sign-in flow (admin)

```
                                  ┌──────────────────────────────┐
                                  │  /login (email+password)     │
                                  │  /login (Google OAuth)       │
                                  └────────────┬─────────────────┘
                                               │ Supabase Auth issues JWT
                                               ▼
                                  ┌──────────────────────────────┐
                                  │  AuthProvider.useAuth()      │
                                  │  resolves user + memberships │
                                  └────────────┬─────────────────┘
                                               ▼
            ┌──────────────────────────────────┴─────────────────────────────────┐
            │                                  │                                 │
       no membership                  membership.is_pending = true         active membership
            │                                  │                                 │
            ▼                                  ▼                                 ▼
   ┌────────────────────┐           ┌──────────────────────┐           ┌──────────────────────┐
   │ CompleteProfileForm│           │ PendingReviewScreen  │           │ /admin/overview      │
   │ (Google OAuth      │           │ (super-admin must    │           │ (full admin shell)   │
   │  first-time users) │           │  approve)            │           │                      │
   └────────────────────┘           └──────────────────────┘           └──────────────────────┘
```

Component locations:

- [`src/auth/shared/AuthProvider.jsx`](../../src/auth/shared/AuthProvider.jsx)
  — top-level auth state.
- [`src/auth/features/complete-profile/CompleteProfileScreen.jsx`](../../src/auth/features/complete-profile/CompleteProfileScreen.jsx)
  — Google-OAuth first-login profile completion.
- [`src/auth/features/pending-review/PendingReviewScreen.jsx`](../../src/auth/features/pending-review/PendingReviewScreen.jsx)
  — gate for users awaiting super-admin approval.
- [`src/layouts/AdminRouteLayout.jsx`](../../src/layouts/AdminRouteLayout.jsx)
  — chooses which screen renders based on auth + membership state.

---

## RLS enforcement

Every tenant-scoped table has RLS policies that filter by
`organization_id` matching the caller's resolved tenant. The policies use
helpers defined in `sql/migrations/003_helpers_and_triggers.sql`:

```sql
-- Sketch of the canonical pattern:
CREATE POLICY tenant_select_own ON jurors
  FOR SELECT USING (
    organization_id = current_admin_org_id()  -- tenant-admin path
    OR is_super_admin()                       -- super-admin bypass
  );
```

The pgTAP suite under [`sql/tests/rls/`](../../sql/tests/rls/) asserts that
each isolated table denies cross-tenant SELECT to non-super-admins. New
tenant-scoped tables must add a matching pgTAP test, and `npm run check:rls-tests`
fails CI if a table has no test.

---

## Edge function patterns

Edge functions that need to act on behalf of a user, but cannot rely on the
PostgREST JWT path (because Kong rejects ES256 in some project
configurations), follow this pattern:

1. Set `verify_jwt: false` in `config.toml`.
2. Inside the function, validate the token with `auth.getUser(token)` —
   tolerates ES256.
3. Look up `memberships` for the resolved user.
4. Use the service role for the actual DB operation, but reject the request
   if the membership lookup says the user has no permission.

See [edge-functions-kong-jwt.md](edge-functions-kong-jwt.md) for the full
pattern and reference implementations.

---

## Cross-tenant safety guarantees

| Threat | Defense |
| --- | --- |
| Tenant-admin browses to another tenant's URL | RLS denies cross-tenant SELECT. The page either renders empty or 404s. Tested in [e2e/security/tenant-isolation.spec.ts](../../e2e/security/tenant-isolation.spec.ts). |
| Tenant-admin manipulates `organization_id` in a request body | Admin RPCs derive tenant from JWT, ignore client-supplied org IDs. |
| Juror token leaks | Token is revocable; admin uses the kebab menu on the entry-token row to revoke. Audit event `token.revoke` records the action. |
| New super-admin elevation | Super-admin status is granted only by editing `memberships` directly via SQL — there is no admin UI for it. Intentional friction. |
| Edge function bypass | All tenant-scoped Edge Functions re-check membership server-side; service-role queries do not skip the membership check. |

---

## Auditing tenant-scoped actions

Tenant-scoped actions write rows to `public.audit_logs` with the acting
admin's `organization_id`. Super-admin actions on a specific tenant carry
that tenant's `organization_id`; platform-wide super-admin actions carry
`NULL`.

The audit-event taxonomy lives in
[`src/admin/utils/auditUtils.js`](../../src/admin/utils/auditUtils.js); the
human-readable rendering is documented in
[../operations/audit/audit-event-messages.md](../operations/audit/audit-event-messages.md).

---

## What this document does *not* cover

- **Billing per tenant.** Not yet implemented — VERA is currently free for
  approved tenants.
- **Tenant data export / deletion.** A delete-organization flow exists; data
  export per tenant is partially covered by analytics export but not as a
  formal "tenant offboarding" feature.
- **Cross-tenant analytics.** Super-admins can see platform metrics
  (`platform-metrics` Edge Function) but cannot join data across tenants in
  the application layer.

---
