# Premium SaaS Test Upgrade Plan for VERA

> **Audit date:** 2026-04-26
> **Auditor:** Claude (analiz-only, hiçbir test dosyası değiştirilmedi)
> **Scope:** Tüm `src/**/__tests__`, `e2e/**`, `supabase/functions/**/_test`, `sql/tests/**`, `.github/workflows/**`, `docs/testing/**`
> **Method:** Statik envanter + örnek dosya okuması + CI workflow analizi + mevcut QA dokümanlarıyla çapraz kontrol

---

## 1. Executive Summary

### Mevcut durum

VERA'nın test altyapısı **yüzeyden bakıldığından çok daha olgun**. Sayılar:

- **313 test dosyası** (254 unit, 59 E2E, 21 Edge fn, 1 SQL/migration, ~1.224 QA-catalog kaydı, ~1.900+ test bloğu)
- Premium-grade altyapı parçaları **zaten mevcut**:
  - Page Object Model (PoM) framework: `e2e/poms/LoginPom`, `AdminShellPom`, `ReviewsPom`, `CriteriaPom`
  - DB fixture helper'ları: `setupOutcomeFixture`, `setupScoringFixture`, `writeMatrixScores`, `seedJurorSession`
  - Numerical correctness pattern: `outcome-attainment.spec.ts`, `analytics.spec.ts` (E3 fixture)
  - Real-RPC pattern: `settings-save.spec.ts` (anon-key sign-in → user-token RPC → DB verify)
  - Drift sentinels: `check:db-types`, `check:rls-tests`, `check:rpc-tests`, `check:edge-schema`
  - Coverage thresholds: `vite.config.js` 53/37/57/53 (lines/funcs/branches/statements), 70/80 hooks/storage
  - pgTAP migration suite: `sql/tests/` + GitHub Actions hard-gate job
  - QA catalog ID sistemi (`qaTest()`) ile her testin discoverable olması

Yani prompt'ta "test sayısını artırmaktan çok güven üretmesini istiyorum" ifadesinin doğru tespiti şu: **sayı az değil, güven dağılımı eşitsiz**. Bazı feature'lar 400+ satırlık E2E ile sağlam (criteria-mapping 456, outcomes-mapping 459, settings-save 341), bazıları ise tautology mock'lar veya skip'lerle kâğıt-üzeri-yeşil.

### Genel test kalite puanı: **7.2 / 10**

| Boyut | Puan | Gerekçe |
|------|------|---------|
| Coverage breadth | 8.5 | Her admin sayfası ve her jury adımı bir test dosyasına dokunulmuş |
| Behavior depth | 6.0 | 9/17 admin page testi tautology pattern'da; 10+ E2E `test.skip()` |
| DB/RPC assertion | 7.5 | Outcome/Criteria/Settings'te real DB verify var; Reviews score-edit ve Audit-log assertion yetersiz |
| CI hardening | 6.5 | Lint/build/migration hard gate; 2 sentinel + tüm E2E soft (planlı W2-W6) |
| Maintainability | 8.0 | PoM + fixture + qaTest yapısı premium |
| False confidence noise | 6.0 | "page renders" smoke testleri prim alıyor; OverviewPage unit testi tamamen mock-heavy |

### Premium SaaS readiness: **6.5 / 10**

VERA üniversite akreditasyon raporları üreten, multi-tenant, audit-trail'li bir SaaS. Premium standardın gerektirdiği güvenler:

| Güven boyutu | Şu an | Hedef |
|---|---|---|
| Tenant isolation (RLS) | Soft sentinel | Hard gate |
| RPC contract stability | Soft sentinel | Hard gate |
| Numerical correctness (attainment, KPI, ranking) | Outcome ✅ / Overview ❌ / Ranking ⚠️ | Hepsi ≥85% senaryo coverage |
| Audit-trail integrity | RPC çalışıyor / log yazıldı doğrulaması yok | Her destructive RPC için audit row assert |
| Export reliability | Backup ZIP shape var; full export içerik diff yok | Header + numeric + filter parity |
| Score immutability after lock | 6 lockEnforcement testi `todo()` placeholder | 6/6 implemented + 7 skipped period-immutability re-enabled |

### En büyük 5 risk

1. **Audit log assertion'ı yok.** `settings-save.spec.ts` admin kullanıcılar üstünde policy değişikliği yapıyor ama "bu değişiklik `audit_logs` tablosuna yazıldı mı?" diye doğrulamıyor. Compliance perspektifinden kritik.
2. **Overview KPI numerical correctness yok.** `OverviewPage.test.jsx` boş array'lerle context mock'luyor; "12 jüri × 50 proje × %78 tamamlanma" gibi rakamların doğruluğunu kontrol eden tek satır E2E veya integration test yok.
3. **Score edit / unlock request flow kapatılmış.** `score-edit-request.spec.ts` tamamen skipped (RPC yok); `unlock-request.spec.ts` var ama yetkisiz erişim yolu test edilmiyor. Reviews sayfasında "score edit enable" var, persist + audit assertion zayıf.
4. **Lock enforcement = 12 placeholder test.** `useManageJurors.lockEnforcement.test.js` ve `useManageProjects.lockEnforcement.test.js` toplamda 12 `todo()` çağrısı içeriyor. Period kapandıktan sonra add/remove engelleniyor mu — DB-seviyesinde doğrulama yok.
5. **9 admin page testi tautology pattern.** Page kendi orchestrator hook'unu mock'ladığı için "hook çağrıldı" testi yapılıyor, "hook ne üretti" değil. Heatmap, Outcomes, Criteria, Periods, Organizations gibi analytics-kritik sayfalar etkileniyor (`docs/testing/page-test-mock-audit.md` bunu zaten tespit etmiş; 1/9 refactor edildi).

---

## 2. Current Test Inventory

### Toplam dosya/satır

| Kategori | Dosya | Yaklaşık satır | Yaklaşık test |
|----------|-------|---------------|---------------|
| Unit (`src/**/__tests__`) | 254 | ~35.000 | ~1.500 |
| E2E (`e2e/**/*.spec.ts`) | 59 | 9.018 | ~280 |
| Edge fn (`supabase/functions/**/_test`) | 21 | n/a | ~190 |
| SQL/pgTAP (`sql/tests/**`) | 1 | n/a | n/a |
| QA catalog ID (`src/test/qa-catalog.json`) | 1 | n/a | 1.224 ID |

### E2E breakdown (priority alanları)

