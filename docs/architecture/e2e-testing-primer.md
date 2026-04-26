Ara not — devam etmeden önce oku:

docs/architecture/e2e-testing-primer.md

Özellikle şu üç bölüm senin şu anki çıkmazını karşılıyor:

- Bölüm 2 (Auth lifecycle + hook guard pattern) — isSuper state'i ne zaman
  true oluyor ve useManageOrganizations'ın enabled guard'ı nasıl devrede.

- Bölüm 3 (RPC invocation path, "What the logs show and how to read them") —
  "anon + permission denied" = timing bug, "authenticated + unauthorized" =
  function check. İki şüpheli RPC'nin loglarını bu tabloya göre sınıflandır;
  ikisi aynı kategoride mi, farklı mı? GRANT anon asla çözüm değil.

- Bölüm 4 Race B — senin gözlemlediğin semptomla birebir aynı: "page mount
  before auth ready". Önerilen mitigation: useAuth().loading bitene kadar
  hook'un RPC atmaması.

Sonra şu sırayla ilerle:

1. İki RPC'nin Supabase loglarında role alanını doğrula (anon/authenticated).
   mcp__claude_ai_Supabase__get_logs kullan.

2. Eğer her ikisi de anon → OrganizationsPage'in enabled guard'ı doğru ama
   sayfa ilk mount'ta isSuper=false iken bir şekilde çağrı tetikleniyor.
   loadOrgs çağrı zincirini izle (useEffect, useMemo, doğrudan useState init).

3. Eğer list=anon, create=authenticated → iki ayrı bug. List'i guard ekleyerek
   çöz, create için function body'sini tekrar oku (current_user_is_super_admin
   içeriği primer bölüm 3'te, memberships.organization_id IS NULL koşuluyla
   — E2E kullanıcının bu kriterde bir satırı olmalı, önceki sprint DB
   doğrulamasında vardı).

Devam et, ama primer'ı ilk adımında oku — 10 dk, sonraki bütün sprintte de
geçerli yatırım.
# E2E Testing Primer — Auth, RPCs, Timing, and Known Traps

**Audience:** Any engineer (or agent) about to write or modify an E2E spec in this repo.
**Purpose:** Capture the implicit architectural rules that E2E tests keep re-discovering sprint after sprint, so you don't waste a window relearning them.
**Last updated:** 2026-04-24 (after B1, B2 bug fixes; B3 in progress)

**Read this primer end-to-end before your first spec.** It's ~15 minutes. It will save you at least one 5-hour window on your first sprint and every sprint thereafter.

---

## 1. Mental model in one paragraph

The app is a React SPA backed by Supabase. Admin auth is JWT-based via `supabase.auth`; almost every admin RPC is a SQL function marked `SECURITY DEFINER` that internally calls `current_user_is_super_admin()` or `_assert_tenant_admin()`. These checks rely on `auth.uid()`, which is derived from the JWT sent on every request. If the JWT is missing or stale, `auth.uid()` returns NULL, the check fails, and the RPC raises `unauthorized` (or PostgREST returns `permission denied` if no `GRANT` covers the anon role). Most "weird E2E failures" in this codebase trace back to three patterns: **(1) the JWT isn't attached to the first request after sign-in**, **(2) a hook fires an RPC before the auth state is ready**, or **(3) the client's cached session was cleared between sign-in and the RPC**. All three look like permission errors in DB logs. The fix is almost never "GRANT anon" or "bypass RLS" — it's "make the client wait until auth is actually ready."

---

## 2. Auth lifecycle — the sequence every spec depends on

`src/auth/shared/AuthProvider.jsx` is the single source of truth. The sequence below is what happens after `await supabase.auth.signInWithPassword(...)`:

