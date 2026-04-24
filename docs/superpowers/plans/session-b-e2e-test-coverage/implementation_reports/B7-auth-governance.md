# B7 — Auth Flows & Governance Drawers

**Date:** 2026-04-24
**Session goal:** Raise total E2E count from 51 → ~62; add auth-flow specs (forgot-password, invite-accept); cover governance pages (criteria, outcomes, pin-blocking, settings).

---

## What was done

### 1. Forgot-password flow (`e2e/auth/forgot-password.spec.ts`) — 3 tests

Straightforward render + submission tests against the live `/forgot-password` page. No email
delivery required — tests only verify the UI response (success banner replaces form after submit).

**POM:** `ForgotPasswordPom.ts` — `goto()`, `emailInput()`, `submitBtn()`, `successBanner()`,
`requestReset(email)`, `expectSuccessBanner()`

**Testids added:** `forgot-email`, `forgot-submit`, `forgot-success-banner`

**Tests:**
- Page loads — email input and submit button visible
- Submit button enabled on page load
- Submit with valid email → success banner, email input hides

### 2. Invite-accept flow (`e2e/auth/invite-accept.spec.ts`) — 2 tests

The most complex spec in B7. Required two independent bug fixes before it could pass.

**Root cause 1 — circular async deadlock in `AuthProvider.jsx`:**

GoTrue JS v2's `_recoverAndRefresh()` fires `SIGNED_IN` inside the `initializePromise` lock
chain. The previous `handleAuthChange` called `fetchMemberships()` → `getSession()` →
`supabase.auth.getUser()` (no JWT arg) → `await initializePromise` → deadlock. The
`initializePromise` never resolved, so the auth state machine stalled and the invite form
showed "Invite Unavailable" instead of the profile-completion form.

**Fix:** Added `isInviteAcceptPath` check in `AuthProvider.handleAuthChange` (lines 174–193).
If `pathname === "/invite/accept"` (or starts with it), the handler calls `setLoading(false)`
and returns early — `fetchMemberships()` is never called. The invite form only needs the
session object, not memberships.

```jsx
const pathname = typeof window !== "undefined" ? window.location.pathname : "";
const skipAdminBootstrap = isJuryOrEvalPath(pathname);
const isInviteAcceptPath = pathname === "/invite/accept" || pathname.startsWith("/invite/accept?");

// Skip fetchMemberships on /invite/accept — avoids circular deadlock:
// _recoverAndRefresh fires SIGNED_IN inside initializePromise's lock chain;
// fetchMemberships → getSession → getUser() awaits initializePromise → deadlock.
if (isInviteAcceptPath) {
  setLoading(false);
  return;
}
```

**Root cause 2 — storage key mismatch from stale prod-credentials server:**

`buildInviteSession` computes `storageKey` using the demo project ref
(`sb-kmprsxrofnemmsryjhfj-auth-token`), but Playwright's `reuseExistingServer: !process.env.CI`
had left a stale dev server on port 5174 that was started with prod Supabase credentials
(`VITE_SUPABASE_URL=https://etxgvkvxvbyserhrugjw.supabase.co`). The browser's GoTrue client
used the prod project ref for its storage key — the injected session was written to the wrong
key and never found. Manifested identically to root cause 1 ("Invite Unavailable").

**Diagnosis:** fetched `http://localhost:5174/src/main.jsx` from the browser context and found
the prod project ref embedded in the compiled JS. Killed the stale server (PID 17052);
Playwright restarted with `.env.e2e.local` demo credentials. Test 1 passed immediately.

**Root cause 3 — confirm password field not filled:**

`InviteAcceptPom.fillAndSubmit()` filled name + password but not the confirm-password field.
`canSubmit = passwordValid && passwordsMatch && displayName.trim()` — with an empty confirm
field `passwordsMatch` was `false`, submit button stayed disabled, `click()` timed out.