| Spec dosyası | Satır | Pattern | DB write? | DB verify? |
|--------------|-------|---------|-----------|------------|
| `e2e/admin/settings-save.spec.ts` | 341 | RPC-direct | ✅ | ✅ (audit log ❌) |
| `e2e/admin/settings.spec.ts` | 44 | UI smoke | ❌ | ❌ |
| `e2e/admin/export-full-zip.spec.ts` | 175 | Storage + RPC | ✅ (backup) | ✅ shape |
| `e2e/admin/criteria.spec.ts` | 80 | UI CRUD | ✅ | ❌ row-fetch |
| `e2e/admin/criteria-mapping.spec.ts` | 456 | Fixture + UI + RPC | ✅ | ✅ |
| `e2e/admin/outcome-attainment.spec.ts` | 153 | Fixture + module direct call | ✅ | ✅ math |
| `e2e/admin/outcomes-mapping.spec.ts` | 459 | Fixture + UI + RPC | ✅ | ✅ |
| `e2e/admin/analytics.spec.ts` | 134 | Fixture + UI + matrix scores | ✅ | ✅ KPI strip |
| `e2e/admin/analytics-export-cells.spec.ts` | 312 | UI + cell-by-cell | ❌ | ✅ render diff |
| `e2e/admin/reviews.spec.ts` | 176 | PoM + filter + score edit | ⚠️ | ⚠️ (filter ✅ / edit persist zayıf) |
| `e2e/admin/scoring-correctness.spec.ts` | 146 | Fixture + score math | ✅ | ✅ |
| `e2e/admin/score-edit-request.spec.ts` | n/a | **placeholder, all skipped** | ❌ | ❌ |
| `e2e/admin/heatmap.spec.ts` | n/a | UI render + matrix calc | ✅ | ⚠️ |
| `e2e/admin/audit-log.spec.ts` | n/a | UI list + filter | ❌ | ⚠️ |

### Coverage by admin page (unit + E2E)

| Sayfa | Unit | E2E | Kalite (1-10) | Notlar |
|-------|------|-----|---------------|--------|
| Overview | ✅ tautology-mock | ❌ | 4 | KPI numerical correctness E2E yok |
| Rankings | ✅ clean | ✅ rankings-export | 7 | Numeric ranking position assertion sınırlı |
| Analytics | ✅ clean | ✅ analytics + export-cells | 8 | Bias/outlier coverage sınırlı |
| Heatmap | ✅ tautology | ✅ matrix verify | 7 | Hook tautology, E2E iyi |
| Reviews | ✅ clean | ✅ filter + score edit | 6 | Score edit DB persist zayıf, audit yok |
| Jurors | ✅ refactored | ✅ CRUD + realtime + import | 8 | Lock enforcement = 6 todo() |
| Projects | ✅ tautology | ✅ CRUD + import | 7 | Lock enforcement = 6 todo() |
| Periods | ✅ tautology | ✅ realtime + lifecycle | 7 | 1 conditional skip |
| Criteria | ✅ tautology | ✅ + criteria-mapping (456 ln) | 8 | UI CRUD + mapping persist iyi |
| Outcomes | ✅ tautology | ✅ + outcome-attainment (153 ln) | 9 | En sağlam alan |
| Entry Control | ✅ clean | ✅ entry-tokens | 7 | TTL/revoke real path test ✅ |
| PIN Blocking | ✅ | ✅ pin-blocking | 7 | Real lockout assertion var |
| Audit Log | ✅ clean | ✅ audit-log | 6 | UI listing var; her audit type için yazılma testi yok |
| Organizations | ✅ tautology | ✅ organizations-crud | 6 | Multi-org switching coverage zayıf |
| Settings | ✅ clean | ✅ settings-save (341 ln) | 8 | Audit log assertion eksik |

### Skipped / TODO testler (toplam ≥ 21)

| Dosya | Sayı | Tip | Sebep |
|-------|------|-----|-------|
| `e2e/security/period-immutability.spec.ts` | 7 | `test.skip()` | DB fixture yetersiz |
| `e2e/security/rbac-boundary.spec.ts` | 3 | `test.skip()` | Test data bağımlılığı |
| `e2e/admin/score-edit-request.spec.ts` | tüm dosya | `test.skip()` + placeholder | RPC + tablo yok |
| `e2e/admin/setup-wizard.spec.ts` | 2 | `test.skip()` | Step state bağımlılığı |
| `e2e/admin/periods.spec.ts` | 1 | conditional skip | Lifecycle state |
| `src/admin/features/jurors/__tests__/useManageJurors.lockEnforcement.test.js` | 6 | `it.todo()` | Implementasyon yok |
| `src/admin/features/projects/__tests__/useManageProjects.lockEnforcement.test.js` | 6 | `it.todo()` | Implementasyon yok |

---

## 3. Coverage by Product Area

### Admin

**Güçlü alanlar:** Outcomes (mapping + attainment), Criteria (mapping), Settings (RPC save), Jurors CRUD, Realtime senkronizasyonu (jurors-realtime, periods-realtime).

**Boşluklar:**
- Overview KPI numerical correctness (E2E yok, unit tamamen mock-context)
- Reviews score-edit → DB persist + audit verification eksik
- Audit log: UI render var, "hangi RPC hangi audit type'ı yazar" matrix testi yok
- Multi-organization switching (super-admin perspektifi) sınırlı

### Jury

**Güçlü alanlar:** `useJuryState.test.js` state machine ve PIN lockout cascade testleri, happy-path E2E, evaluate flow, edit-mode, resume-after-tab-switch, expired-session, offline reconnect.

**Boşluklar:**
- Concurrent jüri yazımı (race condition) — perf.yml'de var ama günlük CI'da değil
- Jüri tarafından yazılan score'un admin tarafından gerçekten okunması (cross-role visibility) testi
- PIN reveal one-time view enforcement (re-fetch sonra ne döner?)

### Auth

**Güçlü alanlar:** Login, register, OAuth, password reset, invite accept, email verify (7 spec).

