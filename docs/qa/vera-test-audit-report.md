# VERA — Test Quality & Strategy Audit

**Date:** 2026-04-25
**Scope:** Vitest unit tests, Playwright E2E, Supabase Edge Function tests, pgTAP DB tests, CI wiring
**Reviewer:** Two-phase test audit (Phase 1 — audit only, no test/code changes)
**Branch:** main (commit `31c9c03c`)

---

## 0. What was reviewed

| Layer | Tool | Files | LOC | Status |
|---|---|---|---|---|
| Unit | Vitest | 234 | ~18,400 | 938 tests passing locally in ~10s |
| E2E | Playwright | ~40 active (+ legacy ignored) | ~5,800 | Runs per PR in `e2e.yml` |
| Edge functions | Deno test | 16 | ~2,960 | `npm run test:edge` |
| DB | pgTAP SQL | 18 pgTAP + 1 idempotency lint | — | 74 assertions, `pg_prove` or Supabase MCP |
| CI workflows | GitHub Actions | `ci.yml`, `e2e.yml`, `db-backup.yml`, `demo-db-reset.yml`, `notification-secrets-sync.yml` | — | **`ci.yml` is disabled** (see §8) |
| Test harness | — | `src/test/` (`qaTest.js`, `qa-catalog.json`, `setup.js`, factories/fixtures/helpers/mocks) | — | QA catalog has 1,167 entries (300 critical, 119 high, 80 major) |
| Coverage | v8 | `coverage/lcov-report/` present | — | Thresholds: lines **47%**, functions **32%**, branches **56%** |

---

## 1. Executive summary

VERA has a **large, well-organized test surface** — 234 unit files, 40 E2E specs, 16 edge function tests, 18 pgTAP files, a risk-classified QA catalog, proper POMs, isolated E2E fixtures, and a deliberately-break pattern in the security suite. That is unusually mature for a project this size.

But the numbers oversell confidence:

1. **Unit tests are disabled in CI.** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) has `if: false` on both `test` and `e2e` jobs in that file. The active CI is [`e2e.yml`](../../.github/workflows/e2e.yml), which runs Playwright only. Unit tests pass locally but are never gated on PRs. 938 passing unit tests = zero regression protection for merges unless a developer runs `npm test` by hand.
2. **Unit test depth is bimodal.** Pure utility tests (field mapping, period helpers, outcome helpers, environment, score selectors) are rigorous and high-survival. Hook-orchestration and page-level tests (`PeriodsPage`, `useManagePeriods`, `useAdminData`, `useJuryState`) are mostly mock-heavy smoke. Estimated aggregate mutation-survival: **40–50%**.
3. **E2E has real depth where it matters most** — scoring correctness (real DB + XLSX parse), outcome attainment (invokes the real app module), jury resume (reload + re-auth + DB persistence), and a tenant-isolation sweep across 8 tables. The security suite uses real tenant JWTs against real REST endpoints with a "deliberately break" assertion pattern. These are the strongest tests in the repo.
4. **Admin workflows are under-tested end-to-end.** Setup wizard, period creation form submission, juror invite, score-edit request, unlock request, password reset, invite accept — either shallow or missing E2E coverage.
5. **DB-layer tests (pgTAP) cover 9 of 45 RPCs + the main RLS policies but miss** most triggers, all constraints (NOT NULL, UNIQUE, CHECK), and the audit-chain verification function. No functional migration CI exists — only a syntax lint (`sql/tests/migrations/idempotency.test.js`).
6. **Edge function tests are unit-like, not integration.** Every test mocks Supabase client + fetch; Kong JWT gate and ES256 signature behavior (called out as a real production gotcha in `CLAUDE.md`) are never exercised. Tests verify handler logic, not the auth path that Kong actually enforces.
7. **229 QA catalog entries (~20%) have no backing test.** 1,167 entries in `qa-catalog.json` vs 938 executing tests. This is either aspirational planning (fine, if tracked) or catalog drift (not fine).

Headline: this project has a **mature test culture but a weakly enforced one**. The individual tests that exist are better than average; the gate that decides what ships is weaker than average.

---

## 2. Current test coverage map

### 2.1 Unit test distribution

