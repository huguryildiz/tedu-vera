# VERA Test Architecture & Coverage Audit

**Tarih:** 2026-04-28
**Kapsam:** Unit, component, integration, E2E, edge function, pgTAP/SQL, migration, RLS, RPC, CI workflow
**Yöntem:** Salt-okunur kod taraması (5 paralel exploration ajanı + manuel doğrulama). Hiçbir test, migration, CI veya kaynak dosyası değiştirilmedi.
**Disclaimer:** Bu rapor static analiz tabanlıdır. CI'de gerçek koşum metriği, flake oranı veya gerçek vaktendeki coverage delta'ları lokalde ölçülmedi. Sayısal ifadeler (örn. "232 test dosyası") repo snapshot'ından alındı; running test count vitest reporter'a göre değişebilir.

---

## 1. Executive Summary

### Tek paragraf

VERA, multi-tenant academic jury evaluation platform olarak **DB-centric bir test piramidini bilinçli olarak tercih eden** ve bunu disipline etmek için drift sentinel'leri (`check:rls-tests`, `check:rpc-tests`, `check:edge-schema`, `check:db-types`) hard-gate'e yerleştirmiş bir projedir. Mevcut envanter sayısal olarak güçlü görünüyor: **~232 unit/component test dosyası, 66 Playwright spec, 135 SQL/pgTAP test, 21/21 edge function için Zod schema + Deno test, 1.189 aktif qaTest ID** — ekip teknik borcun farkında, üç bağımsız audit + bir kalite planı yazılı (docs/testing/). Ancak audit'in sonucu net: **sayısal güven yüksek, davranışsal güven orta seviye**. Üç ana zayıflık: (1) admin sayfa unit testlerinin %53'ü "page renders" smoke veya hook-mock tautology, (2) E2E'lerin yaklaşık ¼'ü gerçek transaction değil "page-loads + form-visible", (3) RLS/RPC kontratları imza ve hata kodlarını sabitliyor ama state-mutation + audit trail bütünlüğünü ölçmüyor. Period auto-lock, criteria-weight→ranking sync, multi-org tenant context-switch ve filtered export gibi **kritik kullanıcı akışlarında E2E gap'leri var**. CI hard-gate'leri sağlam (unit + edge fn + pgTAP + drift sentinel hepsi blocking), ama **E2E workflow informational** — bu, prod'a çıkarken jury-day kritikliği için riskli. Önerilen yön: 9 admin page tautology'sinin refactor'u, 5 audit-log assertion eklemesi, period lifecycle E2E'leri ve RPC kontrat testlerinin state-mutation seviyesine derinleştirilmesidir.

### Top-level güven skorları

| Katman | Skor | Açıklama |
|---|---:|---|
| Migration & schema bütünlüğü | **6/10** | Snapshot 000–009 CI'da uygulanır, idempotency pattern enforced. End-state şema doğrulaması yok. |
| RLS isolation (read) | **8/10** | 27/27 tablo cover. SELECT iyi, INSERT/UPDATE/DELETE inconsistent. |
| RPC contract (signature/error) | **8/10** | 89/89 RPC pin'lenmiş. State mutation + audit shape eksik. |
| RPC business logic | **5/10** | Happy/sad path imzaları var, side-effect (audit row, juror_period_auth update) çoğunlukla untested. |
| Trigger correctness | **6/10** | Critical (audit chain, period lock) ✅. Trigger drop / multi-trigger ordering ✗. |
| Edge function | **8/10** | 21/21 Zod schema + Deno harness. Mock'a karşı kapsamlı. Real Kong/JWT untested. |
| Unit (admin features) | **5/10** | Alt-katman intentional mock boundary'ler iyi. ~9 admin sayfa tautology. |
| Unit (shared/api/hooks) | **7/10** | fieldMapping, storage, useJuryState yüksek kalite. |
| E2E jury flow | **8/10** | Identity→PIN→eval→submit→lock zinciri DB round-trip ile test. Period auto-lock eksik. |
| E2E admin flow | **6/10** | Scoring math, RBAC, immutability iyi. CRUD spec'lerin %50'si smoke. |
| E2E security | **8/10** | Tenant isolation 8 tablo sweep, RLS+RBAC gerçek. Multi-org tenant switch ✗. |
| CI infra hard-gate | **9/10** | unit, edge, pgTAP, drift sentinel hepsi blocking. |
| CI E2E gate | **5/10** | E2E workflow informational, retry strategy belirsiz. |
| **Genel** | **7.0/10** | Premium SaaS hedefi için zemini hazırlanmış, plan + execution arasında %20–30 gap. |

### En kritik 5 risk

> **Düzeltme notu (2026-04-28):** İlk taslakta "period auto-lock post-final-submit E2E yok" diye genel bir risk yer aldı; bu yanıltıcıydı. VERA'da period seviyesinde auto-lock davranışı **kasten kaldırılmış** (`sql/migrations/006a_rpcs_admin.sql:1195` yorumu: "Before the lifecycle redesign an auto-lock trigger on the first token INSERT made this implicit; now publish is a deliberate admin action"). Period kilidi `rpc_admin_publish_period` ile deliberate olarak set edilir ve bu davranış `sql/tests/rpcs/contracts/admin_publish_period.sql`, `sql/tests/triggers/period_lock.sql`, `e2e/security/period-immutability.spec.ts` ile zaten test edilir. **Ancak** juror seviyesindeki "kendi notları lock" mekanizması (final submit sonrası `rpc_jury_upsert_score` → `final_submit_required` reject) gerçek bir gap olarak çıktı — risk #1 buna göre revize edildi.

1. **Juror-level post-submit score lock testi yok.** `rpc_jury_upsert_score` (`sql/migrations/005_rpcs_jury.sql:557-559`) net olarak şunu yapıyor: `final_submitted_at NOT NULL` + `edit_enabled = false` → `error_code: final_submit_required` reject. Bu **juror'un kendi notlarının submit sonrası locked olması** sözleşmesinin tam karşılığı. Ama bu kod path için ne pgTAP ne E2E test var. Mevcut testler sadece "edit_enabled=true ile update OK" (`e2e/jury/edit-mode.spec.ts` test 1) ve "edit_enabled=true ama window expired" (test 2) yönlerini kapsıyor; **default state (admin edit'i hiç enable etmemiş) reject path'i hiç test edilmiyor.** `sql/tests/rpcs/jury/upsert_score.sql` 5 plan içinde sadece invalid_session, session_not_found, happy path, row created, value match var. **En temel "submit yaptım, notlarım kilitlendi" davranışı testsiz.**
2. **Audit log assertion eksikliği.** `e2e/admin/settings-save.spec.ts`, `e2e/admin/criteria.spec.ts`, security-policy değişiklikleri *audit_logs* tablosuna yazıldı mı diye doğrulamıyor. Akreditasyon için compliance-kritik.
3. **9 admin sayfa unit testinin "tautology" olması.** Heatmap, Outcomes, Criteria, Periods, Projects, Reviews, PIN Blocking, Organizations sayfa testleri — orchestrator hook'ları mock'lıyor, "render edildi mi" kontrol ediyor; aslında hesaplama veya state-transition test etmiyor.
4. **Lock enforcement = 12 todo() placeholder.** `useManageJurors.lockEnforcement.test.js` ve `useManageProjects.lockEnforcement.test.js` içinde locked period'da delete/duplicate/import bloklanmıyor mu — yazılmamış. Kod-yorumlarında aşikar.
5. **CI'da E2E workflow PR-blocking değil.** `e2e.yml` informational; admin shard 1/2 fail etse bile main'e merge engellenmez. RBAC/period-immutability/scoring-correctness gibi 19 critical spec güveni için zayıflık.

---

## 2. Current Test Inventory