**Boşluklar:**
- Tenant membership status değişiminde JWT refresh davranışı
- `pending_review` durumundayken RPC çağırırsa ne döner (E2E yok, RPC contract test'te de gri alan)
- Remember-me + session expiry interaction'ı

### DB / RLS

**Güçlü alanlar:** pgTAP suite (`sql/tests`) hard-gate; constraint, RLS, RPC, contract testleri çalışıyor.

**Boşluklar:**
- 16 RLS-enabled tablo için isolation testi yazılmamış (drift-sentinel `check:rls-tests` red, soft gate)
- 71 `public.rpc_*` fonksiyonu için contract test yazılmamış (drift-sentinel `check:rpc-tests` red, soft gate)
- Migration idempotency sadece bir test dosyasında

### Edge Functions

**Güçlü alanlar:** 21 fonksiyonun hepsinde `schema.ts` + Zod parse driven test (W6 sonrası `check:edge-schema` hard-gate green).

**Boşluklar:**
- Kong JWT gate'i `verify_jwt: false` olan fonksiyonların custom auth path'i unit-tested ama integration-tested değil (canlı Kong cevabı simüle edilmiyor)
- Edge fonksiyonların retry/backoff davranışı

### Export

**Güçlü alanlar:** `export-full-zip.spec.ts` backup workflow (create → list → download → JSON shape → delete) + `analytics-export-cells.spec.ts` cell-by-cell render diff + `rankings-export.spec.ts` + `heatmap-export.spec.ts`.

**Boşluklar:**
- CSV/XLSX/PDF export'unun **kolonları UI'daki aktif kolonlarla parity check** edilmiyor
- Active filter (period, group, juror) export'a yansıyor mu testi sığ
- Empty dataset export'u testi yok
- Numeric precision (örn. weighted avg) export'ta yuvarlama drift'i kontrolü yok

### Analytics

**Güçlü alanlar:** Outcome attainment math correctness (5+ scenario), 2×2 matrix-driven KPI strip assertion ("1 of 2 outcomes met" tipi).

**Boşluklar:**
- Juror bias / outlier hesabı: kod var, fixture var, ama `outlier_juror_table` numerical assertion yok
- Period comparison (Spring 2026 vs Fall 2025) chart dataset diff testi yok
- Filter değişimi sonrası dataset re-compute testi sınırlı

### Accreditation (MÜDEK / ABET)

**Güçlü alanlar:** Outcome mapping persist + attainment math.

**Boşluklar:**
- Framework selection per period (memory'de plan var) → analytics framework-aware render testi yok
- Period freeze sonrası snapshot immutability testi (skipped 7 test bekliyor)

### CI

**Güçlü alanlar:** Lint/build/migration/edge hard gate, drift sentinel sistemi.

**Boşluklar:**
- E2E hiçbir zaman hard gate olmadı (separate workflow, deploy gating yok)
- 2 sentinel hâlâ soft (W2 RLS + W3-W5 RPC pencereleri açık)
- Coverage threshold CI'da enforce edilmiyor (sadece local `npm run test:coverage` ile)
- `test.skip` policy yok — bir test skip edilse CI uyarmıyor

---

## 4. False Confidence Tests

### A. Render-only / smoke pattern

| Dosya:satır | Test | Neden render-only |
|-------------|------|-------------------|
| `e2e/admin/analytics.spec.ts:36-39` | "page renders — chart container visible" | Sadece `[data-testid="analytics-chart-container"]` visible kontrolü; data assertion yok |
| `e2e/admin/heatmap.spec.ts:37-40` | "page renders — heatmap grid visible" | Aynı pattern, no data |
| `e2e/admin/heatmap.spec.ts:42-46` | "nav item navigates to heatmap" | URL + nav visible; heatmap içeriği test edilmiyor |
| `e2e/admin/reviews.spec.ts:46-49` | "page renders — reviews table visible" | Tablo görünür, ama satır içeriği yok |
| `e2e/admin/settings.spec.ts` (tümü 44 satır) | UI smoke setleri | Sadece tab/sekme açılma kontrolü |
| `e2e/admin/criteria.spec.ts:51-58` | "criteria page loads and add button is visible" | Add button visible + row count > 0 — minimum |
| `src/admin/__tests__/adminTourSteps.test.js:8-25` | "coverage.admin-tour.fields/placement" | `expect(...).toBeTruthy()` presence kontrolü |

> Bu testlerin tümü gerekli değil değil — bir kısmı navigation/route test olarak kalmalı. Ama priority alanlarda (analytics, heatmap, reviews) "renders" testi behavior testi ile **yer değiştirmeli**, eklenmemeli.

### B. Aşırı mock'lanmış / tautology testleri

`docs/testing/page-test-mock-audit.md` (2026-04-25) bunu zaten audit etmiş. 9/17 admin page testi tautology pattern'da:

| Dosya | Mock | Etki |
|------|------|------|
| `CriteriaPage.test.jsx` | `useManagePeriods` mock'lu | Period loading logic test edilmiyor |
| `HeatmapPage.test.jsx` | `useHeatmapData`, `useGridSort`, `useGridExport` mock'lu | Grid hesaplama hiç çalışmıyor — analytics-kritik |
| `OutcomesPage.test.jsx` | `usePeriodOutcomes` mock'lu | Outcome mapping save/import logic test edilmiyor |
| `OrganizationsPage.test.jsx` | `useManageOrganizations` mock'lu | CRUD logic test edilmiyor |
| `PeriodsPage.test.jsx` | `useManagePeriods` mock'lu | Period state logic test edilmiyor |
| `ProjectsPage.test.jsx` | `useManageProjects` mock'lu | Lock enforcement, CRUD test edilmiyor |
| `ReviewsPage.test.jsx` | (audit raporunu kontrol et — listede var) | Filter, edit logic test edilmiyor |
| `EvaluationsPage.test.jsx` | (varsa) | n/a |
| `JurorsPage.test.jsx` | **REFACTORED ✅** | Pattern doğru |

**Ek tautology örnekleri** (ayrıca tespit edilmiş):
- `useManageOrganizations.test.js` (60-92): tüm Supabase API mock + sadece "API çağrıldı mı" assertion
- `useManageJurors.test.js`: 17+ API call mock, RLS enforcement test yok
- `useAdminTeam.test.js`: Mock dönüşü → state cascade test yok
- `useAuditLogFilters.test.js`: Filter API mock, real filtering logic test yok

### C. OverviewPage özel durumu

`src/admin/features/overview/__tests__/OverviewPage.test.jsx`:

```js
vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    rawScores: [],
    matrixJurors: [],
    summaryData: [],
    // ... boş arrays
  }),
}));
```

Tüm context boş array'lerle mock'lanıyor → KPI'lar `0/0/0/0%` olarak render ediliyor. Test "doğru KPI" değil "render edilebiliyor" kontrol ediyor. Bu hem tautology hem render-only — kritik bir gap.

### D. TODO / placeholder testler

| Dosya | Pattern |
|-------|---------|
| `useManageJurors.lockEnforcement.test.js:94-180` | 6× `it.todo()` (period kapanınca add/remove engelleniyor mu?) |
| `useManageProjects.lockEnforcement.test.js:71-132` | 6× `it.todo()` (aynı pattern) |
| `score-edit-request.spec.ts` | Tüm dosya placeholder ("RPC implemented olunca yazılacak") |

### E. Skipped E2E listesi

| Dosya:satır | Test | Skip sebebi |
|-------------|------|-------------|
| `e2e/security/period-immutability.spec.ts` | 7 test (65, 113, 194, 243, 276, 321, 352) | Locked period BEFORE-UPDATE trigger fixture eksik |
| `e2e/security/rbac-boundary.spec.ts` | 3 test (43, 92, 140) | tenant-A → tenant-B cross-org test data yok |
| `e2e/admin/setup-wizard.spec.ts` | 2 test | Step transition state |
| `e2e/admin/periods.spec.ts:116` | "lifecycle — live period can be closed" | conditional |

`docs/testing/e2e-security-skip-audit.md` bu listeyi kategorize ediyor; planın Phase 1'i bu skip'leri yeniden açmayı içeriyor.

---

## 5. Priority Roadmap

### Phase 1 — Critical SaaS Confidence (W1, ~3 hafta)

| # | Task | Owner alan | Test sayısı | Acceptance |
|---|------|-----------|-------------|------------|
| 1.1 | Settings save → audit log assertion ekle | Settings | 4 yeni it() (her save akışı için) | Her save çağrısı sonrası `audit_logs` tablosunda doğru `event_type`, `target_id`, `actor_id` row'u var |
| 1.2 | Reviews score-edit → DB persist + audit | Reviews | 3 yeni it() | Score edit modal save → `score_sheet_items` row updated + audit row written + UI re-renders new value |
| 1.3 | Export full content parity (CSV/XLSX) | Export | 5 yeni spec testi | Export header = UI tablo header; numeric precision drift yok; aktif filter export'a yansıyor; empty state doğru export; large dataset (1k+ row) crash etmiyor |
| 1.4 | Criteria validation DB-level | Criteria | 4 yeni it() | Total ≠ 100 ise RPC reddediyor (client validation bypass edilse bile); rubric band min/max validation; mapping invalid ise RPC reddediyor |
| 1.5 | Outcomes attainment edge cases | Outcomes | 3 yeni it() | Missing score behavior; threshold below/above status; period freeze sonrası eski snapshot bozulmuyor |

**Çıktı:** Phase 1 sonrası Critical SaaS risk seviyesi → Medium.

### Phase 2 — Reporting and Analytics Correctness (W2-W3)

| # | Task | Test sayısı | Acceptance |
|---|------|-------------|------------|
| 2.1 | Overview KPI numerical correctness E2E | 1 yeni spec dosyası (~6 it()) | Total projects, active jurors, completion %, pending evals, at-risk projects — gerçek seed üstünde matematiksel doğruluk |
| 2.2 | Analytics juror bias/outlier numerical | 2 yeni it() (analytics.spec.ts içine) | Outlier juror tablosu için known-bias seed → table dataset assertion |
| 2.3 | Analytics period comparison | 2 yeni it() | İki period seed → comparison chart dataset değerleri |
| 2.4 | Reviews filter/edit workflow E2E | 4 yeni it() | Score filter (only-with-feedback, etc.); juror+project combined filter; review detail open/close; unauthorized edit block (read-only role) |
| 2.5 | Audit log type-by-type assertion matrix | 1 yeni dosya (`audit-event-coverage.spec.ts`) | Her destructive RPC'nin (delete-juror, close-period, save-criteria, vb.) doğru `audit_event_type` ile log yazdığı çapraz matris |

### Phase 3 — CI Hardening (W4)

| # | Task | Acceptance |
|---|------|------------|
| 3.1 | RLS sentinel hard gate (W2 plan close) | `check:rls-tests` green; `continue-on-error` kaldırıldı |
| 3.2 | RPC contract sentinel hard gate (W3-W5 plan close) | `check:rpc-tests` green; `continue-on-error` kaldırıldı |
| 3.3 | E2E "critical path" hard gate | ✅ Superseded — `e2e.yml`'in `e2e-admin` (sharded) + `e2e-other` job'ları zaten kritik specleri local Supabase stack'lerinde paralel koşuyor. Ayrı bir `e2e-critical.yml` yok. |
| 3.4 | Coverage threshold CI'a taşı | `npm run test:coverage` ci.yml unit-tests job'ına eklenir (mevcut 53/37/57/53; ratchet plan: hooks 70 → 75, lib branches 75 → 78) |
| 3.5 | Skip policy + ESLint rule | `it.skip()`, `test.skip()` kullanan PR'lar required reviewer onayı (CODEOWNERS pattern); CI'da aktif `test.skip` sayısı baseline'dan fazla ise warning |
| 3.6 | period-immutability + rbac-boundary skip'leri kaldır | Phase 1.5 ile bağlantılı: setup fixture'larını yaz → 10 skip test çalışır hale gelsin |

### Phase 4 — Test Refactoring (W5-W6)

| # | Task | Acceptance |
|---|------|------------|
| 4.1 | 8 tautology page testini convert et | `docs/testing/page-test-mock-audit.md`'deki 9 dosyadan 1'i (Jurors) bitti; kalan 8 için API-boundary mock pattern'a geçiş |
| 4.2 | Render-only smoke testleri behavior testlerine dönüştür | analytics.spec.ts, heatmap.spec.ts, reviews.spec.ts, criteria.spec.ts, settings.spec.ts başlangıç smoke'larını ya kaldır ya da behavior assertion ekle |
| 4.3 | OverviewPage unit testi reset | Tautology context mock'u kaldır; gerçek `useAdminData` ile API-boundary mock pattern; KPI hesaplama assertion ekle |
| 4.4 | Lock enforcement 12 todo() implement | `useManageJurors`, `useManageProjects` lockEnforcement.test.js'de placeholder'ları gerçek RPC çağrısı + DB verify ile doldur |
| 4.5 | Test isimlendirme audit | qa-catalog.json'daki 1.224 ID'nin "ne test ediyor"u behavior odaklı yeniden adlandır (örn. "renders heatmap" → "displays correct cell state for partial-scored project") |

---

## 6. Detailed Test Specs

### 6.1 Settings save/persist E2E (Priority 1)

#### Why this matters

`settings-save.spec.ts` zaten 4 save akışını RPC seviyesinde test ediyor (security policy, PIN policy, team CRUD, change password). **Eksik tek şey audit assertion.** Premium SaaS standardı: her policy değişikliği audit-trail'e yazılmalı, aksi halde compliance/legal review fail olur.

#### Existing coverage

- `e2e/admin/settings-save.spec.ts:1-341` — 4 save akışı, RPC + DB verify ✅
- `src/admin/features/settings/__tests__/SettingsPage.test.jsx` — clean pattern ✅
- `src/admin/features/settings/__tests__/useAdminTeam.test.js` — over-mocked ⚠️
- `src/admin/features/settings/__tests__/useProfileEdit.test.js` — clean ✅

#### Missing coverage

1. Audit log row yazıldı mı (her 4 save akışı için)
2. Yetkisiz kullanıcı (read-only role) settings save denerse RPC reject ediyor mu — yalnızca org-admin / super-admin geçmeli
3. Save sonrası reload → değişiklik UI'a yansıyor mu (settings-save şu an sadece DB read; UI re-fetch test edilmiyor)
4. Notification preference / export preference save akışı hiç test edilmemiş

#### Proposed tests

**Dosya:** `e2e/admin/settings-save.spec.ts` (mevcut dosyaya ek it() bloklarıyla)

```ts
test("security policy save → audit_logs row written with event_type=security_policy_updated", async () => {
  // existing change → fetch audit_logs WHERE actor_id = adminUserId AND event_type = 'security_policy_updated' ORDER BY created_at DESC LIMIT 1
  // expect row exists, target_id = orgId, payload includes { maxPinAttempts: oldVal, newVal }
});

test("PIN policy save → audit row written with correct payload diff", async () => { /* aynı pattern */ });

test("team invite cancel → audit row written with event_type=membership_revoked", async () => { /* */ });

test("change password → audit row written with event_type=password_changed (no payload)", async () => { /* hassas veri logged değil */ });

test("read-only role cannot save security policy → RPC returns 403", async () => {
  // sign in as a member with role=jury_admin (or read-only)
  // call rpc_admin_set_security_policy → expect throw with code 'rls_denied' or 'forbidden'
});

test("save → reload → UI reflects new value", async ({ page }) => {
  // UI flow ile change yap → page.reload() → new value visible
});
```

**Yeni dosya:** `e2e/admin/notification-preferences.spec.ts` (~80 satır)

```ts
test("admin can update notification preferences via setNotificationPreferences RPC", async () => { /* */ });
test("notification preferences persist after reload", async () => { /* */ });
test("notification preferences row in DB matches RPC payload", async () => { /* */ });
```

#### Acceptance criteria

- 6 yeni audit assertion testi green
- 1 yeni RBAC enforcement testi green
- 1 yeni UI reload roundtrip testi green
- 3 yeni notification-preferences testi green
- `settings-save.spec.ts` ≥ 90% behavior coverage (her save → DB + audit + RBAC verify)

#### Suggested implementation order

1. Audit row helper (`assertAuditEntry({ eventType, targetId, actorId, withinSeconds })`) → `e2e/helpers/auditHelpers.ts` ekle
2. Mevcut 4 save testine audit assertion ekle (4 testtik şimdi 4×2 olur)
3. Read-only role RBAC test ekle (yeni test user fixture gerekebilir)
4. UI reload roundtrip ekle (page-driven, browser context)
5. Notification preferences RPC bağımsız spec dosyası yaz

### 6.2 Export full content validation (Priority 2)

#### Why this matters

Akreditasyon raporu (Excel + PDF) institutional review board'a gider. UI'da "Project X scored 87.4" görünüyorsa export'ta da 87.4 görünmeli. Filter UI'da "sadece Spring 2026" diyorsa export'ta sadece o periodun row'ları olmalı. Empty state crash etmemeli, large dataset (1.000+ row) timeout vermemeli.

#### Existing coverage

- `e2e/admin/export-full-zip.spec.ts:1-175` — Backup workflow (create → list → download → JSON shape → delete). **Bu sadece backup feature'ı, "export to ZIP" değil.**
- `e2e/admin/analytics-export-cells.spec.ts:1-312` — Cell-by-cell render diff
- `e2e/admin/rankings-export.spec.ts` — Rankings export (var)
- `e2e/admin/heatmap-export.spec.ts` — Heatmap export (var)
- `src/admin/features/export/__tests__/ExportPage.test.jsx` — Clean pattern, API mock

#### Missing coverage

1. **Header parity:** Export edilen kolonlar = UI'daki aktif tablo kolonları (column visibility setting export'a yansıyor mu?)
2. **Filter parity:** Aktif period/group/juror filtresi export'a yansıyor mu?
3. **Numeric precision:** Weighted average, attainment %, ranking position — export'ta yuvarlama drift yok
4. **Empty state:** No data scenario export crash etmiyor
5. **Large dataset:** 1k+ row export timeout/memory issue olmadan tamamlanıyor
6. **PDF / XLSX format integrity:** PDF açılabiliyor (binary signature), XLSX SheetJS ile parse edilebiliyor

#### Proposed tests

**Yeni dosya:** `e2e/admin/export-content-parity.spec.ts` (~250 satır)

```ts
test("rankings CSV export: header matches active UI columns", async ({ page }) => {
  // setupScoringFixture
  // navigate to /admin/rankings
  // assert visible column headers (PoM)
  // download export → parse CSV → header row matches
});

test("rankings CSV export: row count matches active filter", async ({ page }) => {
  // apply period filter
  // download → row count = filtered count from UI
});

test("rankings CSV export: numeric values match UI to 2 decimal places", async ({ page }) => {
  // for first 5 rows: UI shows X.XX, CSV row contains X.XX
});

test("XLSX export: parseable via SheetJS, sheet name = report type", async () => { /* */ });

test("PDF export: starts with %PDF-1.x binary signature, page count > 0", async () => { /* */ });

test("empty period export: produces valid file with header-only", async () => { /* */ });

test("large dataset (1000 rows) export completes < 30s and file is well-formed", async () => { /* */ });
```

#### Acceptance criteria

- 7 yeni it() green
- Export header diff vs UI <= 0 column drift
- Numeric precision: |UI value − export value| < 0.01 her satırda
- Empty state: file produced (not crash), 1 header row + 0 data rows
- Large dataset: completes < 30s on CI runner

#### Suggested implementation order

1. CSV parser helper (`parseCSV(text): string[][]`) → `e2e/helpers/exportHelpers.ts`
2. XLSX parser helper (sheetjs minimal binding)
3. PDF binary signature check (no full PDF parse — just first 5 bytes)
4. UI column reader (PoM extension)
5. 7 testi sırayla yaz

### 6.3 Criteria DB tests (Priority 3)

#### Why this matters

Criteria total ≠ 100 ise normalization bozulur → tüm score'lar hesaplama yanlış → tüm sonraki analytics yanlış. Client validation bypass edilse bile (örn. devtools'tan RPC çağırılırsa) DB-seviyesinde reddedilmeli.

