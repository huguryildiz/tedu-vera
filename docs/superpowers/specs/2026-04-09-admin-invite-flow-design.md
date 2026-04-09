# Admin Invite Flow Design

## Summary

Replace the broken admin invitation flow with a modern email-based invite system. Admins enter an email address, the system sends an invite link, and the invitee sets their own password. Existing Supabase Auth users get membership added directly with a notification email.

## Approach

**Email Invite + Self-Service Password** (Option A) — the standard SaaS pattern used by Notion, Linear, Vercel. The inviter never touches the invitee's password. Resend email infrastructure already exists in the codebase.

## UI Design

### Manage Admins Drawer

Three sections in the existing drawer:

**1. Active Members**

- Each row: avatar (initials), display name, email, role badge (`Owner` / `Admin`)
- Owner row has no actions; Admin rows have a `⋯` overflow menu with "Remove" option
- Remove triggers a ConfirmDialog (simple confirmation, not typed)

**2. Pending Invites**

- Each row: mail icon placeholder (no avatar yet), email, "Sent X days ago · Expires in Y days" subtitle, `Pending` badge
- Action buttons: Resend (↻) and Cancel (✕)
- Dashed border to visually distinguish from active members
- Section hidden when no pending invites exist

**3. Invite Input**

- Email input field with mail icon prefix + "Send Invite" button
- Validation: valid email format, not already a member, not already pending
- Success feedback: invite row appears in Pending section with "Just now" timestamp
- Error feedback: FbAlert inline below the input

### Section Labels

- `ACTIVE MEMBERS` — uppercase, muted, small
- `PENDING INVITES` — uppercase, muted, small (conditional)

## Invite Flow

### Scenario 1: New User (email not in auth.users)

1. Admin enters email, clicks "Send Invite"
2. Frontend calls `sendAdminInvite(orgId, email)` API function
3. API calls new RPC `rpc_admin_invite_send(p_org_id, p_email)`
4. RPC validates: caller is org_admin/super_admin for this org, email not already member, no active pending invite for same email+org
5. RPC inserts row into `admin_invites` table (status: `pending`, 7-day expiry, unique token)
6. RPC calls `net.http_post` to trigger new Edge Function `send-admin-invite`
7. Edge Function sends email via Resend with invite link: `{APP_URL}?invite={token}`
8. Invitee clicks link → app detects `?invite=TOKEN` query param
9. App shows "Set Your Password" form (name pre-filled if available, password + confirm)
10. On submit → Edge Function `accept-admin-invite` creates auth user, membership, marks invite accepted
11. Invitee is logged in and redirected to admin panel

### Scenario 2: Existing User (email already in auth.users)

1. Admin enters email, clicks "Send Invite"
2. Same RPC `rpc_admin_invite_send` — detects user exists in `auth.users`
3. RPC directly creates `memberships` row (role: `org_admin`)
4. RPC calls Edge Function `send-admin-invite` with `type: 'added'` (not invite)
5. Email says "You've been added to {org_name}" with a link to the app
6. No password setup needed — user logs in with existing credentials
7. Drawer updates immediately: user appears in Active Members (not Pending)

### Resend Invite

1. Admin clicks ↻ on a pending invite row
2. Calls `resendAdminInvite(inviteId)`
3. RPC generates a new token, resets `expires_at` to now + 7 days, sends new email
4. Old token is invalidated

### Cancel Invite

1. Admin clicks ✕ on a pending invite row
2. ConfirmDialog (simple): "Cancel invite to {email}?"
3. Calls `cancelAdminInvite(inviteId)`
4. RPC sets status to `cancelled`
5. Row removed from Pending section

### Expired Invites

- A scheduled job or on-read check marks invites as `expired` when `expires_at < now()`
- Expired invites are not shown in the drawer (cleaned up)
- If admin tries to invite same email again after expiry, a fresh invite is created

## Data Model

### New Table: `admin_invites`

```sql
CREATE TABLE admin_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- No table-level unique constraint: multiple cancelled/expired rows allowed.
  -- "Only one pending invite per org+email" enforced in rpc_admin_invite_send.
);

CREATE INDEX idx_admin_invites_token ON admin_invites(token) WHERE status = 'pending';
CREATE INDEX idx_admin_invites_org ON admin_invites(org_id) WHERE status = 'pending';
```

### Existing Tables Used

- `organizations` — org_id reference
- `memberships` — role: `org_admin`, created on invite acceptance
- `profiles` — display_name set during password setup
- `auth.users` — checked for existing user detection

## New RPCs

### `rpc_admin_invite_send(p_org_id UUID, p_email TEXT)`

- Auth: JWT, caller must be org_admin or super_admin for p_org_id
- Validates email format, no existing membership, no active pending invite
- Checks if email exists in auth.users:
  - **Yes** → creates membership directly, returns `{ status: 'added', user_id }`. Sends notification email via Edge Function.
  - **No** → inserts admin_invites row, returns `{ status: 'invited', invite_id }`. Sends invite email via Edge Function.

### `rpc_admin_invite_list(p_org_id UUID)`

- Auth: JWT, caller must be org_admin or super_admin
- Returns pending invites for the org (email, created_at, expires_at)

