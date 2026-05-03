# VERA — Test Coverage Map

> _Last updated: 2026-04-28_

<!-- Last verified: 2026-04-28 -->

**Status legend**
- 🟢 Solid — real DB assertions, happy + error path
- 🟡 Partial — some real assertions but gaps exist
- 🔴 Weak — render-only, mock-tautology, or no tests

**Column guide**
- **Unit** — Vitest files (`src/*/__tests__/`)
- **DB / SQL** — pgTAP files (`sql/tests/`)
- **E2E** — Playwright specs (`e2e/`)

---

## 1. Database Layer

Cross-cutting tests that don't map to a single UI page.

### 1a. Migrations & schema hygiene

| Area | Unit | DB / SQL | Status | Top Gap |
|---|---|---|---|---|
| Migration idempotency (`CREATE OR REPLACE`, `DROP IF EXISTS`) | `sql/tests/migrations/idempotency.test.js` | — | 🟢 | Fresh-DB apply-from-zero not automated |
| Schema constraints (score range, weight ≥ 0, composite UNIQUE, NOT NULL) | — | `constraints/check.sql` `constraints/unique.sql` `constraints/not_null.sql` `constraints/fk_cascade.sql` | 🟢 | — |

### 1b. Row Level Security (27 tables)

| Area | DB / SQL | Status | Top Gap |
|---|---|---|---|
| All tenant-scoped tables (SELECT / INSERT / UPDATE / DELETE isolation) | `rls/*_isolation.sql` (27 files) | 🟢 | Super-admin bypass for each table not 100% covered |
| Public SELECT policies | `rls/public_select.sql` | 🟢 | — |

### 1c. RPC Contracts (~90 RPCs)

| Area | DB / SQL | Status | Top Gap |
|---|---|---|---|
| Admin RPCs — auth gate, tenant gate, return shape | `rpcs/contracts/admin_*.sql` | 🟢 | — |
| Jury RPCs — auth gate, tenant gate, return shape | `rpcs/contracts/jury_*.sql` | 🟢 | — |
| State mutation (side effects, audit rows) | `rpcs/jury/upsert_score.sql` `rpcs/jury/authenticate.sql` `rpcs/jury/verify_pin.sql` `rpcs/admin/set_period_lock.sql` `rpcs/admin/generate_entry_token.sql` `rpcs/admin/log_period_lock.sql` `rpcs/admin/period_freeze_snapshot.sql` | 🟡 | ~70% of admin RPCs lack mutation tests |

### 1d. Triggers

| Trigger | DB / SQL | Status | Top Gap |
|---|---|---|---|
| `audit_chain` — hash chain integrity, append-only | `triggers/audit_chain.sql` | 🟢 | — |
| `period_lock` — locked period mutation rejected (covers period_criteria / period_outcomes / period_criterion_outcome_maps when `is_locked=true`) | `triggers/period_lock.sql` | 🟢 | — |
| `updated_at` auto-update | `triggers/updated_at.sql` | 🟢 | — |
| Email verify grace clear | `triggers/clear_grace_on_email_verify.sql` | 🟢 | — |

---

## 2. Auth

| Feature | Unit | DB / SQL | E2E | Status | Top Gap |
|---|---|---|---|---|---|
| Login (email/password, remember-me) | `LoginScreen.test` | — | `admin-login.spec.ts` | 🟡 | Rate-limit, real 2-fail sequence |
| Forgot password + recovery link | `ForgotPasswordScreen.test` | — | `forgot-password.spec.ts` | 🟢 | — |
| Reset password | `ResetPasswordScreen.test` | — | `forgot-password.spec.ts` | 🟢 | Client-side strength validation |
| Invite accept | `InviteAcceptScreen.test` | `rpcs/contracts/accept_invite.sql` | `invite-accept.spec.ts` | 🟢 | Membership role assertion |
| Tenant application (register → approval chain) | `TenantSearchDropdown.test` | `rpcs/contracts/admin_approve_application.sql` `rpcs/contracts/admin_reject_application.sql` | `tenant-application.spec.ts` `e2e/auth/tenant-application-full.spec.ts` | 🟡 | Anonymous submit → auth user creation full chain |
| Google OAuth | `AuthProvider.test` | — | `google-oauth.spec.ts` | 🟡 | Real provider response; CompleteProfile → membership |
| Session refresh + persistence | `sessionRefresh.test` `useAuth.test` | — | `google-oauth.spec.ts` | 🟢 | Multi-tab session sync |
| Email verification + grace period | `VerifyEmailScreen.test` `EmailVerifyBanner.test` | `triggers/clear_grace_on_email_verify.sql` | — | 🔴 | Real SMTP path, grace expiry |
| Auth guards (JuryGuard, AuthGuard) | `JuryGuard.test` `AuthGuard.test` | — | implicit (all jury specs) | 🟢 | — |

