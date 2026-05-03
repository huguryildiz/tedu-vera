# Runbook — Auth Outage

> _Last updated: 2026-04-28_

**Use when:** admins cannot sign in to `/admin`, or sign-in succeeds but
the admin dashboard never loads (stuck on spinner, redirected to
`/register`, or stuck on the pending-review screen).

Distinct from [demo-seed-broken.md](demo-seed-broken.md), which only
covers the demo environment.

---

## Triage in 60 seconds

| Symptom | Most likely cause | First action |
| --- | --- | --- |
| Login form rejects valid password | Auth user not confirmed, or rate-limited | Check `auth.users.email_confirmed_at`; check Auth logs for rate-limit hits |
| Login succeeds → redirected to `/register` | No `memberships` row for the user | Check `memberships`; insert if missing |
| Login succeeds → "Pending review" screen | `memberships.is_pending = true` | Approve via Organizations page or update DB row |
| Login succeeds → stuck on spinner | Edge Function failing on session-touch / role-check | Check `admin-session-touch` Edge Function logs |
| All admins locked out simultaneously | Supabase Auth outage, or RLS regression on `memberships` | Check Supabase status; check `004_rls.sql` against current DB |
| Google OAuth fails | OAuth callback URL drift, secret rotation, or first-time profile incomplete | Check Supabase Auth → Providers → Google; check `CompleteProfileScreen` flow |

---

## Step 1 — Identify the failure layer

Sign-in is a chain. Each link can fail independently:

```
1. User submits credentials
       │
       ▼
2. Supabase Auth validates → issues JWT
       │
       ▼
3. AuthProvider fetches profile + memberships
       │
       ▼
4. AdminRouteLayout decides which screen to render
       │
       ▼
5. Admin shell loads → admin-session-touch Edge Function fires
       │
       ▼
6. Dashboard renders (RPC calls succeed)
```

Identify the highest-numbered link that succeeded. Where it fails is your
diagnosis target.

---

## Step 2 — Per-layer diagnosis

### Layer 2 — Supabase Auth rejects credentials

**Check:** Supabase dashboard → Auth → Logs.

Common causes:

- **Rate limit hit.** Multiple failed sign-ins from one IP. Supabase
  rate-limits aggressively. Wait 15 minutes or whitelist the IP.
- **Email not confirmed.** If `email_confirmed_at IS NULL`, the user must
  click the verification link first. For invited users, the invite link
  confirms the email automatically; for self-registrations, they need
  the verification email.
- **Password actually wrong.** Use the password-reset flow.

Audit event written by the function: `auth.admin.login.failure` with
`{ email }`. The presence of this row confirms Supabase Auth rejected
(rather than the request never reaching Auth).

### Layer 3 — AuthProvider fetches memberships

**Check:** browser console + Network panel.

- 200 OK on the memberships fetch but result is empty → user has no
  membership; they will be redirected to `/register` (the
  CompleteProfile flow). Insert a `memberships` row pointing at the
  correct organization, or have the user re-register.
- 401 / 403 → JWT is invalid; check Supabase Auth → Settings →
  JWT secret rotation. If the secret was rotated, every existing session
  is invalidated; users must sign in again.
- Network error → `VITE_SUPABASE_URL` may be wrong in the deployed
  build; check Vercel environment variables.

### Layer 4 — AdminRouteLayout decision

[`AdminRouteLayout`](../../../src/layouts/AdminRouteLayout.jsx) chooses
between three screens based on auth state:

| Memberships row | `is_pending` | Screen |
| --- | --- | --- |
| missing | n/a | CompleteProfile (Google OAuth path) or `/register` |
| present | `true` | PendingReviewScreen |
| present | `false` | Admin shell |

If a known-good user sees the wrong screen, check the actual `memberships`
row:

```sql
SELECT user_id, organization_id, is_pending, role, created_at
FROM   memberships
WHERE  user_id = '<auth.uid()>';
```

### Layer 5 — admin-session-touch fails

The admin shell pings `admin-session-touch` Edge Function on every load
to refresh activity tracking.

**Check:**

```
mcp call get_logs service=edge-function
```

- `execution_time_ms ≈ 0` → Kong pre-rejected. ES256 JWT issue. See
  [architecture/edge-functions-kong-jwt.md](../../architecture/edge-functions-kong-jwt.md);
  the function should have `verify_jwt: false` + custom auth.
- 5xx with `>50ms` → function-internal. Stack trace in the log body.
- The shell tolerates this Edge Function being slow but not outright
  failing — if it 5xx's, the dashboard may stay on the spinner.

### Layer 6 — Dashboard RPC calls fail

Once the shell renders, individual page RPCs may fail:

- `permission_denied` → `_assert_tenant_admin()` rejected. Either the
  user's membership row was deleted mid-session, or RLS regression on
  `memberships`. See
  [decisions/0003-jwt-admin-auth.md](../../decisions/0003-jwt-admin-auth.md).
- `function not found` → migration partially applied. Match the missing
  function name against `006a_rpcs_admin.sql` / `006b_rpcs_admin.sql`
  and confirm the function exists in `pg_proc`.

---

## Step 3 — All admins locked out simultaneously

If multiple admins report inability to sign in within minutes of each
other, this is platform-wide:

1. **Check Supabase status** — `https://status.supabase.com`. If red,
   wait it out.
2. **Check the most recent migration.** Did an RLS change to
   `memberships` ship in the last hour? Roll it back if so.
3. **Check the JWT secret rotation log.** Recently rotated secrets
   invalidate every existing session.
4. **Check Vercel deploy log.** Did `VITE_SUPABASE_*` env vars change?
5. As a last resort, redeploy the previous known-good Vercel build via
   "Promote to production" from the deployments list.

---

## Google OAuth specific

If only Google OAuth is failing while email+password works:

1. Supabase dashboard → Auth → Providers → Google. Check that the
   client ID and secret match the Google Cloud Console values.
2. Verify the **redirect URL** at Google Cloud Console matches
   `https://<vera-prod-ref>.supabase.co/auth/v1/callback` (or demo
   equivalent).
3. If a first-time Google user is stuck on `CompleteProfileScreen` →
   the profile-completion form is failing to save. Check the
   `rpc_admin_complete_profile` Postgres logs for SQL errors.

---

## After the outage

1. **Audit log review.** Use the Audit Log page to see what fired and
   what didn't during the outage window. `auth.admin.login.failure`
   counts spike during outages.
2. **Post-mortem.** Write a summary and link it from the relevant issue or PR.
3. **Add monitoring** if the incident exposed a blind spot — see
   [audit/audit-roadmap.md](../audit/audit-roadmap.md) for the queued
   improvements (external root anchoring, sink reliability).

---

## Related

- [decisions/0003-jwt-admin-auth.md](../../decisions/0003-jwt-admin-auth.md)
- [architecture/multi-tenancy.md](../../architecture/multi-tenancy.md)
- [architecture/edge-functions-kong-jwt.md](../../architecture/edge-functions-kong-jwt.md)
- [walkthroughs/tenant-onboarding.md](../../walkthroughs/tenant-onboarding.md)

---
