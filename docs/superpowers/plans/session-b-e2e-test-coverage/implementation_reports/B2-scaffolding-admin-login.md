# B2 — Rewrite scaffolding + Admin login flow (CLOSED)

**Sprint:** B2 (Session B)
**Date closed:** 2026-04-24
**Status:** Green — all exit criteria met

---

## Exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Legacy suite archived under `e2e/legacy/**`; `npm run e2e` excludes it | ✅ |
| 2 | Admin login redirect-to-/register blocker fixed, root cause documented | ✅ |
| 3 | First green rewrite suite: `admin-login.spec.ts`, 3 tests, testid-only, `--repeat-each=3` clean | ✅ |

Pass-rate delta — legacy `14/57`, rewrite `3/3` (legacy excluded from runner). `npm run e2e` ran 3 tests in 5.3s with zero flakes; `--repeat-each=3` ran 9/9 green in 13.2s.

---

## Step 1 — Legacy archive

Moved (via `git mv`) to `e2e/legacy/`:

- `e2e/admin/` (6 specs: audit-log-view, entry-token-lifecycle, jurors-crud, organizations-crud, periods-crud, setup-wizard)
- `e2e/auth/` (5 specs: forgot-password, google-oauth, invite-accept, register-happy-path, reset-password)
- `e2e/jury/` (1 spec: pin-lifecycle)
- `e2e/demo/` (2 specs: auto-login, isolation)
- `e2e/helpers/` (4 files: AdminShell.ts, DemoHelper.ts, JuryFlow.ts, LoginPage.ts)
- Root-level specs: `admin-export`, `admin-import`, `admin-login`, `admin-results`, `jury-flow`, `jury-lock`, `tenant-isolation`

`playwright.config.ts` updated — added `testIgnore: ["**/legacy/**"]`. Runner confirmed excluding them (`npx playwright test --list` → 0 tests before Step 5 added the new spec).

---

## Step 2 — POM scaffolding

Created `e2e/poms/`:

### BasePom.ts
```ts
abstract class BasePom {
  constructor(public readonly page: Page)
  byTestId(id: string): Locator
  goto(path: string): Promise<void>
  expectUrl(pattern: RegExp): Promise<void>
}
```

### LoginPom.ts (extends BasePom)
```ts
goto(): Promise<void>
emailInput() | passwordInput() | submitButton() | errorBanner(): Locator
fillEmail(value) | fillPassword(value) | submit(): Promise<void>
signIn(email, password): Promise<void>
expectErrorMessage(pattern?: RegExp): Promise<void>
```

### AdminShellPom.ts (extends BasePom)
```ts
root() | sidebar() | signOutButton() | navItem(key): Locator
expectOnDashboard(): Promise<void>
clickNav(key: string): Promise<void>
signOut(): Promise<void>
```

All selectors go through `byTestId()`. No text / role / placeholder selectors anywhere in the POMs.

---

## Step 3 — data-testid attributes added

All added as pure attribute additions (no renames, no restructures). File → testid list:

| File | Testids added |
|---|---|
| `src/auth/features/login/LoginScreen.jsx` | `admin-login-email`, `admin-login-password`, `admin-login-submit`, `admin-login-error` (via FbAlert prop) |
| `src/shared/ui/FbAlert.jsx` | Accepts `data-testid` prop and forwards to root `<div>` (infra-only change; used by login error banner) |
| `src/admin/layout/AdminSidebar.jsx` | `admin-shell-sidebar` (root), and full nav set: `admin-shell-nav-{setup,overview,rankings,analytics,heatmap,reviews,jurors,projects,periods,criteria,outcomes,entry-control,pin-blocking,audit-log,organizations,settings}`, plus `admin-shell-signout` |
| `src/layouts/AdminRouteLayout.jsx` | `admin-shell-root` |
| `src/landing/LandingPage.jsx` | `admin-landing-signin` |

Notifying Session A: the full `admin-shell-nav-*` set is available for unit-test assertions on sidebar rendering.

---