```
1. supabase-js writes session + tokens to localStorage (persistence layer)
2. supabase-js fires AuthStateChange event ("SIGNED_IN")
3. AuthProvider.handleAuthChange runs:
   a. setSession(newSession) — React state
   b. fetchMemberships() → calls getSession() in src/shared/api/admin/auth.js
      → which calls supabase.auth.getUser() → returns cached user
      → then supabase.from("memberships").select(...).eq("user_id", user.id)
        plus profiles fetch in parallel
   c. setOrganizations(list) — React state
   d. Compute isSuper (some org has role === 'super_admin')
   e. Compute profileIncomplete (organizationList.length === 0 && !profile_completed)
   f. If persistence mode is "session only" (remember-me off),
      clearPersistedSession() is called at end of handleAuthChange
      → wipes localStorage auth-token so it doesn't survive browser close
4. React re-renders; admin guards evaluate the new state
5. Pages mount, their hooks fire RPCs — only NOW is the JWT reliably attached
```

### Critical invariant

**The first network call that requires a JWT must happen AFTER step 3 completes, not between step 1 and step 3.** Supabase-js attaches the JWT from its in-memory session, which is populated when `SIGNED_IN` fires. If a `supabase.rpc()` fires before the session is in the client's memory, the request goes out with the anon key only — even if localStorage has the token.

### Hook-level guard pattern (learned in B3)

Every admin page that reads data on mount must gate its load on `!authLoading && isSuper` (or `hasActiveOrganization`, depending on the domain):

```js
// src/admin/features/organizations/OrganizationsPage.jsx:29
const { isSuper, loading: authLoading } = useAuth();

// src/admin/features/organizations/OrganizationsPage.jsx:68
useManageOrganizations({
  enabled: isSuper,   // ← good: hook no-ops while isSuper is false
  // ...
});
```

The hook's useEffect is keyed on `[enabled]`, so when `enabled` flips to true, the RPC fires. This works IF `isSuper` becomes true only after step 3. It does, because `isSuper` is derived from `organizations` state which is set inside `handleAuthChange`.

**Anti-pattern:** a page that reads directly from localStorage (`adminStorage` / `juryStorage`) and fires an RPC based on that, without consulting `useAuth().loading`. The storage may be populated before the client's session memory is.

---

## 3. RPC invocation path — what leaves the browser and what comes back

### Client-side dispatch

Admin API modules in `src/shared/api/admin/**` call `supabase.rpc("rpc_admin_*", { ... })` directly in dev and route through the `rpc-proxy` Edge Function in prod:

```js
// src/shared/api/core/invokeRpc.js (or equivalent)
const USE_PROXY = !import.meta.env.DEV;
```