**Fix:**
- Added `data-testid="invite-confirm-password"` to `<input>` in `InviteAcceptScreen.jsx`
- Added `confirmPasswordInput()` method to `InviteAcceptPom.ts`
- Updated `fillAndSubmit()` to fill confirm-password before clicking submit

**Injection strategy (localStorage, not URL hash):**

The E2E admin client uses the demo Supabase project; the dev server uses the demo project (when
started from `.env.e2e.local`). A URL hash with a demo-issued JWT would be validated by GoTrue
Auth-v1 of whatever server the browser hits — if the server happens to be prod, that is a
403. localStorage injection bypasses Auth-v1: `_recoverAndRefresh()` checks token expiry by
timestamp only (no network call) for non-expired tokens. `addInitScript` is used so the
session is present before any page script runs, ensuring GoTrue finds it on first
`_initialize()`.

**POM:** `InviteAcceptPom.ts` — `nameInput()`, `passwordInput()`, `confirmPasswordInput()`,
`submitBtn()`, `successMsg()`, `fillAndSubmit(name, password)`, `expectSuccess()`

**Testids added:** `invite-name`, `invite-password`, `invite-confirm-password`, `invite-submit`,
`invite-success`

**Tests:**
- Invite page loads from injected session and shows form
- Fill name + password + confirm → submit → success message visible

### 3. Criteria drawers (`e2e/admin/criteria.spec.ts`) — 4 tests

Serial spec; `beforeAll` removes any leftover criterion matching the suffix so duplicate-name
errors don't break the "fill and save" test on re-runs.

**POM:** `CriteriaPom.ts` — `addBtn()`, `criteriaRows()`, `openAddDrawer()`, `drawer()`,
`drawerNameInput()`, `drawerWeightInput()`, `drawerSaveBtn()`, `fillAndSave(name, weight)`,
`waitForReady()`

**Testids added:** `criteria-add-btn`, `criteria-drawer`, `criteria-drawer-name`,
`criteria-drawer-weight`, `criteria-drawer-save`

**Tests:**
- Criteria page loads and add button is visible
- Add button opens drawer
- Fill name + weight and save → drawer closes
- Save with no name keeps drawer open (client-side validation)

### 4. Outcomes drawers (`e2e/admin/outcomes.spec.ts`) — 3 tests

Same serial pattern as criteria. Uses a distinct period fixture
(`cccccccc-0005-4000-c000-000000000005`) to avoid cross-spec data conflicts.

**POM:** `OutcomesPom.ts` — `addBtn()`, `outcomeRows()`, `openAddDrawer()`, `drawer()`,
`drawerCodeInput()`, `drawerLabelInput()`, `drawerSaveBtn()`, `fillAndSave(code, label)`,
`waitForReady()`

**Testids added:** `outcomes-add-btn`, `outcomes-drawer`, `outcomes-drawer-code`,
`outcomes-drawer-label`, `outcomes-drawer-save`

**Tests:**
- Outcomes page loads and add button is visible
- Add button opens drawer
- Fill code + label and save → drawer closes

### 5. Pin-blocking (`e2e/admin/pin-blocking.spec.ts`) — 2 tests

`beforeEach` resets seed juror to `is_blocked: true` so repeat runs always see the locked state.
Uses fixed seed juror ID (`eeeeeeee-0001-4000-e000-000000000001`) from demo DB.

**POM:** `PinBlockingPom.ts` — `unlockBtn(jurorId)`, `clickUnlock(jurorId)`, `modal()`,
`closeModal()`, `waitForReady()`

**Testids added:** `pin-blocking-unlock-{jurorId}`, `pin-blocking-modal`,
`pin-blocking-modal-close`

**Tests:**
- Locked juror unlock button is visible
- Clicking unlock opens the PIN modal (modal closes cleanly)

### 6. Settings page (`e2e/admin/settings.spec.ts`) — 2 tests

Targets super-admin visible sections. Tests confirm the security policy button is present and
opens a drawer, without mutating any settings data.

**POM:** `SettingsPom.ts` — `securityPolicyBtn()`, `drawer()`, `waitForReady()`

