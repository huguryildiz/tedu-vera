# P1 Item 10 — Eliminate `waitForTimeout` from active E2E

## Goal

Replace the remaining 2 occurrences of `page.waitForTimeout()` with deterministic event-based waits. Hard-coded sleeps are flake amplifiers and slow runs.

## Find them

```bash
grep -rn "waitForTimeout" e2e --include="*.ts" | grep -v legacy
```

Audit named two specs: `evaluate.spec.ts` and `google-oauth.spec.ts`.

## Replacement patterns

| Old | New |
|---|---|
| `await page.waitForTimeout(N);` (waiting for DOM update) | `await page.waitFor(selector)` or `await expect(locator).toBeVisible()` |
| `waitForTimeout` after click that triggers RPC | `await page.waitForResponse(r => r.url().includes('rpc/...') && r.status() === 200)` |
| `waitForTimeout` after navigation | `await page.waitForURL(/regex/)` |
| `waitForTimeout` for animation settle | Use `expect(locator).toHaveCSS('opacity', '1', { timeout })` or rely on `auto-waiting` of next assertion |

## Acceptance

- `grep -rn "waitForTimeout" e2e --include="*.ts" | grep -v legacy` returns 0 lines
- The two specs still pass locally on a fresh DB

## Out of scope

- Legacy specs in `e2e/legacy/**` (audit ignores them)
