# User-Facing Messages

> _Last updated: 2026-04-29_

Canonical reference for **all** user-facing messages in VERA — toasts, inline errors, validation, and modal feedback. Update this file whenever a message changes.

## Style Guide

| Rule | Detail |
|---|---|
| **Success toasts** | Past tense, no trailing period, no "successfully" suffix |
| **Error toasts** | `"Failed to [verb]"` — never `"Could not"`. No trailing period on one-liners. |
| **Inline errors** | Multi-sentence: `"Failed to [verb]. Please try again."` with trailing period. |
| **Export errors** | End with `— try again` (no "please") |
| **No raw errors** | Never expose `err?.message` as visible user state — always use a controlled string literal |
| **Em-dash separator** | Use `—` (not `-`) for inline context (e.g. `"Closed — rankings archived"`) |

---

## Toast Notifications

### Auth / Session

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

### Admin Team (Settings)

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

### Periods

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

### Jurors

| Type | Message |
|---|---|
| success | `"[N] jurors exported · [Format]"` |
| error | `"Failed to remove juror"` |
| error | `"Jurors export failed — try again"` |

### Projects

| Type | Message |
|---|---|
| success | `"Project duplicated"` |
| success | `"[N] projects exported · [Format]"` |
| error | `"Failed to duplicate project"` |
| error | `"Projects export failed — try again"` |

### Outcomes

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

### PIN Blocking

| Type | Message |
|---|---|
| success | `"Unlocked [N] jurors"` |
| error | `"Failed to unlock juror"` |
| error | `"Unlocked [X] of [N] jurors — [failed] failed"` |
| error | `"Failed to send email"` |

### Entry Control

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

### Audit Log

| Type | Message |
|---|---|
| success | `"No tampering detected — all records are intact"` |
| error | `"Integrity check failed — try again"` |

### Organizations (Super-Admin)

| Type | Message |
|---|---|
| success | `"Unlocked [period name]"` |
| success | `"Rejected unlock request for [period name]"` |
| error | `"This request was already resolved"` |
| error | `"Failed to resolve the request"` |
| error | `"Failed to remove admin"` |

### Export Page

| Type | Message |
|---|---|
| success | `"Score report downloaded · [N] periods · Excel"` |
| success | `"[N] projects exported · all periods · Excel"` |
| success | `"[N] jurors exported · all periods · Excel"` |
| error | `"No evaluation periods found"` |
| error | `"Score report export failed — try again"` |
| error | `"Projects export failed — try again"` |
| error | `"Jurors export failed — try again"` |

### Analytics / Rankings / Heatmap / Reviews

| Type | Message |
|---|---|
| error | `"Analytics export failed — try again"` |
| error | `"Rankings export failed — try again"` |
| error | `"Heatmap export failed — try again"` |
| error | `"Reviews export failed — try again"` |

### Governance (Super-Admin Drawers)

| Type | Message |
|---|---|
| success | `"Global settings saved"` |
| success | `"[Label] — email sent to [N]/[total] org admins"` |
| success | `"Test email sent to your inbox"` |
| success | `"Maintenance cancelled"` |
| warning | `"[Label] — email sent to [N]/[total] org admins ([M] failed)"` |
| error | `"Failed to set maintenance mode"` |
| error | `"Failed to send test email"` |
| error | `"Failed to cancel maintenance"` |

### Backups

| Type | Message |
|---|---|
| success | `"Backup created"` |
| success | `"Backup deleted"` |
| success | `"Schedule updated"` |
| error | `"Backup creation failed"` |
| error | `"Failed to download backup"` |
| error | `"Failed to update schedule"` |

### Send Report Modal

| Type | Message |
|---|---|
| success | `"Report sent — email delivered to [N] recipient(s)"` |

### Setup Wizard

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

---

## Inline Errors

Inline errors appear directly in forms, drawers, panels, and screen bodies (not as toasts). Format: `"Failed to [verb]. Please try again."` with trailing period.

### Auth Flow

**Login (`LoginScreen`)**

| Trigger | Message |
|---|---|
| Empty email or password | `"Please enter your email and password."` |
| Captcha not completed | `"Please complete the captcha challenge."` |
| Login catch | `"Login failed. Please try again."` |
| Google sign-in catch | `"Google sign-in failed. Please try again."` |