| Top-level dir | Test files | Character |
|---|---|---|
| `src/admin/` | 108 | Mix — hooks often shallow, selectors/helpers often deep |
| `src/shared/` | 76 | Strongest overall — api/, lib/, storage/, hooks/ are high quality |
| `src/jury/` | 20 | Orchestration tests are happy-path only |
| `src/auth/` | 17 | `AuthProvider` tests mock the whole Supabase auth surface |
| `src/charts/` | 6 | Chart utils tested; chart copy tested; components rendered |
| `src/landing/` | 4 | Showcase data tests |
| `src/components/` | 2 | Stubs |
| `src/layouts/` | 1 | Stub |

Coverage thresholds (vite.config.js):

```text
lines: 47%    functions: 32%    branches: 56%    statements: 47%
src/shared/hooks/**      → lines 70 / fn 50 / br 70
src/shared/storage/**    → lines 80 / fn 65 / br 50
src/shared/lib/**        → lines 55 / fn 70 / br 75
```

These thresholds are *low* for a production SaaS. 47% line coverage is a permissive floor. The higher per-directory thresholds on `shared/hooks/lib/storage` match where the strongest tests live.

### 2.2 E2E distribution

| Area | Specs | Notes |
|---|---|---|
| `e2e/admin/` | 20 | Broadest surface — mix of real flows and smoke |
| `e2e/jury/` | 7 | `happy-path`, `lock`, `resume`, `evaluate`, `edit-mode`, `expired-session` |
| `e2e/auth/` | 3 | `google-oauth`, `forgot-password`, `invite-accept` |
| `e2e/security/` | 3 | **Highest value tests in repo** — tenant isolation, period immutability, RBAC |
| `e2e/demo/` | 1 | Demo auto-login |
| `e2e/legacy/` | ~7 | `testIgnore` in playwright.config.ts — reference only |

Infrastructure: 23 POMs in `e2e/poms/`, 6 helpers in `e2e/helpers/` (including `scoringFixture`, `outcomeFixture`, `supabaseAdmin`, `rlsProbe`, `oauthSession`, `parseExport`). Fixtures actually set up and tear down DB state via service-role key — this is the right pattern, rarely done well.

### 2.3 Edge function tests

All 16 use a shared harness at `supabase/functions/_test/` (`harness.ts`, `mock-supabase.ts`, `import_map.json`). Every test mocks Supabase client + global fetch; none hit a real DB or deployed function.

### 2.4 pgTAP DB tests

```text
sql/tests/
├── _helpers.sql          (seed_two_orgs, become_a/b/super/reset)
├── migrations/
│   └── idempotency.test.js  (syntax lint only)
├── rls/  (9 files)          organizations, memberships, periods, projects,
│                             jurors, entry_tokens, frameworks, scores, audit_logs
└── rpcs/
    ├── jury/  (4 files)     authenticate, verify_pin, validate_entry_token, upsert_score
    └── admin/ (5 files)     generate_entry_token, list_organizations,
                             mark_setup_complete, set_period_lock, org_admin_list_members
```

74 assertions total. Wrapped in `BEGIN/ROLLBACK` (safe on prod). Runner docs in `sql/tests/RUNNING.md`.

---

## 3. Unit test findings

### 3.1 Top 10 most valuable unit tests

| # | Test | Why it matters |
|---|---|---|
| 1 | [fieldMapping.test.js](../../src/shared/api/__tests__/fieldMapping.test.js) | Pure mapping logic; null handling, string→number coercion, round-trip symmetry. Guards `design→written` / `delivery→oral` UI↔DB field rename. |
| 2 | [periodHelpers.test.js](../../src/admin/features/periods/__tests__/periodHelpers.test.js) | 5-state period state machine, setup percent, relative time — pure logic with strong boundary coverage. |
| 3 | [scores.test.js (pivotItems)](../../src/shared/api/admin/__tests__/scores.test.js) | ~15 tests across null/zero/string scores, `period_criteria.key` priority, score cap warning. Catches aggregation bugs. |
| 4 | [scoreSelectors.test.js](../../src/admin/selectors/__tests__/scoreSelectors.test.js) | `deriveScoreStatus` enum (completed/submitted/in_progress/not_started). Pure; catches conditional-order mutations. |
| 5 | [outcomeHelpers.test.js](../../src/admin/features/outcomes/__tests__/outcomeHelpers.test.js) | `naturalCodeSort` (PO1 vs PO10 / multi-level / suffix), coverage badge mapping. |
| 6 | [crossOrgBoundary.test.js](../../src/shared/api/admin/__tests__/crossOrgBoundary.test.js) | Asserts `getScores`/`getProjectSummary` *throw* on RLS 42501 (must not return `[]`). Multi-tenant boundary spec. |
| 7 | [filterPipeline.test.js](../../src/admin/selectors/__tests__/filterPipeline.test.js) | Compound-key meta maps, dedup, numeric sort on `G02`/`G10`. |
| 8 | [useDeleteConfirm.test.js](../../src/admin/shared/__tests__/useDeleteConfirm.test.js) | Error-message→label mapping (`semester_locked`, `project_has_scored_data`), count pluralization. |
| 9 | [environment.test.js](../../src/shared/lib/__tests__/environment.test.js) | Pathname-based env routing — guards the hard architectural rule that `/demo/*` must never talk to prod DB. |
| 10 | [overviewMetrics.test.js](../../src/admin/selectors/__tests__/overviewMetrics.test.js) | `needsAttention` OR-logic, top-3 stable sort. Covers a real surprising rule (progress=50 + status=not_started still counts as stale). |