#### Existing coverage

- `e2e/admin/criteria-mapping.spec.ts:1-456` — UI + RPC + persist (sağlam)
- `e2e/admin/criteria.spec.ts:1-80` — UI CRUD smoke

#### Missing coverage

1. Total ≠ 100 RPC reddediyor mu (client bypass scenario)
2. Rubric band min < max enforcement DB-seviyesinde
3. Mapping invalid (criterion_id period dışında) RPC reddediyor mu
4. Period freeze sonrası criteria snapshot değişmiyor (immutable)
5. Score'lar varken weight değiştirme attempt → reject

#### Proposed tests

**Yeni dosya:** `e2e/admin/criteria-validation.spec.ts` (~150 satır)

```ts
test("savePeriodCriteria with total != 100 returns error", async () => {
  // direct RPC call with criteria summing to 95 → expect throw
});

test("savePeriodCriteria rejects rubric band where min > max", async () => { /* */ });

test("upsertPeriodCriterionOutcomeMap rejects criterion_id from different period", async () => { /* */ });

test("criteria snapshot frozen after period.locked = true (BEFORE UPDATE trigger)", async () => {
  // bu period-immutability.spec.ts'deki skip'lerden biri zaten yazılmış olabilir
  // setup: period → criteria → lock period → attempt update criteria → expect trigger fires
});

test("score-locked period: criterion weight update rejected (existing scores)", async () => {
  // memory: project_score_locking — scores varsa weights disabled
  // bu davranış kullanıcı tarafından zorlanır; DB'de de enforced mi?
});
```