**Registration (`RegisterScreen`)**

| Trigger | Message |
|---|---|
| Empty full name | `"Full name is required."` |
| Empty email | `"Work email is required."` |
| Empty organization | `"Organization name is required."` |
| Empty password | `"Password is required."` |
| Password mismatch | `"Passwords do not match."` |
| Email already taken | Dynamic — controlled string from API |

**Forgot Password (`ForgotPasswordScreen`)**

| Trigger | Message |
|---|---|
| Empty email | `"Please enter your email address."` |
| Send catch | `"Failed to send reset link. Please try again."` |

**Reset Password (`ResetPasswordScreen`)**

| Trigger | Message |
|---|---|
| Password mismatch | `"Passwords do not match."` |
| Update catch | `"Failed to update password. Please try again."` |

**Email Verification (`VerifyEmailScreen`)**

| Trigger | Message |
|---|---|
| Missing/invalid token | `"Verification link is invalid or missing."` |
| Resend catch | `"Failed to resend verification email."` |

**Email Verify Banner (`EmailVerifyBanner`)**

| Trigger | Message |
|---|---|
| Resend catch | `"Failed to resend verification email."` |

**Grace Lock (`GraceLockScreen`)**

| Trigger | Message |
|---|---|
| Send catch | `"Failed to send verification email. Please try again."` |

**Complete Profile (`CompleteProfileScreen`)**

| Trigger | Message |
|---|---|
| Empty full name | `"Full name is required."` |
| Empty organization | `"Organization name is required."` |
| Submit catch | `"Failed to complete profile. Please try again."` |

**Invite Accept (`InviteAcceptScreen`)**

| Trigger | Message |
|---|---|
| Submit catch | `"Failed to complete account setup. Please try again."` |

**Admin Layout Login (`AdminRouteLayout`)**

| Trigger | Message |
|---|---|
| Login catch | `"Login failed. Please try again."` |

---

### Jury Flow

**Identity Step (`IdentityStep`)**

| Trigger | Message |
|---|---|
| Empty name | `"Please enter your name."` |
| Empty affiliation | `"Please enter your affiliation."` |
| Invalid email | `"Please enter a valid e-mail address."` |

**Session Handlers (`useJurySessionHandlers`)**

| Trigger | Message |
|---|---|
| Period closed | `"This evaluation period has been closed. Please contact the coordinators."` |
| Period not published | `"This evaluation period is not yet published."` |
| Projects load fail | `"Failed to load projects. Please try again."` |
| Period not found | `"Selected period could not be found. Please try again."` |
| Missing name/affiliation | `"Please enter your full name and affiliation."` |
| Period no longer active | `"This period is no longer active. Please try again."` |
| Start evaluation fail | `"Failed to start the evaluation. Please try again."` |
| Demo unavailable | `"Demo period is temporarily unavailable. Please refresh and try again."` |
| No active period | `"No active evaluation period is available right now."` |
| Periods load fail | `"Failed to load periods. Please try again."` |

**Lifecycle Handlers (`useJuryLifecycleHandlers`)**

| Trigger | Message |
|---|---|
| Period locked | `"Evaluations are locked for this period."` |
| Score save fail | `"Failed to save all scores. Please check your connection and try again."` |
| Session expired | `"Your session has expired. Please refresh and re-enter your PIN."` |
| Juror blocked | `"This juror has been blocked. Please contact the coordinators."` |
| Final submit fail | `"Final submission failed. Please try again."` |

**Locked Step (`LockedStep`)**

| Trigger | Message |
|---|---|
| Send request fail | `"Failed to send request. Please try again."` |

---

### Admin Panel / Drawers

**Criteria Panel (`CriteriaPage`)**

| Trigger | Message |
|---|---|
| Periods load fail | `"Failed to load periods. Try refreshing."` |
| Clone fail | `"Failed to clone criteria. Please try again."` |
| Source period empty (info toast) | `"Source period has no criteria to clone"` |

**Criteria Form (`useCriteriaForm`)**

