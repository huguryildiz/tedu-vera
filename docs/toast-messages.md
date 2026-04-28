# Toast Messages

Standardized user-facing toast messages across the VERA admin panel.

## Style Guide

| Rule | Detail |
|---|---|
| **Success** | Past tense, no trailing period, no "successfully" suffix |
| **Error** | `"Failed to [verb]"` — never `"Could not"` |
| **Export errors** | End with `— try again` (no "please") |
| **No raw errors** | Never expose `e?.message` — always use a user-friendly fallback |
| **No trailing period** | Short one-liners never end with `.` |
| **Em-dash separator** | Use `—` (not `-`) for inline context (e.g. `"Closed — rankings archived"`) |

---

## Auth / Session

| Type | Message |
|---|---|
| info | `"Session expired — please sign in again"` |
| success | `"Confirmation link sent to your new email address"` |
| success | `"Email change cancelled"` |
| success | `"Profile updated"` |
| success | `"Password updated"` |
| error | `"Failed to load session history"` |
| error | `"Failed to revoke session"` |
| error | `"Failed to cancel email change"` |

---

## Admin Team (Settings)

| Type | Message |
|---|---|
| success | `"Invite sent"` |
| success | `"Invite resent"` |
| success | `"Admin added"` |
| success | `"Ownership transferred"` |
| success | `"Admin removed"` |
| success | `"Admins can now invite"` |
| success | `"Only owner can invite now"` |
| error | `"Failed to resend invite"` |
| error | `"Failed to cancel invite"` |
| error | `"Failed to transfer ownership"` |
| error | `"Failed to remove admin"` |
| error | `"Failed to update invite setting"` |
| error | `"This email is already a member of this organization."` |
| error | `"This email is already registered in VERA. The user must sign in and request access."` |

---

## Periods

| Type | Message |
|---|---|
| success | `"[Period name] published [QR ready / Generate QR manually]"` |
| success | `"[Period name] was already published"` |
| success | `"Entry link copied to clipboard"` |
| success | `"[Period name] reverted to Draft — structural editing re-enabled"` |
| success | `"Revert request submitted for [period name]"` |
| success | `"[Period name] closed — rankings archived"` |
| success | `"[Period name] was already closed"` |
| success | `"[Period name] deleted"` |
| success | `"[N] periods exported · [Format]"` |
| error | `"[Period name] is not ready to publish — review the readiness panel"` |
| error | `"Failed to publish [period name]"` |
| error | `"No active QR token — open Entry Control to generate one"` |
| error | `"Failed to copy entry link — try Entry Control"` |
| error | `"Failed to revert [period name]"` |
| error | `"Publish the period before closing it"` |
| error | `"Failed to close [period name]"` |
| error | `"Periods export failed — try again"` |

---

## Jurors

| Type | Message |
|---|---|
| success | `"[N] jurors exported · [Format]"` |
| error | `"Failed to remove juror"` |
| error | `"Jurors export failed — try again"` |

---

## Projects

| Type | Message |
|---|---|
| success | `"Project duplicated"` |
| success | `"[N] projects exported · [Format]"` |
| error | `"Failed to duplicate project"` |
| error | `"Projects export failed — try again"` |

---

## Outcomes

| Type | Message |
|---|---|
| success | `"Outcome added"` |
| success | `"Outcome updated"` |
| success | `"Outcome removed"` |
| success | `"Outcome duplicated"` |
| success | `"Outcomes removed from this period"` |
| success | `"Outcomes saved"` |
| error | `"No active organization — switch tenant from the org switcher"` |
| error | `"Failed to add outcome"` |
| error | `"Failed to update outcome"` |
| error | `"Failed to duplicate outcome"` |
| error | `"Failed to remove mapping"` |
| error | `"Failed to update coverage"` |
| error | `"Failed to update attainment threshold"` |
| error | `"Failed to save outcomes"` |

---

## PIN Blocking

| Type | Message |
|---|---|
| success | `"Unlocked [N] jurors"` |
| error | `"Failed to unlock juror"` |
| error | `"Unlocked [X] of [N] jurors — [failed] failed"` |
| error | `"Failed to send email"` |

---

## Entry Control