### 3.2 Top 10 weakest / lowest-value unit tests

| # | Test | Problem |
|---|---|---|
| 1 | [AuthBarrel.test.js](../../src/auth/__tests__/AuthBarrel.test.js) | Asserts `AuthProvider` and `useAuth` are `defined`. Pure tautology. |
| 2 | [useManagePeriods.test.js](../../src/admin/features/periods/__tests__/useManagePeriods.test.jsx) | Single assertion: `periodList is Array`, `loadPeriods is function`. Mocks 14 API calls. No flow coverage. |
| 3 | [PeriodsPage.test.jsx](../../src/admin/features/periods/__tests__/PeriodsPage.test.jsx) | Mocks every child (drawers/modals) to `null`, mocks `useManagePeriods` to empty state, asserts the page renders. |
| 4 | [SharedSmallComponents.test.jsx](../../src/admin/shared/__tests__/SharedSmallComponents.test.jsx) | Render-then-assert-text for `ProjectAveragesCard`, `ExportPanel`, `JurorHeatmapCard`. No interaction. |
| 5 | `useJuryState.test.js` (happy-path only) | Mocks 14+ API fns; only asserts state advances `idle → eval`. No PIN mismatch, no network error, no token expiry. |
| 6 | [invokeEdgeFunction.test.js](../../src/shared/api/core/__tests__/invokeEdgeFunction.test.js) | 3 tests; `fetch` fully mocked. Never validates `Authorization` header format or real 401→refresh→retry contract. |
| 7 | `useAdminData.test.js` | 4 tests, one happy path per branch. No partial-failure case (e.g., `getScores` succeeds, `getProjectSummary` fails). |
| 8 | Any page `*.test.jsx` that mocks its own hook | e.g., page tests that `vi.mock("./useManagePeriods")` — the test is now asserting a contract with a mock, not with the hook. Mock drift risk. |
| 9 | `BarrelsApi.test.js` and similar | Assert barrel exports exist — catches accidental re-export removal; no behavior tested. Useful at coverage margin only. |
| 10 | `SaveBar.test.jsx` and other 2-test presentational component tests | "Renders given `dirty=true`" + "fires onSave" — shallow contract. Legitimate but low-value relative to test count. |

### 3.3 Mock risk register

| Risk | Where | What could ship broken |
|---|---|---|
| Supabase chain mock drift | `scores.test.js`, `useAdminData.test.js`, many | If `.order()` or `.range()` is added to a real query, the mock returns cached data; the real query fails in prod; tests stay green. |
| adminApi wrappers mocked wholesale | Hook tests under `admin/features/**/__tests__/` | The wrapper code (error mapping, retry) is never exercised by the hook test AND often has its own unit test — so neither test touches the *integration* between them. |
| `invokeEdgeFunction` 401→refresh→retry | `invokeEdgeFunction.test.js` | Real retry against an expired-then-refreshed Supabase session never verified. |
| `AuthProvider` Google OAuth path | `AuthProvider.test.*` | Google OAuth + PendingReviewGate + membership fetch sequence mocked. The real, subtle tenant-membership branching is untested. |
| Page tests that mock their own hooks | Multiple page `.test.jsx` | If the hook's return shape changes, the page's consumption is never re-checked. |
| Realtime subscriptions (`useAdminRealtime`) | No test at all | Subscription lifecycle, cleanup on unmount, reconnect on token refresh are all untested. Score tab is the primary consumer. |

