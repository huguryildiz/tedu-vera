# Testing

VERA has four test tiers, each with a distinct scope and runner. This
section indexes the per-tier guides + the architectural references that
shape test design.

For the current quality assessment + improvement roadmap, see
[premium-saas-test-upgrade-plan.md](premium-saas-test-upgrade-plan.md)
(2026-04-26 audit).

---

## The pyramid

```
                ┌────────────────────────────┐
                │    Smoke checklist         │  manual, pre-jury, ~20 min
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │  Visual + a11y (nightly)   │  cron 02:00 UTC, e2e.yml
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │  Perf (concurrent jury)    │  workflow_dispatch only
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │  E2E (Playwright)          │  6 projects, ~285 tests
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │  pgTAP (SQL layer)         │  RLS + RPC + triggers
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │  Edge Fn (Deno)            │  ~190 tests, harness-mocked
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │  Unit (Vitest)             │  jsdom + mocks, ~1500 tests
                └────────────────────────────┘
```

The base of the pyramid runs in seconds, the top runs in minutes. PR
CI runs unit + Edge + pgTAP + admin/other/maintenance E2E projects.
Visual + a11y projects run nightly via cron (and on `workflow_dispatch`).
Perf is workflow_dispatch only — manually triggered before
load-sensitive releases. The smoke checklist is a manual procedure
before live evaluation events.

---

## Per-tier guides

| Guide | Scope |
| --- | --- |
| [unit-tests.md](unit-tests.md) | Vitest, `qaTest()`, `qa-catalog.json`, mock-Supabase pattern, coverage thresholds. |
| [e2e-tests.md](e2e-tests.md) | Playwright, Page Object Models, fixtures, auth helpers, skip policy. **6 projects:** `admin`, `other`, `maintenance`, `a11y`, `visual`, `perf`. |
| [sql-tests.md](sql-tests.md) | pgTAP suite — RLS isolation, RPC contracts, trigger behavior. |
| [edge-function-tests.md](edge-function-tests.md) | Deno test runner + harness for Edge Functions. |
| [smoke-checklist.md](smoke-checklist.md) | Pre-jury-day manual checklist. |

---

## Reference + audit docs

| File | Contents |
| --- | --- |
| [target-test-architecture.md](target-test-architecture.md) | The canonical "what should our tests look like" design doc — 1072 lines, source of truth for patterns. |
| [premium-saas-test-upgrade-plan.md](premium-saas-test-upgrade-plan.md) | Most recent quality audit (2026-04-26) — 7.2/10 quality score, 5 risks, W2-W6 sprint plan. |
| [periods-test-pattern.md](periods-test-pattern.md) | Reference test pattern for periods (PoM + DB fixture + RPC verify). |
| [page-test-coverage-map.md](page-test-coverage-map.md) | Per-admin-page test inventory. |
| [page-test-mock-audit.md](page-test-mock-audit.md) | Tautology-mock audit identifying refactor targets. |
| [audit-taxonomy-scan.md](audit-taxonomy-scan.md) | Audit event taxonomy gap analysis. |
| [e2e-security-skip-audit.md](e2e-security-skip-audit.md) | E2E security spec skip review. |
| [catalog-reconciliation-2026-04-25.md](catalog-reconciliation-2026-04-25.md) | qa-catalog reconciliation session report (one-off). |

---

## Commands cheat sheet

```bash
# Unit
npm test                          # watch mode
npm test -- --run                 # CI-style single run
npm run test:coverage             # with coverage HTML

# E2E (Playwright projects: admin / other / maintenance / a11y / visual / perf)
npm run e2e                       # admin + other + maintenance (default)
npm run e2e -- --project=admin    # admin shard only
npm run e2e -- --project=a11y     # accessibility smoke (nightly cron job)
npm run e2e -- --project=visual   # visual regression  (nightly cron job)
npm run e2e -- --project=perf     # concurrent-jury load (manual only)
npm run e2e -- --headed --workers=1 --grep "Login"

# SQL (pgTAP)
# See sql/tests/RUNNING.md — runs via local Postgres + psql

# Edge Functions
npm run test:edge                 # Deno test runner

# Drift / coverage sentinels
npm run check:db-types
npm run check:rls-tests
npm run check:rpc-tests
npm run check:edge-schema
npm run check:guideline-coverage  # 40-item test-writing.md sentinel (currently 95%)
npm run check:no-native-select
npm run check:no-nested-panels
```

---

## Coverage state (most recent measure)

| Metric | Threshold | Actual | Source |
| --- | --- | --- | --- |
| Lines | 53% | 54.92% | vitest run |
| Functions | 38% | 38.44% | vitest run |
| Branches | 57% | 58.88% | vitest run |
| Statements | 53% | 54.92% | vitest run |
| Unit tests | — | ~1,500 | qa-catalog |
| E2E tests | — | ~280 | playwright list |
| Edge Function tests | — | ~190 | deno test list |
| pgTAP tests | — | ~50 | sql/tests/ |
| Page Object Models | — | 23 | `e2e/poms/` |
| qa-catalog IDs | — | 1,224 | `src/test/qa-catalog.json` |

Numbers shift as coverage grows. Check
[premium-saas-test-upgrade-plan.md](premium-saas-test-upgrade-plan.md)
for the current sprint target.

---

## Testing rules (cross-tier)

1. **Tests are not optional.** Every new feature ships with the
   matching tier of test. A feature with no test does not merge.
2. **Drift sentinels are not optional.** A red sentinel blocks merge.
   Either fix the drift or update the sentinel and document why.
3. **CI is not the smoke check.** CI uses ephemeral environments;
   smoke runs against the real one. Both are required before a
   high-stakes event.
4. **Tautologies are bugs.** A test that mocks X and asserts X teaches
   nothing. The audit at
   [page-test-mock-audit.md](page-test-mock-audit.md) catalogs current
   tautology offenders.
5. **`.skip()` decays.** Skipped tests get reviewed by the per-tier
   audits (e.g., [e2e-security-skip-audit.md](e2e-security-skip-audit.md))
   — either reactivated or formally deleted with a reason.

---

## CI / nightly schedule

| Workflow | Trigger | Includes | Reports |
| --- | --- | --- | --- |
| `ci.yml` | every push + PR | unit, build, edge, migrations, pgTAP, drift sentinels | `allure-report-NNN`, `excel-report-NNN`, `test-results-raw-NNN` |
| `e2e.yml` | every push + PR | admin (sharded), other, maintenance | `excel-e2e-<job>-NNN`, `playwright-results-*` |
| `e2e.yml` (cron) | nightly 02:00 UTC | a11y, visual (in addition to PR matrix) | `excel-e2e-a11y-NNN`, `excel-e2e-visual-NNN` |
| `perf.yml` | `workflow_dispatch` | concurrent-jury load test | `excel-perf-NNN`, `perf-results-NNN` |
| `edge-fn-smoke.yml` | daily 06:00 UTC | smokes deployed Edge Fns against vera-demo | `edge-fn-smoke-NNN` |
| `demo-db-reset.yml` | daily 04:00 UTC | regenerate demo seed + 5 post-seed assertions | `demo-db-reset-NNN` |
| `db-backup.yml` | monthly | pg_dump of vera-prod | `db-backup-NNN` |

Schedule cron runs unblock the visual + a11y suite without paying the
cost on every push. Most CI artifacts retain for 30 days; raw playwright
bundles for 14.

---

> *Last updated: 2026-04-28*
