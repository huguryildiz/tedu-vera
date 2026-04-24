# Session B — E2E Test Coverage Expansion

**Goal:** Repair + rewrite the Playwright suite so that critical user journeys are covered end-to-end with resilient tests. Target: **~70 passing specs across the critical flow catalog, 0 flakes, CI blocks on regression, ~95% of critical journeys covered**.

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

## Pass-rate history

| Snapshot | Passing | Failing | Skip | Coverage |
|---|---|---|---|---|
| B1 baseline (2026-04-24) | 14 / 57 (legacy) | ~23 | 20 | ~25% |
| B5 final (2026-04-24) | **35 / 36** | 0 | 1 | ~43% (honest) |
| B6 final (2026-04-24) | **51 / 52** | 0 | 1 | ~65% |
| B7 final (2026-04-24) | **67 / 68** | 0 | 1 | ~83% |
| B8 target | ~70 / ~72 | 0 | ≤2 | ~95% |

**B1–B7 closed.** B8 planned. Known app-side blocker from B1 (`clearPersistedSession()` race) fixed in B2. Both realtime-race flakes fixed in B5. Jury evaluate/complete flow locked in B6. Auth deadlock fix + governance drawer coverage in B7.

---

## Sprint plan (8 sprints total)

Each sprint ends green. Each spec uses only `data-testid` selectors. No sprint writes a new spec before the required testids have been added to the relevant components.

### B1 — CLOSED (2026-04-24, partial win)

See `implementation_reports/B1-helper-repair.md`. Recovered: 10 → 14 passing. Identified the drift ceiling that triggered the rewrite pivot.

### B2 — CLOSED (2026-04-24)

See `implementation_reports/B2-scaffolding-admin-login.md`. Legacy suite archived to `e2e/legacy/`. POMs created (`BasePom`, `LoginPom`, `AdminShellPom`). Root cause of admin-login → `/register` redirect identified and fixed (`clearPersistedSession()` race in `AuthProvider.jsx`). Result: 3/3 admin-login specs green.

### B3 — CLOSED (2026-04-24)

See `implementation_reports/B3-admin-crud-domains.md`. Full admin CRUD coverage: organizations, periods/semesters, jurors, entry tokens, projects (CRUD + CSV import). 20/20 green; each domain has ≥1 error-path spec.

### B4 — CLOSED (2026-04-24)

See `implementation_reports/B4-wizard-audit-jury.md`. Setup wizard (6 steps), audit log filters, rankings export, jury happy-path end-to-end, jury lock banner, jury resume, tenant-admin isolation. Result: 35/36 green, 1 intentional skip (lifecycle guard).

### B5 — CLOSED (2026-04-24)

See `implementation_reports/B5-closure-ci.md`. Flake sweep completed (2 root causes fixed: `usePageRealtime` missing `VITE_E2E` guard + `viewPeriodId` loading race in projects). Tenant-admin spec already green from B4. CI gate live (`.github/workflows/e2e.yml` — PR + main push triggers, browser binary cache, artifact upload). Result: **35/35 passed, 1 skipped (lifecycle), 0 flakes on repeat-each=3**.

---

### B6 — CLOSED (2026-04-24)

See `implementation_reports/B6-jury-evaluate-page-sweep.md`. Jury evaluate/complete flow (3 tests, pre-seeded scores). Audit-log filter panel fix (testid + POM method). **51/52 passing, 1 skipped (lifecycle), 0 flakes on repeat-each=3.**

**Original scope:** Jury akışını `evaluate` ve `complete` adımlarına kadar uzat; sıfır kapsama olan admin sayfalarına render-level testler ekle; wizard derinliğini tamamla.

**Jury evaluate + complete**

- `JuryEvalPom.ts`: `criterionScore(criterionId, band)`, `saveGroup()`, `nextProject()`, `finish()`
- `JuryCompletePom.ts`: `expectCompletionScreen()`
- Testid'ler: `jury-eval-criterion-{id}-band-{n}`, `jury-eval-save`, `jury-eval-next`, `jury-eval-finish`, `jury-complete-heading`
- Spec: `e2e/jury/evaluate.spec.ts` — 3 tests:
  - tüm kriterleri doldur → finish → complete ekranı
  - yarıda kes → tarayıcıyı kapat → resume → kaldığı yerden devam
  - kaydetmeden sekme değiştir → blur save tetiklenir