---

## 3. Jury

| Feature | Unit | DB / SQL | E2E | Status | Top Gap |
|---|---|---|---|---|---|
| Entry token verification (gate) | — | `rpcs/jury/validate_entry_token.sql` | `happy-path.spec.ts` | 🟢 | Expired / malformed token error messages |
| Identity step | `IdentityStep.test` | — | `happy-path.spec.ts` | 🟡 | Input validation rules (length, charset) |
| PIN submit + 3-attempt lockout | `PinStep.test` | `rpcs/jury/verify_pin.sql` | `pin.spec.ts` `lock.spec.ts` | 🟢 | Concurrent attempt collision |
| PIN reveal | `PinRevealStep.test` | — | `pin-reveal.spec.ts` | 🟡 | `activated_at` DB write assertion |
| Locked screen + admin unlock | `LockedStep.test` `pinReset.test` | `rpcs/contracts/juror_unlock_pin.sql` | `lock.spec.ts` `pin-blocking.spec.ts` | 🟢 | — |
| Progress / welcome back | `ProgressStep.test` | — | `resume.spec.ts` | 🟢 | — |
| Evaluation (scoring, autosave, dedup) | `EvalStep.test` `EvalSmallComponents.test` `useJuryAutosave.test` | `rpcs/jury/upsert_score.sql` | `evaluate.spec.ts` (8 tests) | 🟢 | Mobile touch input, dirty-nav warning |
| Final submit + post-submit lock | `DoneStep.test` | `rpcs/contracts/jury_finalize_submission.sql` | `final-submit-and-lock.spec.ts` | 🟢 | — |
| Edit-mode window (admin-granted) | — | `rpcs/contracts/juror_toggle_edit_mode.sql` | `edit-mode.spec.ts` | 🟢 | — |
| Session resume after reload | `useJuryState.test` | — | `resume.spec.ts` | 🟢 | Network interruption → resume |
| Mobile portrait viewport | — | — | `mobile-viewport.spec.ts` | 🟢 | — |
| Concurrent jury (N=8 parallel) | — | — | `concurrent-jury.spec.ts` | 🟢 | — |
| Offline → reconnect → flush | — | — | `offline-reconnect.spec.ts` | 🟡 | Full offline queue recovery |

---

## 4. Admin — Data Management

| Feature | Unit | DB / SQL | E2E | Status | Top Gap |
|---|---|---|---|---|---|
| **Periods** CRUD + lifecycle | `ManagePeriods.test` `lockEnforcement.test` (×12 files) | `rpcs/contracts/admin_close_period.sql` `rpcs/contracts/admin_publish_period.sql` `rpcs/admin/set_period_lock.sql` | `periods.spec.ts` `period-lifecycle.spec.ts` `periods-realtime.spec.ts` | 🟢 | Date-overlap / duplicate-name validation |
| **Unlock request** (tenant → super-admin) | — | `rpcs/contracts/admin_request_unlock.sql` `rpcs/contracts/admin_resolve_unlock_request.sql` | `unlock-request.spec.ts` | 🟢 | — |
| **Projects** CRUD + CSV import | `ProjectsPage.test` `lockEnforcement.test` (×6 files) | — | `projects.spec.ts` `projects-import.spec.ts` | 🟡 | Project-juror assignment matrix, advisor field rules |
| **Jurors** CRUD + batch import + reopen eval | `JurorsPage.test` `lockEnforcement.test` (×10 files) | `rpcs/contracts/juror_reset_pin.sql` `rpcs/contracts/juror_toggle_edit_mode.sql` | `jurors-crud.spec.ts` `juror-batch-import.spec.ts` `score-edit-request.spec.ts` | 🟢 | Juror→project assignment; audit trail for reopen |
| **Criteria** CRUD + weight + rubric bands | `CriteriaManager.test` (×12 files) | `rpcs/contracts/admin_save_period_criteria.sql` | `criteria.spec.ts` `criteria-validation.spec.ts` `criteria-mapping.spec.ts` (4 tests: assign/remove mapping + cascade attainment + weight redistribution) | 🟢 | Rubric band CRUD E2E |
| **Outcomes** CRUD + mapping | `OutcomesPage.test` (×6 files) | `rpcs/contracts/admin_create_period_outcome.sql` `rpcs/contracts/admin_upsert_period_criterion_outcome_map.sql` | `outcomes.spec.ts` `outcomes-mapping.spec.ts` (5 tests: create/edit/delete cascade + mapping persist + cascade attainment) | 🟢 | — |
| **Organizations** CRUD | `OrganizationsPage.test` (×4 files) | `rpcs/contracts/admin_create_org_and_membership.sql` `rpcs/contracts/admin_delete_organization.sql` | `organizations-crud.spec.ts` | 🟡 | Membership role assignment; owner transfer |

