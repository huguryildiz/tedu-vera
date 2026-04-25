# P2-16 — Kong JWT gate documentation test

## Goal

VERA's edge functions use a known workaround for Kong's JWT gate rejecting ES256 tokens (see CLAUDE.md "Edge Function Patterns" section). Capture this in a single durable test fixture so future contributors understand WHY `verify_jwt: false` + custom auth exists in some functions.

## Background

Kong (Supabase API gateway) has historically rejected valid ES256-signed JWTs from `Auth-v1`, returning 401 "Invalid JWT" even when `auth.getUser(token)` accepts the same token internally. The fix is:
1. Set `verify_jwt: false` in the function's `config.toml`
2. Implement custom auth inside the function: `authClient.auth.getUser(token)` → membership check → service role for DB ops

This pattern is used in `platform-metrics`, `admin-session-touch`, and others. Reference implementation: `supabase/functions/platform-metrics/index.ts`.

## What to add

### Option A: Deno test (preferred)

A Deno test that calls a representative function with both:
- A "good" ES256 JWT minted with the standard test-kit pattern → expect 200
- A malformed JWT → expect 401 from custom auth (not Kong)
- Missing Authorization → expect 401 from custom auth

The test's PURPOSE is documentation: when someone breaks the pattern (e.g., re-enables `verify_jwt: true`), this test fails with a comment that explains the historical fix.

File: `supabase/functions/_test/kong-jwt-gate.test.ts`

### Option B: Markdown ADR (fallback if test scaffolding is too heavy)

If the Deno test harness can't easily fake a Kong-specific 401 without a real Supabase preview env, write a markdown ADR:

`docs/architecture/edge-functions-kong-jwt.md` — explains the symptom, the diagnosis (Kong vs function-internal — `execution_time_ms ≈ 0ms` = Kong), and the fix pattern with code snippets.

## Effort

Read CLAUDE.md "Edge Function Patterns (critical gotchas)" section first — most of the content is already there in shorthand. Expand it into runnable test or ADR.

## Acceptance

- ONE of: a passing Deno test OR a complete markdown ADR
- Future contributor who hits a 401 on a new edge fn finds this and saves an hour

Do NOT commit. Report back: which option you took + path.
