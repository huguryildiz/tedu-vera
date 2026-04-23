# B1 — Helper Repair (CLOSED — partial win)

**Sprint:** B1 (Session B)
**Date closed:** 2026-04-24
**Status:** Partial — pivot to rewrite (see updated README)

---

## Outcome

| Metric | Before | After |
|---|---|---|
| Passing | 10 / 57 | 14 / 57 |
| Failing | ~25 | ~23 |
| Skipped / did not run | 22 | 20 |

Exit criteria was "40+ passing". Not met — the drift in the legacy suite proved too deep for per-spec repair to be economical, which triggered the rewrite pivot documented in `README.md`.

---

## Fixes applied (held for rewrite reference)

### 1. Jury ArrivalStep — `e2e/helpers/JuryFlow.ts` + `e2e/jury-flow.spec.ts`

A new `/jury/arrival` step had been inserted before `/jury/identity`. Tests tried to fill the identity form without clicking the "Begin jury session" button first.

**Fix:** Added `beginBtn.click()` + `waitForURL(/\/jury\/identity/)` before identity-form interactions in both the helper and the spec.

### 2. Register label — `e2e/auth/register-happy-path.spec.ts`

Form label had been renamed from "Institutional Email" to "Email". Spec still searched `/Institutional Email/i`.

**Fix:** Updated selector to `/Email/i`.

### 3. Landing "Admin" button — `e2e/helpers/LoginPage.ts`

The landing-page entry button had been refactored. Prior session (before B1 logged here) already updated the helper to use `button.nav-signin`. Kept.

---

## Unresolved blocker — admin login redirects to `/register`

Affects ~12 admin specs. Root cause investigation:

### Confirmed from DB (`vera-demo` — `kmprsxrofnemmsryjhfj`)

```sql
SELECT m.user_id, m.organization_id, m.role, m.status
FROM memberships m
WHERE m.user_id = (SELECT id FROM auth.users WHERE email = 'demo-admin@vera-eval.app');
```

Returns: `user_id = 6ea7146f-..., organization_id = NULL, role = super_admin, status = active`.

- ✅ UUID matches `auth.users.id`
- ✅ Row has `status='active'`, `role='super_admin'` (super-admins have `organization_id IS NULL` by design)
- ✅ RLS SELECT policy: `user_id = auth.uid() OR current_user_is_super_admin()` — allows this row
- ⚠️ `raw_user_meta_data` is `null` (no `profile_completed` flag)

### Code path analysis (`src/auth/shared/AuthProvider.jsx`)

```js
const memberships = await fetchMemberships();
const organizationList = memberships.map(...);
const profileCompleted = newSession.user.user_metadata?.profile_completed;
if (organizationList.length === 0 && !profileCompleted) {
  setProfileIncomplete(true);  // → /register
}
```

`fetchMemberships()` calls `getSession()` which runs:

```js
supabase.from("memberships")
  .select("*, organization:organizations(id, name, code, status, setup_completed_at)")
  .eq("user_id", user.id)
  .in("status", ["active", "invited"]);
```

The query, RLS, and DB all say this should return 1 row. But the app behaves as if it returns 0.

### Hypotheses (to test in B2)

- **H1 (seed):** Add `raw_user_meta_data.profile_completed = true` to the E2E admin user. Cheap fix, eliminates one variable. Unlikely to be the direct cause because the `organizationList.length === 0` branch fires only when memberships is empty — but worth eliminating.
- **H2 (JWT timing):** `auth.getUser()` is called inside `getSession()` immediately after the sign-in event. Sign-in events fire before JWT is fully propagated to PostgREST. The RLS predicate `auth.uid()` may evaluate to a different value than the local `user.id`, producing an empty result despite correct data. Testable by adding a `waitForSession()` / short delay in the E2E flow before asserting the dashboard.

B2 will write a minimal repro: log in via E2E, then immediately `await supabase.from("memberships").select()` and log the result. That pins H1 vs H2 vs "something else".

---

## Files touched

- `e2e/helpers/JuryFlow.ts`
- `e2e/helpers/LoginPage.ts` (from prior session — verified)
- `e2e/jury-flow.spec.ts`
- `e2e/auth/register-happy-path.spec.ts`

No source code changes. No DB changes. No seed changes.

---

## Lessons for Session B rewrite

1. **Text / role / placeholder selectors drift fast.** Every refactor that touches copy or semantics breaks the suite silently until the next run.
2. **Helpers that wrap multiple steps hide the break point.** When `LoginPage.goto()` fails, all admin specs fail with the same misleading error — hard to diagnose.
3. **Seed drift is invisible.** `.env.e2e.local` expectations must live next to the seed script with a checksum / schema version.
4. **App-side bugs masquerading as test bugs waste sprint time.** The admin login issue consumed more of B1 than all selector fixes combined. Rewrite needs a diagnostic first-spec pattern (log in → assert session → log membership result) to catch these on day 1.

Mitigations baked into the rewrite (see updated README):

- `data-testid`-only selectors (rule 6 under coordination)
- Flat POMs — one step per method, so the failing assertion reveals the real step
- Diagnostic login spec as the first spec, not the last
