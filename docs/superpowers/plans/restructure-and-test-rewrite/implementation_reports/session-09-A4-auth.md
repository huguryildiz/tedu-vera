# Session 09 — A4.1–A4.10: Auth Restructure

**Date:** 2026-04-22
**Commits:** `refactor(A4.1)` through `refactor(A4.10)` — 10 commits
**Branch:** main
**Build:** ✅ green after every commit

---

## Scope

Co-locate all 9 auth screens into `src/auth/features/<name>/`, extract screen-specific CSS from the monolithic `src/styles/auth.css` into per-feature CSS files, and consolidate all shared auth infrastructure into `src/auth/shared/`, completing **Faz A4** entirely.

| Task | Feature | Commit |
|---|---|---|
| A4.1 | login | `2143a7e refactor(A4.1): co-locate login feature to features/login/` |
| A4.2 | register | `575e069 refactor(A4.2): co-locate register feature to features/register/` |
| A4.3 | invite | `6e71b2b refactor(A4.3): co-locate invite feature to features/invite/` |
| A4.4 | forgot-password | `399f2e8 refactor(A4.4): co-locate forgot-password feature to features/forgot-password/` |
| A4.5 | reset-password | `cd6f31d refactor(A4.5): co-locate reset-password feature to features/reset-password/` |
| A4.6 | verify-email | `698e4a0 refactor(A4.6): co-locate verify-email feature to features/verify-email/` |
| A4.7 | complete-profile | `5988ecd refactor(A4.7): co-locate complete-profile feature to features/complete-profile/` |
| A4.8 | pending-review | `0772f90 refactor(A4.8): co-locate pending-review feature to features/pending-review/` |
| A4.9 | grace-lock | `9ddf20f refactor(A4.9): co-locate grace-lock feature to features/grace-lock/` |
| A4.10 | auth/shared | `3594330 refactor(A4.10): consolidate auth/shared/ layer` |

---

## Files Moved

### A4.1 — login

| Old path | New path |
|---|---|
| `src/auth/screens/LoginScreen.jsx` | `src/auth/features/login/LoginScreen.jsx` |

**Consumer updates:** `src/router.jsx`, `src/layouts/AdminRouteLayout.jsx`

---

### A4.2 — register

| Old path | New path |
|---|---|
| `src/auth/screens/RegisterScreen.jsx` | `src/auth/features/register/RegisterScreen.jsx` |
| *(extracted from auth.css)* | `src/auth/features/register/RegisterScreen.css` |

**CSS extracted:** `.apply-*` (apply for access form), `.reg-*` (premium additions), `.grouped-cb-*` (combobox), inline validation helpers, progress indicator — ~320 lines removed from `auth.css`.

**Consumer updates:** `src/router.jsx`, `src/layouts/AdminRouteLayout.jsx`

---

### A4.3 — invite

| Old path | New path |
|---|---|
| `src/auth/screens/InviteAcceptScreen.jsx` | `src/auth/features/invite/InviteAcceptScreen.jsx` |

**Consumer updates:** `src/router.jsx` only (AdminRouteLayout had no import for InviteAcceptScreen).

---

### A4.4 — forgot-password

| Old path | New path |
|---|---|
| `src/auth/screens/ForgotPasswordScreen.jsx` | `src/auth/features/forgot-password/ForgotPasswordScreen.jsx` |

**Consumer updates:** `src/router.jsx`, `src/layouts/AdminRouteLayout.jsx`

---

### A4.5 — reset-password

| Old path | New path |
|---|---|
| `src/auth/screens/ResetPasswordScreen.jsx` | `src/auth/features/reset-password/ResetPasswordScreen.jsx` |

**Consumer updates:** `src/router.jsx`, `src/layouts/AdminRouteLayout.jsx`

---

### A4.6 — verify-email

| Old path | New path |
|---|---|
| `src/auth/screens/VerifyEmailScreen.jsx` | `src/auth/features/verify-email/VerifyEmailScreen.jsx` |
| `src/auth/components/EmailVerifyBanner.jsx` | `src/auth/features/verify-email/EmailVerifyBanner.jsx` |
| *(extracted from auth.css)* | `src/auth/features/verify-email/VerifyEmailScreen.css` |

