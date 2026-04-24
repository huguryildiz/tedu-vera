# Sprint B4 — Setup Wizard Audit & Jury E2E Seeding

**Date:** 2026-04-24
**Branch:** main
**Status:** Complete

---

## Goals

1. Fix E2E flake in setup-wizard specs (B3 carry-over)
2. Fix E2E flake in all jury specs (happy-path, lock, resume) — 9 failures + 6 skipped
3. Confirm stability with `--repeat-each=3 --workers=1` flake pass
4. Document root causes and DB seed strategy

---

## Before State

```
9 failed
  e2e/jury/happy-path.spec.ts:7:3 › jury happy path › token verification navigates to identity step
  e2e/jury/happy-path.spec.ts:7:3 › jury happy path › token verification navigates to identity step
  e2e/jury/happy-path.spec.ts:7:3 › jury happy path › token verification navigates to identity step
  e2e/jury/lock.spec.ts:7:3 › jury lock screen › blocked juror sees locked screen after PIN submit
  e2e/jury/lock.spec.ts:7:3 › jury lock screen › blocked juror sees locked screen after PIN submit
  e2e/jury/lock.spec.ts:7:3 › jury lock screen › blocked juror sees locked screen after PIN submit
  e2e/jury/resume.spec.ts:7:3 › jury resume › returning juror sees "Welcome Back" on progress step
  e2e/jury/resume.spec.ts:7:3 › jury resume › returning juror sees "Welcome Back" on progress step
  e2e/jury/resume.spec.ts:7:3 › jury resume › returning juror sees "Welcome Back" on progress step
6 did not run
9 passed (5.0m)
```

Root failure: `waitForURL(/\/demo\/jury\/arrival/)` timed out — the jury arrival page never loaded.

---

## Root Cause Analysis

### Jury specs

All three jury specs start with `jury.goto()` → `/demo/eval?t=e2e-jury-token` then `jury.waitForArrivalStep()` (waits for `/demo/jury/arrival`). The token verification step (`rpc_jury_validate_entry_token`) performs a SHA-256 hash lookup:

```sql
token_hash = encode(digest(p_token, 'sha256'), 'hex')
```

`e2e-jury-token` was **not present** in `entry_tokens` on vera-demo. Token validation failed → the jury flow stayed on the denied/error screen → `waitForURL` timed out at 30 s → all 9 runs failed at the first `waitForArrivalStep()` call → `test.describe({ mode: "serial" })` propagated those failures to skip the remaining tests in each describe block.

### Setup-wizard specs (B3 carry-over)

Resolved in previous session: E2E org + admin membership were missing from vera-demo. Seeding those fixed 9/9 setup-wizard runs.

---

## Fix: vera-demo DB Seed

Applied via Supabase MCP (`mcp__claude_ai_Supabase__execute_sql`, project `kmprsxrofnemmsryjhfj`).

### Entry token

```sql
INSERT INTO entry_tokens (id, period_id, token_hash, token_plain, is_revoked, expires_at)
VALUES (
  'aaaaaaaa-0003-4000-a000-000000000003',
  'a0d6f60d-ece4-40f8-aca2-955b4abc5d88',
  encode(digest('e2e-jury-token', 'sha256'), 'hex'),
  'e2e-jury-token', false, '2099-12-31 23:59:59+00'
) ON CONFLICT (id) DO NOTHING;
```

`token_plain` is stored so `rpc_jury_validate_entry_reference` (normalises first 8 alphanumeric chars → `'E2EJURYT'`) can also find the row.

### Jurors

```sql
-- E2E Juror (happy-path + resume)
INSERT INTO jurors (id, organization_id, juror_name, affiliation)
VALUES ('aaaaaaaa-0001-4000-a000-000000000001',
  'e802a6cb-6cfa-4a7c-aba6-2038490fb899', 'E2E Juror', 'E2E Test')
ON CONFLICT (id) DO NOTHING;

-- E2E Locked Juror (lock spec)
INSERT INTO jurors (id, organization_id, juror_name, affiliation)
VALUES ('aaaaaaaa-0002-4000-a000-000000000002',
  'e802a6cb-6cfa-4a7c-aba6-2038490fb899', 'E2E Locked Juror', 'E2E Test')
ON CONFLICT (id) DO NOTHING;
```

### PIN auth rows

Pre-seeded with bcrypt hash of `'9999'` so the test PIN works without the random-PIN-generation path:

```sql
-- E2E Juror: PIN=9999, not blocked
INSERT INTO juror_period_auth (juror_id, period_id, pin_hash, is_blocked, failed_attempts)
VALUES ('aaaaaaaa-0001-4000-a000-000000000001',
  'a0d6f60d-ece4-40f8-aca2-955b4abc5d88',
  crypt('9999', gen_salt('bf')), false, 0)
ON CONFLICT (juror_id, period_id) DO UPDATE
  SET pin_hash = crypt('9999', gen_salt('bf')), is_blocked = false,
      failed_attempts = 0, locked_until = NULL;

-- E2E Locked Juror: PIN=9999, is_blocked=true
INSERT INTO juror_period_auth (juror_id, period_id, pin_hash, is_blocked, failed_attempts)
VALUES ('aaaaaaaa-0002-4000-a000-000000000002',
  'a0d6f60d-ece4-40f8-aca2-955b4abc5d88',
  crypt('9999', gen_salt('bf')), true, 0)
ON CONFLICT (juror_id, period_id) DO UPDATE
  SET pin_hash = crypt('9999', gen_salt('bf')), is_blocked = true, failed_attempts = 0;
```

`is_blocked = true` causes `rpc_jury_verify_pin` to return `{ ok: false, error_code: 'juror_blocked' }`, which triggers `useJuryState`'s effect to call `workflow.setStep("locked")` → URL becomes `/demo/jury/locked`.

### Score data (resume "Welcome Back")

`buildProgressCheck` in `src/jury/shared/progress.js` sets `isInProgress = hasProgress && !allSubmitted`. At least one `score_sheet_items` row is required:

```sql
-- Score sheet
INSERT INTO score_sheets (id, period_id, project_id, juror_id, status, last_activity_at)
VALUES ('aaaaaaaa-0004-4000-a000-000000000004',
  'a0d6f60d-ece4-40f8-aca2-955b4abc5d88',
  '93fcb76b-9827-4720-a1a8-9d65fdbc3055',
  'aaaaaaaa-0001-4000-a000-000000000001', 'in_progress', now())
ON CONFLICT (juror_id, project_id) DO NOTHING;

-- Score item (score_value makes hasProgress=true)
INSERT INTO score_sheet_items (id, score_sheet_id, period_criterion_id, score_value)
VALUES ('aaaaaaaa-0005-4000-a000-000000000005',
  'aaaaaaaa-0004-4000-a000-000000000004',
  'ecc8c71e-2fca-4ab8-aaa9-9efbe29700c6', 80)
ON CONFLICT (score_sheet_id, period_criterion_id) DO NOTHING;
```

---

## After State — Flake Pass

```
npx playwright test e2e/admin/setup-wizard.spec.ts \
  e2e/jury/happy-path.spec.ts e2e/jury/lock.spec.ts e2e/jury/resume.spec.ts \
  --repeat-each=3 --workers=1

24 passed (1.8m)
```

All 8 test cases × 3 repetitions = 24 runs. Zero failures.

---

## Fixed UUIDs (vera-demo E2E fixtures)

| ID | Description |
|----|-------------|
| `aaaaaaaa-0001-4000-a000-000000000001` | E2E Juror |
| `aaaaaaaa-0002-4000-a000-000000000002` | E2E Locked Juror |
| `aaaaaaaa-0003-4000-a000-000000000003` | Entry token (`e2e-jury-token`) |
| `aaaaaaaa-0004-4000-a000-000000000004` | Score sheet (E2E Juror, Spring 2026) |
| `aaaaaaaa-0005-4000-a000-000000000005` | Score sheet item |

Period: `a0d6f60d-ece4-40f8-aca2-955b4abc5d88` (Spring 2026, vera-demo)
Org: `e802a6cb-6cfa-4a7c-aba6-2038490fb899` (E2E Org, vera-demo)

---

## Lessons

- `test.describe({ mode: "serial" })` with a serial block means a single failure at step 1 skips all remaining tests — the "6 did not run" count was a direct consequence of the first test timing out.
- Pre-seed PIN hashes with `crypt(pin, gen_salt('bf'))` rather than relying on the random-PIN generation path; it keeps tests deterministic and avoids the `pin_plain_once` reveal-once flow.
- `score_sheets` unique constraint is `(juror_id, project_id)` — period is implicit via project scope.
- Jury E2E setup requires four layers: entry token → juror rows → `juror_period_auth` rows → optional score data for "Welcome Back".
