# Session B — E2E Test Coverage Expansion

**Goal:** Repair the currently broken Playwright suite (**10/57 passing**) and expand coverage of critical user journeys to a healthy SaaS target — roughly **80% of critical flows automated, 100% of passing tests green on every push**.

**Parallel with:** Session A — Unit Test Coverage (see `../session-a-unit-test-coverage/`)

---

## Baseline (2026-04-23)

Captured from `npm run e2e`:

| Metric | Current | Target |
|---|---|---|
| Passing | 10 / 57 | 60+ / 70+ |
| Failing | ~25 | 0 |
| Skipped / did not run | 20 | 0 (or intentional + documented) |
| Critical user journeys covered | ~20% | 80% |

**Key failure pattern:** `e2e/helpers/LoginPage.ts:19` — `getByRole("button", { name: /admin|yönetici/i })` can no longer find the Admin entry button on the landing page. This cascades into every admin spec.

---

## Sprint plan (5 sprints)

### B1 — Repair broken helpers and fixtures

- Fix `LoginPage.ts` selector (landing page "Admin" button → likely renamed or moved)
- Audit all helper files in `e2e/helpers/` for stale selectors
- Verify `.env.e2e.local` seed data still matches DB
- **Exit criteria:** At least 40/57 existing specs pass.

### B2 — Admin CRUD flows (Organizations, Periods, Jurors, Entry Tokens)

- Repair `e2e/admin/*.spec.ts` (all `*-crud.spec.ts` files)
- Each CRUD flow: create, edit, delete, validation errors
- **Exit criteria:** All existing CRUD specs green; add missing Projects CRUD coverage.

### B3 — Admin flows: Setup Wizard, Audit Log, Import/Export

- Repair `setup-wizard.spec.ts` (6 step-indicator checks)
- Repair `audit-log-view.spec.ts` filters
- Repair `admin-import.spec.ts` + `admin-export.spec.ts` (CSV + xlsx)
- **Exit criteria:** Full admin panel happy path covered.

### B4 — Jury flow + Tenant Isolation + Demo

- Repair `jury-flow.spec.ts`, `jury-lock.spec.ts`, `jury/pin-lifecycle.spec.ts`
- Repair `tenant-isolation.spec.ts` (cross-tenant data leakage checks)
- Repair `demo/auto-login.spec.ts`
- Add negative-path tests: expired session, revoked token, locked semester
- **Exit criteria:** Tenant security guarantees fully automated.

### B5 — New critical journeys + CI gate

- Add missing flows: password reset (full loop), invite-accept, tenant application approval, Google OAuth mock
- Wire up `playwright-results.json` parsing in CI to fail on any regression
- Add `allure` reporter to `playwright.config.js` (`test-results/allure-results` is currently empty → reporter not registered)
- **Exit criteria:** 60+ passing tests, Allure report generates real results, CI blocks on failure.

---

## Rules (coordination with Session A)

1. **Session A cannot change component DOM or testids without flagging.** If a spec breaks because a component was refactored, track the root cause — don't just patch the selector.
2. **`data-testid` is Session B's territory.** Propose new testids when selectors are brittle; add them via Session A with coordination (or add here and ping Session A to write matching unit tests).
3. **Shared fixtures:** `e2e/fixtures/` and `src/test/qa-catalog.json` stay in sync. Never branch them.
4. **`.env.e2e.local` seeds:** If a sprint needs new seed rows, document in sprint report + update `scripts/generate_demo_seed.js` if applicable.
5. **Flake policy:** A test that passes 9/10 runs is broken — fix the root cause, don't add retries.

---

## Commands

```bash
npm run e2e                      # full suite (auto-starts dev server)
npm run e2e -- --headed          # watch browser during run
npm run e2e -- --grep "Login"    # filter specs
npm run e2e -- --workers=1       # single worker (debugging)
npm run e2e:report               # open last HTML report
npm run e2e:excel                # xlsx report
```

Playwright browser binaries are downloaded to `~/Library/Caches/ms-playwright/`. If they're missing (e.g. after `node_modules` reinstall), run `npx playwright install`.

---

## Tracking

- Sprint reports: `implementation_reports/B<N>-<slug>.md` with pass-rate delta, flaky tests observed, fixtures changed
- Pass-rate history: append each sprint's `npm run e2e` tail summary to `passrate-history.md` (create on first use)
- Flake log: any test that intermittently fails gets one line in `flake-log.md` with spec path + suspected root cause

---

## Critical user journeys (coverage checklist)

### Admin panel
- [ ] Email+password login → dashboard
- [ ] Google OAuth login (mocked) → dashboard
- [ ] Forgot password → reset link flow
- [ ] Invite-accept → complete profile → dashboard
- [ ] Tenant application → approval → Supabase Auth user created
- [ ] Organizations CRUD
- [ ] Periods + Semesters CRUD, publish, close
- [ ] Jurors CRUD, affiliation edit
- [ ] Projects CRUD + CSV import
- [ ] Entry token: create, copy URL, revoke
- [ ] Criteria + Outcomes + Programme Outcomes drawers
- [ ] Rankings export to xlsx
- [ ] Heatmap renders without errors
- [ ] Audit log filters work
- [ ] Setup wizard: all 6 steps advance + validate
- [ ] Tenant-admin cannot see another tenant's data (URL manipulation)

### Jury flow
- [ ] Entry token gate (valid token → identity)
- [ ] First-visit PIN reveal
- [ ] Known juror → PIN step
- [ ] Full evaluation write + resume
- [ ] Lock banner on locked semester
- [ ] Expired session → re-auth

### Demo
- [ ] `/demo` auto-login lands on `/demo/admin`
- [ ] Demo admin shell tabs work
