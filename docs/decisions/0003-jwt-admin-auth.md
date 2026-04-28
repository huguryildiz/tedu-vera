# 0003 — JWT-based admin auth with legacy v1 coexistence

**Status:** Accepted
**Date:** 2026-04-24

## Context

VERA originally shipped with a custom password-based admin login (referred to
internally as "v1"). That model used SQL functions (`rpc_admin_*` accepting a
shared admin password) and stored a derived token in browser storage. It was
single-tenant by assumption and predates the platform's multi-tenant design.

When the project moved to multi-tenancy, the auth model needed to support:

- Multiple distinct tenant admins, each scoped to their organization.
- Super-admins who can act across all tenants.
- Google OAuth for tenant administrators.
- Pending-review and complete-profile flows for new sign-ups.
- An attribution chain that lets every admin RPC verify the caller's identity
  and tenant scope.

A clean break from v1 to a Supabase Auth + JWT model would require migrating
every existing admin user and rewriting every legacy RPC simultaneously.

## Decision

**Admin auth uses Supabase Auth + JWT for all new flows.** New admin RPCs are
named `rpc_admin_*` and call `_assert_tenant_admin()` to verify the caller's
JWT and tenant membership. Tenant scope comes from the `memberships` table:
super-admin has `organization_id IS NULL`; tenant-admin has a row pointing at
their organization.

Legacy v1 password RPCs are retained **only for backward compatibility** with
the original admin user pool that has not yet migrated. They are not used by
new feature work and are subject to removal once the migration is complete.

## Consequences

**Positive**

- Tenant isolation is enforced at the SQL layer via JWT claim verification,
  not by client trust.
- Standard Supabase tooling (RLS policies, JWT helpers, Auth UI) becomes
  available.
- Google OAuth integration uses the platform's first-class flow rather than a
  custom layer.

**Negative**

- Two parallel auth systems coexist; a developer must know which RPC family
  to call from a given page. New code uses the JWT family; legacy maintenance
  occasionally still touches v1.
- The v1 RPCs cannot be removed until every legacy user has migrated, which
  is not yet scheduled.
- Edge functions face a Kong JWT gate that rejects ES256 tokens in some
  Supabase project configurations — see
  [architecture/edge-functions-kong-jwt.md](../architecture/edge-functions-kong-jwt.md).

## Alternatives considered

- **Big-bang migration to JWT.** Rejected because the v1 user pool predates
  email-verified Supabase Auth identities and migrating would force every
  admin to reset their credentials in a single step, on a live tenant.
- **Custom JWT-like layer instead of Supabase Auth.** Rejected because it
  reintroduces the v1 problem — every audit, OAuth integration, and RLS
  helper would need its own implementation.

## Verification

How we know this decision is still in force:

- **Audit events** (defined in `src/admin/utils/auditUtils.js`, persisted to
  `audit_logs`):
  - `auth.admin.login.success` — admin signed in (records sign-in method).
  - `auth.admin.login.failure` — failed sign-in attempt (records target
    email).
  - `auth.admin.password.changed` — password change recorded.
  - `application.submitted` / `application.approved` /
    `application.rejected` — tenant onboarding decisions.
  - Cross-tenant access attempts produce no event because RLS denies them at
    the SQL layer; the absence of a row *is* the signal.
- **Tests:**
  - [`src/auth/shared/__tests__/AuthProvider.test.jsx`](../../src/auth/shared/__tests__/AuthProvider.test.jsx)
    — email/password login, tenant membership resolution, super-admin path.
  - [`src/auth/shared/__tests__/AuthProvider.googleOAuth.test.jsx`](../../src/auth/shared/__tests__/AuthProvider.googleOAuth.test.jsx)
    — Google OAuth flow + `CompleteProfileForm` for new users.
  - [`src/shared/api/__tests__/admin/auth.test.js`](../../src/shared/api/__tests__/admin/auth.test.js)
    — admin RPC wrappers reject calls without a JWT.
  - [e2e/security/tenant-isolation.spec.ts](../../e2e/security/tenant-isolation.spec.ts)
    — a tenant-admin cannot read another tenant's data via URL manipulation.
  - [sql/tests/rls/](../../sql/tests/rls/) — pgTAP suite asserts every
    isolated table denies cross-tenant SELECT to non-super-admins
    (`jurors_isolation.sql`, `org_applications_isolation.sql`, etc.).
- **Drift sentinels:** `npm run check:rls-tests`, `npm run check:rpc-tests`,
  `npm run check:db-types` — fail CI if RLS/RPC/type contracts drift.

---
