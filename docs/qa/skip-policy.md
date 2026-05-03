# Skip Policy

> _Last updated: 2026-04-28_

## Rule

**`.skip` count may only decrease, never increase.**

`scripts/check-no-skip.js` counts all `it.skip(`, `test.skip(`, `describe.skip(`,
and `qaTest.skip(` calls in `src/` and `e2e/`. CI fails if the count exceeds
`docs/qa/skip-baseline.json#baselineSkipCount`.

## Adding a new skip

If you must add a new skip:

1. Add the skip to the test file with a comment explaining the blocker:

   ```ts
   test.skip(); // Blocked: <reason> — tracked in <issue/plan link>
   ```

2. Update `docs/qa/skip-baseline.json`:
   - Increment `baselineSkipCount`
   - Add the file to `breakdown`
   - Update `lastUpdated`

3. In your PR description, explain:
   - Why the test cannot run now
   - What is needed to unblock it
   - When it will be removed

## Removing a skip

When you remove a skip and the test passes:

1. Delete the `test.skip()` call (or replace with `test()`).
2. Decrement `baselineSkipCount` in `skip-baseline.json`.
3. Remove the file from `breakdown` if it reaches 0.

This ratchets the baseline downward and prevents re-adding that skip silently.

## Current baseline

See [skip-baseline.json](skip-baseline.json).

## Known skips

| File | Count | Blocker |
|------|-------|---------|
| `src/test/qaTest.js` | 1 | Harness implementation — permanent |
| `e2e/security/period-immutability.spec.ts` | 1 | No unblocked `juror_period_auth` row for a closed period in seed |
| `e2e/security/rbac-boundary.spec.ts` | 1 | `E2E_PROJECTS_ORG_ID` has no jurors seeded |
| `e2e/admin/export-content-parity.spec.ts` | 1 | PDF export option not in current build |
| `e2e/admin/periods.spec.ts` | 1 | Conditional guard (already-closed period state) |

Note: 8 former `test.skip()` data guards in the two security specs were converted to `expect()` assertions on 2026-04-26, reducing the baseline from 13 → 5.