#### Acceptance criteria

- 5 yeni it() green
- Total validation: client + DB iki katmanlı
- Period-locked snapshot immutability: BEFORE UPDATE trigger fires
- Score-existing weight lock: RPC error code 'criteria_locked_by_scores'

### 6.4 Outcomes attainment recompute tests (Priority 4)

#### Why this matters

`outcome-attainment.spec.ts` zaten 5 senaryo (full weight, weighted avg, vb.) test ediyor. Eksik: missing-score path, threshold edge, period freeze sonrası recompute behavior.

#### Existing coverage

- `e2e/admin/outcome-attainment.spec.ts:1-153` — Math correctness (sağlam, model)
- `e2e/admin/outcomes-mapping.spec.ts:1-459` — UI + RPC mapping persist

#### Missing coverage

1. Missing score: bir kriterin score'u yoksa attainment hesaplaması ne yapıyor? (skip vs zero)
2. Threshold (örn. 70%) altında/üstünde status doğru render
3. Mapping değiştirildi → attainment recompute (cache invalidation testi)
4. Direct vs indirect mapping ayrımı (memory: framework_per_period)
5. Period snapshot: locked period'da mapping değiştirme attempt → reject

#### Proposed tests

**Mevcut dosyaya ek (`e2e/admin/outcome-attainment.spec.ts`):**