| Trigger | Message |
|---|---|
| Period locked (scores exist) | `"This period's evaluation template is locked because scoring has already started."` |
| No criteria added | `"Add at least one criterion before saving."` |
| Save fail | `"Failed to save criteria template. Please try again."` |

**Edit Single Criterion Drawer**

| Trigger | Message |
|---|---|
| Period locked | `"Locked — scores exist for this period."` |
| Save fail | `"Failed to save. Please try again."` |

**Jurors Panel (`JurorsPage`)**

| Trigger | Message |
|---|---|
| Periods load fail | `"Failed to load periods."` |
| Projects load fail | `"Failed to load projects."` |
| Jurors load fail | `"Failed to load jurors."` |

**Manage Jurors (`useManageJurors`)**

| Trigger | Message |
|---|---|
| Period locked | `"Evaluation period is locked. Unlock the period to make changes."` |
| No period selected for PIN reset | `"Select a period from the header before resetting a PIN."` |
| Wrong period | `"Only the period selected in header can be edited."` |
| Invalid admin password | `"Admin password is invalid. Please re-login."` |
| Reminder send fail | `"Failed to send reminder. Please try again."` |

**Enable Editing Modal (Jurors)**

| Trigger | Message |
|---|---|
| Reopen fail | `"Failed to reopen evaluation. Please try again."` |

**Add Juror Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to add juror. Please try again."` |

**Edit Juror Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to save juror. Please try again."` |

**Periods Panel (`PeriodsPage`)**

| Trigger | Message |
|---|---|
| Periods load fail | `"Failed to load periods."` |

**Manage Periods (`useManagePeriods`)**

| Trigger | Message |
|---|---|
| No org context | `"Organization context missing. Please re-login."` |
| No period selected | `"No period selected. Please select a period to continue."` |
| Create fail | `"Failed to create period. Please try again."` |
| Update fail | `"Failed to update period. Please try again."` |
| Criteria config update fail | `"Failed to update criteria config. Please try again."` |
| Outcome config update fail | `"Failed to update outcome config. Please try again."` |
| Duplicate fail | `"Failed to duplicate period. Please try again."` |
| Delete fail | `"Failed to delete period. Please try again."` |

**Add/Edit Period Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to save period. Please try again."` |

**Period Modals**

| Modal | Trigger | Message |
|---|---|---|
| Publish | Publish fail | `"Failed to publish the period. Please try again."` |
| Close | Close fail | `"Failed to close the period. Please try again."` |
| Delete | Delete fail | `"Failed to delete the period. Please try again."` |
| Revert to Draft | Revert fail | `"Failed to revert the period. Please try again."` |
| Request Revert | Submit fail | `"Failed to submit the request. Please try again."` |

**Projects Panel (`ProjectsPage`)**

| Trigger | Message |
|---|---|
| Periods load fail | `"Failed to load periods."` |
| Projects load fail | `"Failed to load projects."` |

**Manage Projects (`useManageProjects`)**

| Trigger | Message |
|---|---|
| No period for import | `"Select a period from the header before importing groups."` |
| No period for add | `"Select a period before adding a group."` |
| Period locked | `"Evaluation period is locked. Unlock the period to make changes."` |
| Save fail | `"Failed to save project. Please try again."` |
| Delete fail | `"Failed to delete project. Please try again."` |
| Duplicate fail | `"Failed to duplicate project."` |
| Load fail | `"Failed to load projects. Please try again."` |

**Add Project Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to add project. Please try again."` |

**Edit Project Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to save project. Please try again."` |

**Outcomes Panel (`OutcomesPage`)**

| Trigger | Message |
|---|---|
| Remove fail | `"Failed to remove outcome. Please try again."` |

**Add Outcome Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to add outcome. Please try again."` |

**Outcome Detail Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to save outcome. Please try again."` |

**Outcome Editor (`OutcomeEditor`)**

| Trigger | Message |
|---|---|
| Period locked | `"This period's evaluation template is locked because scoring has already started."` |
| Save fail | `"Failed to save outcome template. Please try again."` |

**Outcomes Data (`usePeriodOutcomes`)**

| Trigger | Message |
|---|---|
| Load fail | `"Failed to load outcomes data. Please try again."` |

