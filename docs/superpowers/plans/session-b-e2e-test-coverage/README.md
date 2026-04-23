# Session B — E2E Test Coverage Expansion

**Goal:** Repair + rewrite the Playwright suite so that critical user journeys are covered end-to-end with resilient tests. Target: **~60 passing specs across the critical flow catalog, 0 flakes, CI blocks on regression**.

**Parallel with:** Session A — Unit Test Coverage (see `../session-a-unit-test-coverage/`)

---

## Plan pivot (2026-04-24)

**Original plan** was to repair the existing suite sprint-by-sprint. After B1 (see `implementation_reports/B1-helper-repair.md`) we realised the legacy suite had accumulated too much drift (stale selectors, outdated route assumptions, DOM-coupled helpers) to make repair economical. B1 recovered only 10 → 14 passing with significant effort, and admin-login specs hit an app-side blocker that was independent of test code.

**Revised approach — rewrite, not repair:**

- **Same flow catalog** — the list of critical journeys stays identical (admin login, org CRUD, period CRUD, jurors CRUD, entry tokens, wizard, audit, import/export, jury happy path, tenant isolation, demo, password reset, invite-accept).
- **Fresh POMs** — new Page Object Models bound to current DOM, written once, owned by this plan.
- **`data-testid` contract is mandatory** — every new spec only uses `data-testid` selectors. Component-level text / role / placeholder selectors are banned. This prevents the drift that killed the legacy suite.
- **Legacy suite archived, not deleted** — `e2e/**/*.spec.ts` moves to `e2e/legacy/`. It stays in the repo as a behaviour oracle during rewrite but is excluded from `npm run e2e`.

---

## Baseline (2026-04-24, end of B1)

Captured from `npm run e2e`:

| Metric | Current | Target |
|---|---|---|
| Passing | 14 / 57 | 60+ / ~65 |
| Failing | ~23 | 0 |
| Skipped / did not run | 20 | 0 (or intentional + documented) |
| Critical user journeys covered with green specs | ~25% | 80% |

**Known app-side blocker (found in B1):** `getSession()` returns empty in the E2E admin flow for `demo-admin@vera-eval.app` even though (a) UUID matches `auth.users.id`, (b) membership row exists with `status='active' / role='super_admin'`, (c) RLS policy `user_id = auth.uid() OR current_user_is_super_admin()` allows the read. Two hypotheses:

- **H1 (seed):** `raw_user_meta_data.profile_completed` is `null` on the E2E admin. AuthProvider only redirects to `/register` when `organizationList.length === 0`, so seed alone is not the direct cause — but it's a cheap fix that eliminates one variable.
- **H2 (JWT timing):** `auth.getUser()` is called immediately after sign-in and may resolve before the JWT propagates, making the RLS predicate evaluate against a different `auth.uid()` → empty array. Would need either a retry in AuthProvider or an explicit `waitForSession()` in the E2E helper.

**This blocker is owned by sprint B2** (scaffold + first flow) — the admin-login spec will repro it in isolation and pick the fix.

---

## Revised sprint plan (5 sprints)

Each sprint ends green. Each spec uses only `data-testid` selectors. No sprint writes a new spec before the required testids have been added to the relevant components.

### B1 — CLOSED (2026-04-24, partial win)

See `implementation_reports/B1-helper-repair.md`. Recovered: 10 → 14 passing. Identified the drift ceiling that triggered the rewrite pivot.

### B2 — Rewrite scaffolding + Admin login flow

- Move `e2e/**/*.spec.ts` → `e2e/legacy/**` and exclude from `playwright.config.ts`
- Create `e2e/poms/` folder with `BasePom.ts`, `LoginPom.ts`, `AdminShellPom.ts`
- Add mandatory `data-testid` attributes to: login form fields, sign-in button, admin sidebar nav, admin shell root
- Diagnose + fix the admin-login blocker (H1/H2 above)
- Write first green spec: `admin-login.spec.ts` (happy + 2 error paths)
- **Exit criteria:** 3 green admin-login specs on fresh rewrite; `e2e/legacy/` untouched by runner.