```ts
test("missing score for one criterion → attainment uses available scores only", async () => { /* */ });
test("attainment 65%, threshold 70% → status='not met'", async () => { /* */ });
test("attainment 75%, threshold 70% → status='met'", async () => { /* */ });
test("mapping changed mid-period → attainment recomputes on next read", async () => {
  // setup → readAttainment → updateMapping → readAttainment → values different
});
test("locked period mapping update rejected (period_immutability)", async () => { /* */ });
```

#### Acceptance criteria

- 5 yeni it() green
- Missing score behavior dokümante (skip vs zero, ekibin kararı)
- Threshold edge (≤ vs <) explicit assertion
- Recompute: değişiklik sonrası ≥ 1 attainment value değişmiş

### 6.5 Analytics chart numerical dataset tests (Priority 5)

#### Why this matters

Bir chart "render edildi" → değer doğru anlamına gelmez. Premium SaaS = chart altındaki dataset doğru olmalı.

#### Existing coverage

- `e2e/admin/analytics.spec.ts:50-134` — E3 fixture, 2x2 matrix, KPI strip "1 of 2 outcomes met" assertion ✅
- `e2e/admin/analytics-export-cells.spec.ts:1-312` — Cell render diff
- `e2e/admin/heatmap.spec.ts` — Matrix verification

#### Missing coverage

1. Juror bias detection: known-biased juror seed → bias score numerical assertion
2. Outlier detection: known-outlier project seed → outlier table appearance
3. Criteria average: per-criterion mean across all projects/jurors
4. Period comparison: 2 period seed → comparison chart dataset diff
5. Filter re-compute: filter change → dataset re-renders (not just UI)

#### Proposed tests

**Mevcut dosyaya ek + yeni dosya `e2e/admin/analytics-bias-outlier.spec.ts` (~200 satır)**

```ts
test("juror with consistently +20 deviation → flagged in bias table with score >= 80%", async () => {
  // setup 2 juror × 4 project; juror1 always 80, juror2 always 60 (30% gap)
  // expected: juror1 OR juror2 in bias table (depends on baseline)
});

test("project with consistently +30 deviation from group avg → outlier table", async () => { /* */ });

test("criteria average: sum of all scores / count → matches displayed mean", async () => { /* */ });

test("period comparison chart dataset diff: spring vs fall same metric", async () => { /* */ });

test("filter change → chart dataset values change", async () => {
  // read chart dataset (page.evaluate on chart instance)
  // change filter
  // re-read dataset
  // assert at least 1 value differs
});
```

#### Acceptance criteria

- 5 yeni it() green
- Bias/outlier detection: known-deviation seed → expected entries in table
- Numeric precision: < 0.01 drift between expected and rendered

### 6.6 Overview KPI correctness (Priority 6)

#### Why this matters

Overview, admin'in gördüğü ilk sayfa. KPI'lar yanlışsa admin tüm gün yanlış kararlar verir. Şu an coverage = 0 (unit testi tamamen mock context).

#### Existing coverage

- `src/admin/features/overview/__tests__/OverviewPage.test.jsx` — Tautology + mock context (4/10)
- E2E: yok

#### Missing coverage

Tümü.

#### Proposed tests

**Yeni dosya:** `e2e/admin/overview-kpi.spec.ts` (~250 satır)

```ts
test.describe("overview KPI numerical correctness", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture;

  test.beforeAll(async () => {
    // 50 project, 12 juror, 30 completed, 5 at-risk seed
    fixture = await setupScoringFixture({
      namePrefix: "OV1",
      projects: 50,
      jurors: 12,
      completed: 30,
      atRisk: 5,
    });
  });

  test("KPI: total projects = 50", async ({ page }) => { /* */ });
  test("KPI: active jurors = 12", async ({ page }) => { /* */ });
  test("KPI: completed score sheets = 30", async ({ page }) => { /* */ });
  test("KPI: completion percentage = (30 / (50 × 12)) × 100 ≈ 5%", async ({ page }) => { /* */ });
  test("KPI: pending evaluations = (50 × 12) - 30 = 570", async ({ page }) => { /* */ });
  test("KPI: at-risk projects = 5", async ({ page }) => { /* */ });
  test("recent activity feed: shows last 10 audit events", async ({ page }) => { /* */ });
  test("empty state: no period selected → KPI strip shows '—' not '0'", async ({ page }) => { /* */ });
  test("period filter change → KPI re-computes for selected period only", async ({ page }) => { /* */ });
});
```

**Unit testi reset:** `OverviewPage.test.jsx`'i clean pattern'a getir — `useAdminContext` mock'la ama gerçek hesaplama logic'i çalışsın.

#### Acceptance criteria

- 9 yeni E2E it() green
- Unit test refactor: tautology mock kaldırıldı, KPI hesap logic'i en az 3 senaryoda doğrulandı
- Overview kalite puanı 4/10 → 8/10

### 6.7 Reviews workflow tests (Priority 7)

#### Why this matters

Reviews sayfası score düzenleme + feedback inceleme + audit-trail'in admin entry-point'i. Şu an filter testleri var, ama:

#### Existing coverage

- `e2e/admin/reviews.spec.ts:1-176` — UI smoke + filter (juror, project)
- Yeni "score edit enable" testi var (line 160) — implementation sınırlı

#### Missing coverage

1. Score edit save → DB persist verification
2. Score edit save → audit log row written
3. Score filter (only-with-feedback, score range)
4. Combined filter (juror AND project AND score range)
5. Read-only role: edit button hidden / RPC reject
6. Review detail open → close → state restoration
7. Bulk operation (eğer varsa): multi-row edit

#### Proposed tests

**Mevcut dosyaya ek + yeni dosya `e2e/admin/reviews-edit-persist.spec.ts` (~180 satır)**