### 2.1 Sayısal envanter

| Layer | Yer | Dosya | ~Test bloğu |
|---|---|---:|---:|
| Unit/component (Vitest+jsdom) | `src/**/__tests__/` | 232 | ~1.500 |
| E2E (Playwright) | `e2e/**.spec.ts` | 66 | ~280 |
| Edge function (Deno test) | `supabase/functions/*/index.test.ts` | 21 | ~250 |
| Edge schema (Zod) | `supabase/functions/*/schema.ts` | 21 | — |
| pgTAP RLS isolation | `sql/tests/rls/` | 29 | ~290 assertion |
| pgTAP RPC contracts | `sql/tests/rpcs/contracts/` | 86 (+1 pending) | ~440 |
| pgTAP RPC jury | `sql/tests/rpcs/jury/` | 4 | ~60 |
| pgTAP RPC admin | `sql/tests/rpcs/admin/` | 5 | ~80 |
| pgTAP triggers | `sql/tests/triggers/` | 5 | ~30 |
| pgTAP constraints | `sql/tests/constraints/` | 4 | ~25 |
| Migration (JS) | `sql/tests/migrations/idempotency.test.js` | 1 | static scan |
| Skip-policy testler | `e2e/**.spec.ts` skipped | 5 (baseline) | — |
| qaTest catalog | `src/test/qa-catalog.json` | 1.189 active ID | — |
| QA backlog | catalog'da `status:"backlog"` | 254 ID | planlı, kod yok |

**Toplam:** Yaklaşık 313 test dosyası, ~1.900 test bloğu, 889 pgTAP assertion, 1.189 qaTest ID.

### 2.2 Frameworks ve araçlar

- **Vitest 1.3.1** (jsdom, fork pool) + `@testing-library/react@14`, `@testing-library/jest-dom`
- **Playwright 1.58.2** + `@axe-core/playwright`
- **Allure** (test:report, vitest.config.allure.mjs)
- **Deno test** (Edge functions, import map)
- **pgTAP** (Postgres extension, pg_prove runner via .github/workflows/ci.yml)
- **Custom check scripts** (`scripts/check-*.mjs|js`): no-native-select, no-nested-panels, no-table-font-override, js-size, css-size, db-types, rls-tests, rpc-tests, edge-schema, no-skip
- **Allure-vitest, vitest-axe, vitest coverage v8**

### 2.3 Yapı / organizasyon

- Unit testler her feature klasörünün altındaki `__tests__/` dizinde (`src/admin/features/<area>/__tests__/`, `src/jury/features/<area>/__tests__/`, vs.)
- E2E testler `e2e/<domain>/` (admin, jury, auth, security, visual, a11y, perf, demo)
- POM yapısı: `e2e/poms/` (~23 POM), `e2e/helpers/`, `e2e/fixtures/`
- pgTAP testleri 3 ana subdir: `rls/`, `rpcs/{jury,admin,contracts}/`, `triggers/`, `constraints/`, `migrations/`
- Edge function testler: her fonksiyonun kendi klasöründe `index.test.ts`, `schema.ts`. `supabase/functions/_test/` test harness ve mock-supabase
- qaTest catalog tek dosya: `src/test/qa-catalog.json` (kategori dağılımı: shared/API 208, admin/utils 91, geri kalanı dağıtılmış)

### 2.4 Lokal vs CI farklılığı

- CI'de `pool=forks` (ci.yml:unit-tests), lokalde varsayılan
- E2E lokalde `npm run e2e`, CI'de 2 admin shard + other + maintenance
- Forgot-password E2E **CI'da skip** (`process.env.CI` guard, Mailpit/SMTP yok)
- `analytics-export-cells.spec.ts` CI'da skip (recent commit `65adc932`)
- Visual regression + a11y smoke **manual workflow_dispatch only**
- pgTAP testler CI'de Postgres 15 + pg_cron/pg_net guard'ı ile çalışır; lokalde RUNNING.md'ye göre yapılır

---

## 3. Layer-by-Layer Assessment

### 3.1 Unit & component tests

#### Güçlü taraflar
- `src/shared/api/__tests__/fieldMapping.test.js` — 26 qaTest, round-trip dönüşüm + null/array/string normalization. Gold-standard.
- `src/jury/shared/__tests__/useJuryState.test.js` — full state machine'i test eden helper'lar (`advanceToEval2`) ile gerçek user-visible behavior.
- `src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js` — lock-aware mutation gating.
- `src/shared/storage/__tests__/adminStorage.test.js` — token persistence, scratch ayrımı, round-trip.
- `src/admin/features/heatmap/__tests__/HeatmapPage.test.jsx` (lines 1–5) **bilerek mock'lamamış**: "Mocking them was a false-confidence tautology" yorumu — pattern olgun.
- `src/admin/features/outcomes/__tests__/outcomeHelpers.test.js` — pure helper'lar için doğru seviye.

