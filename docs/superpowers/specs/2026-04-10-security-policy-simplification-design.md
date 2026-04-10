---
date: 2026-04-10
status: draft
owner: hugur
---

# Security Policy Simplification & Drawer-Level "QR" Rename

## Goal

Clean up the Super Admin "Edit Security Policy" drawer so every visible setting actually controls something, rename "Entry Token" to "QR Code" inside the drawer (labels, helpers) and inside the `security_policy.policy` JSONB so JS form state and SQL speak the same field names, and expand the notification settings to cover all five user-visible notification flows the platform sends.

The broader `entry_token` concept — the SQL table, columns, RPC, the `generateEntryToken` API function, local `entryToken` variables across `src/`, and non-drawer UI copy on other admin pages — stays untouched. These are developer-facing technical identifiers documented in README files and do not need to change. Only the Security Policy drawer surface and the policy JSONB schema get the "QR" rename.

## Problem

The current drawer mixes four kinds of settings into one screen and only some of them do anything:

- Google OAuth, Email/Password, Remember Me — wired into `AuthProvider` and `LoginScreen`, these work.
- Entry Token TTL, PIN Lockout Cooldown, and the field labelled "Max Login Attempts" (actually the PIN fail threshold) — wired into RPCs and the PIN Blocking page, these work.
- CC on PIN Reset Requests and CC on Score Edit Requests — wired into the `request-pin-reset` and `request-score-edit` Edge Functions, these work.
- Minimum Password Length, "Max Login Attempts" label semantics, `requireSpecialChars`, `allowMultiDevice` (still lingering in JSDoc) — not enforced anywhere. Dead settings that create a false sense of security.

Additional issues:

- The field labelled "Max Login Attempts" actually controls PIN failure threshold, not login attempts. This is a semantic mismatch between the UI, the JS identifier, and the SQL field — all three say "login" but the behavior is "PIN".
- "Entry Token" is developer jargon; users see the QR code, not a token.
- Nothing prevents a super admin from disabling both Google OAuth and Email/Password at once and locking the entire platform out.
- The platform sends five kinds of user-visible notifications (PIN reset, score edit, tenant application events, maintenance, password changed) but the drawer only exposes CC controls for two of them.
- The current `security_policy.policy` JSONB row contains three dead keys (`minPasswordLength`, `requireSpecialChars`, `allowMultiDevice`) that no code reads but that clutter the schema.

## Scope

**In scope:**