### 3.4 Business logic coverage gaps (unit)

- **Outcome attainment weighted formula** — [getOutcomeAttainmentTrends](../../src/shared/api/admin/outcomes.js) is *only* verified at the E2E layer (`e2e/admin/outcome-attainment.spec.ts`). No unit test pins the weight application or the 70% threshold.
- **Period lock enforcement at hook layer** — tests verify `getPeriodState` enum, but no unit test asserts "locked period rejects mutation RPC".
- **Realtime subscription behavior** — `useAdminRealtime`, cleanup, reconnect — untested.
- **Session refresh (`supabase.auth.onAuthStateChange`)** — remember-me persistence path, token expiry mid-request — untested.
- **CSV/XLSX export formatting** — delimiter escape, date locale, BOM handling. E2E checks a happy-path XLSX download; no unit test on formatting edge cases.
- **PIN reset flow orchestration** — `request-pin-reset` edge function has a unit test; the *client* orchestration path does not.
- **Audit log buildAuditParams filter validation** — called out in memory as remaining work; remains unverified.
- **Field-mapping sweep** — `fieldMapping.test.js` is good for written/oral; does it cover *every* UI↔DB pair? Spot-check suggests not all naming-audit items are exercised.

### 3.5 Estimated mutation survival

~**40–50%** aggregate. Broken down:

- Pure utilities (mapping, helpers, selectors, environment, storage): **~80%** — real logic, realistic inputs, assertion depth good.
- Hook orchestration (`useAdminData`, `useJuryState`, `useManagePeriods`, etc.): **~25–30%** — single-path happy tests with heavy mocks; branch mutations in error paths would not be detected.
- Page-level `.test.jsx`: **~10–15%** — tests largely assert "didn't throw" after mounting; component swap or prop rewiring inside the tree would not be caught.

---

## 4. E2E findings

### 4.1 Per-area assessment

| Area | Specs | Depth | Data seeding | Notes |
|---|---|---|---|---|
| Security (tenant-isolation, period-immutability, rbac-boundary) | 3 | **Real** | Service-role + deliberately-break | Best-in-repo. Uses real REST API with tenant JWT to probe RLS across 8 tables; inverts assertion to prove guard isn't always-deny. |
| Scoring (scoring-correctness, outcome-attainment) | 2 | **Real** | `scoringFixture` + `outcomeFixture` with teardown | Real period→criteria→scores DB round-trip; verifies DOM ranking + XLSX export parse + weighted formula. |
| Jury (resume, lock, evaluate, edit-mode, expired-session) | 5 | **Mixed** | `seedJurorSession`, `resetJurorAuth` | `resume.spec.ts` is the best jury spec — reload + re-auth + DB-verified score persistence. `happy-path.spec.ts` is shallow by comparison. |
| Auth (forgot-password, invite-accept, google-oauth) | 3 | **Partial** | `generateInviteLink`, `generateRecoveryLink`, `extractAuthHash` | Helpers exist; specs do not fully exercise the flows. `google-oauth.spec.ts` uses a `waitForTimeout(2000)` — smell. |
| Admin CRUD (projects, jurors, periods, organizations, criteria, outcomes, entry-tokens, settings, tenant-admin) | ~10 | **Shallow→Medium** | Mostly UI-through-app, fewer fixtures | Visits pages, opens drawers, submits some forms. Few assertions against DB state after submit. |
| Admin wizards (setup-wizard, tenant-application) | 2 | **Smoke** | — | `setup-wizard.spec.ts`: 5 tests, all `toBeVisible()`/`toHaveURL()`. No period is actually created end-to-end. |
| Admin analytics/reviews/rankings/heatmap/audit-log | ~6 | **Smoke→Medium** | Rankings has export verification | Mostly "page renders with data" tests. |
| Demo | 1 | **Medium** | Auto-login | Verifies the `/demo` auto-login path. |

### 4.2 Strongest E2E specs