**E2E runs in dev mode** (Vite dev server started by Playwright's `webServer`), so `USE_PROXY = false` and RPCs go direct to PostgREST. You will almost never need to worry about the proxy in E2E.

### Server-side reception

Every admin RPC function is declared `SECURITY DEFINER`. It runs with postgres owner privileges, but:

- `auth.uid()` is still computed from the **caller's JWT**, not the definer's identity.
- If no JWT → `auth.uid()` is NULL → any `current_user_is_super_admin()` check fails.
- If JWT is present but for a different user → the membership lookup returns the wrong row or nothing.

Example — `current_user_is_super_admin()` definition (verified 2026-04-24):

```sql
CREATE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = (SELECT auth.uid())
      AND organization_id IS NULL
  );
$$;
```

Note the absence of `AND status='active'`. Super-admin membership status isn't asserted here — if the row exists at all with `organization_id IS NULL`, the function returns true. Tenant-admin RPCs have stricter checks via `_assert_tenant_admin()`.

### What the logs show and how to read them

Supabase logs record the role that made each query: `anon`, `authenticated`, `service_role`, etc.

- **`anon` + `permission denied`** → client didn't send the JWT. Root cause is either timing (fired before session ready) or session wiped (the B2 bug). **Not** a missing GRANT. Do not grant `authenticated` to `anon`.
- **`authenticated` + `unauthorized`** → JWT was sent, but the function's own check failed. Look at `current_user_is_super_admin()` or `_assert_tenant_admin()`. Usually means the logged-in user doesn't have the membership the function requires.
- **`authenticated` + `permission denied`** → PostgREST-level denial. Usually a missing `GRANT EXECUTE ON FUNCTION ... TO authenticated`. Check the migration that creates the function.
- **`execution_time_ms ≈ 0`** → Kong pre-rejected the request (JWT invalid from Kong's perspective). For Edge Functions with `verify_jwt: true` and an ES256 JWT, Kong will reject it. Fix is `verify_jwt: false` + custom auth inside the function (see `supabase/functions/platform-metrics/` and `admin-session-touch/` for reference implementations).

**If you don't know which role the caller used, check the logs before theorizing.** Teams consistently waste hours debugging a "permission" error without first looking at `role` in the log row.

---

## 4. The three race conditions we know about

### Race A — clearPersistedSession() vs supabase-js bootstrap (B2, FIXED)

**Symptom:** user signs in, URL briefly goes to `/admin`, then redirects to `/register`. DB logs show `getSession()` membership query returning 0 rows for a user whose membership row exists and whose RLS policy allows the read.

**Root cause:** `AuthProvider.signIn()` used to call `clearPersistedSession()` right after `signInWithPassword()` succeeded, before supabase-js had finished writing its session to its own in-memory cache. The wipe removed localStorage entries supabase-js was about to read; the next `supabase.from('memberships').select()` went out with anon credentials; RLS correctly returned nothing; AuthProvider saw empty `organizationList` and redirected to `/register`.

**Fix (committed `b55c5b6`):** removed the premature `clearPersistedSession()`. The equivalent clear still runs at the end of `handleAuthChange` (the session-only persistence mode for remember-me-off users), but only AFTER bootstrap is complete.

**Lesson:** Never mutate persistence state between `signIn*()` returning and the `SIGNED_IN` handler finishing.

### Race B — page mount before auth ready (B3, ongoing)

**Symptom:** RPC logs show `role: anon` on admin-page loads even though sign-in completed. Specifically `rpc_admin_list_organizations` returns `permission denied` because the first call happens before `isSuper` is true.

**Root cause (hypothesis):** admin pages mount and their hooks start firing before step 3 of the lifecycle finishes. If a hook's `enabled` guard reads something other than `useAuth().isSuper && !useAuth().loading`, it can fire prematurely.

**Mitigation:** ensure every admin-page hook gates its load on `enabled: !authLoading && isSuper` (or the appropriate role for tenant-admin pages). Confirmed present for Organizations at `OrganizationsPage.jsx:68` — `enabled: isSuper`. But other pages may not have this guard.

### Race C — session across E2E tests (potential, not yet hit)

**Symptom (predicted):** Test 1 signs in and leaves the session in localStorage. Test 2 starts a fresh browser context but inherits... wait, Playwright creates a fresh context per test by default, so this shouldn't happen. BUT if you use `test.describe.configure({ mode: 'serial' })` and share a context, this becomes relevant.

**Guidance:** do not share browser context across tests unless explicitly needed (and then use a clean login step at the start of each). Each test should assume it starts with no session.

---

## 5. E2E environment specifics

### Environment files

Playwright loads env vars in this order (see `playwright.config.ts`):

1. `.env.e2e.local` (override: true)
2. `.env.local` (override: false, backfill only)

**Use `.env.e2e.local` for everything E2E-specific**, including:
- `VITE_SUPABASE_URL` (points to vera-demo: `https://<demo-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RPC_SECRET`
- `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
- `E2E_BASE_URL` (default `http://localhost:5173`)

Never put E2E credentials in `.env.local` — that's the dev-mode file and can lead to prod/E2E mixing.

### Dev server under E2E

`playwright.config.ts` sets `webServer.command = "npm run dev"` and points it at the E2E env vars. `reuseExistingServer: !process.env.CI` means locally a running dev server on 5173 is reused; in CI a fresh one starts.

**Implication:** if you have `npm run dev` already running against `.env.local` (prod), Playwright will happily reuse it — with the wrong credentials. Either stop your dev server before `npm run e2e`, or confirm the running server has E2E env.

### Browser binaries

Playwright browsers live in `~/Library/Caches/ms-playwright/`. After `rm -rf node_modules && npm install` they disappear; run `npx playwright install` to restore. Error signature: `Executable doesn't exist at .../chrome-headless-shell`.

### Target project

E2E runs against **vera-demo only**. Never point E2E at vera-prod. Seed changes made for E2E must still be applied to both projects to keep parity (project rule), but the actual test traffic stays on demo.

---

## 6. Data-testid contract (Session B rule)

Session B enforces testid-only selectors. Before writing a new spec:

1. **Every interactive element the spec touches must have `data-testid` already.** If it doesn't, add the attribute first — do not fall back to text/role/placeholder.
2. **Naming convention:** `{scope}-{component}-{element}`, lowercase, hyphen-separated.
    - `admin-login-email`, `admin-login-submit`
    - `admin-shell-nav-overview`, `admin-shell-signout`
    - `orgs-drawer-name`, `orgs-row-kebab`, `orgs-delete-confirm-yes`
    - `jury-identity-name`, `jury-pin-digit-0`
3. **Shared UI primitives accept testid as a prop.** `FbAlert` already does (B2). `Modal`, `Drawer`, `ConfirmDialog`, `CustomSelect` may need the same passthrough — add it on first use, following FbAlert's pattern.
4. **Testid additions must not change behaviour.** Only add the attribute. Do not rename props, restructure JSX, or move markup. Session A (unit tests) runs in parallel; non-testid DOM changes break their assertions.
5. **BasePom.byTestId(id)** is the only accessor in new POMs. No `getByRole`, `getByPlaceholder`, `locator(':has-text(...)')`.

### Testid inventory registry

Each sprint's implementation report lists the testids added. Before adding a new one, grep the reports to avoid duplicating an existing testid or naming the same thing differently:

```bash
grep -r "data-testid" .claude/internal/plans/session-b-e2e-test-coverage/implementation_reports/
```

---

## 7. Diagnostic checklist — when a spec fails, run these in order

Before rewriting a selector, changing a hook, or suspecting a bug:

### Step 1 — read the network log
Run the spec with `--trace on` or `--headed`:
```bash
npm run e2e -- --grep "<your spec>" --headed --workers=1
```
Open DevTools → Network tab. For each failing RPC:
- Status code? (401 vs 403 vs 500 tell very different stories)
- `Authorization` header present? `apikey` header? Both?
- Request payload matches what the RPC expects?

### Step 2 — read the Supabase logs
Via `mcp__claude_ai_Supabase__get_logs` or the dashboard. Filter to the last minute. For the failing call:
- `role` field: `anon` / `authenticated` / `service_role`?
- `execution_time_ms`: 0 = Kong rejected; >50 = function-internal error
- `error_message`: is it `unauthorized` (function check failed) or `permission denied` (role lacks GRANT)?

### Step 3 — confirm the SQL function behaves
Before suspecting a client bug, verify the function returns what you expect when called from a known-good role:
```sql
SELECT current_user_is_super_admin();    -- as the service_role via MCP
-- or
SELECT * FROM public.rpc_admin_list_organizations();
```
(Remember that service_role `auth.uid()` is NULL, so these checks will behave differently than for an authenticated user. Usually you confirm the function definition is correct by reading `pg_get_functiondef(...)`.)

### Step 4 — read AuthProvider state in the browser
In the test, add a temporary log:
```ts
await page.evaluate(() => {
  const auth = (window as any).__VERA_AUTH__;
  console.log({ loading: auth?.loading, isSuper: auth?.isSuper, orgs: auth?.organizations });
});
```
(AuthProvider may need to expose itself on window for this; add during diagnosis, remove before commit.)

### Step 5 — suspect yourself before suspecting the framework
- "Playwright didn't wait for the navigation" → 99% you're asserting before the await resolves.
- "The testid isn't found" → 99% you added it to the wrong element or forgot the rebuild (Vite HMR usually catches; hard reload if in doubt).
- "The RPC is failing intermittently" → race condition. Fix the root, not the retry count.

---

## 8. Anti-patterns — things to refuse when tempted

| Tempting fix | Why it's wrong | What to do instead |
|---|---|---|
| `GRANT EXECUTE ... TO anon` on an admin RPC | Opens the RPC to unauthenticated callers. Security regression. Masks the real bug. | Fix the timing so the JWT arrives with the call. |
| Bypass RLS on memberships for the test user | E2E stops testing real security. First prod regression you'll catch via customer report. | Use a proper super-admin membership row (already seeded). |
| Add `await page.waitForTimeout(500)` to "fix flake" | Masks timing bugs. Breaks on slower/faster machines. | Identify the event the test is racing (navigation, hook-ready, network-idle) and wait for that specifically. |
| Retry a failing RPC at the client level | Hides race conditions; turns a deterministic bug into a flaky test. | Gate the RPC on the state it needs. |
| Use `any`-typed helpers to dodge type errors in POMs | Gives up the one real advantage of TypeScript specs. | Model the types. They're usually 2 lines. |
| Copy a selector from `e2e/legacy/` into a rewrite spec | Legacy selectors are why we're rewriting. | Copy the **flow** (what the test does, in what order), then rewrite selectors as testids. |

---

## 9. Starting a new sprint — opening checklist

Before writing the first line of test code:

- [ ] Read `.claude/internal/plans/session-b-e2e-test-coverage/README.md` for the current sprint scope.
- [ ] Read the previous sprint's implementation report.
- [ ] Read this primer (you're doing it now).
- [ ] Confirm `npm run e2e` on `main` passes with the baseline count.
- [ ] For each flow the sprint will cover, open the corresponding `e2e/legacy/**/*.spec.ts` and read what it was trying to do. Ignore the selectors.
- [ ] Check the relevant page/hook for the `enabled: !authLoading && <role>` guard (Section 2). If missing, that's your first fix, not a new spec.
- [ ] List the UI primitives the sprint will touch (Modal/Drawer/ConfirmDialog/CustomSelect) and check whether they already accept `data-testid` as a prop. If not, note them as prerequisites.
- [ ] Have `mcp__claude_ai_Supabase__execute_sql` handy for verifying function definitions and membership rows when a test fails.

---

## 10. Known-good reference files

When in doubt, these are the current "canon" to emulate:

- **POM base class:** `e2e/poms/BasePom.ts`
- **First rewrite spec:** `e2e/admin/admin-login.spec.ts`
- **Auth lifecycle reference:** `src/auth/shared/AuthProvider.jsx` (especially `handleAuthChange`)
- **API wrapper pattern:** `src/shared/api/admin/auth.js` (the `getSession` function)
- **Hook with correct enabled guard:** `src/admin/shared/useManageOrganizations.js` combined with `OrganizationsPage.jsx:68`
- **SECURITY DEFINER RPC:** `rpc_admin_list_organizations` (read via MCP)
- **Edge Function with custom auth (Kong verify_jwt:false pattern):** `supabase/functions/platform-metrics/index.ts`

---

## 11. Updating this primer

This document is a living artifact. Update it when:

- A new race condition or bug class is discovered and fixed.
- A new convention (testid naming, POM pattern) is adopted.
- A hook, RPC, or auth flow changes shape.
- A piece of "tribal knowledge" emerges from a sprint report that would save another agent time.

Every sprint's implementation report should end with "Primer updates needed?" as a prompt. If yes, open a PR that touches this file alongside the sprint's code changes.