### B3 — Admin CRUD domains

- Organizations CRUD (create/edit/delete + validation)
- Periods + Semesters CRUD (create/publish/close)
- Jurors CRUD (add/edit affiliation/remove)
- Entry tokens (create/copy URL/revoke)
- Projects CRUD + CSV import
- **Exit criteria:** 15+ green specs covering all admin CRUD happy paths; each domain has at least 1 error path.

### B4 — Admin non-CRUD + jury flow

- Setup wizard (all 6 steps advance + validate)
- Audit log (filter controls)
- Rankings export to xlsx
- Jury happy path: entry token → identity → PIN reveal → evaluation → done
- Jury lock: locked semester shows banner
- Jury resume: known juror → PIN step
- **Exit criteria:** 10+ green specs; jury flow end-to-end covered.

### B5 — Security, demo, new flows + CI gate

- Tenant isolation (URL manipulation, cross-tenant scores, cross-tenant settings)
- Demo auto-login (`/demo` → `/demo/admin`)
- Password reset (full email → reset link → new password loop, email mocked)
- Invite-accept (super-admin invites tenant-admin → link accept → profile complete)
- Tenant application approval (anonymous form → admin approve → Supabase Auth user created)
- Google OAuth (mocked) login screen
- Wire CI gate: `playwright-results.json` parsed in GitHub Actions; any failure blocks merge
- Add Allure reporter to `playwright.config.ts` so `npm run allure:generate` produces real output
- **Exit criteria:** 60+ green specs; CI blocks on regression; Allure report generated.

---

## Rules (coordination with Session A)

1. **Session A cannot change component DOM or testids without flagging.** If a spec breaks because a component was refactored, track the root cause — don't just patch the selector.
2. **`data-testid` is Session B's territory and contract.** New testids added as part of a sprint must be documented in the sprint report. Session A is welcome to assert against them in unit tests.
3. **Shared fixtures:** `e2e/fixtures/` and `src/test/qa-catalog.json` stay in sync. Never branch them.
4. **`.env.e2e.local` seeds:** If a sprint needs new seed rows, document in sprint report + update `scripts/generate_demo_seed.js` if applicable.
5. **Flake policy:** A test that passes 9/10 runs is broken — fix the root cause, don't add retries.
6. **Rewrite discipline:** No spec is merged that uses a non-testid selector. No PR that adds a test also changes a component's behaviour — only its testid attributes.

---

## `data-testid` naming convention

Pattern: `{scope}-{component}-{element}` — lowercase, hyphen-separated.

Examples:
- `admin-login-email`, `admin-login-password`, `admin-login-submit`
- `admin-shell-sidebar`, `admin-shell-nav-overview`, `admin-shell-signout`
- `orgs-drawer-name`, `orgs-drawer-code`, `orgs-drawer-save`
- `jury-identity-name`, `jury-identity-surname`, `jury-identity-start`
- `jury-pin-digit-0` .. `jury-pin-digit-5`

Rule: every interactive element (input/button/link) touched by any E2E spec must have a `data-testid` before the spec is written.

---

## Commands

```bash
npm run e2e                       # rewritten suite (legacy excluded via config)
npm run e2e -- --headed           # watch browser during run
npm run e2e -- --grep "login"     # filter specs
npm run e2e -- --workers=1        # single worker (debugging)
npm run e2e:report                # open last HTML report
npm run e2e:excel                 # xlsx report
npm run allure:generate           # Allure report (after B5 when reporter is wired)
```

Playwright browser binaries live at `~/Library/Caches/ms-playwright/`. If missing after `node_modules` reinstall: `npx playwright install`.

---

## Tracking

- Sprint reports: `implementation_reports/B<N>-<slug>.md` with pass-rate delta, flaky tests observed, fixtures / testids added
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