- **[tenant-isolation.spec.ts](../../e2e/security/tenant-isolation.spec.ts)** — 8-table RLS sweep across `period_criteria`, `outcomes`, `score_sheets`, `projects`, `entry_tokens`, `audit_logs`, `juror_period_auth`, `unlock_requests`. Uses real tenant JWTs vs anon key. Deliberately-break guard on period.is_locked.
- **[period-immutability.spec.ts](../../e2e/security/period-immutability.spec.ts)** — triggers, structural column locks, RPC guards, closed-period RLS.
- **[scoring-correctness.spec.ts](../../e2e/admin/scoring-correctness.spec.ts)** — asymmetric weight ranking, XLSX export parse, tie case. 146 LOC of *real* verification.
- **[outcome-attainment.spec.ts](../../e2e/admin/outcome-attainment.spec.ts)** — invokes real `getOutcomeAttainmentTrends` via `page.evaluate` inside the live page. Math is tested against DB-sourced data.
- **[resume.spec.ts](../../e2e/jury/resume.spec.ts)** — reload lands on `/arrival` (by contract), re-auth restores to progress, autosaved score value survives reload. True persistence test.

### 4.3 Weakest / smokiest E2E specs

- **[setup-wizard.spec.ts](../../e2e/admin/setup-wizard.spec.ts)** — 5 tests, `toBeVisible()` assertions only. No period actually created.
- **[happy-path.spec.ts](../../e2e/jury/happy-path.spec.ts)** — 3 tests, token→identity→PIN→progress, no error injection, no persistence check.
- **[google-oauth.spec.ts](../../e2e/auth/google-oauth.spec.ts)** — uses `waitForTimeout(2_000)` instead of a state-based wait.
- Several admin CRUD specs assert the drawer opens and the toast text appears, but do not read back from DB to confirm the row was actually written/updated.

### 4.4 Critical paths with no or shallow E2E coverage

| Path | Status | Risk |
|---|---|---|
| Invite accept (admin invite → login creation) | Helper exists, no full E2E flow | **High** — wrong membership role at creation leaks cross-tenant |
| Password reset (end-to-end via link) | No spec | **High** — silent break blocks users |
| Period creation form (setup wizard → submitted period) | Smoke only | **High** — wizard is the primary onboarding path |
| Juror batch import / invite | No spec | Medium — but data integrity matters |
| Score edit request / approval flow | No spec (edge fn unit-only) | **High** — drives jury correction flow |
| Unlock request flow | No spec | **High** — gates reopening a closed period |
| Jury final submission + lock side-effects | Partial — `lock.spec.ts` covers attempt-lock, not final-submit transition | **High** — fault would lose work |
| Realtime admin updates during active event | No spec | Medium — matters on evaluation day |
| Maintenance mode activation + UI behavior | No spec | Medium |

### 4.5 Flake indicators (with references)

