# B1 — Edge function auth-shape pinning: Admin group

**You are a Sonnet 4.6 subagent dispatched by the main Opus session.**

**Repo root:** `/Users/huguryildiz/Documents/GitHub/VERA`
**Your scope:** 4 edge functions — `admin-session-touch`, `platform-metrics`, `invite-org-admin`, `on-auth-event`

---

## Goal

For each of the 4 functions in your group, add **auth-failure + response-shape pinning tests** to its existing `index.test.ts`. Do NOT create new files; do NOT touch `index.ts` source; do NOT touch any other function's tests.

## Context

VERA uses a shared Deno test harness at `supabase/functions/_test/` (`harness.ts`, `mock-supabase.ts`, `import_map.json`). Every existing edge function test uses `captureHandler(modulePath)` to import the function and `makeRequest({ method, body, headers })` to invoke it.

Read these files FIRST before writing any test (they define the pattern):

1. `supabase/functions/_test/harness.ts` (full)
2. `supabase/functions/_test/mock-supabase.ts` (full)
3. `supabase/functions/admin-session-touch/index.test.ts` (reference implementation — see what's already tested and what shape existing tests use)
4. For each of YOUR 4 functions, read their `index.ts` (just to understand auth path) and current `index.test.ts` (to avoid duplication)

## Standard test set per function

For each function, ADD these tests to its existing `index.test.ts` (do not remove existing tests):

1. **`rejects missing Authorization header → 401`** — POST with empty headers, assert status 401 and response body shape matches `{ error: ... }` or equivalent.
2. **`rejects malformed Authorization → 401`** — POST with `Authorization: "Bearer not-a-jwt"` or `Authorization: "malformed"`, assert 401.
3. **`rejects insufficient role → 403`** (only if the function has role checks like super-admin) — mock `auth.getUser` to return a regular user (no super-admin membership), assert 403.
4. **`success path returns expected shape`** — mock auth.getUser + DB correctly for a happy path, assert 200 AND assert the response body has the expected top-level fields. Look at existing tests to see what fields are expected; pin them explicitly.

**Skip any of the 4 tests that are already covered by existing tests.** Don't duplicate.

## Per-function specifics

### 1. `admin-session-touch`

Read `supabase/functions/admin-session-touch/index.ts`. Check if it's already a reference implementation per CLAUDE.md.

Expected behavior: authenticated super-admin touches their session. Check the existing tests; add whatever is missing from the standard set.

### 2. `platform-metrics`

Read `supabase/functions/platform-metrics/index.ts`. This one checks super-admin via `memberships` where `organization_id IS NULL`.

Expected tests:
- Missing header → 401 (may exist)
- Malformed token → 401
- Non-super-admin (regular tenant user) → 403 ← IMPORTANT
- Success → 200 + shape with expected metrics fields (read the actual return shape from `index.ts` to pin)

### 3. `invite-org-admin`

Read `supabase/functions/invite-org-admin/index.ts`. This one invites a tenant admin to an org.

Expected tests:
- Missing header → 401
- Malformed → 401
- Missing/invalid email in body → 400
- Non-super-admin caller → 403
- Success → 200 + shape with user_id / invite_link / etc. (inspect actual return)

### 4. `on-auth-event`

Read `supabase/functions/on-auth-event/index.ts`. This one handles auth events (likely receives webhooks).

Expected tests:
- Missing signature/header if it uses webhook signing → 401/400
- Malformed event body → 400
- Unknown event type → 400 or 200-ignored (whichever the function does — don't assume; read)
- Success → 200 + shape

**CRITICAL for on-auth-event:** This one probably doesn't use `Authorization: Bearer` the same way. It might use a webhook secret. Read the source and pin whatever auth gate exists.

## What you MUST do

1. Read the harness + mock-supabase files IN FULL before writing anything
2. For each of your 4 functions, read `index.ts` + existing `index.test.ts`
3. Add missing tests for the standard set (skip what exists)
4. Run `cd supabase/functions && deno test --allow-net --allow-env --allow-read --import-map=_test/import_map.json <function-dir>/` after each function to verify your new tests pass
5. If a test fails in a way that reveals a real bug (not a test authoring bug), do NOT force it to pass — document it in your final summary as "POTENTIAL BUG: function X fails scenario Y"

## What you MUST NOT do

- ❌ Do NOT modify `index.ts` files (source code) — only `index.test.ts`
- ❌ Do NOT touch any edge function outside your 4-function scope
- ❌ Do NOT skip tests with `.ignore` or commenting out — if a test can't pass, document why
- ❌ Do NOT use `any` or `@ts-ignore` to bypass type issues — follow the existing pattern

## Output format

Return a final summary message with:

1. **Changes per function:**
   - Function name
   - New tests added (count + brief descriptions)
   - Tests already present (skipped)
   - Any POTENTIAL BUGS discovered
2. **Verification:** `deno test` output for your 4 functions (pasted, trimmed)
3. **Edge cases you hit:** anything surprising in the source that made you change your approach
4. **Files modified:** list of test files you edited

Do NOT commit. The main session will handle commits after integrating all 3 groups (B1, B2, B3).

## Environment reminder

- Use the Read tool (absolute paths) — NOT `cat`
- Use Edit tool for existing file modifications — NOT Write (don't overwrite)
- Run Bash commands in non-interactive mode; use `--run` or direct deno commands
- Time budget: ~60-90 minutes. If blocked for more than 20 minutes on a single function, move to the next and report the block.

Begin.
