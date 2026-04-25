# B2 — Edge function auth-shape pinning: Audit/Cron group

**You are a Sonnet 4.6 subagent dispatched by the main Opus session.**

**Repo root:** `/Users/huguryildiz/Documents/GitHub/VERA`
**Your scope:** 4 edge functions — `audit-anomaly-sweep`, `audit-log-sink`, `log-export-event`, `notify-maintenance`

---

## Goal

For each of the 4 functions in your group, add **auth-failure + response-shape pinning tests** to its existing `index.test.ts`. Do NOT create new files; do NOT touch `index.ts` source; do NOT touch any other function's tests.

## Context

VERA uses a shared Deno test harness at `supabase/functions/_test/` (`harness.ts`, `mock-supabase.ts`, `import_map.json`). Every existing edge function test uses `captureHandler(modulePath)` to import the function.

Read these files FIRST before writing any test (they define the pattern):

1. `supabase/functions/_test/harness.ts` (full)
2. `supabase/functions/_test/mock-supabase.ts` (full)
3. `supabase/functions/audit-anomaly-sweep/index.test.ts` (reference — it's called out in the audit as "good" quality)
4. For each of YOUR 4 functions, read their `index.ts` (just to understand auth path) and current `index.test.ts`

## Auth path variety in this group

This group is **heterogeneous** on auth:

- `audit-anomaly-sweep` — uses `x-cron-secret` header (cron-triggered, NOT Bearer JWT)
- `audit-log-sink` — likely Bearer JWT or cron-secret; read source
- `log-export-event` — likely authenticated user (Bearer JWT)
- `notify-maintenance` — likely cron-triggered + Bearer for admin-triggered maintenance; read source

**You MUST read each function's index.ts to understand its actual auth pattern before writing tests.** Do not assume Bearer.

## Standard test set per function

Adjust per actual auth pattern:

1. **`rejects missing auth credential → 401`** — POST without the relevant header (missing `x-cron-secret` OR missing `Authorization`, whichever the function uses)
2. **`rejects wrong credential → 401`** — wrong cron secret or malformed bearer token
3. **`rejects missing/invalid body → 400`** (for functions that require a payload)
4. **`success path returns expected shape`** — assert 200 AND pin the top-level response fields

**Skip any of the 4 tests that are already covered by existing tests.** Don't duplicate.

## Per-function specifics

### 1. `audit-anomaly-sweep`

Existing tests reportedly cover `x-cron-secret` rejection + chain_ok detection + dedup. Response shape is pinned already.

**Your job:** verify existing coverage, add any gaps (e.g., missing body → 400 if applicable, unexpected header → ignored gracefully). Likely minimal addition here.

### 2. `audit-log-sink`

Read source. This function probably accepts audit events from other functions or external sinks.

Expected tests:
- Missing auth → 401 (whatever auth pattern it uses)
- Malformed event body → 400
- Valid event → 200 + shape with event_id / accepted status
- (Bonus if time permits) Duplicate event handling

### 3. `log-export-event`

Read source. Logs that an admin downloaded an export file.

Expected tests:
- Missing Authorization → 401
- Malformed token → 401
- Missing export_id in body → 400
- Success → 200 + shape (likely just `{ ok: true }` or `{ logged_at: ... }`)

### 4. `notify-maintenance`

Read source. Sends maintenance notifications — 402 LOC, largest in this group. Probably has complex recipient routing.

Expected tests:
- Missing auth → 401
- Malformed body → 400
- Missing required fields (e.g., message, severity) → 400
- Success → 200 + shape (likely `{ queued: N, sent: M }` or similar)

Since this one is large, aim for 3-4 solid tests, not exhaustive coverage.

## What you MUST do

1. Read the harness + mock-supabase files IN FULL before writing anything
2. For each of your 4 functions, read `index.ts` + existing `index.test.ts`
3. Add missing tests for the standard set (adapted to the real auth pattern)
4. Run `cd supabase/functions && deno test --allow-net --allow-env --allow-read --import-map=_test/import_map.json <function-dir>/` after each function to verify
5. If a test fails revealing a real bug, document as "POTENTIAL BUG"

## What you MUST NOT do

- ❌ Do NOT modify `index.ts`
- ❌ Do NOT touch functions outside your scope
- ❌ Do NOT use `.ignore` / commented-out tests
- ❌ Do NOT assume Bearer auth — read each source

## Output format

Return a final summary:

1. Changes per function (new tests added, already-present, POTENTIAL BUGs)
2. Verification output (deno test trimmed)
3. Edge cases encountered
4. Files modified

Do NOT commit.

## Environment reminder

- Read tool with absolute paths — NOT `cat`
- Edit tool for modifications
- Time budget: ~60-90 minutes
- Block threshold: 20 minutes → move on, report block

Begin.