```ts
test("score edit save → score_sheet_items row updated with new value", async () => { /* */ });
test("score edit save → audit_logs row written with event_type=score_edited, payload includes old/new value", async () => { /* */ });
test("filter: only-with-feedback shows only rows where feedback IS NOT NULL", async () => { /* */ });
test("filter: score range 70-80 shows only rows where score BETWEEN 70 AND 80", async () => { /* */ });
test("combined filter: juror=X AND project=Y AND feedback-only", async () => { /* */ });
test("read-only role: score edit button hidden in UI", async () => { /* */ });
test("read-only role: rpc_admin_edit_score returns 403", async () => { /* */ });
test("review detail drawer open → close → re-open shows fresh data", async () => { /* */ });
```

#### Acceptance criteria

- 8 yeni it() green
- Score edit DB persist: row updated + audit row written + UI re-renders
- RBAC enforcement: read-only blocked at UI + RPC
- Reviews kalite puanı 6/10 → 8/10

### 6.8 CI hard gates

#### Why this matters

`docs/testing/target-test-architecture.md` zaten plan W2-W6 pencerelerini tanımlamış. Soft sentinel'ler intentionally red — pencereler kapanınca hard gate'e geçiş yapılmalı.

#### Existing state

- `ci.yml` unit-tests, edge-tests, migration-test, drift-sentinels[db-types, edge-schema] — **hard gate ✅**
- `ci.yml` drift-sentinels[rls-tests, rpc-tests] — **soft (continue-on-error)**, planlı W2/W3-W5'te green
- `e2e.yml` admin + auth/jury — **soft (no merge blocker)**

#### Recommendations

| Hard gate yapılmalı | Şu anki durum | Eylem |
|---|---|---|
| RLS isolation coverage (`check:rls-tests`) | Soft (W2 açık) | W2 close → continue-on-error kaldır |
| RPC contract coverage (`check:rpc-tests`) | Soft (W3-W5 açık) | W5 close → continue-on-error kaldır |
| Critical path E2E (settings-save, outcome-attainment, criteria-mapping, scoring-correctness) | ✅ `e2e.yml` `e2e-admin` + `e2e-other` shard'ları kapsıyor (local Supabase stack) | Tamam — branch protection bu shard'ları required işaretler |
| Migration idempotency multi-run | Single-run | Yeni step: aynı migration suite'i 2× peş peşe çalıştır, 2. run no-op olmalı |
| Tenant isolation E2E | Soft + 3 skip | `period-immutability.spec.ts` skip'leri kaldırıldıktan sonra hard gate |
| Coverage threshold | Local-only | `npm run test:coverage` ci.yml unit-tests'e ekle |

| Soft kalabilir | Sebep |
|---|---|
| Full E2E suite (admin shard) | 5-10 dk wall clock; PR'i blokladığı için hızı düşürür |
| Visual regression (eğer varsa) | False positive sıklığı |
| A11y testleri | Çoğu öneri seviyesinde; warning olarak kalsın |

| `continue-on-error` kaldırılmalı (sırasıyla) | Pencere |
|---|---|
| `check:rls-tests` | W2 close (~Phase 1 sonu) |
| `check:rpc-tests` | W5 close (~Phase 2 sonu) |

| Coverage threshold uygula | |
|---|---|
| Lines | 53 → 60 (Phase 4 ratchet) |
| Functions | 37 → 50 (Phase 4 ratchet) |
| Branches | 57 → 65 (Phase 4 ratchet) |
| Hooks lines | 70 → 75 (Phase 3 ratchet) |
| Storage lines | 80 → 82 (Phase 3 ratchet) |

#### Skip policy

Yeni `scripts/check-no-skip.js` ekle:

- `it.skip`, `test.skip`, `describe.skip` sayısını CI'da say
- Baseline'ı `docs/testing/skip-baseline.json`'da tut (şu an: 21 skip)
- PR yeni skip eklerse fail (warning değil, error)
- Skip kaldırma her zaman serbest (baseline aşağı doğru ratchet)

### 6.9 Render-only test refactor

#### Approach

Her render-only testi **silmek yerine** behavior assertion ile zenginleştir.

| Mevcut test | Refactor sonrası |
|-------------|------------------|
| `analytics.spec.ts` "page renders — chart container visible" | Sil veya birleştir: E3 testleri zaten chart'ı görüyor |
| `heatmap.spec.ts` "page renders — heatmap grid visible" | Behavior ekle: en az 1 cell rengini doğrula (scored=green, partial=yellow, empty=gray) |
| `reviews.spec.ts` "page renders — reviews table visible" | Behavior ekle: row count > 0 (seed exists), first row has expected columns |
| `criteria.spec.ts` "criteria page loads and add button is visible" | Behavior ekle: total weight = 100 banner shows correct value |
| `settings.spec.ts` (44 satır UI smoke) | Refactor: her tab açıldığında ilk panel content visible (tab content load testi) |

#### Test naming refactor

Behavior odaklı isimlendirme örnekleri:

| Önce | Sonra |
|------|-------|
| "renders heatmap" | "displays correct cell state (scored/partial/empty) for each project" |
| "page loads" | "fetches first page of records on initial render" |
| "filter works" | "filtering by juror reduces visible rows to only that juror's reviews" |
| "save button" | "save button submits form data and triggers re-fetch" |
| "drawer opens" | "drawer opens and pre-fills form with selected record values" |

---

## 7. CI Gate Recommendations

### ~~Yeni job: e2e-critical (hard gate)~~ — Superseded

**Status:** Superseded. Ayrı bir `e2e-critical.yml` workflow eklemek yerine `e2e.yml`'deki mevcut `e2e-admin` (sharded) ve `e2e-other` job'ları kritik specleri zaten kapsıyor; ikisi de izole local Supabase stack'inde çalışıyor. Branch protection rule'da `E2E / Admin panel (shard 1/2)`, `E2E / Admin panel (shard 2/2)`, `E2E / Auth, jury & security`, `E2E / Maintenance mode (serial)` required olarak işaretlenir. Aşağıdaki orijinal öneri tarihsel bağlam için bırakıldı.

**Dosya (historical):** `.github/workflows/e2e-critical.yml`

```yaml
name: E2E critical path
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  e2e-critical:
    name: Critical path E2E (must pass)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install chromium
      - name: Critical specs
        env:
          E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
        run: |
          npx playwright test \
            e2e/admin/settings-save.spec.ts \
            e2e/admin/outcome-attainment.spec.ts \
            e2e/admin/criteria-mapping.spec.ts \
            e2e/admin/scoring-correctness.spec.ts \
            e2e/admin/overview-kpi.spec.ts \
            e2e/security/period-immutability.spec.ts \
            --reporter=line
```

~~GitHub branch protection rule'da "e2e-critical / Critical path E2E (must pass)" required check olarak işaretlenmeli.~~ Superseded — bkz. yukarıdaki Status notu.

### Coverage threshold ratchet plan

| Tarih | Lines | Funcs | Branches | Statements | Note |
|-------|-------|-------|----------|------------|------|
| 2026-04-26 (current) | 53 | 37 | 57 | 53 | Baseline |
| Phase 1 close | 56 | 42 | 60 | 56 | +Settings/Reviews/Export tests |
| Phase 2 close | 60 | 50 | 65 | 60 | +Overview/Analytics/Audit tests |
| Phase 4 close | 65 | 55 | 70 | 65 | +Tautology refactor |