#### Zayıf taraflar
- `src/shared/ui/__tests__/smoke.test.jsx` — 24 test mount + `getByText("Info")` kontrol. Prop, state, a11y, error state yok.
- `src/admin/features/rankings/__tests__/RankingsPage.test.jsx` — 16+ child component mock + 8 child stub `() => null`. Search input render ediliyor mu test edilmiş, gerçekten filtreliyor mu test edilmemiş.
- `src/admin/features/criteria/__tests__/useCriteriaForm.test.js` — sadece 2 test, dnd-kit ve validation mock'lı. Validation mantığı test edilmemiş.
- `src/admin/features/heatmap/__tests__/useHeatmapData.test.js` — single test, sadece property key varlığı. Multi-group aggregation correctness ✗.
- 9 admin sayfa testinin **tautology pattern**: orchestrator mock + page renders. (page-test-mock-audit.md'den): Criteria, Heatmap, Outcomes, Organizations, Periods, Projects, PIN Blocking, Reviews — 8 pending refactor.
- 12× `it.todo()` lock enforcement yer tutucu (`useManageJurors.lockEnforcement.test.js`, `useManageProjects.lockEnforcement.test.js`) — yorum satırlarında "delete on locked period missing", "duplicate on locked missing", "import on locked missing" gap dokümante edilmiş ama test yok.

#### Test count vs güven asimetrisi
- Vitest config'de coverage threshold'lar düşük: lines 49%, functions 35%, branches 57% (vite.config.js içindeki yorum: "raise to 60/50 once dedicated sub-component tests are added")
- 1.189 active ID → 935 actual `qaTest()` call → **254 backlog ID** (catalog'da var ama kod yok). Plan-vs-execution gap %21.

### 3.2 E2E (Playwright) tests

#### Gerçek transaction testler (19 critical, "keep")
| Path | Test alanı |
|---|---|
| `e2e/jury/evaluate.spec.ts` | Score input → blur → upsert RPC → DB verify |
| `e2e/jury/final-submit-and-lock.spec.ts` | Identity → PIN → eval all → submit → `final_submitted_at` |
| `e2e/jury/lock.spec.ts` | 3 PIN attempt → `failed_attempts=3` + `locked_until` |
| `e2e/jury/resume.spec.ts` | reload mid-eval → "Welcome Back" + score rehydrate |
| `e2e/jury/expired-session.spec.ts` | jury_access cleared → /demo/eval redirect |
| `e2e/jury/edit-mode.spec.ts` | admin unlock window → re-score persist |
| `e2e/security/rbac-boundary.spec.ts` | tenant-A patches org-B period → RLS silent filter |
| `e2e/security/period-immutability.spec.ts` | locked period mutation → ERRCODE 23514 trigger |
| `e2e/security/tenant-isolation.spec.ts` | 8 table cross-org JWT sweep |
| `e2e/admin/scoring-correctness.spec.ts` | C4 asymmetric criteria → ranking math doğrulama |
| `e2e/admin/realtime-score-update.spec.ts` | service-role insert → admin UI 15s window propagation |
| `e2e/admin/export-content-parity.spec.ts` | CSV header + row + numeric ±0.01 parity |
| `e2e/admin/unlock-request.spec.ts` | RPC + DB state full lifecycle (sample) |
| `e2e/admin/score-edit-request.spec.ts` | reviewed via plan, `__skipped__` yer tutucu |
| 5 daha (admin/jury reroute) | sampled |

Bu set sağlam — **DB round-trip + state assertion** içeriyor. Selectorlar `data-testid`-bazlı, POM ile shielded.

#### Smoke / yüzeysel testler (~%23, "improve" veya "demote")
| Path | Sınırlandırma |
|---|---|
| `e2e/jury/happy-path.spec.ts` | identity reveal + PIN reveal + nav. Asla eval'e ulaşmıyor. |
| `e2e/auth/landing-cta.spec.ts` | CTA visibility |
| `e2e/admin/criteria.spec.ts` | drawer open + fill + save (CRUD smoke). Ranking impact yok. |
| `e2e/admin/projects.spec.ts` | form visibility + drawer states |
| `e2e/admin/periods.spec.ts` | CRUD + activation, lifecycle yok |
| `e2e/admin/organizations-crud.spec.ts` | CRUD only, tenant isolation cross-check yok |
| `e2e/admin/overview-kpi.spec.ts` | KPI card render. Numerical correctness yok. |
| `e2e/admin/settings.spec.ts` | form load + localStorage. Backend persistence + audit log ✗. |
| `e2e/admin/entry-tokens.spec.ts` | token list + drawer + bulk-import. Token validation + jury-entry use ✗. |
| `e2e/admin/jurors-crud.spec.ts` | table + drawer + import. Scoring impact ✗. |
| `e2e/admin/pin-blocking.spec.ts` | page render. Blocking actual flow ✗. |
| `e2e/admin/admin-login.spec.ts` | form + URL redirect. Dashboard validation post-login ✗. |

Bu sayfaları **upgrade hedefi**: drawer açılıyor mu yerine "save → DB row → realtime propag → UI reflect" zinciri.

#### Skipped/disabled (5 baseline)
| Spec | Skip pattern | Sebep | Makul mu |
|---|---|---|---|
| `e2e/auth/forgot-password.spec.ts` | `test.skip(!!process.env.CI, ...)` | Mailpit/SMTP CI'de wire değil, supabase-js fetch override pickup edemiyor | ✓ Evet — unit test ForgotPasswordScreen contract'ı kapsıyor |
| `e2e/security/rbac-boundary.spec.ts` | `if !jurors.length test.skip()` | E2E_PROJECTS_ORG_ID'de seed eksik olabilir | ✓ Evet — false fail yerine conditional skip |
| `e2e/admin/export-full-zip.spec.ts` | `if !storageUploaded test.skip(...)` | Local Supabase Storage DNS resolve fail mümkün, RPC layer hâlâ test ediliyor | ✓ Evet — graceful fallback |
| `e2e/admin/export-content-parity.spec.ts` | `test.skip(true, "rankings-export-format-pdf option not present")` | PDF feature flag build'de yok | ✓ Evet — flag rollout |
| `e2e/admin/maintenance-mode.spec.ts` | playwright project config `testIgnore` | Global state mutation, serial CI job'da çalışıyor | ✓ Evet — architecture constraint |
| `e2e/admin/analytics-export-cells.spec.ts` | recent commit (CI skip) | seeded period drift, son zamanda CI'da kapatıldı | ⚠ **Bu son skip baseline'dan sonra eklendi mi yoksa accept-edilmedi mi belirsiz**, skip-baseline.json güncel mi kontrol edilmeli |

#### Kritik flow boşlukları
| Boşluk | Etki |
|---|---|
| **Period auto-lock post-submit E2E yok** | jury-day'in temel sözleşmesi |
| Filtered export (status/criteria/juror filter ile) | export'un real-life kullanım modu |
| Multi-org tenant context-switch | tenant-admin 2+ org sahibi → org switch UI/data izolasyon |
| Criteria max_score change → ranking re-compute realtime | analytics correctness |
| Period full lifecycle (Create→Activate→Lock→Close) integrated | setup-wizard'lar wizard UI'sını test ediyor, period state-transition'ları değil |
| Concurrent juror race condition (aynı project simultaneous write) | perf test 1 spec, race spesifik test yok |
| Google OAuth full flow | spec mevcut, sample edilmedi (mocked OAuth callback şüphesi) |

#### POM olgunluğu
- 23 POM, hepsi `data-testid`-based (BasePom.byTestId helper)
- Comprehensive: LoginPom, AdminShellPom, JuryPom, JuryEvalPom, CriteriaPom, OutcomesPom, ProjectsPom, PeriodsPom, HeatmapPom, RankingsPom, OverviewPom, JuryCompletePom (12)
- Partial: AuditPom, ReviewsPom, JurorsPom, SettingsPom, EntryTokensPom, WizardPom, DemoPom, TenantApplicationPom, InviteAcceptPom, ResetPasswordPom, ForgotPasswordPom, PinBlockingPom, OrgsPom (13)
- POM'suz: Analytics dashboard, Audit logs viewer, Score-edit-request workflow, realtime-bağımlı interaction'lar (inline selector → maintenance riski)

### 3.3 SQL / pgTAP / RLS / RPC

#### Inventory (135 dosya, 13.3K LOC, ~889 assertion)
- 29 RLS isolation
- 86 RPC contract + 1 pending (`backup_list.sql` 008 schema mismatch)
- 4 jury RPC + 5 admin RPC (deeper)
- 5 trigger + 4 constraint
- 1 migration JS test (idempotency static scan)
- 1 helpers (`_helpers.sql`: `become_a()`, `become_b()`, `become_super()`, `become_reset()`)

#### Coverage sentinel'ler (CI'de hard-fail)
- `npm run check:rls-tests` → **27/27 RLS-enabled tablo cover** ✓
- `npm run check:rpc-tests` → **89/89 RPC için contract test** ✓ (2 pending excluded)
- `npm run check:edge-schema` → **21/21 edge fn için Zod schema** ✓

#### Güçlü
- BEGIN/ROLLBACK ile self-contained, role switch helper, JWT claim mock (`SET LOCAL request.jwt.claims`)
- pg_cron/pg_net optional skip pattern uygulanmış
- Plan(N) → finish() convention disiplinli, dollar-quoting + lowercase UUID hex enforced
- audit chain trigger (216 LOC, hash chain tamper-proof) ve period_lock trigger (156 LOC) gerçek davranış doğruluyor
- ON DELETE CASCADE constraints test edilmiş

#### Zayıf
- **Migration end-state validation yok**: `idempotency.test.js` sadece `CREATE OR REPLACE` ve `DROP IF EXISTS` pattern static scan ediyor. "Fresh DB → 001…009 → expected schema" test yok.
- **RLS write-side tutarsız**: SELECT izolasyonu güçlü, INSERT/UPDATE/DELETE bazı dosyalarda var (unlock_requests_isolation), bazılarında yok. Cross-tenant WRITE rejection (42501 error) dosyaların yarısında.
- **JOIN-based RLS chain**: period_criteria → periods → organizations cascade davranışı test yok
- **RPC business logic test sığ**: `rpc_jury_finalize_submission` contract'ı (signature + error_code'lar) ✓, ama `juror_period_auth.final_submitted_at` update edildi mi assertion yok
- **Audit log shape per-RPC variation untested**: rpc_admin_save_period_criteria audit row'a ne yazdığını doğrulayan test yok
- **Session token lifecycle**: rotation, expiry, revocation — only happy-path tested
- **Migration 008–009 (pg_cron/pg_net)**: optional skip → backup schedule, audit cron timing untested in CI

#### Genel SQL güveni
- Schema-level (DDL, constraints, RLS policy varlığı): **🟢 yüksek**
- Business state mutation + audit completeness: **🟡 orta**
- Auth lifecycle: **🟡 orta**

### 3.4 Edge functions

#### Coverage
- 21/21 fonksiyonun her birinde `index.test.ts` + `schema.ts`
- Test harness: `_test/harness.ts` (Deno.serve override, request builder, fetch stub, env management)
- Mock Supabase: `_test/mock-supabase.ts` (chainable QueryBuilder, CallRecord, auth/storage/rpc mock'ları)

#### Reference (3 örnek)
- `admin-session-touch` (269 satır, 13 test): CORS preflight, method 405, auth gates, env validation, DB error, happy upsert
- `platform-metrics` (222 satır, 13 test): super-admin gate, RPC chain, schema validation
- `log-export-event` (396 satır, 16 test): tenant verify, super-admin bypass, audit_logs insert payload, fail-closed

#### Pattern
- Mock auth.getUser → no real Kong/JWT verification
- Zod SuccessResponseSchema/ValidationErrorResponseSchema/InternalErrorResponseSchema parse'ı her test'te
- Call recording via getCalls() — payload assertion var

#### Güçlü
- Fail-closed davranış (audit write fail → 500) test edilmiş
- CORS preflight, method validation, env validation tüm ref'lerde mevcut
- Tenant scoping (memberships maybeSingle + super-admin null bypass) test ediliyor

#### Zayıf
- **Real Kong JWT validation hiçbir testte yok** — production'da Kong reject etse, mock test yakalamaz
- **Real Supabase API call yok** — rpc, storage, auth tümü mock
- Schema drift sentinel ✓ ama Zod schema'nın gerçek upstream type ile eşleşmesi sadece runtime test'lerde garanti

#### Sample doğrulanmamış fonksiyonlar
- `auto-backup`, `audit-anomaly-sweep`, `notify-juror`, `send-juror-pin-email` derinlemesine sample edilmedi (test count harness'in 21/21 olduğunu söylüyor ama depth varies)

### 3.5 CI workflows

#### Inventory
| Workflow | Tetik | Hard gate |
|---|---|---|
| `ci.yml` | push main, PR | ✓ |
| `e2e.yml` | push main, PR | ✗ informational |
| `edge-fn-smoke.yml` | daily 06:00 UTC | ✗ post-deploy |
| `perf.yml` | manual | ✗ |
| `db-backup.yml` | monthly | ✗ ops |
| `demo-db-reset.yml` | daily 04:00 UTC | ✗ ops |
| `notification-secrets-sync.yml` | branch push | ✗ ops |

#### ci.yml hard-gate jobs
- **unit-tests** (10m): 5 check:* lint script + vitest run + coverage threshold + check-no-skip + npm build
- **edge-tests** (10m): `deno test --allow-net --allow-env --allow-read --import-map=_test/import_map.json` (~252 test)
- **migration-test** (15m): Postgres 15 + pgTAP, 001–009 apply, pg_prove (constraints, triggers, rls, rpcs/jury, rpcs/admin, contracts)
- **drift-sentinels** (5m): check:db-types, check:rls-tests, check:rpc-tests, check:edge-schema
- **test-report** (20m, soft): Allure + Excel artifact

#### e2e.yml jobs (informational)
- e2e-admin (2 shards), e2e-other, e2e-maintenance (serial), a11y-smoke (manual), visual-regression (manual)
- Caching: ms-playwright/.cache
- Local Supabase per run
- Artifact upload (14–30 day retention)

#### CI gap'leri
- E2E PR-blocking değil (en kritik gap)
- Real Kong/JWT auth integration test yok (mock-only)
- Multi-tenant isolation E2E sadece tek-org JWT'de test (multi-org switch ✗)
- Perf benchmark scheduled değil (manual-only)
- Flake retry stratejisi e2e.yml'de explicit değil (sample edilmedi)

### 3.6 Doc consistency

`docs/testing/` altında 14 doküman + 1 plan + 1 catalog reconciliation. Birikmiş bilgi:
- **target-test-architecture.md (42KB)** — DB-centric piramit, integration layer 2026-04-26'da kalıcı kaldırıldı
- **premium-saas-test-upgrade-plan.md (49KB)** — SaaS readiness 6.5/10, sayfa-sayfa kalite skoru, W2-W6 plan
- **page-test-mock-audit.md** — 17 admin sayfa, 9 tautology, 8 clean, 1 refactored
- **e2e-security-skip-audit.md** — 5 baseline skip + her birinin gerekçesi
- **catalog-reconciliation-2026-04-25.md** — 1.189 active, 254 backlog
- **audit-taxonomy-scan.md** — 98.4% audit event coverage

**Çelişkiler:**
- README "Tests are not optional" + 254 backlog ID kod-dışı
- README "Tautologies are bugs" + 8 sayfa hâlâ tautology (1/9 refactor edildi)
- target-test-architecture.md hâlâ integration layer'ı tarif ediyor → 2026-04-26 decision sonrası "deprecated" not eklenmeli

---

## 4. Critical Coverage Gaps

### Yüksek riskli (jury-day kritikliği)
1. **Period auto-lock post-final-submit** — DB trigger var mı? Auto-lock RPC fired mı? E2E doğrulanmıyor.
2. **Concurrent juror race** (aynı `project_id` + farklı `juror_id` simultaneous upsert) — race condition test yok.
3. **PIN reset flow E2E** — `request-pin-reset` Edge fn mock test ✓, full user-visible flow E2E yok.
4. **Score edit window enforcement** — edit_enabled + edit_expires_at gate var, ama window kapandıktan sonra UI bypass test yok.
5. **Realtime period updates** — `periods-realtime.spec.ts` var ama deeply sample edilmedi; period metadata realtime drop senaryosu belirsiz.

### Veri bütünlüğü
6. **Audit log row written assertion** (settings-save, criteria-update, security-policy-set, membership-grant/revoke) — compliance-kritik.
7. **Cross-period criteria mutation impact** — period A'da criteria değişince period B'nin score_sheets'ı korunuyor mu?
8. **Cascading delete** — project deletion → score_sheet_items cleanup → ranking re-compute test yok.
9. **Migration end-state schema diff** — fresh DB → 001…009 → expected DDL byte-equivalent test yok.

### Compliance / accreditation
10. **Outcome attainment % calculation correctness** — `outcome-attainment.spec.ts` ✓ ama %78 vs %82 gibi precise threshold test'i sample edilmedi.
11. **Export filtered correctness** — filter applied → export → CSV row count + values match filter.
12. **Multi-org tenant context switch** — tenant-admin 2+ org → switch → org-A data görünmüyor.

### Auth / security
13. **Real Kong/JWT validation** — Edge fn mock test'leri Kong'u taklit ediyor; gerçek `verify_jwt = false` config + auth.getUser flow E2E gap.
14. **Session token revocation race** — admin revoke ederken juror eval içinde → next RPC reject mı?
15. **Google OAuth full flow** — spec var, sample edilmedi (mock callback olabilir).

### UX
16. **Form validation rules** (LoginScreen, ForgotPassword, CompleteProfile) — happy/error path ✓, password strength + email format + boundary edge case ✗.
17. **Form state after error** (input clear, submit re-enable, error message clearing) — eksik.
18. **A11y label associations + ARIA** — `e2e/a11y/smoke.spec.ts` manual workflow_dispatch only, scheduled değil.

---

## 5. Weak / Redundant / Misplaced Tests

### Sadece "render ediyor mu" smoke (delete or upgrade)
- `src/shared/ui/__tests__/smoke.test.jsx` — 24× "renders" tests
- `e2e/auth/landing-cta.spec.ts` — single CTA visibility
- `e2e/admin/overview-kpi.spec.ts` — KPI card visibility (numerical assertion yok)
- `e2e/admin/admin-login.spec.ts` (2 test) — form render + URL redirect
- `e2e/jury/happy-path.spec.ts` (4 test) — token reveal + PIN reveal, eval'e ulaşmıyor

### Mock fazlalığı, gerçek davranış yakalamıyor (refactor)
- `src/admin/features/rankings/__tests__/RankingsPage.test.jsx` — 16+ child stub
- 9 admin sayfa testi (Periods, Heatmap, Outcomes, Criteria, Projects, Reviews, PIN Blocking, Organizations + 1 daha — page-test-mock-audit.md'den)
- `src/admin/features/criteria/__tests__/useCriteriaForm.test.js` — 2 test, validation mock'lı

### Aynı şeyi tekrar eden testler
- `e2e/admin/heatmap.spec.ts` + `e2e/admin/heatmap-export.spec.ts` — overlap var, export specific'i deeper, base smoke gereksiz
- `e2e/admin/criteria.spec.ts` + `criteria-validation.spec.ts` + `criteria-mapping.spec.ts` — 3 spec; criteria.spec.ts smoke seviye, diğer ikisi gerçek; criteria.spec.ts demote kandidatı
- `e2e/admin/setup-wizard*.spec.ts` (3 spec) — aralarında overlap olabilir, ortak helper'a refactor edilebilir

### Implementation detail testleri
- Çoğu lock enforcement testi `expect(updatePeriod).toHaveBeenCalledTimes(N)` style — UI state-mutation yerine mock call count assertion
- Score normalization isolation testleri — round-trip yerine isolated function call

### Skipped (kabul edilebilir)
- 5 baseline skip — hepsi documented, conditional, skip-policy.md ile uyumlu
- ⚠ `e2e/admin/analytics-export-cells.spec.ts` — recent CI skip (commit 65adc932). Skip-baseline.json güncel olmalı; baseline'da yoksa policy ihlali olur.

### Yer tutucu / placeholder
- 12× `it.todo()` lock enforcement (`useManageJurors.lockEnforcement.test.js`, `useManageProjects.lockEnforcement.test.js`)
- 254 catalog backlog ID
- `score-edit-request.spec.ts` — tüm dosya placeholder

---

## 6. Migration, RLS and RPC Test Review

### Migration
- ✅ `idempotency.test.js` — `CREATE OR REPLACE` + `DROP IF EXISTS` pattern static scan
- ✅ CI'da Postgres 15 + pgTAP ile 001–009 sequential apply
- ❌ End-state schema doğrulaması (fresh DB → expected DDL diff) yok
- ❌ Concurrent migration race (yalnızca migration 1× tek prosesde)
- ❌ Rollback testi (snapshot-based mantık gereği yok, ama production'da hiç test edilmiyor)
- ⚠ Migration 008–009 (pg_cron/pg_net) optional skip → backup schedule + audit cron timing CI'de test yok

### RLS
- ✅ 27/27 tablo cover (sentinel)
- ✅ tipik pattern: A görür, B görmez (silent filter)
- ⚠ INSERT/UPDATE/DELETE inconsistent — bazı tablolarda var, bazılarında SELECT only
- ⚠ JOIN-based policy chain (period_criteria → periods → organizations) cascade test yok
- ⚠ Super-admin bypass test edilmiş ama tenant-admin org-context-switch test yok

### RPC
- ✅ 89/89 contract pinned (signature, return type, error_code)
- ✅ Auth gate (`_assert_tenant_admin`, `_assert_org_admin`) test ediliyor
- ⚠ State mutation side-effect (juror_period_auth.final_submitted_at update, audit_logs insert) çoğu kontratta yok
- ⚠ `rpcs/contracts/_pending/backup_list.sql` — re-promotion checklist var, henüz değil
- ⚠ Cross-tenant bypass attempt → `_assert_*` helper'ın gerçek implementation'ı trust edilir, davranışsal test yok

### Triggers
- ✅ audit chain (BEFORE INSERT → row_hash) ve period_lock comprehensive
- ❌ Multi-trigger same-event ordering (RLS WITH CHECK + insert trigger collision)
- ❌ Trigger drop simulation (deliberate drop → check raises)
- ❌ NEW vs OLD edge case (DELETE'de OLD only, INSERT'de NEW only — cross-test eksik)

### Constraints
- ✅ NOT NULL, UNIQUE, CHECK, FK CASCADE base case
- ❌ Composite UNIQUE (user_id, organization_id) gibi multi-column kombinatoryal yok
- ❌ Deferred constraints (none tested)
- ❌ Partial index'ler (none tested)

---

## 7. E2E Flow Review

### Jury flow (8 spec)
- **Güçlü:** evaluate (autosave + dedup), final-submit-and-lock (full chain), lock (PIN attempts), resume (mid-eval rehydrate), expired-session (redirect), edit-mode (admin unlock window)
- **Eksik:** period auto-lock E2E, concurrent juror race, PIN reset full flow E2E, score-edit window expire UI bypass

### Auth flow (7 spec)
- **Güçlü:** admin-login (form + redirect), invite-accept (sample), multi-tab-session, password-reset, tenant-application-full (depth unknown)
- **Eksik veya unsampled:** Google OAuth full (mock şüphesi), forgot-password CI skip (Mailpit yok), CompleteProfile flow

### Security flow (3 spec)
- **Güçlü:** rbac-boundary (cross-org PATCH), period-immutability (trigger ERRCODE 23514, RLS silent filter, RPC self-enforce), tenant-isolation (8 table sweep)
- **Eksik:** multi-org tenant context switch, session revocation race, super-admin bypass attempt simulation

### Admin flow (44 spec)
- **Güçlü:** scoring-correctness (math), realtime-score-update (channel propagation), export-content-parity (header+row+numeric ±0.01), unlock-request, criteria-mapping, outcomes-mapping, outcome-attainment
- **Smoke:** criteria.spec.ts, projects.spec.ts, periods.spec.ts, organizations-crud.spec.ts, overview-kpi.spec.ts, settings.spec.ts, entry-tokens.spec.ts, jurors-crud.spec.ts, pin-blocking.spec.ts, admin-login.spec.ts (10–12 spec)
- **Eksik:** filtered export, multi-org switch, period full lifecycle integrated, criteria max_score change → realtime ranking

### Visual / a11y / perf
- visual: manual only (1 spec, snapshot-based)
- a11y: manual only (1 spec)
- perf: manual only (1 spec, concurrent juror matrix, 90s SLO)
- **Risk:** Bunların hiçbiri PR-blocking değil; regression yakalanmaz

---

## 8. CI Pipeline Review

### Hard-gate stack (ci.yml)
| Gate | Komut | Status |
|---|---|---|
| Lint (5 check) | `check:no-native-select`, `check:no-nested-panels`, `check:no-table-font-override`, `check:js-size`, `check:css-size` | ✅ |
| Unit | `npx vitest run --pool=forks` | ✅ |
| Coverage | `npx vitest run --coverage` (49% lines threshold) | ✅ |
| No-skip | `node scripts/check-no-skip.js` (baseline 5) | ✅ |
| Build | `npm run build` (vite) | ✅ |
| Edge fn | `cd supabase/functions && deno test --allow-...` | ✅ |
| Migration | Postgres 15 + apply 001–009 + pg_prove (5 dir) | ✅ |
| Drift sentinel | `check:db-types`, `check:rls-tests`, `check:rpc-tests`, `check:edge-schema` | ✅ |

### Soft / informational
- `test-report` Allure + Excel — `continue-on-error: true`
- `e2e.yml` workflow tüm job'ları — PR-blocking değil
- `perf.yml` — manual only
- `edge-fn-smoke.yml` — daily, post-deploy

### Eksik / zayıf
- E2E PR-blocking olmaması (ana boşluk)
- Flaky retry strategy explicit değil
- Real Supabase auth integration testi yok
- Multi-browser matrix (Firefox/Safari) yok (Chromium only mu — sample edilmedi)
- Coverage thresholds düşük (49% lines)
- Performance regression CI'da yok (perf.yml manual)

### Cache
- node_modules cache ✓ (npm ci)
- Playwright browser cache ✓ (ms-playwright/.cache)
- Postgres image cache (CI'de yeniden pull mi?)

### Artifacts
- playwright-report (14 day retention)
- Allure HTML + Excel report (30 day)
- Lighthouse report (manual)

### CI çalışma sırası (özet)
```
push/PR main
  ├─ unit-tests (10m): lint + vitest + coverage + check-no-skip + build
  ├─ edge-tests (10m, parallel)
  ├─ migration-test (15m, parallel)
  ├─ drift-sentinels (5m, parallel)
  ├─ test-report (20m, soft)
  └─ [PARALLEL] e2e-admin/other/maintenance (25–30m, informational)
```

---

## 9. Recommended Target Test Architecture

### Yön
**DB-centric pyramid'ı korumak**. Mevcut strateji (target-test-architecture.md) doğru. Değişiklik: **execution gap'lerini kapatmak**, layer responsibility'leri keskinleştirmek.

### Layer responsibility'leri (öneri)

| Layer | Sorumlu | Kapsam |
|---|---|---|
| **Unit (Vitest)** | Pure helper, hook state machine, formatters, transformers | fieldMapping, scoreHelpers, useJuryState, useManagePeriods (lock-aware), config validators. **Komponent smoke testler buradan E2E'ye veya component test'e taşınmalı.** |
| **Component (Vitest+RTL)** | Tek component'in user-visible behavior'ı (props, state transitions, a11y, error states) | Drawer açıkken Cancel hangi state'de? Form submit error mesajı temizleniyor mu? Score input boundary değer?  Bunlar **page test'lerden ayrı küçük dosyalara**. |
| **Contract (RLS pgTAP)** | 27 tablo × {SELECT, INSERT, UPDATE, DELETE} matrix, super-admin bypass | Şu an 27 tablo SELECT cover. CRUD matrix **tam olmalı** (~108 assertion). |
| **Contract (RPC pgTAP)** | 89 RPC × {signature, error_code, **state-mutation side-effect**, **audit_log row**} | Mevcut: signature + error. Eksik: state mutation + audit shape. |
| **Contract (Edge Zod)** | 21 fn × {request schema, response schema, error envelope, fail-closed audit} | Coverage ✓. Real Kong integration smoke aylık scheduled (production'a karşı). |
| **E2E (Playwright)** | Real user journey: auth + RPC + UI + Realtime + Export. **DB round-trip assertion zorunlu**. | Period lifecycle, multi-org, filtered export, audit log row assertion eklenecek. |
| **Visual / a11y** | Layout regression, WCAG blocker | PR-blocking olmalı (snapshot threshold belirleyerek). |
| **Perf** | Concurrent juror SLO (90s), realtime propagation latency | Nightly scheduled (manual değil). |

### Sınır kuralları
- Bir page testinde `useAdminContext` mock'lansın, **orchestrator hook real**. (page-test-mock-audit.md pattern)
- Bir hook testinde API mock'lansın, **hook logic real**.
- Component testinde child component'ler **stub değil real** (data-testid'lar üzerinden assertion).
- E2E'de mock fixture **sadece external boundary** (SMTP, OAuth provider). Supabase real DB.
- pgTAP'da JWT claim mock + helper role switch (mevcut pattern).

### Yeni test ekleme kuralı
- Yeni RPC → contract test (CI hard-gate sentinel) + state mutation test
- Yeni RLS-enabled tablo → 4 op (SELECT/INSERT/UPDATE/DELETE) cross-tenant test
- Yeni Edge fn → schema.ts + index.test.ts (Zod parse + harness coverage)
- Yeni admin sayfası → 1 unit (orchestrator clean) + 1 E2E (DB round-trip)
- Yeni jury sayfası → 1 unit (state machine) + 1 E2E (full flow)

### CI gate hedefi
- E2E PR-blocking yapılsın (Phase 1: e2e-admin shard 1/2 hard, sonra tüm shard'lar)
- Coverage threshold 49 → 60 lines (W3 sonu)
- Skip baseline ratchet: increment'e CI auto-fail
- Visual regression snapshot threshold 0% (deterministic baseline) PR-blocking
- A11y axe violation 0 critical PR-blocking

---

## 10. Test Reclassification Table

Mevcut testleri 7 kategoriye ayırdım. Tam liste değil — temsili örnek + pattern.

| Test path / pattern | Kategori | Gerekçe |
|---|---|---|
| `src/shared/api/__tests__/fieldMapping.test.js` | **Keep as-is** | Round-trip + null handling, gold standard |
| `src/jury/shared/__tests__/useJuryState.test.js` | **Keep as-is** | Full state machine, real behavior |
| `src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js` | **Keep as-is** | Lock-aware mutation gating |
| `src/shared/storage/__tests__/adminStorage.test.js` | **Keep as-is** | Round-trip persistence |
| `src/admin/features/outcomes/__tests__/outcomeHelpers.test.js` | **Keep as-is** | Pure helper, edge case |
| `e2e/jury/evaluate.spec.ts` | **Keep as-is** | Score input → blur → upsert → DB verify |
| `e2e/jury/final-submit-and-lock.spec.ts` | **Keep as-is** | Full submission + final_submitted_at |
| `e2e/security/period-immutability.spec.ts` | **Keep as-is** | Trigger ERRCODE doğrulanıyor |
| `e2e/security/tenant-isolation.spec.ts` | **Keep as-is** | 8 tablo cross-org sweep |
| `e2e/admin/scoring-correctness.spec.ts` | **Keep as-is** | C4 asymmetric ranking math |
| `e2e/admin/export-content-parity.spec.ts` | **Keep as-is** | Header + row + numeric parity |
| `sql/tests/triggers/audit_chain.sql` | **Keep as-is** | Hash chain tamper-proof |
| `sql/tests/triggers/period_lock.sql` | **Keep as-is** | Lock-aware mutation reject |
| `sql/tests/rls/memberships_isolation.sql` | **Keep as-is** | Critical, all-op cover |
| `sql/tests/rpcs/jury/upsert_score.sql` | **Keep as-is** | Score arithmetic deep |
| `supabase/functions/log-export-event/index.test.ts` | **Keep as-is** | Audit row assert + fail-closed |
| `supabase/functions/admin-session-touch/index.test.ts` | **Keep as-is** | Auth + DB + env coverage |
| 9 admin page tautology testleri (Heatmap/Outcomes/Criteria/Periods/Projects/Reviews/PINBlocking/Organizations) | **Keep but improve** | Pattern: API mock, hook real (Jurors örneği). 30–50 satır değişim her biri. |
| `src/admin/features/criteria/__tests__/useCriteriaForm.test.js` | **Keep but improve** | Validation real, dnd-kit minimal stub. Test count 2 → 8+. |
| `src/admin/features/heatmap/__tests__/useHeatmapData.test.js` | **Keep but improve** | Multi-group aggregation correctness ekle |
| `src/admin/features/rankings/__tests__/RankingsPage.test.jsx` | **Keep but improve** | 16 child stub kaldırılsın, search filter real test |
| `src/shared/ui/__tests__/smoke.test.jsx` | **Move to component test** | 24× smoke → her component için kendi component testine bölünmeli, prop+state+a11y eklenmeli |
| `e2e/admin/criteria.spec.ts` | **Move to component test or delete** | Smoke seviye, criteria-mapping/criteria-validation gerçek. Bu dosya redundant. |
| `e2e/admin/projects.spec.ts` | **Keep but improve** | Smoke → "create → period assignment → ranking impact" zinciri |
| `e2e/admin/organizations-crud.spec.ts` | **Keep but improve** | Smoke → tenant isolation cross-check |
| `e2e/admin/overview-kpi.spec.ts` | **Keep but improve** | KPI numerical correctness E2E (fixture: 3 org, 10 project, 50 juror, 100 score) |
| `e2e/admin/settings.spec.ts` | **Keep but improve** | Backend persistence + audit_logs row assert |
| `e2e/admin/admin-login.spec.ts` | **Keep but improve** | Login → dashboard data validation post-redirect |
| `e2e/admin/entry-tokens.spec.ts` | **Keep but improve** | Token validation + jury entry use chain |
| `e2e/admin/jurors-crud.spec.ts` | **Keep but improve** | CRUD + scoring impact |
| `e2e/admin/pin-blocking.spec.ts` | **Keep but improve** | Page render → actual blocking flow |
| `e2e/jury/happy-path.spec.ts` | **Move to E2E flow** | Smoke seviyesinde kalmamalı, full flow zaten final-submit'te. Bu dosya **delete** kandidatı. |
| `e2e/auth/landing-cta.spec.ts` | **Delete or merge** | CTA visibility tek başına spec değer üretmiyor, landing.spec.ts altına merge |
| 12× `it.todo()` lock enforcement | **Implement (move from todo to active)** | Pattern: real period locked → API call rejected → assertion |
| `e2e/admin/score-edit-request.spec.ts` (placeholder) | **Implement** | RPC + UI + DB round-trip |
| `sql/tests/rpcs/contracts/_pending/backup_list.sql` | **Implement (re-promote)** | RUNNING.md checklist takip |
| `sql/tests/rpcs/jury/finalize_submission.sql` (state mutation eksik) | **Implement (extend)** | `juror_period_auth.final_submitted_at` UPDATE assertion ekle |
| Audit log row assertion 5 RPC için (settings, criteria, security-policy, membership-grant/revoke) | **Missing — add** | Pattern: RPC sonrası `audit_logs` SELECT WHERE action = X |
| Period auto-lock E2E | **Missing — add** | jury submit → `periods.is_locked = true` DB assertion |
| Filtered export E2E | **Missing — add** | filter set → export → CSV row count + values match |
| Multi-org tenant context switch | **Missing — add** | tenant-admin → 2+ org → switch → data isolation |
| Concurrent juror race E2E | **Missing — add** | aynı project simultaneous upsert → data integrity |
| Real Kong/JWT integration smoke | **Missing — add** | aylık scheduled, production'a karşı |
| Migration end-state schema validation | **Missing — add** | fresh DB → 001…009 → expected DDL byte-equivalent |
| Composite UNIQUE constraint test | **Missing — add** | (user_id, organization_id) cross-cases |
| Multi-trigger same-event ordering | **Missing — add** | RLS WITH CHECK + insert trigger collision |
| Skip-baseline ratcheting CI auto-comment | **Missing — add** | new skip → PR auto-comment "baseline would increase" |

---

## 11. Prioritized Action Plan

### P0 — Acil (1–2 hafta, bu sprint)
**Ürün güvenliği + veri bütünlüğü için kritik**

1. **Juror post-submit score lock testi (pgTAP + E2E)**
   - **pgTAP** `sql/tests/rpcs/jury/upsert_score.sql` extend (mevcut 5 plan → 8):
     - juror final_submit yaptıktan sonra `edit_enabled=false` default state → `rpc_jury_upsert_score` `error_code: final_submit_required` döndürüyor mu
     - DB tarafında score_sheet_items value değişmiyor olmalı (immutability assertion)
     - Aynı şartlar altında 2. denemede de `final_submit_required` (idempotent reject)
   - **E2E** `e2e/jury/final-submit-and-lock.spec.ts` extend (mevcut 2 test → 3):
     - submit sonrası servis-role admin client ile `rpc_jury_upsert_score` çağır → `error_code: final_submit_required` doğrula
     - score_sheet_items'da score_value değişmemiş olmalı
   - Tahmini: 0.5 gün
   - **Gerekçe:** `rpc_jury_upsert_score:557-559` mekanizması var, ama temel "submit ettim, notlarım kilitlendi" davranışı testsiz. Bu juror veri bütünlüğü için en kritik tek gap.

2. **Audit log row assertion ekle 5 kritik RPC için**
   - `e2e/admin/settings-save.spec.ts` extend (security_policy.update audit row)
   - `e2e/admin/criteria.spec.ts` extend (criteria.update audit row)
   - Yeni: `audit_logs` content assertion helper (`e2e/helpers/audit.ts`)
   - Edge fn `log-export-event` zaten var; admin-side missing
   - Tahmini: 3–4 gün

3. **CI'de E2E hard-gate'e başla (kademeli)**
   - Phase 1: `e2e-admin` shard 1/2 + `e2e-other` PR-blocking
   - Phase 2: Tüm shard'lar PR-blocking (1 ay sonra)
   - Yeni job: explicit retry (1 retry on main)
   - Tahmini: 0.5 gün config + monitoring window

4. **`sql/tests/rpcs/contracts/_pending/backup_list.sql` re-promote**
   - 008_platform.sql rpc_backup_list body'sini oku, signature uyumlu yaz
   - Tahmini: 0.5 gün

5. **Skip baseline drift fix**
   - `e2e/admin/analytics-export-cells.spec.ts` recent CI skip baseline'a eklendi mi kontrol et; eklenmediyse `docs/qa/skip-baseline.json` güncelle
   - Tahmini: 0.5 gün

### P1 — Yüksek öncelik (2–4 hafta)
**Regression riskini ciddi azaltır**

6. **9 admin page tautology refactor (page-test-mock-audit.md takip)**
   - Sıra: Periods → Heatmap → Outcomes → Criteria → Projects → Reviews → PIN Blocking → Organizations + 1 daha
   - Pattern: API mock, hook real (JurorsPage örneği)
   - Tahmini: ~2 saat × 9 = 2 hafta

7. **12× `it.todo()` lock enforcement implement et**
   - `useManageJurors.lockEnforcement.test.js` (6 test)
   - `useManageProjects.lockEnforcement.test.js` (6 test)
   - Pattern: locked period → API call rejected → assertion
   - Tahmini: 2 gün

8. **RPC contract testlerine state-mutation assertion ekle**
   - 89 RPC × {happy state mutation, audit_logs row} matrix
   - Öncelik: jury (4) + admin (5) zaten deeper, contracts (86) genişletilecek
   - W6 sonu hedefi
   - Tahmini: 1 hafta

9. **RLS write-side completeness (INSERT/UPDATE/DELETE)**
   - 27 tablo × {INSERT, UPDATE, DELETE} cross-tenant matrix
   - ~80 yeni assertion
   - Sentinel script revize edilsin (op-bazlı kontrol)
   - Tahmini: 1 hafta

10. **Multi-org tenant context switch E2E**
    - Yeni: `e2e/security/multi-org-tenant.spec.ts`
    - Tenant-admin 2+ org → switch → org-A data hidden
    - Tahmini: 2 gün

11. **Score-edit-request RPC + spec'i unblock**
    - Backend RPC stub doldur
    - UI flow integrate
    - E2E `score-edit-request.spec.ts` placeholder kaldır
    - Tahmini: 3–5 gün

### P2 — Orta öncelik (1–2 ay)
**Test kalitesini ve sürdürülebilirliği artırır**

12. **Smoke E2E'leri behavior'a upgrade**
    - 10 smoke spec → DB round-trip + state assertion
    - Sıra: settings → entry-tokens → jurors-crud → projects → organizations-crud
    - Tahmini: 2–3 hafta

13. **Component test extraction**
    - `src/shared/ui/__tests__/smoke.test.jsx` 24 test → 12 component test (her component için kendi dosyası, prop+state+a11y)
    - Tahmini: 1 hafta

14. **A11y axe + visual regression PR-blocking**
    - `e2e/a11y/smoke.spec.ts` workflow_dispatch → push/PR trigger
    - Visual snapshot 0% threshold + PR-blocking
    - Tahmini: 1 gün config + baseline approval

15. **Perf benchmark scheduled**
    - `perf.yml` manual → nightly schedule
    - SLO threshold (concurrent juror 90s) regression alert
    - Tahmini: 1 gün

16. **Multi-trigger ordering + composite UNIQUE testleri**
    - `sql/tests/triggers/multi_trigger_ordering.sql`
    - `sql/tests/constraints/composite_unique.sql`
    - Tahmini: 2 gün

17. **Migration end-state schema diff test**
    - Fresh DB → 001…009 → `pg_dump --schema-only` snapshot vs expected
    - `sql/tests/migrations/end_state.sql` veya separate JS
    - Tahmini: 2 gün

18. **Real Kong/JWT integration scheduled**
    - Aylık workflow: production-like project'e Edge fn smoke (real auth, real Kong)
    - `edge-fn-smoke.yml` extend
    - Tahmini: 2 gün

19. **Coverage threshold yükselt (49 → 60 lines, 35 → 50 functions)**
    - W3 hedefi (premium-saas-test-upgrade-plan.md)
    - Tahmini: tautology refactor sonrası otomatik gelir

20. **Skip-baseline ratcheting CI hook**
    - PR'de skip count artarsa auto-comment + soft-fail
    - `.github/workflows/ci.yml` step
    - Tahmini: 1 gün

### P3 — Temizlik (sürekli, sprint kapsamında)
**Silinebilecek, sadeleştirilebilecek, dokümante edilecek**

21. **`e2e/jury/happy-path.spec.ts` delete** — final-submit-and-lock'ta zaten covered
22. **`e2e/auth/landing-cta.spec.ts` merge** — landing.spec.ts altına
23. **`e2e/admin/criteria.spec.ts` delete** — criteria-validation + criteria-mapping yeterli
24. **target-test-architecture.md update** — integration layer "deprecated" notu
25. **254 backlog ID review** — kritik olanlar P1'e, gereksizler delete catalog'dan
26. **Heatmap.spec.ts vs heatmap-export.spec.ts overlap analysis** — merge or delete base smoke
27. **Setup-wizard 3 spec ortak helper'a refactor**
28. **page-test-coverage-map.md → güncelle (her tautology refactor sonrası)**
29. **README "tests are not optional" cümlesini metric ile destekle** (skip baseline, coverage, sentinel)
30. **POM gap kapatma: Analytics, Audit logs, Score-edit-request POM'ları**

---

## 12. Final Recommendations

### Genel değerlendirme
VERA, **multi-tenant SaaS için doğru piramidi seçmiş** (DB-centric) ve bunu disipline edecek mekanizmaları kurmuş bir projedir: drift sentinel'leri, snapshot migration disiplini, hard-gate CI, qaTest catalog reconciliation, skip-baseline ratcheting, periodik audit raporları. Bu **stratejik zemin nadiren bu kadar olgun** olur.

Ancak **strateji ile execution arasında %20–30 gap** var. Bu gap'in büyük kısmı dokümante edilmiş (premium-saas-test-upgrade-plan.md, page-test-mock-audit.md, audit-taxonomy-scan.md), ekip kendi borçlarını biliyor. Asıl sorun **uygulama momentum'unun execution gap'i kapatmaktan ziyade yeni feature'lar üzerinde olması**.

### En önemli 3 mesaj

1. **Sayısal güven ≠ davranışsal güven.** 1.500 unit + 280 E2E + 889 pgTAP assertion etkileyici görünür ama 9 admin sayfa tautology, 12 todo placeholder, 254 backlog ID, ve E2E'lerin ¼'ü smoke seviyesinde. Sayıyı görmeyi bırakıp hangi davranışın gerçekten korunduğunu görmek lazım.

2. **Period auto-lock + audit log assertion + RPC state-mutation** — bu üçü birden hâlâ E2E veya pgTAP seviyesinde değil. VERA'nın iş modelinde **audit trail = compliance, period lock = juri-gün güvencesi**. Bu üçü P0.

3. **CI E2E'yi hard-gate yapmak en yüksek leverage'lı tek değişiklik**. RBAC/tenant-isolation/scoring-correctness/realtime gibi 19 critical spec şu an informational; main'e merge'i blok etmiyor. Phase 1 olarak admin shard 1/2 + other → blocking yapılırsa, haftalık regression catch oranı muhtemelen 3–5× artar.

### Net cümleler

- **Test altyapısına ne kadar güvenebiliriz?** Schema bütünlüğü ve auth-contract'ı için yüksek. Business state mutation, audit completeness, ve admin user-flow correctness için orta. Jury-day kritikliği için "iyi ama yeterli değil" — period auto-lock E2E gap'i yeter sebep.
- **En kritik gap'ler nerede?** (1) Period auto-lock, (2) audit_logs row assertion, (3) admin page tautology, (4) CI E2E informational, (5) RPC state-mutation eksikliği.
- **Hangi testler bizi kandırıyor?** 9 admin page tautology testi, 24× UI smoke testi, 10 E2E CRUD smoke spec'i. Hepsi yeşil koşar ama gerçek bug yakalamıyor.
- **Hangi testler en fazla regression riskini azaltır?** P0+P1 listesi — özellikle period auto-lock E2E + audit assertion + RPC state mutation testleri.
- **Layer sınırlarını nasıl daha doğru çizeriz?** Page test'lerden orchestrator hook real, child component real; component test'lerini smoke'tan ayır (props/state/a11y); RPC contract'ı state-mutation + audit shape'i kapsayacak şekilde genişlet; E2E PR-blocking yap.

### Kapanış
Bu rapor static analiz tabanlı. Önerilen P0 aksiyonlarını (özellikle period auto-lock E2E + audit assertion) hızla uygulayıp **ölçülebilir CI metric'i** (skip baseline trend, sentinel pass rate, E2E flake oranı) yayınlamak, bu audit'in kanıtsal değerini artırır. Premium SaaS hedefine ulaşmak için **execution disiplini test stratejisinden daha kritik** — strateji zaten doğru.

---

**Audit referansları:**
- `docs/testing/target-test-architecture.md`
- `docs/testing/premium-saas-test-upgrade-plan.md`
- `docs/testing/page-test-mock-audit.md`
- `docs/testing/page-test-coverage-map.md`
- `docs/testing/audit-taxonomy-scan.md`
- `docs/testing/catalog-reconciliation-2026-04-25.md`
- `docs/testing/e2e-security-skip-audit.md`
- `docs/testing/sql-tests.md`
- `docs/testing/edge-function-tests.md`
- `docs/testing/periods-test-pattern.md`
- `docs/qa/skip-baseline.json`
- `docs/qa/skip-policy.md`
- `.github/workflows/ci.yml`, `e2e.yml`, `edge-fn-smoke.yml`, `perf.yml`, `db-backup.yml`, `demo-db-reset.yml`
- `package.json` (scripts)
- `sql/tests/RUNNING.md`
- `src/test/qa-catalog.json`
