# Email Notifications

> _Last updated: 2026-05-03_

VERA sends transactional emails through [Resend](https://resend.com) via Supabase Edge Functions.
All functions live under `supabase/functions/` and are deployed to both **vera-prod** and **vera-demo**.

---

## Environment Variables

Set these in the Supabase dashboard under **Settings → Edge Functions → Secrets** for each project.

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key — emails will not send without this |
| `NOTIFICATION_FROM` | No | Sender address. Default: `VERA <noreply@vera-eval.app>` |
| `NOTIFICATION_LOGO_URL` | No | Logo image URL embedded in emails. Falls back to `https://vera-eval.app/vera_logo_dark.png` |
| `NOTIFICATION_APP_URL` | No | Portal URL used for CTA links (e.g. `https://vera-eval.app`) |
| `SUPABASE_URL` | Auto | Injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Injected by Supabase runtime |

---

## Logo

The logo is served from `public/vera_logo_dark.png` at `https://vera-eval.app/vera_logo_dark.png`.
This path is stable (no Vite content hash) because it lives in `public/`, not `src/assets/`.

All functions check `NOTIFICATION_LOGO_URL` first; if empty, the hardcoded public URL is used as fallback.

---

## Email Functions

### 1. `invite-org-admin`

Invites a new user to join an organization as an admin. Sends a Supabase native invite
email with an accept link. If the user already has a VERA account, adds them directly
without sending an email.

**Payload:**

```json
{
  "organizationId": "uuid",
  "email": "newadmin@tedu.edu.tr",
  "displayName": "Dr. Mehmet Yılmaz"
}
```

---

### 2. `password-reset-email`

Generates a Supabase password recovery link via the admin API and sends a branded
reset email. Called from the admin's "Forgot Password" flow.

**Payload:**

```json
{
  "email": "admin@tedu.edu.tr"
}
```

---

### 3. `password-changed-notify`

Notifies a user that their password was successfully changed.

**Payload:**

```json
{
  "recipientEmail": "admin@tedu.edu.tr",
  "displayName": "Dr. Mehmet Yılmaz"
}
```

---

### 4. `send-juror-pin-email`

Sends a juror their newly generated or reset PIN. Optionally includes a QR code
and "Join Evaluation" button if an entry token URL is provided.

**Payload:**

```json
{
  "recipientEmail": "juror@tedu.edu.tr",
  "jurorName": "Dr. Ayşe Kaya",
  "pin": "4821",
  "jurorAffiliation": "Electrical Engineering",
  "organizationName": "TED University",
  "periodName": "EE 492 — Spring 2026",
  "tokenUrl": "https://vera-eval.app?eval=TOKEN"
}
```

---

### 5. `send-entry-token-email`

Sends an evaluation access link (QR token URL) to a recipient. Includes a scannable
QR code and a direct "Join Evaluation" button. Called from the admin Entry Control page.

**Payload:**

```json
{
  "recipientEmail": "juror@tedu.edu.tr",
  "tokenUrl": "https://vera-eval.app?eval=TOKEN",
  "expiresIn": "2h 30m left",
  "periodName": "EE 492 — Spring 2026",
  "organizationName": "TED University"
}
```

---

### 6. `request-pin-reset`

Sent to the organization's admins when a juror is locked out after too many failed
PIN attempts. Super admins are CC'd when the `ccOnPinReset` security policy is on (default: true).

**Payload:**

```json
{
  "periodId": "uuid",
  "jurorName": "Dr. Ayşe Kaya",
  "affiliation": "Electrical Engineering",
  "message": "I forgot my PIN — please reset it."
}
```

---

### 7. `request-score-edit`

Sent to the organization's admins when a juror who has already submitted their scores
requests the ability to edit them. Validates the juror's session token before sending.

**Payload:**

```json
{
  "periodId": "uuid",
  "jurorName": "Dr. Ayşe Kaya",
  "affiliation": "Electrical Engineering",
  "sessionToken": "..."
}
```

---

### 8. `send-export-report`

Sends an evaluation report file (XLSX, CSV, or PDF) as an email attachment to one or
more recipients. Called from the admin Send Report dialog.

**Payload:**

```json
{
  "recipients": ["dean@tedu.edu.tr"],
  "fileName": "VERA_Rankings_TEDU_Spring-2026.xlsx",
  "fileBase64": "...",
  "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "reportTitle": "Score Rankings",
  "periodName": "Spring 2026",
  "organization": "TED University",
  "department": "Electrical & Electronics Eng.",
  "message": "Please review before Monday's meeting.",
  "senderName": "Dr. Mehmet Yılmaz",
  "ccSenderEmail": "mehmet@tedu.edu.tr"
}
```

---

### 9. `notify-maintenance`

Sends a scheduled maintenance notice to all org admin users. Called by the super admin
from the Maintenance Mode panel.

**Payload:**

```json
{
  "startTime": "April 5, 2026 at 02:00 AM PDT",
  "endTime": "April 5, 2026 at 04:00 AM PDT",
  "message": "Scheduled database maintenance. Platform temporarily unavailable."
}
```

---

### 10. `email-verification-send`

Issues a single-use email verification token and sends a branded verification email.
Used during registration / register-from-application and when an admin re-requests
verification from the unverified-banner.

**Payload:**

```json
{
  "email": "newadmin@tedu.edu.tr",
  "displayName": "Dr. Mehmet Yılmaz"
}
```

---

### 11. `email-verification-confirm`

Validates the token from the verification link and marks the user's email as
verified. Writes a corresponding `auth.email.verified` audit row (fire-and-forget —
audit failure does not break verification). Called by the `/verify-email` route.

**Payload:**

```json
{
  "token": "..."
}
```

---

### 12. `notify-juror`

Generic juror-facing notification dispatcher. Used by admin flows that need to
inform a juror of an event (e.g. score-edit window opened, evaluation reopened).

**Payload:** event-typed; see `supabase/functions/notify-juror/index.ts` for the
schema variants.

---

### 13. `notify-unlock-request`

Sent to org admins when a juror or peer admin requests that a locked period be
unlocked for editing. Surfaces the request in the Unlock Requests panel and via email.

**Payload:**

```json
{
  "periodId": "uuid",
  "requesterName": "Dr. Ayşe Kaya",
  "reason": "Need to correct a juror's mis-entered score before publication."
}
```

---

## Security Policy CC Flags

Several functions respect CC flags stored in the `security_policy` table.
These are checked via the shared helper `supabase/functions/_shared/super-admin-cc.ts`.

| Policy Flag | Default | Affects |
|---|---|---|
| `ccOnPinReset` | `true` | `request-pin-reset` |
| `ccOnScoreEdit` | `false` | `request-score-edit` |
| `ccOnTenantApplication` | `true` | (reserved — flag is read by the Settings UI but no current Edge Function consumes it; tenant application emails were retired with the legacy `notify-application` function) |

---

## Email Preview

All email templates can be previewed locally by opening:

```text
supabase/functions/_preview/email-preview.html
```

This is a standalone HTML file with tab-based navigation — no server required.
Open it directly in a browser.

| Tab | Function |
|---|---|
| Password Reset | `password-reset-email` |
| Password Changed | `password-changed-notify` |
| Email Verification | `email-verification-send` |
| Juror PIN | `send-juror-pin-email` |
| Entry Token | `send-entry-token-email` |
| Export Report | `send-export-report` |
| Maintenance Notice | `notify-maintenance` |
| PIN Reset Request | `request-pin-reset` |
| Score Edit Request | `request-score-edit` |
| Unlock Request | `notify-unlock-request` |
| Org Admin Invite | `invite-org-admin` |

---

## Shared Helpers

**`supabase/functions/_shared/super-admin-cc.ts`**

Provides two helpers used by functions that need to CC super admins:

- `getSuperAdminEmails(client)` — returns all super admin email addresses
- `shouldCcOn(client, flag)` — reads a boolean flag from the `security_policy` table

When deploying functions that use these helpers via the Supabase MCP tool, the cross-directory
import `../_shared/super-admin-cc.ts` cannot be resolved by the bundler. In that case, inline
the helper functions directly into `index.ts` for deployment. The source file remains canonical
at `supabase/functions/_shared/super-admin-cc.ts`.

---

## Deployment

Both **vera-prod** and **vera-demo** must be kept in sync — every function
deployment is done twice via the Supabase MCP, once per project ref. A function
present in vera-prod but missing in vera-demo will silently fail in the demo
environment.

**Auth posture varies per function** (see each function's `config.toml`):

- `verify_jwt = false` — Kong skips JWT validation; the function does its own auth
  (session token, service role check, custom token). Used by:
  `admin-session-touch`, `email-verification-confirm`, `invite-org-admin`,
  `log-export-event`, `send-juror-pin-email`.
- Default (Kong validates the caller JWT before invoking) — the rest of the
  functions, including all admin-triggered email senders.

When changing `verify_jwt`, update both the `config.toml` and the in-function
auth checks. See `.claude/rules/edge-functions.md` for the diagnostic playbook
(`execution_time_ms ≈ 0` → Kong rejection; `> 50ms` → in-function error).