- UI copy and UI structure of `SecurityPolicyDrawer` only (the drawer's own labels, helpers, form state field names, and `DEFAULT_POLICY` constant)
- A SQL migration that rewrites the `security_policy.policy` JSONB: renames `maxLoginAttempts` → `maxPinAttempts` and `tokenTtl` → `qrTtl`, prunes dead keys (`minPasswordLength`, `requireSpecialChars`, `allowMultiDevice`), and adds three new CC fields with sane defaults
- Updates to SQL functions that currently read the renamed JSONB keys (`rpc_jury_verify_pin` and `rpc_admin_generate_entry_token`, both of which read `policy->>'maxLoginAttempts'` and `policy->>'tokenTtl'` today)
- Updates to the `security_policy` default seed row in `002_tables.sql`
- Update to `DEFAULT_POLICY` in `src/auth/SecurityPolicyContext.jsx` and the local default in `SecurityPolicyDrawer.jsx` so JS default matches the new JSONB schema
- `src/shared/api/admin/security.js` JSDoc rewrite to document the new schema (no runtime behavior change — it is already a pass-through RPC wrapper)
- Three Edge Function edits: `notify-application`, `notify-maintenance`, `password-changed-notify` all learn to read the policy and CC super admin when the corresponding flag is on
- Optional refactor: extract the existing inline "fetch super admin email + read CC flag" logic from `request-pin-reset` and `request-score-edit` into a shared `_shared/super-admin-cc.ts` helper, consumed by all five Edge Functions
- A new derived "master" toggle for CC notifications in the drawer (UI-only, not persisted)
- A safeguard that prevents disabling all authentication methods simultaneously
- Unit tests for the drawer and a smoke test for each Edge Function change

**Out of scope:**

- Renaming `entry_tokens` table, `entry_token` columns, or `rpc_admin_generate_entry_token` function name. These are documented technical identifiers that do not need to change.
- Renaming the `generateEntryToken` API function in `src/shared/api/admin/tokens.js`, the `entryToken` / `ENTRY_TOKEN` local variables anywhere in `src/`, or "Entry Token" UI copy on pages other than the Security Policy drawer (EntryControlPage, SendReportModal, JurorsPage, etc.). These stay untouched.
- Renaming session tokens, Supabase JWTs, `rpc_secret`, CSRF tokens, or any other non-entry-code "token" usage
- Wiring password length enforcement (Supabase Auth already enforces a 10-char minimum globally — that is sufficient)
- Profile-level personal notification preferences (not needed; CC settings stay platform-global)
- Adding new notification flows that don't already exist (this spec only wires CC into already-sending Edge Functions)
- URL parameter `?eval=TOKEN` and env var `VITE_DEMO_ENTRY_TOKEN` — deployment-visible literals that would break existing QR codes if renamed

## Design

### New drawer layout

The drawer keeps its current shell, header, and footer. The body is restructured into three sections:

**1. Authentication Methods**

Three toggles identical to today plus a safeguard:

- Google OAuth — "Allow sign-in with Google accounts"
- Email/Password Login — "Allow traditional email and password authentication"
- Remember Me (30-day sessions) — "Allow persistent sessions across browser restarts"

Safeguard: On Save, if both Google OAuth and Email/Password are off, the save fails with an `FbAlert` (danger variant) reading "At least one authentication method must remain enabled." The toggles themselves stay interactive so the user can see and correct their intent before saving. The existing `useShakeOnError` hook handles the shake animation on the Save button when `saveError` is set.

**2. QR Access**

Three fields inside a single card with the existing "Risk Control" rozette styling:

- QR Code TTL — dropdown (12 hours / 24 hours / 48 hours / 7 days) — helper text: "How long jury QR codes remain valid after generation."
- Max PIN Attempts — number input (3 to 20) — helper text: "Number of failed PIN attempts before a juror is locked out."
- PIN Lockout Cooldown — dropdown (5 / 10 / 15 / 30 / 60 minutes) — helper text: "After max failed PIN attempts, juror access is locked for [duration]."

All three are grouped because they are three variables of the same concept: jury QR access security. The field previously labelled "Max Login Attempts" moves here and gets renamed to "Max PIN Attempts" because that is what it actually controls.

**3. Notifications**

A master toggle and five granular child toggles, all backed by boolean fields in the policy JSONB:

- Master: "CC Super Admin on All Notifications" — toggle, UI-only.
  - When all five child toggles are on, the master renders as on.
  - When all five child toggles are off, the master renders as off.
  - When some but not all are on, the master renders in an indeterminate "mixed" state: the track stays in its on-color but is rendered at 50% opacity and the thumb sits centered between its on and off positions. No dashed borders, no new colors.
  - Clicking the master from mixed or off sets every child to on. Clicking from on sets every child to off.
  - The master is a pure UI computation — it is not stored in the policy JSONB and is not sent to `onSave`.
- Child: **PIN Reset Requests** — "Receive a copy when a juror requests a PIN reset" — backed by `ccOnPinReset`.
- Child: **Score Edit Requests** — "Receive a copy when a juror requests score editing" — backed by `ccOnScoreEdit`.
- Child: **Tenant Application Events** — "Receive a copy when a tenant application is submitted, approved, or rejected" — backed by `ccOnTenantApplication`.
- Child: **Maintenance Notifications** — "Receive a copy when platform maintenance windows are announced" — backed by `ccOnMaintenance`.
- Child: **Password Changed** — "Receive a copy when an admin changes their account password" — backed by `ccOnPasswordChanged`.

The child toggles are the source of truth. The master exists only for convenience.

**Removed from drawer:**

- "Password Requirements" section in its entirety (`minPasswordLength` input, the old "Max Login Attempts" input in this section, and any `requireSpecialChars` markup).

### Policy JSONB schema — target state

After the migration runs, `security_policy.policy` has exactly these keys, and no others:

```json
{
  "googleOAuth": true,
  "emailPassword": true,
  "rememberMe": true,
  "qrTtl": "24h",
  "maxPinAttempts": 5,
  "pinLockCooldown": "30m",
  "ccOnPinReset": true,
  "ccOnScoreEdit": false,
  "ccOnTenantApplication": true,
  "ccOnMaintenance": true,
  "ccOnPasswordChanged": true
}
```

Eleven keys total. Six authentication/access fields, five notification fields. Every key is read by at least one consumer. There is no translation layer in JS because JS and SQL now speak the same names.

### SQL migration

A new migration file `sql/migrations/025_security_policy_cleanup.sql` performs the rename, prune, and defaults in a single transaction. The migration is idempotent: running it twice produces the same result.

**Step 1 — Rewrite the existing policy row.** Use a single `UPDATE` that removes dead keys, renames live keys (by reading the old value and writing the new key), and inserts defaults for the new CC fields.

The migration reads the current `policy->'maxLoginAttempts'` and writes it under the new `maxPinAttempts` key. Same for `tokenTtl` → `qrTtl`. If the old keys do not exist (fresh install), the fallback defaults `5` and `"24h"` are used. Dead keys (`minPasswordLength`, `requireSpecialChars`, `allowMultiDevice`) are removed with the `-` operator. New keys (`ccOnTenantApplication`, `ccOnMaintenance`, `ccOnPasswordChanged`) are added with `true` defaults only if they do not already exist (COALESCE on `policy->'key'`).

**Step 2 — Update SQL functions that read the renamed keys.** Each function is replaced via `CREATE OR REPLACE FUNCTION`. The bodies change in exactly one way: the JSONB key lookup string is renamed.

Functions to patch:

- `rpc_jury_verify_pin` — currently reads `policy->>'maxLoginAttempts'`. Update to read `policy->>'maxPinAttempts'`. Lives in `005_rpcs.sql` and is re-defined in `007_security_policy_enforcement.sql`, `008_audit_logs.sql`, `009_audit_actor_enrichment.sql` (the latest redefinition wins). The migration replaces it one final time with the new key name.
- `rpc_admin_generate_entry_token` — currently reads `policy->>'tokenTtl'`. Update to read `policy->>'qrTtl'`. Also lives in `007_security_policy_enforcement.sql` and `008_audit_logs.sql`. Same treatment.

The migration does **not** rename the SQL function names themselves — `rpc_admin_generate_entry_token` keeps its name. Only the JSONB key it reads changes.

**Step 3 — Update `002_tables.sql` seed.** The `INSERT INTO security_policy (id, policy) VALUES (1, '...')` seed in `002_tables.sql` is updated to use the new schema (eleven keys, no dead fields). This is purely cosmetic — it only affects fresh database creation via `drop_all` + rerun. Existing deployments rely on the migration in Step 1.

**Step 4 — Update `rpc_admin_set_security_policy` key validation, if any.** The current implementation in `005_rpcs.sql:1638` just merges `policy || p_policy` with no validation. No change needed — the set RPC happily accepts the new keys because it does not enforce an allow-list. If key validation were added later, it would need the new key list.

### JS API layer changes

With the DB now speaking the new names, `src/shared/api/admin/security.js` becomes a pass-through: `getSecurityPolicy()` and `setSecurityPolicy()` just call their respective RPCs and return the data unchanged. No translation layer, no field mapping. The JSDoc `@returns` block is rewritten to document exactly the eleven live fields.

`DEFAULT_POLICY` in both `SecurityPolicyContext.jsx` and `SecurityPolicyDrawer.jsx` is rewritten to the new schema. The two files currently duplicate this constant — this spec keeps them duplicated (existing pattern) rather than deduplicating, to keep the diff focused.

### Scope-limited JS renames

The only JS identifiers that change are the two policy fields, because the DB JSONB schema is being renamed and JS must follow:

| Old identifier | New identifier | Location |
|---|---|---|
| `tokenTtl` | `qrTtl` | `DEFAULT_POLICY` in `SecurityPolicyContext.jsx` and `SecurityPolicyDrawer.jsx`, `form.tokenTtl` state inside the drawer, JSDoc in `security.js` |
| `maxLoginAttempts` | `maxPinAttempts` | Same three locations |

The drawer's own labels change:

| Old label | New label |
|---|---|
| "Entry Token TTL" | "QR Code TTL" |
| "Max Login Attempts" (in Password Requirements section — section is being deleted) | "Max PIN Attempts" (in new QR Access section) |
| Helper text: "How long jury entry tokens remain valid after generation." | "How long jury QR codes remain valid after generation." |

**Nothing else in `src/` changes.** `generateEntryToken` in `tokens.js` keeps its name. `entryToken` variables anywhere in the tree keep their names. "Entry Token" on `EntryControlPage`, `SendReportModal`, `JurorsPage`, `DoneStep`, `JuryGatePage`, etc. stays as-is. The `VITE_DEMO_ENTRY_TOKEN` env var stays. The URL parameter `?eval=TOKEN` stays. The DB column, table, and RPC stay. `entry_token` as a codebase term remains; it is documented in `sql/README.md` and `docs/architecture/system-overview.md` for anyone who needs to know what it is.

The two JS renames are scoped specifically because they live inside the drawer (user-facing) and inside the policy JSONB (schema). Both must change together for consistency. Any other "entry_token" rename would be scope creep.

### Edge Function changes

Three Edge Functions need to learn the "read policy and CC super admin" pattern that `request-pin-reset` and `request-score-edit` already implement.

**Shared helper extraction.** The two existing functions each have their own inline copy of:

- A query that finds the super admin user_id from `memberships` where `role = 'super_admin'` and `organization_id IS NULL`
- A resolver that fetches the super admin email from Supabase Auth Admin API
- A `shouldCcSuperAdmin()` style function that reads a single policy field

Rather than copy-pasting this three more times, a shared helper lives in `supabase/functions/_shared/super-admin-cc.ts` (new file). It exports:

- `getSuperAdminEmail(serviceClient): Promise<string | null>` — queries membership + auth and returns the email, or null if none configured
- `shouldCcOn(serviceClient, field: string): Promise<boolean>` — reads `security_policy.policy->>field` and returns the boolean (defaults to true if policy read fails)

Each caller Edge Function imports these and replaces inline implementations. The two existing functions (`request-pin-reset`, `request-score-edit`) are refactored to use the shared helper in the same commit, so all five functions share one implementation.

**New CC wiring:**

- `notify-application/index.ts` — reads `ccOnTenantApplication`. The function currently sends three kinds of emails (submitted, approved, rejected). All three get the same CC treatment: when the flag is on, super admin is added to the CC array of every outgoing email.
- `notify-maintenance/index.ts` — reads `ccOnMaintenance`. Single email type (maintenance window announcement), same CC pattern.
- `password-changed-notify/index.ts` — reads `ccOnPasswordChanged`. Single email type (account password change notification), same CC pattern.

In each function, the CC array is built immediately before the Resend API call. If the flag read fails (e.g., DB error reading policy), the fallback is `true` — err on the side of notifying the super admin, matching `request-pin-reset` behavior.

### Drawer safeguard implementation

Inside the drawer's save handler, before `onSave` is called:

```javascript
if (!form.googleOAuth && !form.emailPassword) {
  setSaveError("At least one authentication method must remain enabled.");
  return;
}
```

This runs before `onSave` and aborts the save. No drawer state changes, no RPC round-trip, and `useShakeOnError` shakes the Save Policy button because `displayError` changes.

### Master toggle computation

In the drawer component:

```javascript
const ccChildren = [
  form.ccOnPinReset,
  form.ccOnScoreEdit,
  form.ccOnTenantApplication,
  form.ccOnMaintenance,
  form.ccOnPasswordChanged,
];
const ccAllOn = ccChildren.every(Boolean);
const ccAnyOn = ccChildren.some(Boolean);
const ccMixed = ccAnyOn && !ccAllOn;

const handleMasterToggle = () => {
  const next = !ccAllOn;
  setForm((f) => ({
    ...f,
    ccOnPinReset: next,
    ccOnScoreEdit: next,
    ccOnTenantApplication: next,
    ccOnMaintenance: next,
    ccOnPasswordChanged: next,
  }));
};
```

The `Toggle` component gains an `indeterminate` prop that, when true, renders the track at 50% opacity with the thumb centered. The master uses `checked={ccAllOn}` and `indeterminate={ccMixed}`.

## Testing

**Drawer unit tests** (`src/admin/__tests__/SecurityPolicyDrawer.test.jsx`):

- Saves pass through all eleven policy fields to `onSave` with correct names (`qrTtl`, `maxPinAttempts`, etc.)
- Disabling both Google OAuth and Email/Password and clicking Save displays the safeguard error and does not call `onSave`
- Clicking the master notifications toggle from off sets all five child toggles to true
- Clicking the master toggle from on sets all five to false
- The master renders in "mixed" visual state when one child differs from the others (spot-check one case)
- Password Requirements section is absent from the DOM
- The drawer displays "QR Code TTL" and "Max PIN Attempts" labels, not the old names

No new tests for `src/shared/api/admin/security.js` — the module is already a thin RPC pass-through and only its JSDoc changes in this work. Existing tests (if any) cover the current behavior.

**Edge Function smoke tests.** Each of the three changed functions gets a minimal test:

- `notify-application` honors `ccOnTenantApplication` (true → CC present, false → CC absent)
- `notify-maintenance` honors `ccOnMaintenance`
- `password-changed-notify` honors `ccOnPasswordChanged`

Edge Function tests can be Deno-based unit tests with a mocked service client, following the existing pattern in the repo if one exists, or manual smoke-test notes in the implementation plan if no Edge Function test harness is in place.

**SQL migration verification:**

- Run the migration against a local Supabase instance (`mcp__claude_ai_Supabase__apply_migration`), then `SELECT policy FROM security_policy WHERE id = 1` and assert the shape matches the target schema above
- Run it a second time; assert the policy is unchanged (idempotence check)

Every new test uses `qaTest` with a fresh ID in `src/test/qa-catalog.json`.

No E2E tests are added for this change. The jury access flow is functionally unchanged; the drawer changes are covered by unit tests; the Edge Function changes affect outbound email CC, which is hard to E2E without a real email sink.

## Rollout

Single deploy, sequenced:

1. Apply SQL migration (`025_security_policy_cleanup.sql`) via Supabase MCP `apply_migration`
2. Deploy the three updated Edge Functions (`notify-application`, `notify-maintenance`, `password-changed-notify`) and the refactored two (`request-pin-reset`, `request-score-edit`) via Supabase MCP `deploy_edge_function`
3. Deploy the frontend

There is a brief window between steps 1 and 3 where the old frontend is still live but the policy JSONB has already been renamed. During this window, the old drawer will display default values for Max Login Attempts and Entry Token TTL instead of the actual stored values (because it reads the now-absent `maxLoginAttempts` and `tokenTtl` keys). If a super admin happens to save the drawer during this window, the old drawer writes `maxLoginAttempts` and `tokenTtl` as orphan keys into the JSONB; the SQL functions continue to read the new keys correctly, so runtime behavior is unaffected, but the JSONB gains two orphan keys that need a follow-up cleanup. The Security Policy drawer is accessed rarely and only by super admins, so the risk is low. To further mitigate, the rollout notes in the implementation plan recommend completing all three deployment steps within the same ten-minute window.

Rollback: redeploying the previous frontend version continues to work because the renamed JSONB keys are still present in the row, just under different names. The old frontend will display defaults (as noted above) but will not crash or corrupt data. If the migration itself must be reverted, a reverse-rename SQL block is drafted in the implementation plan and kept on hand but not committed unless needed.

## Open questions

None. All design decisions were resolved during brainstorming:

- Password policy: removed entirely. Supabase Auth's 10-char global minimum is sufficient.
- CC notifications: five granular toggles with a master convenience toggle, all platform-global (not personal profile preferences).
- QR rename scope: drawer UI copy + two JSONB policy field names (`tokenTtl`, `maxLoginAttempts`) + their direct JS references in `DEFAULT_POLICY`/form state only. The DB table, columns, RPC name, the `generateEntryToken` API function, local `entryToken` variables, and non-drawer UI copy all stay untouched — these are documented in README files and are not confusing enough to rename.
- Notification granularity: five toggles, with tenant application submitted/approved/rejected grouped under a single `ccOnTenantApplication` flag.