## Step 4 — Admin login blocker: root cause + fix

### Diagnosis (evidence-based)

Added temporary `[B2-DIAG]` logging inside `handleAuthChange` and ran a throwaway E2E spec (since removed) that signs in as `demo-admin@vera-eval.app`, captures the browser console, and reports the final URL.

**Iteration 1** — log `fetchMemberships` result:
```text
final URL: /register
fetchMemberships returned { count: 0, userId: "6ea7146f-…", userMeta: {} }
```

**Iteration 2** — compare the SIGNED_IN event session vs the client's cached session, and issue a direct REST call with the event's token to isolate the failure layer:
```text
fetchMemberships#1 { count: 0, cachedTokenLen: 0, newSessionTokenLen: 723 }
direct REST with newSession token: { status: 200, count: 1, body: [{ role: "super_admin", status: "active" }] }
```

### Root cause (NOT H1, NOT H2 as originally framed)

B1 framed the failure as either H1 (seed: `profile_completed` null) or H2 (JWT timing / RLS mismatch). **Neither was the actual cause.**

The real cause is in `signIn()` (`src/auth/shared/AuthProvider.jsx:511`):

```js
if (!rememberMe) clearPersistedSession();
```

`clearPersistedSession` deletes the `sb-<hostname>-auth-token` localStorage keys. On a fresh sign-in with `rememberMe=false` (the E2E default — no prior preference stored), this fires **immediately after** `signInWithPassword()` returns and **before** supabase-js completes its internal session write / SIGNED_IN dispatch. The storage-clear causes supabase-js to drop its cached session (via its storage-sync path), so when `handleAuthChange` subsequently calls `fetchMemberships → getSession → supabase.auth.getUser`, the client's `getSession()` returns an empty-token session and PostgREST queries go out with no `Authorization` header. RLS evaluates `auth.uid() = null` and returns 0 rows. `organizationList.length === 0` + `user_metadata.profile_completed` undefined → `setProfileIncomplete(true)` → `RootLayout.jsx:24-28` navigates to `/register`.

The direct REST call with `newSession.access_token` returns the membership row (status 200, count 1) — proving both the DB state and the JWT are correct. Only the client's cached session is empty. That rules out H1 (seed) and H2 (timing / JWT propagation) definitively.

### Fix

One-line removal in `src/auth/shared/AuthProvider.jsx`:

```diff
-    if (!rememberMe) clearPersistedSession();
+    // Session persistence is handled by handleAuthChange (see clearPersistedSession
+    // call keyed off ADMIN_REMEMBER_ME). Clearing storage here races with
+    // supabase-js finishing its own session write and leaves the client's
+    // cached getSession() empty, so the first PostgREST query after sign-in
+    // goes out unauthenticated and RLS returns 0 rows.
```

The equivalent clear already runs at `AuthProvider.jsx:342` **after** `fetchMemberships()` completes, inside `handleAuthChange`:

```js
if (!skipAdminBootstrap) {
  try {
    if (localStorage.getItem(KEYS.ADMIN_REMEMBER_ME) === "false") {
      clearPersistedSession();
    }
  } catch {}
}
```

So the "no-persist on browser close" behavior for remember-me=false is preserved — only the redundant, race-prone call in `signIn()` is gone.

### Verification

After the fix, the same diagnostic spec reported:

```text
final URL: /admin/overview
fetchMemberships#1 { count: 1, cachedTokenLen: 723, newSessionTokenLen: 723 }
```

AuthProvider + AuthGuard + useAuth unit suites (12/12) still green. Then the diagnostic instrumentation was removed and the throwaway spec deleted.

### No DB or seed change needed

Neither H1 nor H2 required a fix. `raw_user_meta_data` stays null for the demo-admin, `email_verified_at` on `profiles` stays null — these are not load-bearing. No `apply_migration` was run; `vera-prod` and `vera-demo` DB state unchanged.

---

## Step 5 — First green spec suite

`e2e/admin/admin-login.spec.ts` — 3 tests:

1. **Happy path** — sign in with valid credentials → `AdminShellPom.expectOnDashboard()` (URL matches `/admin(/|$)`; `admin-shell-root` + `admin-shell-sidebar` visible).
2. **Wrong password** — error banner visible with text matching `/invalid email or password/i`; URL stays on `/login`.
3. **Unknown email** — same expectation; Supabase returns the same generic message to avoid user enumeration.

Run results:

- `npm run e2e` — 3/3 green in 5.3s.
- `npm run e2e -- --repeat-each=3 --workers=1` — 9/9 green in 13.2s. No flakes.

All three tests use **only** `data-testid` selectors through the POMs (no text / role / placeholder anywhere).

---

## Pass-rate delta

| Snapshot | Passing | Notes |
|---|---|---|
| End of B1 | 14 / 57 | legacy suite, ~23 failing, ~20 not run |
| End of B2 | 3 / 3 | legacy excluded from runner, rewrite foundation begins |

The denominator dropping is intentional — legacy specs are archived, not deleted (`e2e/legacy/**`), and can be consulted as behaviour oracles during B3–B5.

---

## New testids for Session A

The sidebar nav exposes a full set:

- `admin-shell-root`, `admin-shell-sidebar`, `admin-shell-signout`
- `admin-shell-nav-{setup, overview, rankings, analytics, heatmap, reviews, jurors, projects, periods, criteria, outcomes, entry-control, pin-blocking, audit-log, organizations, settings}`
- `admin-login-{email, password, submit, error}`
- `admin-landing-signin`

Unit tests are welcome to assert against any of these — the contract is stable for B2+.

`FbAlert` now forwards `data-testid` to its root `<div>`. Any future use of `<FbAlert data-testid="…">` will work the same way as the login error banner.

---

## Files touched

- `playwright.config.ts` — add `testIgnore`
- `e2e/legacy/**` — archived (git mv)
- `e2e/poms/BasePom.ts` (new)
- `e2e/poms/LoginPom.ts` (new)
- `e2e/poms/AdminShellPom.ts` (new)
- `e2e/admin/admin-login.spec.ts` (new)
- `src/auth/features/login/LoginScreen.jsx` — 4 testids
- `src/shared/ui/FbAlert.jsx` — forward `data-testid` prop
- `src/admin/layout/AdminSidebar.jsx` — sidebar root + signout + 16 nav testids
- `src/layouts/AdminRouteLayout.jsx` — shell root testid
- `src/landing/LandingPage.jsx` — landing signin testid
- `src/auth/shared/AuthProvider.jsx` — remove redundant `clearPersistedSession()` from `signIn()`

No DB migration, no seed update, no Edge Function change.

---

## Things worth flagging for B3

1. **Fast-path when admin already logged in.** Current `admin-login.spec.ts` relies on a fresh sign-in each run. If B3 stacks many admin CRUD specs, consider a storage-state fixture that re-uses a signed-in session between tests (Playwright `storageState`). Works naturally with the fix above — the session is now stable in storage.
2. **Flake floor looks good.** 9/9 `--repeat-each=3` in 13.2s → ~1.5s per test, well under the 30s timeout. No retries needed for B2 specs; keep that bar for B3.
3. **FbAlert prop forwarding as a pattern.** If B3 adds error-banner assertions in other domains (orgs, periods, jurors), use `data-testid` on the FbAlert instance rather than adding a dedicated error wrapper. Convention: `{scope}-{component}-error`, e.g. `orgs-drawer-error`, `periods-drawer-error`.
4. **FallbackLoginForm has no testids.** `AdminRouteLayout`'s `FallbackLoginForm` (rendered only if `LazyLoginForm` fails to load) is untested. Unlikely to matter, but if a test ever hits it the selectors won't match. Not worth adding testids there unless we also add a spec that forces the fallback path.
5. **Admin-login error path is English-locale-specific.** The `/invalid email or password/i` regex would break if login copy is ever localised. B3 specs touching error banners should consider asserting against the banner's *presence and testid* rather than the message body where possible.