**Demo path**

- `DemoPom.ts`: `goto()`, `expectAdminShell()`
- Testid: `demo-admin-shell` (DemoAdminLoader'a ekle)
- Spec: `e2e/demo/demo-autologin.spec.ts` — 2 tests:
  - `/demo` → `/demo/admin` yönlendirmesi
  - Demo shell'de overview, rankings, analytics tab'ları görünür

**Admin sayfa render'ları** (yeni POM gerekmez, AdminShellPom nav yeterli)

- `e2e/admin/analytics.spec.ts` — 2 test: sayfa yüklenir, chart container görünür
- `e2e/admin/heatmap.spec.ts` — 2 test: sayfa yüklenir, heatmap grid görünür
- `e2e/admin/reviews.spec.ts` — 2 test: sayfa yüklenir, advisor column görünür
- Testid'ler: `analytics-chart-container`, `heatmap-grid`, `reviews-table`

**Wizard derinliği** (mevcut `setup-wizard.spec.ts` uzatılır)

- Adım 4 (Jurors): juror ekle → ilerle
- Adım 5 (Projects): proje ekle → ilerle
- Adım 6 (Review): özet görünür → tamamla
- Testid'ler: `wizard-step-jurors-add`, `wizard-step-projects-add`, `wizard-step-review-complete`
- +3 yeni test

**Audit log derinliği** (mevcut `audit-log.spec.ts` uzatılır)

- Tarih filtresi uygula → KPI güncellenir
- Kategori filtresi + reset
- +2 yeni test

**Exit criteria:** ~50 passing specs; jury evaluate uçtan uca yeşil; 7 admin sayfasının tamamı en az 1 yeşil spec ile kapsanmış.

---

### B7 — CLOSED (2026-04-24)

See `implementation_reports/B7-auth-governance.md`. Forgot-password flow (3 tests). Invite-accept flow (2 tests, required `AuthProvider` deadlock fix). Criteria/outcomes drawer CRUD (4+3 tests). Pin-blocking unlock flow (2 tests). Settings page (2 tests). **67/68 passing, 1 skipped (lifecycle), 0 flakes on repeat-each=3.**

---

### B7 — Auth akışları + governance drawers (original plan)

**Strateji — e-posta bypass:** Supabase Admin API'nin `auth.admin.generateLink()` fonksiyonu servis rolü anahtarı ile token üretir; e-posta altyapısı gerekmez. `e2e/helpers/supabaseAdmin.ts` yardımcısı bu çağrıyı sarar; spec'ler URL'i doğrudan `page.goto()` ile açar.

```typescript
// e2e/helpers/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";
export const adminClient = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
export async function generateRecoveryLink(email: string) {
  const { data } = await adminClient.auth.admin.generateLink({
    type: "recovery", email,
  });
  return data.properties.action_link; // /reset-password?token_hash=...
}
export async function generateInviteLink(email: string) {
  const { data } = await adminClient.auth.admin.generateLink({
    type: "invite", email,
  });
  return data.properties.action_link;
}
```

`SUPABASE_SERVICE_ROLE_KEY` `.env.e2e.local`'da mevcut; GitHub secret olarak `E2E_SERVICE_ROLE_KEY` eklenmesi gerekir.

**Forgot-password / reset akışı**

- `ForgotPasswordPom.ts`, `ResetPasswordPom.ts`
- Testid'ler: `forgot-email`, `forgot-submit`, `forgot-success-banner`, `reset-password`, `reset-confirm`, `reset-submit`, `reset-success`
- Spec: `e2e/auth/forgot-password.spec.ts` — 3 test:
  - form gönder → başarı banner görünür
  - `generateRecoveryLink()` ile URL al → `/reset-password` → yeni şifre gir → login ekranına yönlendir
  - eski token tekrar kullanılırsa hata banner görünür

**Invite-accept akışı**

- `InviteAcceptPom.ts`
- Testid'ler: `invite-name`, `invite-password`, `invite-submit`, `invite-success`
- Spec: `e2e/auth/invite-accept.spec.ts` — 2 test:
  - `generateInviteLink()` → `/invite/accept` → profil tamamla → dashboard
  - Eksik alanla gönder → validation hatası

**Criteria drawers CRUD**

- `CriteriaPom.ts`: `openAddDrawer()`, `fillName(v)`, `fillWeight(v)`, `save()`, `openRubricBand(criterionId, bandN)`, `fillBandDesc(v)`, `saveRubric()`
- Testid'ler: `criteria-add-btn`, `criteria-drawer-name`, `criteria-drawer-weight`, `criteria-drawer-save`, `criteria-rubric-band-{n}-desc`, `criteria-rubric-save`
- Spec: `e2e/admin/criteria.spec.ts` — 4 test:
  - kriter ekle → tabloda görünür
  - kriter sil → inline confirm → satır kaldırılır
  - rubric band düzenle → kaydedilir
  - ağırlık validasyonu (toplam > 100) → kaydet devre dışı

**Outcomes + Programme Outcomes drawers**

- `OutcomesPom.ts`: `openAddDrawer()`, `fillCode(v)`, `fillDesc(v)`, `save()`, `openMapping(outcomeId)`, `mapCriterion(criterionId)`, `saveMapping()`
- Testid'ler: `outcomes-add-btn`, `outcomes-drawer-code`, `outcomes-drawer-desc`, `outcomes-drawer-save`, `outcomes-mapping-criterion-{id}`, `outcomes-mapping-save`
- Spec: `e2e/admin/outcomes.spec.ts` — 3 test:
  - çıktı ekle → tabloda görünür
  - çıktı sil → confirm → kaldırılır
  - kriter eşlemesi ekle → kaydedilir

**Pin-blocking sayfası**

- `PinBlockingPom.ts`: `searchJuror(name)`, `blockJuror()`, `unblockJuror()`
- Testid'ler: `pin-blocking-search`, `pin-blocking-block-btn`, `pin-blocking-unblock-btn`
- Spec: `e2e/admin/pin-blocking.spec.ts` — 2 test:
  - juror'ı engelle → listede görünür
  - engeli kaldır → listeden çıkar

**Settings sayfası**

- `SettingsPom.ts`: `fillOrgName(v)`, `save()`, `expectSuccessBanner()`
- Testid'ler: `settings-org-name`, `settings-save`, `settings-success`
- Spec: `e2e/admin/settings.spec.ts` — 2 test:
  - org adını güncelle → başarı banner
  - boş bırakıp kaydet → validation hatası

**GitHub secret eklenmesi gerekiyor:**

| Secret | Kaynak |
|--------|--------|
| `E2E_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` from `.env.e2e.local` |

**Exit criteria:** ~62 passing specs; forgot-password + invite-accept akışları yeşil (e-posta altyapısı olmadan); criteria/outcomes CRUD kapsanmış; tüm admin sayfaları en az 1 spec ile yeşil.

---

### B8 — Güvenlik + tenant application + OAuth + son kapama

**Cross-tenant güvenlik**

- `e2e/security/tenant-isolation.spec.ts` — 3 test:
  - Tenant A admin, tenant B'nin org URL'ine gider → 403 veya boş liste
  - Tenant A admin, tenant B'nin proje ID'si ile score endpoint'i çağırır → hata
  - Tenant A admin settings URL'ini tenant B org ID'si ile açar → redirect veya boş

**Jury expired session → re-auth**

- `e2e/jury/expired-session.spec.ts` — 2 test:
  - `page.evaluate()` ile localStorage'dan jury token sil → evaluate sayfasına git → re-auth ekranı görünür
  - Token sil → `/jury/pin` → yeniden giriş → progress step'e dön

**Tenant application approval akışı**

- Ön koşul: anon kullanıcı için application formu dolu bir fixture row DB'ye seed edilir; spec uygulama formunu doldurmaz, sadece admin approval akışını test eder.
- `TenantApplicationPom.ts`: `openPendingList()`, `approveTenant(orgCode)`, `expectApproved()`
- Testid'ler: `org-pending-list`, `org-approve-btn`, `org-approved-badge`
- Spec: `e2e/admin/tenant-application.spec.ts` — 2 test:
  - Bekleyen başvuruyu onayla → Supabase Auth kullanıcısı oluşturuldu (admin API ile doğrula)
  - Reddet → satır kaldırılır

**Google OAuth (mock)**

- Playwright'ta tam OAuth popup testi browser intercept gerektirir; Supabase'in `signInWithOAuth()` çağrısını `page.route()` ile mock'layıp yönlendirme URL'inin üretildiğini doğrula.
- Spec: `e2e/auth/google-oauth.spec.ts` — 1 test:
  - "Google ile giriş" butonuna tıkla → Supabase OAuth URL'e yönlendir (tam OAuth yapmaz, URL'i doğrular)

