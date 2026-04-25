# P2 Test Hardening Sprint

**Date:** 2026-04-25 (devam)
**Branch:** `qa/p2-test-hardening`
**Predecessor:** P1 sprint complete on `main` (merge commit `b784f397`)
**Reference audit:** [`docs/qa/vera-test-audit-report.md`](../../../qa/vera-test-audit-report.md) §9 P2

---

## Why P2 now

P0 closed the regression-detection gap (CI gates, edge auth shapes, RPC contracts, migration CI, hook hardening). P1 deepened test coverage (constraint/trigger pgTAP, 6 more RPC contracts, post-seed smoke, E2E gap-fill, concurrent perf). P2 is the "ongoing" tier — visual quality, accessibility, catalog hygiene, and threshold ratcheting.

## Sprint scope (5 items, 4 parallel + 1 sequential)

| # | Audit item | What it adds | Parallel? |
|---|---|---|---|
| **12** | QA catalog audit + prune | Reconcile `src/test/qa-catalog.json` (1167 IDs) against the 938 actual tests; mark missing as backlog or remove | ✅ |
| **13** | Visual regression | Playwright `toHaveScreenshot()` for top 5 routes (Rankings, Periods, mobile cards). Light + dark | ✅ |
| **14** | Accessibility smoke | `axe-playwright` on top 5 routes; flag WCAG violations | ✅ |
| **16** | Kong JWT gate doc test | Single deno test or pgTAP fixture documenting the ES256/Kong workaround | ✅ |
| **15** | Coverage threshold raises | Bump from 47/32/56 → 60/50/65 (P0+P1 added ~50 tests); reset later to 70/60/75 | ⛔ Last (depends on P0+P1 tests landing) |

Items 12, 13, 14, 16 are independent — dispatch as 4 parallel Sonnet subagents.
Item 15 is mechanical and runs after the others land.

## Per-item prompts

- [`12-qa-catalog-audit.md`](./prompts/12-qa-catalog-audit.md)
- [`13-visual-regression.md`](./prompts/13-visual-regression.md)
- [`14-a11y-smoke.md`](./prompts/14-a11y-smoke.md)
- [`16-kong-jwt-doc.md`](./prompts/16-kong-jwt-doc.md)
- [`15-coverage-thresholds.md`](./prompts/15-coverage-thresholds.md)

## Acceptance

- All P0 + P1 checks remain green
- Each P2 item ships its own commit (independently revertable)
- Final SESSION-REPORT documents what landed + tier-3 backlog