**Testids added:** `settings-security-policy-btn`, `settings-drawer`

**Tests:**
- Settings page loads — security policy button is visible (super admin)
- Security policy button opens drawer

---

## Key fix: `AuthProvider.jsx` deadlock (affects all future invite-accept work)

The fix lives in `src/auth/shared/AuthProvider.jsx` at the `handleAuthChange` function. It
extends the existing `skipAdminBootstrap` / `isJuryOrEvalPath` pattern. The early return
prevents `fetchMemberships()` from being called on `/invite/accept`, which breaks the
`initializePromise` circular wait.

**Files changed:**
- `src/auth/shared/AuthProvider.jsx` — deadlock fix
- `src/auth/features/invite/InviteAcceptScreen.jsx` — added `data-testid="invite-confirm-password"`
- `e2e/auth/invite-accept.spec.ts` — uses localStorage injection + `addInitScript`
- `e2e/poms/InviteAcceptPom.ts` — added `confirmPasswordInput()`, updated `fillAndSubmit()`

---

## Final counts

| Metric | Value |
|---|---|
| Total tests passing | **67** |
| Skipped (pre-existing) | 1 |
| Failures | 0 |
| New spec files | 6 |
| New POMs | 6 |

### Tests by file (full suite)

| File | Tests |
|---|---|
| `e2e/admin/admin-login.spec.ts` | 3 |
| `e2e/admin/analytics.spec.ts` | 2 |
| `e2e/admin/audit-log.spec.ts` | 5 |
| `e2e/admin/criteria.spec.ts` | 4 |
| `e2e/admin/entry-tokens.spec.ts` | 3 |
| `e2e/admin/heatmap.spec.ts` | 2 |
| `e2e/admin/jurors-crud.spec.ts` | 4 |
| `e2e/admin/organizations-crud.spec.ts` | 4 |
| `e2e/admin/outcomes.spec.ts` | 3 |
| `e2e/admin/periods.spec.ts` | 4 (+1 skipped) |
| `e2e/admin/pin-blocking.spec.ts` | 2 |
| `e2e/admin/projects-import.spec.ts` | 1 |
| `e2e/admin/projects.spec.ts` | 3 |
| `e2e/admin/rankings-export.spec.ts` | 2 |
| `e2e/admin/reviews.spec.ts` | 2 |
| `e2e/admin/settings.spec.ts` | 2 |
| `e2e/admin/setup-wizard.spec.ts` | 6 |
| `e2e/admin/tenant-admin.spec.ts` | 1 |
| `e2e/auth/forgot-password.spec.ts` | 3 |
| `e2e/auth/invite-accept.spec.ts` | 2 |
| `e2e/demo/demo-autologin.spec.ts` | 2 |
| `e2e/jury/evaluate.spec.ts` | 3 |
| `e2e/jury/happy-path.spec.ts` | 3 |
| `e2e/jury/lock.spec.ts` | 1 |
| `e2e/jury/resume.spec.ts` | 1 |
| **Total** | **68 (67 pass, 1 skip)** |

---

## Architecture notes

- **`addInitScript` vs `evaluate + reload`** for localStorage injection: `page.evaluate` runs
  after page scripts have started; GoTrue's `_initialize()` may have already read localStorage.
  `addInitScript` fires before any page script, so the session is present when
  `_recoverAndRefresh()` first checks on `goto`. This is the correct injection point.
- **`reuseExistingServer` stale-server hazard:** Locally, Playwright reuses whatever server is
  on port 5174 without checking its env vars. A server started with prod credentials will use
  a different GoTrue storage key than the E2E admin client. Always kill any stale dev server
  before running invite-accept specs locally, or run with `CI=1` to force a fresh server.
- **`isInviteAcceptPath` pattern** deliberately mirrors the existing `isJuryOrEvalPath` guard.
  Both patterns represent routes where the auth state machine must not perform admin bootstrap
  operations — the invite form only needs a session object, not tenant memberships.