**CSS extracted:** All keyframes (`ring-pulse`, `ring-emit`, `icon-pop`, `icon-shake`, `dot-bounce`, `vef-spin`, `vef-redirect-pulse`) and all `.vef-*` rules with dark and light mode variants — ~304 lines removed from `auth.css`.

**Consumer updates:** `src/router.jsx`, `src/layouts/AdminRouteLayout.jsx`, `src/auth/__tests__/VerifyEmailScreen.test.jsx`, `src/auth/__tests__/EmailVerifyBanner.test.jsx`

---

### A4.7 — complete-profile

| Old path | New path |
|---|---|
| `src/auth/screens/CompleteProfileScreen.jsx` | `src/auth/features/complete-profile/CompleteProfileScreen.jsx` |

**Consumer updates:** `src/layouts/AdminRouteLayout.jsx` only (this screen is rendered inline by AdminRouteLayout, not via router; `AuthProvider.jsx` only had a code comment referencing the screen name, not an import).

---

### A4.8 — pending-review

| Old path | New path |
|---|---|
| `src/auth/screens/PendingReviewScreen.jsx` | `src/auth/features/pending-review/PendingReviewScreen.jsx` |
| *(extracted from auth.css)* | `src/auth/features/pending-review/PendingReviewScreen.css` |

**CSS extracted:** All `.prv-*` rules with keyframes (`prv-pulse-ring`, `prv-step-pulse`, `prv-dot-pulse`) and all light mode overrides and mobile media query — ~224 lines removed from `auth.css`.

**Consumer updates:** `src/layouts/AdminRouteLayout.jsx`

---

### A4.9 — grace-lock

| Old path | New path |
|---|---|
| `src/auth/screens/GraceLockScreen.jsx` | `src/auth/features/grace-lock/GraceLockScreen.jsx` |
| *(extracted from auth.css)* | `src/auth/features/grace-lock/GraceLockScreen.css` |

**CSS extracted:** All `.gls-*` rules with light mode overrides and mobile media query — ~80 lines removed from `auth.css`. After this step, `auth.css` contained only the shared layout and `.login-*` rules (~210 lines).

**Consumer updates:** `src/layouts/AdminRouteLayout.jsx`

---

### A4.10 — auth/shared (all shared infrastructure)

**Core files** — moved from `src/auth/` → `src/auth/shared/`:

| File |
|---|
| `AuthProvider.jsx` |
| `useAuth.js` |
| `SecurityPolicyContext.jsx` |
| `lockedActions.js` |

**Guard** — moved from `src/guards/` → `src/auth/shared/`:
- `AuthGuard.jsx`

**CSS** — moved and renamed:
- `src/styles/auth.css` (210 lines, shared layout + `.login-*`) → `src/auth/shared/auth-base.css`

**`src/auth/index.js` barrel updated:**
```js
export { default as AuthProvider } from "./shared/AuthProvider";
export { useAuth } from "./shared/useAuth";
```

**Consumer updates:**