| Type | Message |
|---|---|
| success | `"Period published — new access QR generated"` |
| success | `"Test sent to [email]"` |
| success | `"Access link sent to [N] recipients"` |
| success | `"Sent to [N] jurors"` |
| error | `"Failed to revoke jury access — try again"` |
| error | `"Generate an active QR token first"` |
| error | `"Failed to load your account email"` |
| error | `"Failed to send test email"` |
| error | `"[N] email(s) failed to send"` |
| error | `"Bulk send failed"` |
| error | `"Failed to download QR code"` |

---

## Audit Log

| Type | Message |
|---|---|
| success | `"No tampering detected — all records are intact"` |
| error | `"Integrity check failed — try again"` |

---

## Organizations (Super-Admin)

| Type | Message |
|---|---|
| success | `"Unlocked [period name]"` |
| success | `"Rejected unlock request for [period name]"` |
| error | `"This request was already resolved"` |
| error | `"Failed to resolve the request"` |
| error | `"Failed to remove admin"` |

---

## Export Page

| Type | Message |
|---|---|
| success | `"Score report downloaded · [N] periods · Excel"` |
| success | `"[N] projects exported · all periods · Excel"` |
| success | `"[N] jurors exported · all periods · Excel"` |
| error | `"No evaluation periods found"` |
| error | `"Score report export failed — try again"` |
| error | `"Projects export failed — try again"` |
| error | `"Jurors export failed — try again"` |

---

## Analytics / Rankings / Heatmap / Reviews

| Type | Message |
|---|---|
| error | `"Analytics export failed — try again"` |
| error | `"Rankings export failed — try again"` |
| error | `"Heatmap export failed — try again"` |
| error | `"Reviews export failed — try again"` |

---

## Governance (Super-Admin Drawers)

| Type | Message |
|---|---|
| success | `"Global settings saved"` |
| success | `"[Label] — email sent to [N]/[total] org admins"` |
| success | `"Test email sent to your inbox"` |
| success | `"Maintenance cancelled"` |
| warning | `"[Label] — email sent to [N]/[total] org admins ([M] failed)"` |
| error | `"No evaluation periods found"` |
| error | `"Score report export failed — try again"` |
| error | `"Projects export failed — try again"` |
| error | `"Jurors export failed — try again"` |
| error | `"Failed to set maintenance mode"` |
| error | `"Failed to send test email"` |
| error | `"Failed to cancel maintenance"` |

---

## Backups

| Type | Message |
|---|---|
| success | `"Backup created"` |
| success | `"Backup deleted"` |
| success | `"Schedule updated"` |
| error | `"Backup creation failed"` |
| error | `"Failed to download backup"` |
| error | `"Failed to update schedule"` |

---

## Send Report Modal

| Type | Message |
|---|---|
| loading | `"Sending report…"` |
| success | `"Report sent — email delivered to [N] recipient(s)"` |
| error | `"Failed to send report"` |

---

## Setup Wizard

| Step | Type | Message |
|---|---|---|
| Period | error | `"No organization selected — select one from the org switcher"` |
| Period | success | `"Period created"` |
| Period | error | `"Failed to create period"` |
| Jurors | error | `"Please add at least one juror"` |
| Jurors | error | `"Please fill in all required fields"` |
| Jurors | success | `"[N] jurors added"` |
| Jurors | error | `"Failed to add jurors"` |
| Projects | error | `"Please add at least one project"` |
| Projects | error | `"Team members are required for each project"` |
| Projects | success | `"[N] projects added"` |
| Projects | error | `"Failed to add projects"` |
| Criteria | success | `"[Framework name] assigned"` |
| Criteria | error | `"Failed to assign framework"` |
| Criteria | error | `"No period selected"` |
| Criteria | success | `"Criteria applied"` |
| Criteria | error | `"Failed to apply criteria"` |
| Criteria | error | `"Failed to save name"` |
| Completion | error | `"No period selected"` |
| Completion | error | `"Cannot publish — [blockers]"` |
| Completion | error | `"Period is not ready to publish"` |
| Completion | error | `"Failed to publish period"` |
| Completion | success | `"Period published — entry token ready"` |
| Completion | error | `"Period must be published before generating a token"` |
| Completion | error | `"Failed to generate entry token"` |
