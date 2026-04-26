# Tenant Onboarding

**Scenario.** A new university wants to use VERA. Someone fills out the "Apply
for VERA" form on the landing page. A super-admin reviews the application,
approves it, and within seconds a new organization is provisioned with a
tenant-admin Supabase Auth user. The new tenant-admin receives an invite
email, signs in, and walks through the setup wizard to configure their first
evaluation period.

For *why* tenancy is enforced this way, see
[decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md) and
[architecture/multi-tenancy.md](../architecture/multi-tenancy.md).

---

## Actors

| Actor | Identity | Role |
| --- | --- | --- |
| Anonymous applicant | Email only, no account | Submits the application form. |
| Super-admin | Supabase Auth user with `memberships.organization_id IS NULL` | Reviews and approves applications. |
| Edge Function (`process-tenant-application`) | Service role | Provisions Auth user + organization + membership in one transaction. |
| New tenant-admin | Newly created Supabase Auth user | Receives invite, completes profile, runs setup wizard. |

---

## Application (T+0)

### 1. Applicant fills the form

On the landing page, the applicant clicks "Apply for VERA" and provides:
organization name, contact name, contact email, brief description.

- **Component:** [LandingPage](../../src/landing/LandingPage.jsx) → application
  drawer.
- **RPC (anonymous):** `rpc_public_submit_org_application(...)` — writes to
  `public.org_applications` with status `pending`.
- **Audit event:** `application.submitted` with
  `{ applicant_email, applicant_org_name }`.

The applicant sees a confirmation. No account is created at this point — the
record sits in `org_applications` awaiting review.

---

## Review (T+0..72h)

### 2. Super-admin reviews

The super-admin opens
[Organizations page](../../src/admin/features/organizations/OrganizationsPage.jsx)
→ "Pending Applications" tab.

- **Page:** sees the application with submitted metadata and an Approve /
  Reject pair of actions.
- **Filter context:** super-admins can see all `org_applications` regardless
  of `organization_id` (which is `NULL` on a pending record).

### 3. Approval — happy path

The super-admin clicks "Approve". A drawer prompts for: organization slug,
tenant-admin email (defaults to applicant email, editable), and any
overrides.

- **Edge Function:** `process-tenant-application` (POST, custom-auth pattern
  from [edge-functions-kong-jwt.md](../architecture/edge-functions-kong-jwt.md)).
  In one transaction, the function:
  1. Verifies super-admin status server-side (re-checks `memberships`).
  2. Creates a Supabase Auth user with `email_confirm = false`.
  3. Inserts a row into `public.organizations`.
  4. Inserts a `memberships` row pointing the new user at the new org with
     `is_pending = false`.
  5. Updates `org_applications` row to `status = 'approved'`.
  6. Sends the invite email via Supabase Auth → Edge Function template
     (`email-notifications` pipeline — see
     [architecture/email-notifications.md](../architecture/email-notifications.md)).
- **Audit event:** `application.approved` with
  `{ applicant_email, organization_id }`.
- **Test:** [`e2e/admin/tenant-application.spec.ts`](../../e2e/admin/tenant-application.spec.ts) +
  [`e2e/auth/tenant-application-full.spec.ts`](../../e2e/auth/tenant-application-full.spec.ts).

### 3a. Rejection — alternate path

If the super-admin rejects: the row is updated to `status = 'rejected'`, no
Auth user is created, the applicant receives a courteous rejection email.

- **Audit event:** `application.rejected` with
  `{ applicant_email, reason? }`.

---

## First sign-in (T+approval+~5min)

### 4. Tenant-admin opens invite link

The invite email contains a magic-link to `/invite/accept?token=<...>`.

- **Component:** [InviteAcceptScreen](../../src/auth/features/invite/InviteAcceptScreen.jsx).
- **Token validation:** Supabase Auth's built-in invite token flow. On
  success, the user is redirected to set a password.

### 5. Set password

After setting password, the user is signed in.
[`AuthProvider`](../../src/auth/shared/AuthProvider.jsx) resolves the session,
fetches `memberships`, finds an active row pointing at the new organization.

- **Tests:** [`src/auth/shared/__tests__/AuthProvider.test.jsx`](../../src/auth/shared/__tests__/AuthProvider.test.jsx).

### 6. Profile completion (Google OAuth users only)

If the tenant-admin chose to sign in with Google later (rather than the
email+password invite path), [`CompleteProfileScreen`](../../src/auth/features/complete-profile/CompleteProfileScreen.jsx)
prompts for any missing profile fields. Skipped for the standard invite path.

---

## Setup wizard (T+first-login)

### 7. AdminRouteLayout decides what to render

[`AdminRouteLayout`](../../src/layouts/AdminRouteLayout.jsx) checks
`organizations.setup_completed_at`:

- `NULL` → render the setup wizard.
- non-`NULL` → render the standard admin shell.

### 8. Six-step wizard

The wizard collects: framework choice (MÜDEK / ABET / custom), evaluation
period naming, criteria/outcome configuration, juror import (optional at
this stage), settings.

- **Component family:** [`src/admin/features/setup-wizard/`](../../src/admin/features/setup-wizard/)
  with steps under `setup-wizard/steps/`.
- **Test:** [`e2e/admin/setup-wizard.spec.ts`](../../e2e/admin/setup-wizard.spec.ts).
- On finish, the wizard sets `organizations.setup_completed_at = now()` and
  redirects to `/admin/overview`.

---

## Failure modes

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Application form returns 401 | RLS rejected the anonymous insert | `org_applications` RLS policy in `004_rls.sql` |
| Approval fails halfway through (org created, user not) | Edge Function transaction rolled back partially | Edge Function logs (`get_logs service=edge-function`); check for service-role connection issues |
| Invite email never arrives | Supabase Auth email template misconfigured, or domain blocking the sender | Auth → Email Templates in Supabase dashboard; check spam folder |
| New tenant-admin sees "Pending" screen instead of admin shell | `memberships.is_pending = true` (wrong default) | `memberships` row in DB |
| Setup wizard step 2 fails to save | Period CRUD RPC rejected | Postgres logs (`get_logs service=postgres`); check `setup_completed_at` constraints |

A consolidated incident response playbook will live in
`docs/operations/runbooks/` (planned, Session 4).

---

## Related

- [decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md)
- [architecture/multi-tenancy.md](../architecture/multi-tenancy.md)
- [architecture/email-notifications.md](../architecture/email-notifications.md)
- [architecture/edge-functions-kong-jwt.md](../architecture/edge-functions-kong-jwt.md)
- [audit-trail-walkthrough.md](audit-trail-walkthrough.md)

---

> *Last updated: 2026-04-24*