| Consumer | Change |
|---|---|
| `src/styles/main.css` | `@import './auth.css'` → `@import '../auth/shared/auth-base.css'` |
| `src/layouts/RootLayout.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/components/MaintenanceGate.jsx` | `@/auth/useAuth` → `@/auth/shared/useAuth` |
| `src/auth/features/login/LoginScreen.jsx` | `@/auth/AuthProvider` + `@/auth/SecurityPolicyContext` → `shared/*` |
| `src/auth/features/register/RegisterScreen.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/auth/features/forgot-password/ForgotPasswordScreen.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/auth/features/reset-password/ResetPasswordScreen.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/auth/features/verify-email/VerifyEmailScreen.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/auth/features/verify-email/EmailVerifyBanner.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/admin/features/settings/SettingsPage.jsx` | `@/auth/SecurityPolicyContext` → `@/auth/shared/SecurityPolicyContext` |
| `src/admin/features/pin-blocking/PinBlockingPage.jsx` | `@/auth/SecurityPolicyContext` → `@/auth/shared/SecurityPolicyContext` |
| `src/admin/features/organizations/OrganizationsPage.jsx` | `@/auth/lockedActions` → `@/auth/shared/lockedActions` |
| `src/admin/features/jurors/JurorsPage.jsx` | `@/auth/lockedActions` → `@/auth/shared/lockedActions` |
| `src/admin/features/rankings/RankingsPage.jsx` | `@/auth/lockedActions` → `@/auth/shared/lockedActions` |
| `src/admin/features/entry-control/EntryControlPage.jsx` | `@/auth/lockedActions` → `@/auth/shared/lockedActions` |
| `src/admin/modals/SendReportModal.jsx` | `@/auth/lockedActions` → `@/auth/shared/lockedActions` |
| `src/auth/__tests__/EmailVerifyBanner.test.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/auth/__tests__/RegisterScreen.test.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |
| `src/auth/__tests__/VerifyEmailScreen.test.jsx` | `@/auth/AuthProvider` → `@/auth/shared/AuthProvider` |

**Empty directories removed:**
- `src/auth/screens/`
- `src/auth/components/`
- `src/guards/` (entirely — AuthGuard was the last remaining file)

---

## Patterns & Gotchas

### Dual consumer pattern

Every auth screen is lazy-imported in BOTH `src/router.jsx` AND `src/layouts/AdminRouteLayout.jsx`. This was discovered on A4.1. Exception: `InviteAcceptScreen` (A4.3) — AdminRouteLayout had no import for it. `CompleteProfileScreen` (A4.7) — only in AdminRouteLayout, not router.jsx (rendered inline, not via route).

### CompleteProfileScreen is not router-mounted

This screen is rendered conditionally inside `AdminRouteLayout`, not as a route. Only AdminRouteLayout needed updating; `AuthProvider.jsx` only referenced it in a code comment.

### auth.css truncation strategy

After A4.2, A4.6, A4.8, A4.9 each extracted their CSS sections, `auth.css` was reduced from 1178 lines to 210 lines via `head -n N` bash truncation rather than Edit-tool multi-line replacements. One Edit-tool attempt on the prv section created a malformed file (section header replaced but body left in place); bash truncation was the reliable fix.

### auth.css sandwich structure

Before extraction, the file was:
1. Shared layout + `.login-*` (lines 1-210) — stays → `auth-base.css` in A4.10
2. `.prv-*` PENDING REVIEW section (211-434) — extracted in A4.8
3. `.gls-*` GRACE LOCK section (435-514) — extracted in A4.9
4. `.vef-*` VERIFY EMAIL section (515-818) — extracted in A4.6

The `.reg-*`/`.apply-*` section was in the first 600 lines and extracted in A4.2.

### AdminRouteLayout uses barrel; feature files use direct paths

`AdminRouteLayout.jsx` imports `useAuth` from `@/auth` (barrel). Feature files import `{ AuthContext }` from `@/auth/AuthProvider` (direct path). The barrel needed updating in `index.js`; all direct-path consumers needed individual sed updates. AdminRouteLayout required no change for A4.10.

### guards/ fully removed in A4.10

After A3.10 moved `JuryGuard.jsx` to `src/jury/shared/`, only `AuthGuard.jsx` remained in `src/guards/`. A4.10 moved it to `src/auth/shared/` and removed the now-empty `src/guards/` directory entirely.

---

## State after session

- **9 / 9 auth features co-located** — Faz A4 complete
- `src/auth/features/` — login, register, invite, forgot-password, reset-password, verify-email, complete-profile, pending-review, grace-lock
- `src/auth/shared/` — `AuthProvider.jsx`, `useAuth.js`, `SecurityPolicyContext.jsx`, `lockedActions.js`, `AuthGuard.jsx`, `auth-base.css`
- `src/auth/screens/`, `src/auth/components/`, `src/guards/` — **deleted**
- **Next session:** A5 — test rewrite (migrate remaining `it()` tests to `qaTest()`, update qa-catalog.json)