---

## 5. Admin — Analytics & Reporting

| Feature | Unit | DB / SQL | E2E | Status | Top Gap |
|---|---|---|---|---|---|
| **Overview** KPIs | `OverviewPage.test` | — | `overview-kpi.spec.ts` (9 tests) | 🟢 | Period switching UI; realtime WS update |
| **Analytics** — attainment math | `useAnalyticsData.test` `getOutcomeAttainmentTrends.test` | `rpcs/contracts/scoring_arithmetic.sql` | `analytics.spec.ts` `outcome-attainment.spec.ts` (9 tests) | 🟢 | — |
| **Analytics** — XLSX export | — | — | `analytics-export-cells.spec.ts` (9 XLSX sheets) | 🟢 | PDF export; CI skip guard (`wcDescribe`) |
| **Analytics** — period comparison | — | — | `analytics-period-comparison.spec.ts` | 🟢 | — |
| **Heatmap** | `HeatmapPage.test` (×6 files) | — | `heatmap.spec.ts` `heatmap-export.spec.ts` | 🟢 | XLSX cell numerical values |
| **Rankings** + export | `RankingsPage.test` | — | `rankings-export.spec.ts` `scoring-correctness.spec.ts` `export-content-parity.spec.ts` `export-advanced-assertions.spec.ts` | 🟢 | Tie-breaker rules with missing scores |
| **Reviews** — filters + KPIs + feedback submit | `ReviewsPage.test` `useReviewsFilters.test` | — | `reviews.spec.ts` (incl. `rpc_submit_jury_feedback` DB write) `analytics-bias-outlier.spec.ts` `reviews-edit-persist.spec.ts` | 🟢 | Combined score+comment filter |
| **Audit Log** — UI + content | `AuditLogPage.test` (×2 files) | — | `audit-log.spec.ts` `audit-event-coverage.spec.ts` (12 event types) | 🟢 | Hash chain verification; pagination; export |

---

## 6. Admin — Controls & Configuration

| Feature | Unit | DB / SQL | E2E | Status | Top Gap |
|---|---|---|---|---|---|
| **Entry Control** (token generate / revoke) | `JuryEntryControlPanel.test` (×2 files) | `rpcs/contracts/admin_generate_entry_token.sql` `rpcs/contracts/admin_revoke_entry_token.sql` | `entry-tokens.spec.ts` | 🟡 | Token expiry; multi-period token management |
| **PIN Blocking** (admin unlock) | `PinBlockingPage.test` (×3 files) | `rpcs/contracts/juror_unlock_pin.sql` | `pin-blocking.spec.ts` | 🟢 | Bulk unlock; audit trail |
| **Settings** — security policy, PIN policy, team, password | `AdminSettings.test` (×5 files) | `rpcs/contracts/admin_set_security_policy.sql` `rpcs/contracts/admin_set_pin_policy.sql` | `settings.spec.ts` `settings-save.spec.ts` (8 RPC tests) | 🟢 | Organization config save; audit row for settings change (known backlog) |
| **Setup Wizard** | `SetupWizard.test` (×2 files) | `rpcs/contracts/mark_setup_complete.sql` | `setup-wizard.spec.ts` (step nav) `setup-wizard-submit.spec.ts` (full submit) `setup-wizard-steps.spec.ts` (4 tests: step 2/3/4/5 DB writes) | 🟢 | Framework assign step write (via UI) |
| **Maintenance Mode** | — | `rpcs/contracts/admin_set_maintenance.sql` `rpcs/contracts/admin_cancel_maintenance.sql` | `maintenance-mode.spec.ts` | 🟢 | — |
| **Tenant Admin role** | — | — | `tenant-admin.spec.ts` | 🟡 | Nav restriction enforcement per route |

---

## 7. Security

