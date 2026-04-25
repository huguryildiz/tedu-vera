# B3 — Edge function auth-shape pinning: Email/Jury group

**You are a Sonnet 4.6 subagent dispatched by the main Opus session.**

**Repo root:** `/Users/huguryildiz/Documents/GitHub/VERA`
**Your scope:** 5 edge functions — `email-verification-send`, `email-verification-confirm`, `password-reset-email`, `request-pin-reset`, `receive-email`

---

## Goal

For each of the 5 functions in your group, add **auth-failure + response-shape pinning tests** to its existing `index.test.ts`. Do NOT create new files; do NOT touch `index.ts` source; do NOT touch any other function's tests.

## Context

VERA uses a shared Deno test harness at `supabase/functions/_test/` (`harness.ts`, `mock-supabase.ts`, `import_map.json`).

Read these files FIRST:

1. `supabase/functions/_test/harness.ts` (full)
2. `supabase/functions/_test/mock-supabase.ts` (full)
3. `supabase/functions/request-pin-reset/index.test.ts` (reference — audit marks it as "moderate" quality with session-token validation)
4. For each of YOUR 5 functions, read their `index.ts` + current `index.test.ts`

## Auth path variety in this group

This group is the most auth-diverse:

- `email-verification-send` — likely authenticated user (Bearer) who wants to verify their email
- `email-verification-confirm` — likely receives a token in query/body, NO JWT required (public endpoint with token-as-credential)
- `password-reset-email` — likely public endpoint that rate-limits by email
- `request-pin-reset` — uses `session_token_hash` validation (from jury flow) — see existing tests
- `receive-email` — inbound email webhook; receives raw MIME or parsed; auth is via webhook signing key, NOT JWT

**You MUST read each function's index.ts to understand its actual auth pattern before writing tests.** Assumptions will mislead you.

## Standard test set per function (adapted)

For each function, cover:

1. **Missing credential → 401/400** (what the function actually does for missing credential)
2. **Invalid/malformed credential → 401/400**
3. **Missing required body field → 400**
4. **Success path → 200 + expected shape**

**Skip any already-covered scenarios.** Don't duplicate.

## Per-function specifics

### 1. `email-verification-send`

Read source. Sends verification email to authenticated user.

Expected tests:
- Missing Authorization → 401
- Malformed token → 401
- Already-verified user → 409 or specific error (read source to pin)
- Success → 200 + shape (likely `{ sent: true }` or `{ token_id }`)

### 2. `email-verification-confirm`

Read source. Public endpoint — confirms with a token from email link.

Expected tests:
- Missing token query/body param → 400
- Invalid/expired token → 401 or 410
- Already-used token → 409
- Success → 200 + shape (likely `{ confirmed: true, user_id }`)

**NOTE:** This one may not need Authorization at all (token IS the credential). Don't write "missing Authorization → 401" if the function doesn't check it.

### 3. `password-reset-email`

Read source. Public endpoint — accepts email, sends reset link.

Expected tests:
- Missing email in body → 400
- Invalid email format → 400
- Email not found → 200 **(intentional — don't leak user existence; verify this is the behavior by reading source)**
- Email found → 200 + shape
- Rate limit exceeded → 429 (if implemented)

**IMPORTANT:** Don't assume email-not-found returns 404. Security best practice (and likely VERA's implementation) is to return 200 regardless to prevent user enumeration. Read source; pin actual behavior.

### 4. `request-pin-reset`

Read existing tests first — auth.md marks this as "moderate" quality with session-token validation already tested.

Add whatever's missing from standard set that isn't already covered. Focus on response shape pinning if not already pinned.

### 5. `receive-email`

Read source. Inbound email webhook (116 LOC, likely Resend or similar provider).

Expected tests:
- Missing webhook signature header → 401
- Invalid signature → 401
- Malformed MIME/body → 400
- Success → 200 + shape (likely `{ processed: true }` or `{ thread_id }`)

## What you MUST do

1. Read harness + mock-supabase IN FULL
2. For each of your 5 functions, read `index.ts` + existing test
3. Add missing tests (adapted to the real auth pattern)
4. Run `cd supabase/functions && deno test --allow-net --allow-env --allow-read --import-map=_test/import_map.json <function-dir>/` after each
5. Document POTENTIAL BUGs if you find any

## What you MUST NOT do

- ❌ Do NOT modify `index.ts`
- ❌ Do NOT touch functions outside your 5-function scope
- ❌ Do NOT use `.ignore`
- ❌ Do NOT assume auth pattern — read each source

## Output format

Return:

1. Changes per function (new tests, skipped-already-present, POTENTIAL BUGs)
2. Verification output
3. Edge cases
4. Files modified

Do NOT commit.

## Environment reminder

- Read tool with absolute paths
- Edit tool for modifications
- Time budget: ~75-100 minutes (5 functions vs 4 in B1/B2)
- Block threshold: 20 minutes → move on, report

Begin.