### `rpc_admin_invite_resend(p_invite_id UUID)`

- Auth: JWT, caller must be org_admin or super_admin for the invite's org
- Generates new token, resets expires_at, triggers email

### `rpc_admin_invite_cancel(p_invite_id UUID)`

- Auth: JWT, caller must be org_admin or super_admin for the invite's org
- Sets status to `cancelled`

### `rpc_admin_invite_accept(p_token UUID, p_password TEXT, p_display_name TEXT)`

- Auth: anonymous (invitee doesn't have an account yet)
- Validates token exists, status is pending, not expired
- Creates auth user via service role (Edge Function handles this)
- Creates membership + profile
- Sets invite status to `accepted`

## New Edge Functions

### `send-admin-invite`

- Triggered by RPC via `net.http_post`
- Two email types:
  - `type: 'invite'` → "You've been invited to {org_name}. Click to set your password and join." CTA: `{APP_URL}?invite={token}`
  - `type: 'added'` → "You've been added to {org_name}. Log in to get started." CTA: `{APP_URL}?admin`
- Uses existing `buildHtmlTemplate()` pattern from password-reset-email
- Env vars: `RESEND_API_KEY`, `NOTIFICATION_APP_URL`, `NOTIFICATION_FROM`

### `accept-admin-invite`

- Called from frontend when invitee submits password form
- Receives: `{ token, password, display_name }`
- Uses service role to:
  1. Validate invite token (pending, not expired)
  2. Create auth user with `auth.admin.createUser()`
  3. Create membership row
  4. Create profile row
  5. Mark invite as accepted
- Returns session token so invitee is immediately logged in

## Frontend Changes

### New Query Param Handler

In `App.jsx`, detect `?invite=TOKEN`:

- Show `InviteAcceptPage` component
- Form: display name input, password input (with PasswordStrengthInput), confirm password
- On submit: call `accept-admin-invite` Edge Function
- On success: redirect to admin panel (logged in)
- On error (expired/invalid): show message with option to request new invite

### API Layer

New functions in `src/shared/api/admin/organizations.js`:

- `sendAdminInvite(orgId, email)` → calls `rpc_admin_invite_send`
- `listAdminInvites(orgId)` → calls `rpc_admin_invite_list`
- `resendAdminInvite(inviteId)` → calls `rpc_admin_invite_resend`
- `cancelAdminInvite(inviteId)` → calls `rpc_admin_invite_cancel`
- `acceptAdminInvite(token, password, displayName)` → calls `accept-admin-invite` Edge Function

### Hook Changes

`useManageOrganizations.js`:

- Add `invites` state (loaded via `listAdminInvites`)
- Add `handleSendInvite(email)` — calls API, refreshes invite list
- Add `handleResendInvite(inviteId)` — calls API, refreshes
- Add `handleCancelInvite(inviteId)` — calls API with ConfirmDialog, refreshes
- Remove old `handleCreateTenantAdminApplication` and related password fields

### Drawer Changes

`ManageOrganizationsPanel.jsx` (or new `ManageAdminsDrawer.jsx`):

- Render Active Members section from existing memberships data
- Render Pending Invites section from `invites` state
- Render Invite input with email validation
- Wire up resend/cancel buttons

## Migration

File: `sql/migrations/012_admin_invites.sql`

Contents:

- `admin_invites` table creation
- RPCs: `rpc_admin_invite_send`, `rpc_admin_invite_list`, `rpc_admin_invite_resend`, `rpc_admin_invite_cancel`
- Helper for invite acceptance (token validation + status update)
- Drop or deprecate old `tenant_admin_applications` related RPCs if no longer needed

## Email Templates

Both emails use the existing `buildHtmlTemplate()` pattern:

### Invite Email

- Subject: "You're invited to join {org_name} on VERA"
- Body: "{inviter_name} has invited you to manage {org_name}. Click below to set your password and get started."
- CTA: "Accept Invite" → `{APP_URL}?invite={token}`

### Added Email

- Subject: "You've been added to {org_name} on VERA"
- Body: "You now have admin access to {org_name}. Log in to get started."
- CTA: "Go to VERA" → `{APP_URL}?admin`

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid email format | Inline validation, button disabled |
| Email already a member | FbAlert: "This email is already a member of this organization" |
| Pending invite exists | FbAlert: "An invite is already pending for this email. Resend it instead." |
| Invite link expired | InviteAcceptPage shows expiry message + "Request a new invite from your admin" |
| Invite link invalid/cancelled | InviteAcceptPage shows invalid message |
| Email delivery fails | RPC succeeds (invite row created), admin can resend later |
| Rate limiting | Max 10 invites per org per hour (enforced in RPC) |

## Security

- Invite tokens are UUID v4 (cryptographically random)
- Tokens are single-use (status changes on accept)
- 7-day expiry enforced at both DB level and acceptance time
- Only org_admin/super_admin can send/resend/cancel invites
- Invite acceptance is anonymous but token-gated
- Rate limiting: 10 invites per org per hour to prevent abuse
- RLS: admin_invites readable only by org admins of the same org