| Scenario | DB / SQL | E2E | Status | Top Gap |
|---|---|---|---|---|
| Cross-tenant data isolation (8-table sweep) | `rls/*_isolation.sql` | `tenant-isolation.spec.ts` | 🟢 | — |
| RBAC boundary (tenant-admin cross-org mutation) | — | `rbac-boundary.spec.ts` | 🟢 | — |
| Period structural immutability (locked-period trigger) | `triggers/period_lock.sql` | `period-immutability.spec.ts` | 🟢 | — |
| Token revoke → eval gate denial | `rpcs/contracts/entry_token_revoke.sql` | `token-revoke-deny.spec.ts` | 🟢 | — |
| Multi-org tenant context switch | — | `multi-org-switch.spec.ts` | 🟢 | — |
| Demo org read-only | — | `read-only.spec.ts` | 🟢 | — |

---

## 8. Visual & Accessibility

| Area | Tool | Spec | Status | Top Gap |
|---|---|---|---|---|
| Admin routes (light + dark, desktop + mobile) | Playwright snapshots | `visual/admin-routes.spec.ts` | 🟡 | Jury flow snapshots missing |
| Accessibility (axe, 0 critical violations) | axe-playwright | `a11y/smoke.spec.ts` | 🟡 | Jury eval form; mobile portrait a11y |

---

## Coverage Summary

| Layer | 🟢 Solid | 🟡 Partial | 🔴 Weak |
|---|---|---|---|
| DB / SQL (migrations, constraints, RLS, RPCs, triggers) | Constraints, RLS (27 tables), RPC contracts (~90), all 4 triggers | RPC state mutation (~30%) | — |
| Unit (Vitest) | Jury flow, Periods, Criteria, Jurors | Auth screens, Admin analytics hooks | Landing, VerifyEmail, CompleteProfile |
| E2E (Playwright) | Jury (all), Periods, Security (all), Overview KPI, Analytics, Rankings, Heatmap, Audit Log, Settings, Criteria (mapping + cascade), Outcomes (mapping + cascade), Reviews (feedback submit), Setup Wizard (step writes) | Projects, Organizations, Entry Control | VerifyEmail |

### Priority gaps (implementation order)

1. **Rubric band CRUD E2E** — drawer add / remove / reorder bands → DB assertion on `period_criteria.rubric_bands` JSONB *(~1 day)*
2. **Reviews combined-filter engine E2E** — score range + comment text + juror filter applied together → row count matches *(~0.5 days)*
3. **Projects → juror assignment matrix E2E** — assign juror to project → DB row in junction table; remove → row gone *(~1 day)*
4. **Organizations: owner transfer E2E** — transfer ownership → membership.is_owner moves; old owner becomes plain admin *(~0.5 days)*
5. **RPC state-mutation backfill** — extend admin state-mutation tests from ~30% toward 60% (target: framework CRUD, juror reset PIN, force-close edit-mode side effects) *(~3 days)*

> **Coverage notes (2026-04-28):** Earlier priority list was based on a stale read of `e2e/admin/`. The mapping / cascade / feedback / setup-wizard gaps are already covered by `criteria-mapping.spec.ts`, `outcomes-mapping.spec.ts`, `reviews.spec.ts`, and `setup-wizard-steps.spec.ts`. The "snapshot immutability trigger" gap was misframed — actual immutability is `is_locked`-based and tested in `triggers/period_lock.sql`; the snapshot lifecycle (idempotency + force re-freeze) is now covered by `rpcs/admin/period_freeze_snapshot.sql` instead.

---

## File locations

```
src/admin/features/<feature>/__tests__/   admin unit tests
src/jury/features/<step>/__tests__/       jury unit tests
src/auth/features/<screen>/__tests__/     auth unit tests
sql/tests/migrations/                     migration idempotency (Vitest)
sql/tests/constraints/                    schema constraint pgTAP
sql/tests/rls/                            RLS isolation pgTAP
sql/tests/rpcs/contracts/                 RPC contract pgTAP
sql/tests/rpcs/jury/                      jury RPC state pgTAP
sql/tests/rpcs/admin/                     admin RPC state pgTAP
sql/tests/triggers/                       trigger pgTAP
e2e/admin/                                admin Playwright (project: admin)
e2e/jury/                                 jury Playwright (project: other)
e2e/auth/                                 auth Playwright (project: other)
e2e/security/                             security Playwright (project: other)
e2e/a11y/                                 axe scans (project: a11y, nightly)
e2e/visual/                               snapshot tests (project: visual, nightly)
e2e/perf/                                 load tests (project: perf, dispatch only)
```
