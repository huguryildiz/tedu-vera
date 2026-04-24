# C1 — Scoring Autosave DB Validation

**Sprint:** Session C — E2E Depth & Integrity  
**Date:** 2026-04-24  
**Status:** Complete

## What was built

Three DB-validating E2E tests added to `e2e/jury/evaluate.spec.ts` that prove the scoring autosave pipeline writes real data all the way through to Supabase:

| Test | Assertion |
|------|-----------|
| `onBlur → score_sheets DB row exists with correct value` | After entering a score and blurring, waits for the saving pill to appear then clear, then queries `score_sheets` + `score_sheet_items` via the service-role client and asserts the exact `score_value` written. |
| `visibilitychange save → score_sheets DB row exists` | Fills a score WITHOUT blurring, then simulates `document.visibilityState = "hidden"` + dispatches `visibilitychange`. Waits 2 s for the async write, then validates the DB row. |
| `deduplication: identical blur does not trigger a second RPC call` | Intercepts `**/rpc/rpc_jury_upsert_score**` via `page.route`, performs two identical blurs, and asserts `rpcCallCount === 1`. |

## Infrastructure added

**`e2e/helpers/supabaseAdmin.ts`** — `readRubricScores(jurorId, periodId)`:  
Queries `score_sheets` with nested `score_sheet_items(score_value)` using the service-role client (bypasses RLS). Returns empty array if no sheets exist.

**`e2e/poms/JuryEvalPom.ts`** — two additions:

- `saveStatusSaving()` — targets `[data-testid="jury-eval-save-status"].saving`. The base `saveStatus()` locator is always rendered (both saving and saved states); the `.saving` class is only present during an active write cycle.
- `fillAllScores(value)` rewritten to navigate all segments in the segmented bar, waiting for the group-bar counter (`.dj-group-bar-num`) to confirm each async navigation settled before filling inputs. This accounts for `handleNavigate` being async — it flushes a DB write before calling `setCurrent`.

**`e2e/jury/evaluate.spec.ts`** — `beforeEach` extended:  
Added `session_token_hash: null` to the PATCH that resets `juror_period_auth` before each test. Without this, serial-mode repeat runs encounter "session opened on another device" because the previous repeat's session token is still stored.

## Non-obvious findings

**`saveStatus` is always visible.** The `EvalStep` component renders the save pill in both states; it never hides. Asserting `not.toBeVisible()` on the base locator always fails. The correct signal is the `.saving` CSS class.

**`handleNavigate` is async.** `SegmentedBar` segment clicks call `onNavigate(i)` which runs `await writeGroup(currentPid)` before `setCurrent(newIndex)`. The group-bar counter `{projIdx+1}/{total}` is the correct synchronization point — it only updates after navigation commits.

**`--repeat-each=3` requires `--workers=1`.** The serial suite's `beforeEach` resets shared DB rows. With multiple workers, three concurrent repeat groups all patch the same `juror_period_auth` rows, invalidating each other's live sessions mid-test. Running `--workers=1` (which matches CI behavior) eliminates this entirely — 24/24 green across all 3 repeats.

## Dedicated jurors

| Juror | Used by |
|-------|---------|
| `E2E Eval Render` | render test, back-button test |
| `E2E Eval Blur` | autosave status test, all C1 DB tests |
| `E2E Eval Submit` | all-complete banner test, full submission test |

The `score_sheets` cleanup in `beforeEach` only targets the Blur juror so C1 assertions always see a fresh write. Submit juror sheets are left in place (submit test's `final_submitted_at` is cleared by the auth reset).

## Results

- 8/8 `evaluate.spec.ts` tests pass
- 24/24 with `--repeat-each=3 --workers=1` (3 clean repeats)
- Full suite: 72/81 pass; 4 admin tests fail with redirect-to-login (pre-existing authentication race, unrelated to C1)