### Continue-on-error removal timeline

| Step | Timeline | Trigger |
|------|----------|---------|
| `check:rls-tests` (drift-sentinels) | Phase 1 sonu | 16 RLS test dosyası tamamlandı |
| `check:rpc-tests` (drift-sentinels) | Phase 2 sonu | 71 RPC contract test'i tamamlandı |

---

## 8. Final Scorecard

| Alan | Şu an | Phase 1 sonrası | Phase 2 sonrası | Phase 4 sonrası (hedef) | Phase 4 sonrası (gerçekleşen) |
|------|-------|------------------|-----------------|--------------------------|-------------------------------|
| Settings | 8 | 9 | 9 | 9 | **9** ✅ |
| Export | 6 | 8 | 8 | 9 | **8** ⚠️ (Phase 4 export'a dokunmadı) |
| Criteria | 8 | 9 | 9 | 9 | **9** ✅ |
| Outcomes | 9 | 9 | 9 | 10 | **10** ✅ |
| Analytics | 7 | 7 | 9 | 9 | **9** ✅ |
| Overview | **4** | 5 | 8 | 9 | **9** ✅ (Phase 4.3 +3 KPI testi) |
| Reviews | 6 | 8 | 9 | 9 | **9** ✅ |
| RLS / RPC sentinel | 5 (soft) | 7 | 9 (hard) | 10 | **9** ⚠️ (RLS hard ✅; RPC contracts 63/89, 26 eksik) |
| Audit-trail integrity | 5 | 8 | 9 | 9 | **9** ✅ |
| General test quality | 7.2 | 7.8 | 8.4 | 9.0 | **8.8** ⚠️ (HeatmapPom + ProjectsPage sibling-hook kalan) |
| Premium SaaS readiness | 6.5 | 7.4 | 8.4 | 9.2 | **9.0** ⚠️ (lock enforcement DB-level guard yok) |

**Final test count (Phase 4 close-out, 2026-04-26):** 1007/1007 unit ✅, 232 test dosyası, 16/16 Phase 2 E2E ✅.

**Açık backlog (Phase 5+):**

1. 26 eksik RPC contract test → Task 3.2 sentinel hard-gate'e flip için ön koşul
2. `e2e/poms/HeatmapPom.ts` → `firstCellScore()` / `cellColor()` metotları (heatmap E2E behavior augment için)
3. `ProjectsPage.test.jsx` → `useManagePeriods` sibling hook mock'unu kaldır (8/8 tautology için)
4. Lock enforcement DB-level RPC guard (opsiyonel — şu an application-layer reject yeterli)

---

## Appendix A — Test File Conventions

### qaTest pattern

Tüm yeni testler `qaTest()` kullanmalı, `qa-catalog.json`'a eklenmiş ID gerekir:

```js
import { qaTest } from "@/test/qaTest";
qaTest("e2e.admin.settings.audit.security_policy", async () => { /* */ });
```

### PoM kullanımı

Yeni E2E testleri direkt `page.locator()` kullanmamalı — uygun PoM'a method ekle:

- `e2e/poms/SettingsPom.ts` — yeni audit assertion testleri için
- `e2e/poms/ReviewsPom.ts` — score edit drawer methodları
- `e2e/poms/OverviewPom.ts` — yeni; KPI read methodları

### Fixture kullanımı

Numerical correctness testleri için `setupScoringFixture` veya `setupOutcomeFixture` extend edilmeli:

```ts
// scoringFixture.ts'e eklenmeli:
export async function writeBiasedJurorScores(fixture, juror1Bias, juror2Bias) { /* */ }
export async function writeOutlierProjectScores(fixture, outlierProjectIdx, deviation) { /* */ }
```

### Audit assertion helper

```ts
// e2e/helpers/auditHelpers.ts (yeni)
export async function assertAuditEntry(opts: {
  eventType: string;
  targetId: string;
  actorId: string;
  withinSeconds: number;
  payloadIncludes?: Partial<Record<string, unknown>>;
}): Promise<void> { /* */ }
```

---

## Appendix B — Risk Matrix

| Risk | Olasılık | Etki | Mitigasyon |
|------|----------|------|-----------|
| Akreditasyon raporu yanlış sayı içerir | Medium | **Critical** | Phase 1.5 (outcomes) + Phase 2.1 (overview KPI) |
| Cross-tenant veri sızıntısı | Low | **Critical** | RLS sentinel hard-gate (Phase 3.1) + period-immutability skip kaldırma |
| Audit log eksik = compliance fail | Medium | High | Phase 1.1 (settings audit) + Phase 2.5 (audit matrix) |
| Locked period sonrası score değişimi | Medium | High | Phase 4.4 (lock enforcement 12 todo) |
| Export header drift production'da | High | Medium | Phase 1.3 (export parity) |
| Tautology mock'lar regression saklar | High | Medium | Phase 4.1 (8 tautology refactor) |

---

## Appendix C — Assumptions & Open Questions

**Varsayımlar:**

1. `setupScoringFixture` mevcut helper, ama Overview KPI testleri için extension gerekiyor (50 project / 12 juror seed). İmplementation detayı Phase 2.1 başında değerlendirilecek.
2. Read-only role (jury_admin / read_only) tenant_admin'den ayrı bir membership rolü olarak DB'de mevcut. Eğer değilse Phase 1.1 öncesinde role schema review gerekir.
3. Score edit RPC (`rpc_admin_edit_score` veya benzeri) production'da var. `score-edit-request.spec.ts` placeholder olduğundan, RPC adı doğrulanmalı.
4. Branch protection rule'lar GitHub UI tarafından yönetiliyor (kod değil). Required check ekleme manuel.
5. CI runner kapasitesi: 1k+ row export testi 30s içinde tamamlanır varsayımı. Eğer Postgres seed time + UI render time toplamı bunu aşarsa, test farklı bir job'da çalıştırılmalı.

**Açık sorular:**

1. Notification preferences için RPC mevcut mu? `rpc_admin_set_notification_preferences` aramada bulunmadı; eğer feature backlog'daysa Phase 1.1 başında check gerekir.
2. PDF export gerçekte üretiliyor mu yoksa sadece print-to-PDF mi? Eğer print-to-PDF ise binary signature testi anlamsız.
3. Multi-organization switching (super-admin) için coverage hedefi nedir? Şu an sınırlı; eğer customer base genişlerse priority artırılmalı.
4. `qa-catalog.json` 1.224 ID'nin kaçı aktif test dosyasında kullanılıyor? Orphan ID temizliği gerekebilir (`audit-taxonomy-scan.md` bunu kısmen ele almış).

---

**Plan owner:** QA Lead + Engineering
**Review cadence:** Her phase sonu retrospective
**Update trigger:** Yeni feature merge, yeni framework adoption (ABET), yeni tenant onboarding