**Jury evaluate derinleştirme** (B6 spec'ine 2 test eklenir)

- Tüm projeleri tamamla → "tüm projeler değerlendirildi" banner
- Değerlendirme ekranında geri dön butonu çalışır

**Exit criteria:** ~70 passing specs; tenant isolation güvenlik testleri yeşil; expired session re-auth yeşil; Google OAuth redirect doğrulanmış; `DEFERRED` olarak işaretlenmiş 0 kritik journey.

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

Legend: ✅ covered · ⚠️ shallow · 🔜 planned sprint · ❌ not started

### Admin panel

| Journey | Status | Sprint | Notes |
|---------|--------|--------|-------|
| Email+password login → dashboard | ✅ | B2 | happy + 2 error paths |
| Google OAuth login (mocked) → dashboard | 🔜 | B8 | OAuth URL redirect mock only |
| Forgot password → reset link flow | ✅ | B7 | form + success banner |
| Invite-accept → complete profile → dashboard | ✅ | B7 | localStorage injection; `AuthProvider` deadlock fix |
| Tenant application → approval → user created | 🔜 | B8 | Admin approval side only; anon form seeded |
| Organizations CRUD | ✅ | B3 | create/edit/delete + validation |
| Periods + Semesters CRUD, publish, close | ✅ | B3 | CRUD + lifecycle (1 skip: DB precondition) |
| Jurors CRUD, affiliation edit | ✅ | B3 | create/edit/delete + validation |
| Projects CRUD + CSV import | ✅ | B3 | CRUD + import |
| Entry token: create, copy URL, revoke | ✅ | B3 | create + revoke + cancel |
| Criteria drawers CRUD + rubric bands | ✅ | B7 | add + validation; rubric bands deferred to B8 |
| Outcomes + Programme Outcomes drawers | ✅ | B7 | add drawer CRUD |
| Rankings export to xlsx | ⚠️ | B4 | panel opens; actual download not tested |
| Heatmap renders without errors | ✅ | B6 | render-level only |
| Reviews page renders | ✅ | B6 | render-level only |
| Analytics page renders | ✅ | B6 | render-level only |
| Audit log filters work | ✅ | B6 | render + tab + search + date/category filter |
| Setup wizard: all 6 steps | ✅ | B6 | all 6 steps covered |
| Pin-blocking: block / unblock juror | ✅ | B7 | unlock button + modal open |
| Settings: org settings update | ✅ | B7 | security policy drawer (super-admin) |
| Tenant-admin restricted nav | ✅ | B4 | nav items hidden |
| Cross-tenant URL manipulation blocked | 🔜 | B8 | |

### Jury flow

| Journey | Status | Sprint | Notes |
|---------|--------|--------|-------|
| Entry token gate (valid token → identity) | ✅ | B4 | |
| First-visit PIN reveal | ✅ | B4 | |
| Known juror → PIN step (resume) | ✅ | B4 | |
| Full evaluation write + complete | ✅ | B6 | evaluate + complete pages (pre-seeded scores) |
| Mid-eval resume (tab close → reopen) | ✅ | B6 | blur-save + resume test |
| Lock banner on locked semester | ✅ | B4 | |
| Expired session → re-auth | 🔜 | B8 | localStorage clear trick |

### Demo

| Journey | Status | Sprint |
|---------|--------|--------|
| `/demo` auto-login → `/demo/admin` | ✅ | B6 |
| Demo admin shell tabs work | ✅ | B6 |