- `page.waitForTimeout` — 4 occurrences in active specs:
  - [e2e/jury/evaluate.spec.ts:166](../../e2e/jury/evaluate.spec.ts#L166), [:198](../../e2e/jury/evaluate.spec.ts#L198)
  - [e2e/auth/google-oauth.spec.ts:30](../../e2e/auth/google-oauth.spec.ts#L30)
  - [e2e/jury/lock.spec.ts:52](../../e2e/jury/lock.spec.ts#L52) *(this one is intentional — models the real 8-second lockout; acceptable)*
- `test.skip()` usage in `e2e/security/*.spec.ts` — 10 occurrences. These are conditional on fixture presence; acceptable if the condition is stable, risky if it silently disables tests when seeds are missing on demo DB.
- `retries: 2` in CI combined with `screenshot: "only-on-failure"` can mask transient flakes — if a test fails once then passes, the signal is lost.

---

## 5. Edge function test findings

All 16 functions have a test file. All use the mock harness — none hit a real deployed function.

| Function | Auth tested | DB round-trip | Depth | Notes |
|---|---|---|---|---|
| `admin-session-touch` | Header presence, invalid JWT → 401 | No | Medium | Reference impl in CLAUDE.md; mocked auth |
| `platform-metrics` | Super-admin detection via memberships mock | No | Medium | Reference impl; mocked |
| `invite-org-admin` | Missing auth, `getUser` error | No | Medium | No email-domain validation test |
| `request-score-edit` | `session_token_hash` validation, cross-period token | No | **Good** | Strongest edge fn test — covers missing field 400, invalid token 401, no-RESEND-key path |
| `request-pin-reset` | Session validation | No | Medium | — |
| `audit-anomaly-sweep` | `x-cron-secret` | No | **Good** | Chain-verify failure, dedup skip, response shape pinned |
| `audit-log-sink` | — | No | Medium | — |
| `auto-backup` | — | No | Medium | Recently modified (git status dirty) |
| `send-export-report` | — | No | Medium | Recently modified |
| `log-export-event` | — | No | Medium | — |
| `email-verification-send` / `-confirm` | Token hashing | No | Medium | — |
| `receive-email` | — | No | Low | — |
| `notify-maintenance` | — | No | Low | — |
| `password-reset-email` | — | No | Medium | — |
| `on-auth-event` | — | No | Medium | — |

### 5.1 Gaps

- **Kong JWT gate is not tested anywhere.** `CLAUDE.md` documents "Kong JWT gate" + ES256 gotcha + `verify_jwt: false` pattern + the 0ms-vs-50ms log signature diagnostic — all learned the hard way. None of it is pinned by a test. If a future function re-introduces Kong JWT for a route and breaks on ES256, there is no automated alarm.
- **No test hits a deployed function.** This is a reasonable choice (speed, isolation) but means auth-path regressions slip through.
- **Response-shape pinning is inconsistent** — `audit-anomaly-sweep` pins its shape; most others don't. A silent shape drift in `platform-metrics` would not be caught.

---

## 6. DB / pgTAP findings

### 6.1 Coverage summary

Tested (9 of 45 RPCs, core RLS policies):

- Jury: `rpc_jury_authenticate`, `rpc_jury_verify_pin`, `rpc_jury_validate_entry_token`, `rpc_jury_upsert_score`
- Admin: `rpc_admin_generate_entry_token`, `rpc_admin_list_organizations`, `rpc_admin_mark_setup_complete`, `rpc_admin_set_period_lock`, `rpc_org_admin_list_members`
- RLS: organizations, memberships, periods, projects, jurors, entry_tokens, frameworks, scores, audit_logs (9 files, 36 assertions)

Not tested at DB layer (36 of 45 RPCs), e.g.:

- `rpc_jury_finalize_submission`, `rpc_jury_get_scores`, `rpc_jury_project_rankings`
- `rpc_period_freeze_snapshot`
- `rpc_admin_save_period_criteria`, `rpc_admin_create/update/delete_period_outcome`, `rpc_admin_upsert_period_criterion_outcome_map`
- `rpc_admin_verify_audit_chain` — the audit-chain integrity function has no tamper-then-detect test
- `rpc_juror_reset_pin`, `rpc_juror_toggle_edit_mode`, `rpc_juror_unlock_pin`
- `rpc_admin_update_organization`, `rpc_admin_hard_delete_org_member`, `rpc_admin_delete_organization`
- All backup RPCs, all platform settings RPCs, all public landing/auth-flags RPCs

### 6.2 Triggers, constraints, helpers

- **Triggers:** `trigger_set_updated_at` (9 tables) — untested. `trigger_assign_project_no` — untested. `trigger_clear_grace_on_email_verify` — untested. `trigger_audit_log` diff encoding — only indirectly exercised.
- **Constraints:** NOT NULL / UNIQUE / CHECK / FK CASCADE — untested at pgTAP layer. A migration that accidentally drops a constraint would pass CI.
- **Public RLS policies** (jury anonymous read on locked periods): `period_criteria_select_public`, `period_outcomes_select_public`, `juror_period_auth_select_public` — not directly pgTAP-tested; only assumed via E2E.

### 6.3 Migration CI

- `sql/tests/migrations/idempotency.test.js` — **syntax lint only** (checks for `CREATE OR REPLACE` / `IF EXISTS` patterns).
- **No functional migration CI exists.** No job applies `000→009` on a fresh DB and validates schema.
- Demo seed cron (`demo-db-reset.yml`) applies the seed daily but does not validate that jury auth works on the seeded orgs post-apply.

---

## 7. SaaS-layer test checklist (presence, quality, risk)

| Layer | VERA needs it? | Present? | Quality | Risk if missing | Priority |
|---|---|---|---|---|---|
| Unit tests | Yes | Yes (234, 938 tests) | Medium — bimodal | Internal logic drift | P0 (CI gap) |
| Integration tests (hook ↔ api ↔ mock DB) | Yes | Partial — wrappers tested, hooks mock wrappers, gap between | Low | Silent contract drift | P1 |
| Component tests (RTL) | Yes | Yes | Low–Medium — many shallow | Missed UI regressions | P2 |
| E2E tests | Yes | Yes (40 specs) | Medium–High | Flow breakage | P1 (coverage gaps) |
| API / RPC contract tests | Yes — critical | Partial (9 of 45 RPCs in pgTAP) | Medium where present | **Breaking RPC shape drift** | P0 |
| DB constraint tests | Yes | **No** | — | Silent schema relaxation | P1 |
| RLS / tenant isolation tests | Yes — critical | Yes (pgTAP RLS + E2E sweep) | High | Cross-tenant leak | P0 already well-covered — maintain |
| Migration / idempotency functional tests | Yes | **No** (syntax lint only) | — | Broken migration ships | P0 |
| Visual regression | Nice-to-have | No | — | Drift across light/dark, tables, mobile | P2 |
| Accessibility | Yes | No | — | WCAG violations | P2 |
| Performance / load | Yes (event day) | No | — | Meltdown on concurrent jury usage | P1 |
| Smoke tests (post-deploy) | Yes | Partial (happy-path E2E serves this role) | Medium | Bad deploy undetected | P1 |
| Regression tests | Yes | Yes implicitly via full E2E | Medium | — | P1 — gate unit tests in CI |
| Observability / audit-log tests | Yes | Partial — `audit-log-sink`/`audit-anomaly-sweep` unit tests only | Medium | Tamper detection silent failure | P1 |

---

## 8. Most important findings

1. **CI gate is only E2E.** [ci.yml](../../.github/workflows/ci.yml) lines 6 and 48 have `if: false` on the `test` and `e2e` jobs. The active workflow is [e2e.yml](../../.github/workflows/e2e.yml), which runs Playwright only. 938 unit tests and the edge function test suite do not run on PRs or on `main`.

2. **Hooks-and-pages tests are mock-tautologies in many places.** Page tests that mock their own hook and hook tests that mock all their API dependencies means a wide swath of the suite is exercising a testbench, not the integration the user hits.

3. **The security/RLS story is genuinely strong.** `e2e/security/*` + pgTAP RLS isolation tests together cover multi-tenant boundaries at both layers. This is the single area where VERA is above the SaaS norm. It should be maintained aggressively (and extended to public RLS policies).

4. **No migration CI.** Per `CLAUDE.md`: "Test from zero: After any migration change, apply 000→009 on a fresh DB and verify." This rule has no enforcement. The `idempotency.test.js` file is a regex scan, not a DB apply.

5. **RPC contracts are unpinned for 36 of 45 RPCs.** Changing the return shape of, say, `rpc_admin_update_organization` will break the client silently — no test asserts the shape.

6. **Kong JWT gate untested.** The project's own docs call out this as a "critical gotcha" and reference specific edge functions as the canonical fix pattern. Without a test that reproduces Kong-rejects-ES256, the regression is a matter of time.

7. **QA catalog drift.** 1,167 catalog IDs, 938 tests. The catalog is either aspirational (track it as backlog) or stale (prune it). Either way, "1,167 QA entries" is not the same as "1,167 tests."

---

## 9. Improvement plan

### P0 — do first (gate regression properly)

1. **Enable unit tests in CI.** Remove `if: false` from [ci.yml](../../.github/workflows/ci.yml) `test` job (or move the content into `e2e.yml` as a preceding job). Gate PR merges on green unit tests.
2. **Add functional migration CI.** A job that spins a fresh Postgres (Supabase branching or a Postgres container), applies `sql/migrations/001..009` in order, then runs `pg_prove sql/tests/**/*.sql`. Fail the PR if any fail.
3. **Pin edge function auth-failure shapes.** For every function, add one test each for: missing Authorization header → 401; malformed token → 401; authenticated-but-not-super-admin (where relevant) → 403; valid call → expected shape. That's 16 × ~4 = 64 small tests, mechanical.
4. **Pin RPC return shapes for the 9 most-called RPCs.** pgTAP `has_function` + `matches()` on `RETURNS` clause + a single row-shape assertion per RPC. One file, one day.
5. **Harden the mock-heavy hook tests that matter most.** Replace the mocks in `useAdminData.test.js`, `useSettingsCrud.test.js` (if present), and `useJuryState.test.js` with a small in-test fake RPC surface that covers partial failures (one RPC fails while others succeed). Do *not* rewrite all hook tests — pick the three that drive evaluation day.

### P1 — within one sprint

6. **Fill E2E gaps:** invite-accept end-to-end, password-reset end-to-end, setup-wizard period-creation submission, score-edit-request approval, unlock-request, jury final-submit + lock.
7. **Add constraint / trigger pgTAP.** Insert rows that violate each NOT NULL, UNIQUE, CHECK; assert rejection. Test `trigger_assign_project_no`, `trigger_audit_log` diff accuracy, `trigger_clear_grace_on_email_verify`.
8. **Add post-seed validation.** After `demo-db-reset.yml` applies the seed, run a 5-assertion smoke: a seeded jury token authenticates, a locked period shows projects to the jury, a super-admin can list orgs.
9. **Extend RPC pgTAP to cover the remaining critical RPCs:** `rpc_jury_finalize_submission`, `rpc_period_freeze_snapshot`, `rpc_admin_verify_audit_chain` (with tamper case), `rpc_juror_unlock_pin`, `rpc_admin_upsert_period_criterion_outcome_map`, `rpc_admin_delete_organization`.
10. **Eliminate `waitForTimeout` from active E2E.** Replace the remaining two spots in `evaluate.spec.ts` and `google-oauth.spec.ts` with event-based waits.
11. **Add concurrent-jury performance test.** Even a lightweight Playwright fan-out (N parallel contexts each scoring) against the demo DB validates the evaluation-day use case.

### P2 — ongoing

12. **Audit and prune QA catalog.** Reconcile 1,167 IDs against the 938 tests. Either write the missing tests or mark the entries as backlog.
13. **Add visual regression for the handful of high-churn pages** (RankingsPage, PeriodsPage, mobile card variants) — Playwright `toHaveScreenshot()` with tolerance. Light + dark.
14. **Add accessibility smoke** — `axe-playwright` on the top 5 routes.
15. **Raise coverage thresholds step-wise.** From 47/32/56 to 60/50/65 once P0–P1 are in, then 70/60/75.
16. **Document Kong JWT gate behavior in a pgTAP or deno test fixture.** Even a single reproduction case "Kong rejects ES256 → verify_jwt: false + custom auth" would be a durable memory.

---

## 10. Honest scoring

| Dimension | Score | Reasoning |
|---|---|---|
| **Unit test quality** | **5.5 / 10** | Strong pure-logic tests (field mapping, period helpers, selectors, outcome sorting). Weak hook/page tests (mock-tautologies). Mutation survival ~40–50%. Catalog discipline is a plus. |
| **E2E test quality** | **7 / 10** | Best-in-class security + scoring + resume specs. Real fixtures with teardown. But setup wizard is smoke, several critical admin flows (invite accept, password reset, unlock, score-edit) are missing, `waitForTimeout` smells remain. |
| **Business logic coverage** | **6 / 10** | Scoring math, period state, field mapping, score status — covered well. Outcome attainment only E2E. Realtime, session refresh, CSV export formatting, audit filter building — uncovered. |
| **Data integrity coverage** | **6 / 10** | pgTAP RLS sweep + 9 RPC contracts is solid. 36 RPCs unpinned, constraints/triggers untested, migrations lint-only. |
| **Security / tenant isolation confidence** | **7.5 / 10** | Strongest area. Dual-layer coverage (pgTAP RLS + E2E REST probe + deliberately-break pattern). Kong/ES256 path untested. Public RLS policies not directly pgTAP-tested. |
| **Regression confidence** | **5.5 / 10** | Unit tests disabled in CI is the dominant factor. 938 tests pass locally — nobody is forced to run them. E2E gate helps but is not a substitute. |
| **Production confidence** | **6.5 / 10** | Security and scoring correctness are real. But: no migration CI, no edge fn deploy test, no concurrent-jury perf test, weak admin-flow E2E, audit-chain integrity not tamper-tested. |

**Aggregate read:** The project's ceiling is high — it has the right patterns and the right instincts. The floor is lower than the ceiling suggests, because the gate that decides what ships does not enforce most of them.

---

## 11. Recommended next steps (execution order)

1. Re-enable unit tests in CI (P0 item 1) — a one-line change with immediate regression value.
2. Add functional migration CI (P0 item 2) — the single biggest silent-break risk.
3. Mechanical edge fn auth-shape pinning (P0 item 3) — small effort, broad value.
4. E2E gap sprint for invite-accept, password reset, setup-wizard full submission (P1 items 6).
5. Hardening pass on the three hook orchestrators that drive evaluation day (P0 item 5).

Once the above ship, raise coverage thresholds and reconcile the QA catalog (P2).

---

**End of audit.** No tests were written and no production code was modified during this review, per the Phase 1 scope.