**Entry Control Page / Panel**

| Trigger | Message |
|---|---|
| Session expired | `"Session expired — please log in again."` |
| Token status load fail | `"Failed to load token status."` |
| Not ready to publish | `"Cannot publish: [blockers]"` or `"Period is not ready to publish."` |
| Token generation fail | `"Token generation failed — please try again."` |
| Period not published | `"This period is not published yet. Publish it first from the Periods page."` |
| Unauthorized | `"Unauthorized — check your session."` or `"Unauthorized — check your admin password."` |
| Generate fail | `"Failed to generate token."` |
| Revoke fail | `"Failed to revoke token."` |
| Clipboard fail | `"Failed to copy to clipboard."` |
| QR download fail | `"Failed to download QR."` |
| QR required for publish | `"Period must be published before generating a QR."` |

**PIN Policy Drawer**

| Trigger | Message |
|---|---|
| Invalid max attempts | `"Max PIN attempts must be at least 1."` |
| Save fail | `"Failed to save PIN policy. Please try again."` |

**PIN Blocking (`usePinBlocking`)**

| Trigger | Message |
|---|---|
| Load fail | `"Failed to load locked jurors."` |

**Settings — Change Password Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to update password. Please try again."` |

**Settings — Edit Profile Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to save profile. Please try again."` |

**Settings — Security Policy Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to save security policy. Please try again."` |
| All auth methods disabled | `"At least one authentication method must remain enabled."` |

**Settings — Admin Team (`useAdminTeam`)**

| Trigger | Message |
|---|---|
| Load fail | `"Failed to load team members. Please try again."` |

**Admin Data (`useAdminData`)**

| Trigger | Message |
|---|---|
| Incorrect password | `"Incorrect password."` |
| Data load fail | `"Failed to load data. Check your connection and try refreshing."` |

**Organizations Page**

| Trigger | Message |
|---|---|
| Delete fail | `"Failed to delete organization."` |

**Manage Organizations (`useManageOrganizations`)**

| Trigger | Message |
|---|---|
| Load fail | `"Failed to load organizations."` |
| Update admin fail | `"Failed to update admin."` |
| Delete admin fail | `"Failed to delete admin."` |
| Cancel invite fail | `"Failed to cancel invite."` |
| Approve join request fail | `"Failed to approve join request."` |
| Reject join request fail | `"Failed to reject join request."` |
| Approve application fail | `"Failed to approve application."` |
| Reject application fail | `"Failed to reject application."` |

**Governance Drawers (Platform Settings)**

| Trigger | Message |
|---|---|
| Load fail | `"Failed to load platform settings. Please try again."` |
| Save fail | `"Failed to save platform settings. Please try again."` |

**Create Organization Drawer**

| Trigger | Message |
|---|---|
| Save fail | `"Failed to create organization. Please try again."` |

---

### Shared Components

**ConfirmDialog / ConfirmModal**

| Trigger | Message |
|---|---|
| Confirm action catch | `"Something went wrong. Please try again."` |

**Import CSV Modal / Import Jurors Modal**

| Trigger | Message |
|---|---|
| Non-CSV file | `'"[filename]" is not a CSV file. Please upload a .csv file.'` |
| Parse fail | `"Failed to parse file. Make sure it is a valid CSV."` |
| Import fail | `"Import failed. Please try again."` |

**Delete Backup Modal**

| Trigger | Message |
|---|---|
| Delete fail | `"Failed to delete. Please try again."` |

**Send Report Modal**

| Trigger | Message |
|---|---|
| Send fail | `"Failed to send report. Please try again."` |

**PIN Result Modal**

| Trigger | Message |
|---|---|
| Email not sent (API result) | `"Email could not be sent."` |
| Send catch | `"Failed to send PIN email. Please try again."` |

**Backups (`useBackups`)**

| Trigger | Message |
|---|---|
| Load fail | `"Failed to load backups. Please try again."` |
| Create fail | `"Failed to create backup. Please try again."` |
| Delete fail | `"Failed to delete backup. Please try again."` |

**Demo Admin Loader**

| Trigger | Message |
|---|---|
| Connect fail | `"Failed to connect to demo environment. Please try again."` |
