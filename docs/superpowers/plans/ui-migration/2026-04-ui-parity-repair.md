# VERA Full UI Reset — Prototype → React Rewrite Plan

## Context

Mevcut React UI, prototype'dan çeşitli şekillerde sapma gösteriyor (Tailwind/shadcn mix, yanlış JSX dönüşümleri, eksik sayfalar). Incremental fix yerine **tüm UI katmanını sıfırdan yazacağız**. Prototype HTML tek kaynak. Hooks, API layer, state management korunacak — sadece JSX + CSS yeniden yazılacak.

**Kaynak:** `docs/concepts/vera-premium-prototype.html` (~28K satır, ~6K CSS, 75+ ekran)
**Hedef:** Birebir görsel/yapısal eşleşme

## Temel Kararlar ve Kurallar

### Yaklaşım

> Eski UI'yi koruma veya düzeltme.
> Prototype'taki ekranı tekrar oku.
> JSX'i sıfırdan yaz.
> CSS'i prototype'tan al.
> React wiring'i bağla.
> Birebir parity hedefle.

### Kapsam Kararları

- Bu iş incremental migration değil, **full UI reset** olarak yürütülecek
- Tailwind **tamamen** kaldırılacak
- shadcn **tamamen** kaldırılacak
- Eski UI **komple** silinecek
- Mevcut JSX patch edilmeyecek; prototype'taki ilgili ekran tekrar okunup JSX **sıfırdan** yazılacak

### Source of Truth

- `docs/concepts/vera-premium-prototype.html` **tek source of truth** olacak
- Kod prototype'a uymalı; prototype koda uydurulmayacak
- Section isimleri, metinler, layout ve blok hiyerarşisi keyfi olarak değiştirilmeyecek
- Büyük sapma varsa patch yerine **rewrite from prototype** uygulanacak

### CSS ve Styling

- Prototype CSS'i doğrudan alınacak; ilk aşamada cleanup/refactor yapılmayacak
- Tailwind utility class'ları kullanılmayacak
- shadcn component'ları kullanılmayacak

### Davranış ve Chart'lar

- Prototype JS davranışları React state/event yapısına rewrite edilecek
- Chart'lar prototype'ta nasıl görünüyorsa öyle yapılacak

### Korunan Katmanlar

- Hooks, API layer, selectors, auth/state management ve business logic korunacak
- API contract, hook output shape ve selector output shape değiştirilmeyecek
- Yalnızca UI wiring için zorunlu minimal değişiklik yapılabilecek

### Refactoring Yasağı

- Parity sağlanana kadar erken abstraction/component extraction yapılmayacak
- Önce birebir çalışsın, sonra refactor edilsin

### Phase Yürütme Kuralları

- Her phase sonunda:
  - Yapılanları özetle
  - Silinen / eklenen / yeniden yazılan dosyaları yaz
  - Parity açısından kritik notları belirt
  - Varsa minimal logic değişikliklerini açıkça yaz
  - Sonraki phase'i söyle ve dur
- Sonnet ile implement edilecekse her phase **tek bir context'e sığacak** şekilde yürütülecek
- Bir response içinde sadece tek phase yapılacak

### Branch ve Worktree Kuralları

- Bu çalışma için **ayrı bir worktree açılmayacak**
- Tüm UI reset işi **doğrudan current main branch üzerinde** yürütülecek
- Başka stale/diverged branch'ler varsa, unique gerekli iş içermiyorsa kaldırılacak
- Claude/Codex yeni worktree veya alternatif branch önermeyecek
- Tek güvenilir baseline **main branch** olacak

### Güvenlik

- Phase 0 başlamadan önce mevcut main için bir **backup tag** (`pre-ui-reset`) alınacak
- Phase 0'da shared UI dependencies ve styling layer temizlensin; page JSX dosyaları ilgili phase'de replace edilsin

### Chart Stratejisi

- Prototype'ta Chart.js ile render edilen grafikler React içinde de **Chart.js** (`react-chartjs-2`) ile yeniden kurulacak
- Custom SVG/HTML yalnızca prototype'ta Chart.js ile yapılmayan, HTML/CSS-only chart'larda (lollipop, attainment bar gibi) kullanılacak
- Phase 15 yeni chart yazma phase'i **değildir**; chart'lar ilgili page phase'lerinde (Phase 2, 4) yazılacak
- Phase 15 = **final chart parity polish, remaining fixes, cross-page consistency check**

### Tracking

- Repo içinde ayrıca bir **parity tracker** tutulacak (`docs/audits/ui-parity-tracker.md`)
- Tracker alanları: Screen, Prototype line range, Target React file, Status, Parity, Notes
- Her tamamlanan phase için ayrı bir implementation raporu Markdown dosyası oluşturulacak
- Rapor dosyaları `docs/superpowers/plans/ui-migration/implementation_reports/` altında tutulacak
- Dosya adı formatı: `phase-0-implementation-summary.md`, `phase-1-implementation-summary.md`, vb.
- Bu raporlar o phase için yapılan işleri, dosya değişikliklerini, parity notlarını, logic/wiring notlarını ve kalan işleri içerecek
- Parity tracker tablosundaki `Notes` alanı ilgili implementation rapor dosyasına referans içerecek

### Cleanup

- Tailwind tamamen kaldırıldıktan sonra `src/lib/utils.js` içindeki `cn()` helper (clsx + tailwind-merge) artık kullanılmıyorsa silinecek
- `tailwind.config.js`, `postcss.config.js` Tailwind kaldırıldıktan sonra silinecek veya minimal CSS-only config'e dönüştürülecek

### Phase Validation Checklist

Her phase sonunda aşağıdaki kontroller yapılacak:

1. **Text parity** — section isimleri, başlıklar, alt başlıklar, buton metinleri
2. **Section parity** — tüm bloklar mevcut, eksik section yok
3. **Layout parity** — grid yapısı, kolon sayısı, sıralama
4. **Spacing parity** — padding, gap, margin değerleri
5. **Background/theme parity** — gradient, glow, glassmorphism
6. **Dark/light parity** — her iki mod doğru çalışıyor
7. **Mobile parity** — responsive breakpoint'ler, sidebar toggle
8. **Interaction parity** — click, hover, toggle, dropdown davranışları

### Phase Sonucu Formatı

Her phase tamamlandığında şu format kullanılacak:

```text
## Yapılanlar
- ✅ Tamamlanan işler
- ⚠️ Kısmen tamamlanan / dikkat gerekenler
- ⏳ Sonraki phase’e kalanlar

## Dosya Değişiklikleri
- Silinen dosyalar
- Eklenen dosyalar
- Sıfırdan yazılan dosyalar
- Güncellenen dosyalar

## Parity Notları
- Prototype ile birebirlik açısından kritik noktalar

## Parity Tracker Güncellemesi
| Screen | Prototype Range | Target React File | Status | Parity | Notes |

## Logic / Wiring Notları
- Zorunlu minimal logic değişiklikleri (varsa)
- Hook/API/selector contract değişikliği olup olmadığı

## Implementation Report
- O phase için `docs/superpowers/plans/ui-migration/implementation_reports/phase-X-implementation-summary.md` dosyasını oluştur veya güncelle
- Bu phase cevabındaki tüm içerikleri ayrıca o dosyaya kaydet
- Parity tracker `Notes` alanında ilgili rapor dosyasına referans ver

## Sonraki Adım
- Sadece sıradaki phase (yeni phase'e başlanmaz, durulur)
```

## Strateji

```text
Her phase için:
1. Eski UI dosyalarını sil (JSX render + CSS)
2. Prototype'taki ilgili ekranı oku
3. JSX'i sıfırdan yaz (prototype HTML → React)
4. CSS'i prototype'tan aynen kopyala
5. Hook wiring'i bağla (mevcut hook'lar korunuyor)
6. Doğrula (dev server'da aç, prototype ile yan yana karşılaştır)
7. Parity tracker'ı güncelle
8. Phase implementation raporunu `docs/superpowers/plans/ui-migration/implementation_reports/phase-X-implementation-summary.md` altına kaydet
```

## Korunacaklar (SİLİNMEYECEK)

- `src/shared/api/` — Tüm API katmanı
- `src/shared/auth/AuthProvider.jsx` — Auth context
- `src/shared/theme/ThemeProvider.jsx` — Theme context
- `src/jury/useJuryState.js` + `src/jury/hooks/` — Jury state management
- `src/admin/hooks/` — Admin hooks (useAdminData, useAdminTabs, useSettingsCrud, vb.)
- `src/admin/selectors/` — Filter pipeline
- `src/admin/analytics/analyticsDatasets.js` — Chart data builders
- `src/admin/analytics/analyticsExport.js` — Export logic
- `src/admin/scoreHelpers.js` — Pure computation functions
- `src/shared/stats.js` — İstatistik hesaplamaları
- `src/config.js` — Criteria config
- `src/test/` — Test altyapısı
- `src/lib/utils.js` — cn() utility (Tailwind geçişi için geçici tutulacak)

## Silinecekler

- `src/components/ui/` — Tüm shadcn bileşenleri (57 dosya)
- `src/styles/globals.css` — Tailwind imports + eski token'lar
- `src/styles/prototype.css` — Eski partial extract
- `src/styles/pages/*.css` — Sayfa bazlı CSS
- `src/styles/jury-confetti.css`, `src/styles/jury-pin.css`
- Tüm JSX render dosyaları (aşağıdaki phase'lerde detaylı)

## CSS Mimarisi (Yeni)

Prototype'daki tüm CSS'i tek dosyaya kopyala, sonra mantıksal bölümlere ayır:

```text
src/styles/
├── variables.css      — :root + .dark-mode token'ları
├── base.css           — reset, typography, utilities
├── layout.css         — .admin-shell, .admin-main, .admin-header, sidebar
├── components.css     — .card, .btn-*, .badge, .pill-*, .dropdown-*, forms
├── pages/
│   ├── overview.css
│   ├── rankings.css
│   ├── analytics.css
│   ├── heatmap.css
│   ├── reviews.css
│   ├── jurors.css
│   ├── projects.css
│   ├── periods.css
│   ├── criteria.css
│   ├── outcomes.css
│   ├── entry-control.css
│   ├── pin-lock.css
│   ├── audit-log.css
│   ├── settings.css
│   └── export.css
├── jury.css           — jury flow tüm step'ler
├── landing.css        — landing page
├── auth.css           — login, register, forgot, reset
├── drawers.css        — .fs-drawer, .fs-modal, CRUD formları
├── modals.css         — confirmation modals
├── charts.css         — chart card'ları, legend, tooltip
└── print.css          — @media print (gerekirse eklenecek)
```

---

## Execution Phases

### Phase 0 — CSS Extraction + Cleanup

**Amaç:** Prototype CSS'i extract et, eski UI'yı sil, boş sayfa iskeletini kur.

**Adımlar:**

1. Prototype HTML'den tüm `<style>` bloklarını extract et → `src/styles/` altına yukarıdaki yapıda yerleştir
2. `src/styles/main.css` oluştur — tüm CSS dosyalarını import eden master file
3. `src/main.jsx`'te `main.css` import et (Tailwind import'larını kaldır)
4. `src/components/ui/` dizinini sil (shadcn)
5. Eski JSX render dosyalarını sil (Phase 1-7'de belirtilen dosyalar)
6. `tailwind.config.js`, `postcss.config.js`'yi devre dışı bırak veya minimal tut
7. `components.json` (shadcn config) sil
8. `index.html`'de font link'lerini prototype ile eşleştir (Google Fonts CDN)
9. `App.jsx`'i minimal skeleton'a dönüştür — sadece route switch, tüm page content boş

**Doğrulama:** `npm run dev` çalışır, boş sayfa görünür, console'da import hatası yok.

**Kritik dosyalar:**
- Sil: `src/components/ui/**`, `src/styles/globals.css`, `src/styles/prototype.css`, `src/styles/pages/*`, `src/styles/jury-*.css`, `components.json`
- Oluştur: `src/styles/variables.css`, `src/styles/base.css`, `src/styles/layout.css`, `src/styles/components.css`, `src/styles/main.css`

---

### Phase 1 — Admin Shell (Sidebar + Header + Layout)

**Prototype kaynağı:** Satır 11580-11710 (sidebar), satır ~2800-3100 (admin-shell CSS)

**Silinecek:**
- `src/admin/layout/AdminLayout.jsx`
- `src/admin/layout/AdminHeader.jsx`
- `src/admin/layout/AdminSidebar.jsx`
- `src/admin/components/SidebarProfileMenu.jsx`

**Yazılacak (sıfırdan):**
- `src/admin/layout/AdminLayout.jsx` — `.admin-shell` wrapper, mobile overlay
- `src/admin/layout/AdminSidebar.jsx` — `.sidebar` nav, theme toggle, tenant switcher, user menu
- `src/admin/layout/AdminHeader.jsx` — `.admin-header` breadcrumb, period select, refresh
- `src/styles/layout.css` — sidebar, header, admin-main CSS

**Hook bağlantıları:** `useTheme`, `useAuth`, `useAdminTabs` (korunuyor)

**Doğrulama:** Sidebar açılır/kapanır, dark/light toggle çalışır, sayfa navigasyonu çalışır.

**⚠️ Post-Phase Auth Gate Fix (2026-04-03):**

Phase 1 rewrite'ında AdminLayout, eski AdminPanel'deki auth gate'i (LoginForm) içermeyen bir shell olarak yazıldı. Bu nedenle `activeOrganization` her zaman null geliyordu ve `useAdminData` hiç fetch yapmıyordu (tüm KPI'lar "—"). Düzeltme:

- `AdminLayout.jsx`'e auth gate eklendi: `authLoading → !user → profileIncomplete → isPending` sırası
- Tüm auth form bileşenleri (`LoginForm`, `RegisterForm`, vb.) `React.lazy` ile yükleniyor — Phase 12'de rewrite edilene kadar
- `AuthFormErrorBoundary` + `FallbackLoginForm` (saf HTML/CSS, shadcn bağımsız) eklendi — shadcn import'ları hâlâ silinmiş olduğu için fancy form yüklenemez; fallback çalışır durumda
- Demo mod: `FallbackLoginForm` `VITE_DEMO_ADMIN_EMAIL` / `VITE_DEMO_ADMIN_PASSWORD` env vars ile pre-fill yapıyor

---

### Phase 2 — Overview Page

**Prototype kaynağı:** Satır 11759-11982

**Silinecek:**
- `src/admin/OverviewTab.jsx`
- `src/admin/overview/KpiGrid.jsx`
- `src/admin/overview/KpiCard.jsx`
- `src/admin/overview/JurorActivityTable.jsx`
- `src/admin/overview/NeedsAttentionCard.jsx`
- `src/admin/overview/PeriodSnapshotCard.jsx`
- `src/admin/overview/CriteriaProgress.jsx`
- `src/admin/overview/CompletionByGroupCard.jsx`
- `src/admin/overview/TopProjectsCard.jsx`

**Yazılacak (sıfırdan):**
- `src/admin/OverviewPage.jsx` — Tüm Overview sayfası tek dosya
- İçerik: KPI grid (4 kart), Live Jury Activity table, Needs Attention + Period Snapshot (sağ stack), Live Feed card, Completion by Group card, Submission Timeline chart, Score Distribution chart, Top Projects table
- `src/styles/pages/overview.css`

**Hook bağlantıları:** `useAdminData` → `overviewMetrics`, `jurorStats`, `ranked`

---

### Phase 3 — Rankings Page

**Prototype kaynağı:** Satır 11985-12200

**Silinecek:**
- `src/admin/RankingsTab.jsx`
- `src/admin/scores/RankingsTable.jsx`

**Yazılacak:**
- `src/admin/RankingsPage.jsx` — KPI strip, filter panel, export panel, rankings table
- `src/styles/pages/rankings.css`

**Hook bağlantıları:** `useAdminData` → `ranked`, `summaryData`

---

### Phase 4 — Analytics Page

**Prototype kaynağı:** Satır 12200-13199 (~1000 satır)

**Silinecek:**
- `src/admin/analytics/AnalyticsTab.jsx`
- `src/admin/analytics/AnalyticsDashboardStates.jsx`
- `src/admin/analytics/AnalyticsPrintReport.jsx`
- `src/admin/analytics/TrendPeriodSelect.jsx`
- `src/admin/components/analytics/AnalyticsHeader.jsx`
- `src/charts/` — tüm chart component'ları (CompetencyRadarChart, CriterionBoxPlotChart, vb.)

**Yazılacak:**
- `src/admin/AnalyticsPage.jsx` — Tüm analytics sayfası
- İçerik: Header (title + MÜDEK badge + export), Analytics nav tabs (6 tab), Section 01: Attainment Status (8 traffic-light card), Section 02: Attainment Analysis (Rate chart + Gap lollipop), Section 03: Outcome by Group (bar chart), Section 04: Programme Overview (overview + radar), Section 05: Continuous Improvement (trend chart), Section 06: Group-Level Attainment, Section 07: Assessment Reliability (heatmap), Insight banners
- `src/charts/` — Yeni chart component'ları (Chart.js veya custom SVG, prototype'a uygun)
- `src/styles/pages/analytics.css`

**Hook bağlantıları:** `useAdminData` → `dashboardStats`, `submittedData`, trend hooks

---

### Phase 5 — Heatmap Page

**Prototype kaynağı:** Satır 13199-13288

**Silinecek:**
- `src/admin/ScoreGrid.jsx`
- `src/admin/useHeatmapData.js` (hook korunur, sadece JSX silinir — aslında hook da burada, dikkat)
- `src/admin/GridExportPrompt.jsx`

**Yazılacak:**
- `src/admin/HeatmapPage.jsx` — Header (title + subtitle + criteria tabs + export), matrix table, footer legend
- `src/styles/pages/heatmap.css`

**Hook bağlantıları:** `useHeatmapData`, `useGridSort`, `useGridExport`

**Not:** `useHeatmapData.js` hook olarak kalacak, sadece render JSX yeniden yazılacak.

---

### Phase 6 — Reviews Page ✅

**Prototype kaynağı:** Satır 13291-13490

**Historical geçiş:** `ScoreDetails` (replaced by `ReviewsPage`).

**Kaldırılan legacy dosyalar (historical):**
- `src/admin/ScoreDetails.jsx`
- `src/admin/components/details/ScoreDetailsHeader.jsx`
- `src/admin/components/details/ScoreDetailsFilters.jsx`
- `src/admin/components/details/ScoreDetailsTable.jsx`
- `src/admin/components/details/scoreDetailsColumns.jsx`
- `src/admin/components/details/scoreDetailsFilterConfigs.jsx`

**Historical leftover (unused):**
- `src/admin/components/details/scoreDetailsHelpers.js` (silinmedi; `ReviewsPage` tarafından kullanılmıyor)

**Canonical yazılan dosyalar:**
- `src/admin/ReviewsPage.jsx` — Header (title + subtitle + search + filter + export), filter banner, KPI strip, status legend, filter panel, reviews table, pagination
- `src/styles/pages/reviews.css`

**Wiring / Hook bağlantıları:**
- `useScoreDetailsFilters` korunur (legacy hook adı, canonical kullanım `ReviewsPage`).
- `src/admin/ScoresTab.jsx` Reviews view için `ReviewsPage` render edecek şekilde bağlıdır.
- `src/admin/layout/AdminLayout.jsx` `scoresView === "details"` dalında `ReviewsPage` render eder.
- `src/admin/selectors/filterPipeline.js` Reviews selector/filter pipeline’ının canonical kaynağıdır.

**Phase sonrası düzeltmeler (korunacak):**
- Blank page fix: `AdminLayout` içinde eksik `scoresView === "details"` render branch’i eklendi.
- Field-name mismatch fix: `getScores` alan adları `filterPipeline` + `ReviewsPage` beklentisiyle hizalandı.

---

### Phase 7 — Manage Pages (Jurors, Projects, Periods) ✅

**Prototype kaynağı:** Jurors ~13492-14001, Projects ~14001-14294, Periods ~14294-14519

**Silinecek:**
- `src/admin/ManageJurorsPanel.jsx`, `src/admin/jurors/JurorsTable.jsx`
- `src/admin/ManageProjectsPanel.jsx`, `src/admin/projects/*.jsx`
- `src/admin/ManageSemesterPanel.jsx`
- `src/admin/pages/JurorsPage.jsx`, `ProjectsPage.jsx`, `PeriodsPage.jsx`

**Yazılacak:**
- `src/admin/JurorsPage.jsx` — Header, KPI strip, toolbar (search + filter + export + import + add), filter panel, jurors table
- `src/admin/ProjectsPage.jsx` — Header, KPI strip, toolbar, projects table
- `src/admin/PeriodsPage.jsx` — Header, periods list, locked semester banner
- `src/styles/pages/jurors.css`, `projects.css`, `periods.css`

**Hook bağlantıları:** `useManageJurors`, `useManageProjects`, `useManageSemesters`

---

### Phase 8 — Configuration Pages (Criteria, Outcomes) ✅

**Prototype kaynağı:** Criteria ~14519-14718, Outcomes ~14718-14797

**Silinecek:**
- `src/admin/criteria/CriteriaManager.jsx`, `CriterionEditor.jsx`, `RubricBandEditor.jsx`, `MudekPillSelector.jsx`, vb.
- `src/admin/CriteriaManager.jsx`
- `src/admin/pages/CriteriaPage.jsx`, `OutcomesPage.jsx`

**Yazılacak:**
- `src/admin/CriteriaPage.jsx` — Info banner, criteria list, criterion cards
- `src/admin/OutcomesPage.jsx` — Framework selector, outcome mapping table, coverage matrix
- `src/styles/pages/criteria.css`, `outcomes.css`

**Hook bağlantıları:** `useCriteriaForm`, criteria helpers

**⚠️ DB Migration Etkisi (2026-04-03):**

DB migration ile kriter/outcome yapısı kökten değişti. Eski `periods.criteria_config` JSONB
yapısı kaldırıldı, yerine normalize tablolar geldi:

| Eski Yapı | Yeni Yapı |
|-----------|-----------|
| `periods.criteria_config` JSONB | `framework_criteria` → `period_criteria` (snapshot) |
| `periods.outcome_config` JSONB | `framework_outcomes` → `period_outcomes` (snapshot) |
| Flat criterion-outcome mapping | `framework_criterion_outcome_maps` → `period_criterion_outcome_maps` |

Bu phase'de ek olarak yapılması gerekenler:

- `framework_criteria` CRUD API hook'u (admin seviyesinde kriter ekleme/düzenleme/silme)
- `framework_outcomes` CRUD API hook'u
- `framework_criterion_outcome_maps` CRUD API hook'u (kriter-outcome eşleme)
- Snapshot mekanizması UI'ı: framework düzenlendiğinde `rpc_period_freeze_snapshot` tetikleme veya uyarı gösterme
- `period_criteria` read-only görüntüleme (snapshot alındıktan sonra period kriterleri değiştirilemez)
- Mevcut `listPeriodCriteria` API fonksiyonu kullanılabilir ama framework-level CRUD yeni yazılmalı
- `useCriteriaForm` hook'u framework tablolarıyla konuşacak şekilde güncellenmeli veya yeniden yazılmalı

Referans migration dosyaları: `003_frameworks.sql`, `005_snapshots.sql`

---

### Phase 9 — System Pages (Entry Control, PIN Blocking, Audit Log, Settings, Export) ✅

**Prototype kaynağı:** Entry Control ~14797-15050, PIN ~15050-15159, Audit ~15159-15621, Export ~15621-15647, Settings ~15647-16066

**Tamamlanma tarihi:** 2026-04-03

**Silinen dosyalar:**
- `src/admin/pages/EntryControlPage.jsx`, `AuditLogPage.jsx`, `ExportPage.jsx`, `OrgSettingsPage.jsx`
- `src/admin/settings/PinResetDialog.jsx`, `AuditLogCard.jsx`, `ExportBackupPanel.jsx`

**Yazılan dosyalar:**
- `src/admin/EntryControlPage.jsx` — KPI strip, token table (active/revoked/expired badges), QR display, revoke action
- `src/admin/PinBlockingPage.jsx` — Lock policy alert, KPI strip, active lockouts table, policy snapshot
- `src/admin/AuditLogPage.jsx` — Search + filters (type, date range), paginated activity log, event detail panel, CSV export
- `src/admin/SettingsPage.jsx` — Dual-mode: org-admin (profile/security/org-access/danger zone) + super-admin control center (KPI strip, org table, pending approvals, cross-org memberships, platform danger zone)
- `src/admin/ExportPage.jsx` — Export format cards (Scores XLSX, Jurors XLSX, Full JSON backup)

**AdminLayout wiring:**
- `src/admin/layout/AdminLayout.jsx` — 5 yeni import + render branch: `entry-control`, `pin-lock`, `audit-log`, `settings`, `export`

**Hook bağlantıları:**
- `AuditLogPage` → `useAuditLogFilters(organizationId)`
- `SettingsPage` → `useProfileEdit()` + `useManageOrganizations({ enabled: isSuper })`
- `EntryControlPage` → `listEntryTokens`, `createEntryToken`, `revokeEntryToken`
- `ExportPage` → `exportXLSX`, `fullExport`, `listPeriods`, `listJurorsSummary`, `getScores`, `getProjectSummary`

**Tasarım notu:** `SettingsPage` içindeki `ProfileEditModal` self-contained (`createPortal` + `crud-modal` vera.css sınıfları). `UserAvatarMenu` zaten kendi instance'ını kullanıyor; shared state yerine izole instance tercih edildi.

**Implementation raporu:** [phase-9-implementation-summary.md](implementation_reports/phase-9-implementation-summary.md)

**⚠️ DB Migration Etkisi (2026-04-03):**

Entry tokens ve PIN blocking alanları değişti:

- **Entry Control:** Token'lar artık `token_hash` (SHA-256) ile saklanıyor (`009_security_hash_tokens.sql`). `last_used_at` alanı eklendi. 24h TTL + revoke mekanizması var (`023_entry_token_security.sql`). Token tablosu `last_used_at`, `expires_at`, `revoked_at` göstermeli.
- **PIN Blocking:** `juror_period_auth` tablosuna `locked_at`, `session_expires_at`, `edit_reason`, `edit_expires_at` alanları eklendi. Lockout tablosu bu yeni alanları göstermeli.
- **Audit Log:** Audit trigger'ları `score_sheets` mutasyonlarını izliyor (eski `scores` değil). `audit_logs` tablosu yapısı aynı ama event tipleri genişledi (`snapshot_frozen`, `score_submitted` vb.).
- Mevcut admin API fonksiyonları (`adminApi.js`) zaten yeni şemaya uygun — ek API değişikliği gerekmez, sadece JSX yeni alanları render etmeli.

Referans migration dosyaları: `007_auth_and_tokens.sql`, `008_audit_and_rls.sql`, `009_security_hash_tokens.sql`

---

### Phase 10 — Drawers + Modals

**Prototype kaynağı:** ~22545-26700 (drawer'lar + modal'lar)

**Silinecek:**
- `src/shared/ConfirmDialog.jsx` (yeniden yazılacak)

**Yazılacak:**
- `src/shared/Drawer.jsx` — Generic `.fs-drawer` wrapper
- `src/shared/Modal.jsx` — Generic `.fs-modal-wrap` wrapper
- Drawer içerikleri: Her CRUD formu prototype'dan birebir
  - `src/admin/drawers/AddProjectDrawer.jsx`, `EditProjectDrawer.jsx`, `AddJurorDrawer.jsx`, `EditJurorDrawer.jsx`, `AddSemesterDrawer.jsx`, `EditSemesterDrawer.jsx`, `EditCriteriaDrawer.jsx`, `AddOutcomeDrawer.jsx`, `EditProfileDrawer.jsx`, `ChangePasswordDrawer.jsx`, vb.
- Modal içerikleri: Confirmation dialog'lar
  - `src/shared/ConfirmModal.jsx` — Generic confirm
  - Sayfa bazlı modal'lar gerekirse ayrı dosya
- `src/styles/drawers.css`, `src/styles/modals.css`

**⚠️ DB Migration Etkisi (2026-04-03):**

Criteria/Outcome CRUD drawer'ları artık `framework_criteria` ve `framework_outcomes` tablolarıyla konuşmalı (eski `criteria_config` JSONB değil):

- `EditCriteriaDrawer` → `framework_criteria` CRUD (key, label, short_label, max_score, weight, color, rubric_bands JSONB, sort_order)
- `AddOutcomeDrawer` → `framework_outcomes` CRUD
- Criterion-outcome mapping drawer → `framework_criterion_outcome_maps` CRUD
- Period CRUD drawer'ları → `framework_id` seçimi eklenmeli (her period bir framework'e bağlı)
- Juror drawer'larında değişiklik yok (jurors tablosu sadece `avatar_color`, `updated_at` eklendi)

---

### Phase 11 — Landing Page ✅

**Prototype kaynağı:** ~10541-11159

**Tamamlanma tarihi:** 2026-04-03

**Sıfırdan yazılan dosyalar:**
- `src/pages/LandingPage.jsx` — 15 section: nav, hero, trust band, how-it-works, features, before/after, mobile mockups, use cases, comparison table, testimonial, trust badges, FAQ accordion, admin gallery, footer
- `src/styles/landing.css` — ~1130 lines, full landing CSS from prototype
- `src/components/home/AdminShowcaseCarousel.jsx` — Rewritten to `.product-showcase` class structure (sliding track, prev/next, counter/caption)

**Wiring notları:**
- `useTheme()` for dark/light toggle (CSS-only icon visibility)
- `IntersectionObserver` scroll-reveal on `.reveal-section` + `.landing-steps` (threshold 0.15)
- FAQ accordion via `useState` array, `.faq-item.open` CSS class
- `isDemoMode` prop removed — not used in new implementation
- Props: `{ onStartJury, onAdmin, onSignIn }`

**Implementation raporu:** [phase-11-implementation-summary.md](implementation_reports/phase-11-implementation-summary.md)

---

### Phase 12 — Auth Screens

**Prototype kaynağı:** Login/auth CSS + HTML

**Silinecek:**
- `src/components/auth/LoginForm.jsx`
- `src/components/auth/RegisterForm.jsx`
- `src/components/auth/ForgotPasswordForm.jsx`
- `src/components/auth/ResetPasswordCreateForm.jsx`
- `src/components/auth/CompleteProfileForm.jsx`
- `src/admin/components/PendingReviewGate.jsx`

**Yazılacak:**
- `src/auth/LoginScreen.jsx` — Glassmorphic card, email/password, Google SSO, remember me
- `src/auth/RegisterScreen.jsx` — Application form, org search
- `src/auth/ForgotPasswordScreen.jsx`
- `src/auth/ResetPasswordScreen.jsx`
- `src/auth/CompleteProfileScreen.jsx`
- `src/auth/PendingReviewScreen.jsx`
- `src/styles/auth.css`

**Hook bağlantıları:** `useAuth` (korunuyor)

**Durum:** ✅ Tamamlandı (2026-04-03)

**Implementation raporu:** [phase-12-implementation-summary.md](implementation_reports/phase-12-implementation-summary.md)

---

### Phase 13 — Jury Flow

**Prototype kaynağı:** ~16351-16700 (jury step'ler)

**Silinecek:**
- `src/JuryForm.jsx`
- `src/jury/JuryGatePage.jsx`
- `src/jury/InfoStep.jsx`
- `src/jury/PinStep.jsx`
- `src/jury/PinRevealStep.jsx`
- `src/jury/SheetsProgressDialog.jsx`
- `src/jury/EvalStep.jsx`, `EvalHeader.jsx`, `GroupStatusPanel.jsx`, `ScoringGrid.jsx`
- `src/jury/DoneStep.jsx`
- `src/jury/QRShowcaseStep.jsx` (varsa)

**Yazılacak:**
- `src/jury/JuryGatePage.jsx` — Token gate ekranı
- `src/jury/JuryFlow.jsx` — Step router (eski JuryForm yerine)
- `src/jury/steps/IdentityStep.jsx`
- `src/jury/steps/PinStep.jsx`
- `src/jury/steps/PinRevealStep.jsx`
- `src/jury/steps/LockedStep.jsx`
- `src/jury/steps/SemesterStep.jsx`
- `src/jury/steps/ProgressStep.jsx`
- `src/jury/steps/EvalStep.jsx` — Scoring grid, project nav, autosave indicator
- `src/jury/steps/DoneStep.jsx` — Confetti + thank you
- `src/styles/jury.css`

**Hook bağlantıları:** `useJuryState` + tüm sub-hook'lar (korunuyor)

**⚠️ DB Migration Etkisi (2026-04-03):**

`useJuryState` hook'ları zaten DB migration Faz 5+7'de güncellendi. JSX yeniden yazılırken dikkat edilmesi gerekenler:

- **Dinamik criteria rendering:** EvalStep artık `config.js` hardcoded CRITERIA yerine hook'tan gelen `criteriaConfig` state'ini kullanmalı. Label, maxScore, rubric band bilgileri DB'den geliyor.
- `criteriaConfig` → `useJuryState` üzerinden EvalStep'e aktarılmalı (zaten hook output'unda mevcut)
- Scoring grid, criteria label'larını ve max değerleri dinamik olarak render etmeli
- Snapshot yoksa config.js fallback'i otomatik çalışır (hook seviyesinde handle ediliyor)

---

### Phase 14 — App Shell + Routing

**Yazılacak (son):**
- `src/App.jsx` — Clean route switch (landing, auth, admin, jury)
- `src/main.jsx` — ThemeProvider, AuthProvider, CSS import
- `src/AdminPanel.jsx` — Tab router → page component'ları
- `src/admin/ScoresTab.jsx` — Rankings/Analytics/Heatmap/Reviews view switch

---

### Phase 15 — Charts

Chart component'ları Phase 4 (Analytics) ve Phase 2 (Overview) ile birlikte yazılacak ama burada listeliyorum:

**Yazılacak:**
- `src/charts/SubmissionTimelineChart.jsx` — Overview: Zaman bazlı aktivite (Chart.js line)
- `src/charts/ScoreDistributionChart.jsx` — Overview: Histogram (Chart.js bar)
- `src/charts/AttainmentRateChart.jsx` — Analytics: Horizontal bar + threshold
- `src/charts/ThresholdGapChart.jsx` — Analytics: Diverging lollipop (custom SVG)
- `src/charts/OutcomeByGroupChart.jsx` — Analytics: Grouped bar
- `src/charts/OutcomeOverviewChart.jsx` — Analytics: Overview chart
- `src/charts/CompetencyRadarChart.jsx` — Analytics: Radar
- `src/charts/OutcomeTrendChart.jsx` — Analytics: Multi-line trend
- `src/charts/JurorConsistencyHeatmap.jsx` — Analytics: Heatmap
- `src/charts/GroupAttainmentHeatmap.jsx` — Analytics: Group-level heatmap
- `src/charts/chartUtils.js` — Shared helpers
- `src/styles/charts.css`

---

### Phase 16 — CSS Refactor

**Amaç:** `src/styles/vera.css` (10K+ satır) sıfır satıra indirilecek. Her CSS kuralı kendi dosyasına taşınacak.

**Ön koşul:** Phase 14 tamamlanmış olmalı (tüm UI stabil).

**Adımlar:**

1. `vera.css`'i bölümlere göre oku, her kural setini ilgili dosyaya taşı:
   - `variables.css` — `:root` + `.dark-mode` token'ları
   - `base.css` — reset, typography, utilities
   - `layout.css` — `.admin-shell`, sidebar, header
   - `components.css` — `.card`, `.btn-*`, `.badge`, `.dropdown-*`, forms
   - `src/styles/pages/*.css` — her sayfa kendi CSS'ini alır
   - `jury.css`, `landing.css`, `auth.css`, `drawers.css`, `modals.css`, `charts.css`
2. `vera.css` boşaltılır, son satırda `/* vera.css emptied — Phase 16 */` bırakılır ya da dosya silinir
3. `main.css` import sırası kontrol edilir
4. `npm run build` — hatasız geçmeli

## Execution Sırası

```text
Phase 0  ✅ CSS extraction + cleanup (temel altyapı)
Phase 1  ✅ Admin shell (sidebar, header, layout)
Phase 2  ✅ Overview (ilk görüntülenen sayfa)
Phase 3  ✅ Rankings
Phase 4  ✅ Analytics (en büyük gap)
Phase 5  ✅ Heatmap
Phase 6  ✅ Reviews Page
Phase 7  ✅ Manage pages (Jurors, Projects, Periods)
Phase 8  ✅ Configuration pages (Criteria, Outcomes)
Phase 9  ✅ System pages (Entry Control, PIN, Audit, Settings, Export)
Phase 10 ✅ Drawers + Modals
Phase 11 ✅ Landing page
Phase 12 ✅ Auth screens
Phase 13 ✅ Jury flow
Phase 14 → App shell + routing (final wiring)
Phase 15 → Charts (Phase 2 + 4 ile paralel yazılabilir)
Phase 16 → CSS Refactor (vera.css → ayrı dosyalara bölme)
```

## Doğrulama

Her phase sonunda:
1. `npm run dev` — Sayfa hatasız yüklenir
2. Prototype HTML'i browser'da aç, yan yana karşılaştır
3. Dark mode + light mode kontrol
4. Mobile responsive kontrol
5. Hook'lar çalışır (data yüklenir, interaction çalışır)

Final doğrulama:
- `npm run build` — Production build başarılı
- `npm test -- --run` — Mevcut testler (güncellenmesi gerekecek)
- Her sayfa prototype ile birebir eşleşir

## Response Format (ZORUNLU)

## Yapılanlar
- ✅ Tamamlanan işler
- ⚠️ Kısmen tamamlanan / dikkat gerekenler
- ⏳ Sonraki phase’e kalanlar

## Dosya Değişiklikleri
- Silinen dosyalar
- Eklenen dosyalar
- Sıfırdan yazılan dosyalar
- Güncellenen dosyalar

## Parity Notları
- Prototype ile birebirlik açısından kritik noktalar

## Parity Tracker Güncellemesi
| Screen | Prototype Range | Target React File | Status | Parity | Notes |

## Logic / Wiring Notları
- Minimal değişiklikler (varsa)
- Hook/API/selector contract değişikliği olup olmadığı

## Implementation Report
- `docs/superpowers/plans/ui-migration/implementation_reports/phase-X-implementation-summary.md`
- Bu phase'in detaylı uygulama raporu buraya kaydedilecek
- Parity tracker `Notes` alanında bu rapora link verilecek

## Sonraki Adım
- Sadece sıradaki phase

---

## Parity Tracker

Bu tablo her phase sonunda güncellenir. `Notes` alanında ilgili implementation rapor dosyasına referans verilir.

**Status:** ✅ Tamamlandı | ⚠️ Kısmen tamamlandı / dikkat gerekiyor | ⏳ Başlanmadı
**Parity:** Full | Partial | Missing

| Screen | Prototype Range | Target React File | Status | Parity | Notes |
| ------ | --------------- | ----------------- | ------ | ------ | ----- |
| CSS Layer | style blocks | src/styles/*.css | ✅ | Full | [Phase 0 Report](implementation_reports/phase-0-implementation-summary.md) |
| Admin Shell | 11580-11710 | src/admin/layout/*.jsx | ✅ | Full | [Phase 1 Report](implementation_reports/phase-1-implementation-summary.md) |
| Overview | 11759-11982 | src/admin/OverviewPage.jsx | ✅ | Full | [Phase 2 Report](implementation_reports/phase-2-implementation-summary.md) |
| Rankings | 11985-12200 | src/admin/RankingsPage.jsx | ✅ | Full | [Phase 3 Report](implementation_reports/phase-3-implementation-summary.md) |
| Analytics | 12200-13199 | src/admin/AnalyticsPage.jsx | ✅ | Full | [Phase 4 Report](implementation_reports/phase-4-implementation-summary.md) |
| Heatmap | 13199-13288 | src/admin/HeatmapPage.jsx | ✅ | Full | [Phase 5 Report](implementation_reports/phase-5-implementation-summary.md) |
| Reviews | 13291-13490 | src/admin/ReviewsPage.jsx | ✅ | Full | [Phase 6 Report](implementation_reports/phase-6-implementation-summary.md) |
| Jurors | 13492-14001 | src/admin/pages/JurorsPage.jsx | ✅ | Full | [Phase 7 Report](implementation_reports/phase-7-implementation-summary.md) |
| Projects | 14001-14294 | src/admin/pages/ProjectsPage.jsx | ✅ | Full | [Phase 7 Report](implementation_reports/phase-7-implementation-summary.md) |
| Periods | 14294-14519 | src/admin/pages/PeriodsPage.jsx | ✅ | Full | [Phase 7 Report](implementation_reports/phase-7-implementation-summary.md) |
| Criteria | 14519-14718 | src/admin/pages/CriteriaPage.jsx | ✅ | Full | [Phase 8 Report](implementation_reports/phase-8-implementation-summary.md) |
| Outcomes | 14718-14797 | src/admin/pages/OutcomesPage.jsx | ✅ | Full | [Phase 8 Report](implementation_reports/phase-8-implementation-summary.md) |
| Entry Control | 14797-15050 | src/admin/EntryControlPage.jsx | ✅ | Full | [Phase 9 Report](implementation_reports/phase-9-implementation-summary.md) |
| PIN Blocking | 15050-15159 | src/admin/PinBlockingPage.jsx | ✅ | Full | [Phase 9 Report](implementation_reports/phase-9-implementation-summary.md) |
| Audit Log | 15159-15621 | src/admin/AuditLogPage.jsx | ✅ | Full | [Phase 9 Report](implementation_reports/phase-9-implementation-summary.md) |
| Export | 15621-15647 | src/admin/ExportPage.jsx | ✅ | Full | [Phase 9 Report](implementation_reports/phase-9-implementation-summary.md) |
| Settings | 15647-16066 | src/admin/SettingsPage.jsx | ✅ | Full | [Phase 9 Report](implementation_reports/phase-9-implementation-summary.md) |
| Drawers | 22545-26560 | src/admin/drawers/*.jsx | ✅ | Full | [Phase 10 Report](implementation_reports/phase-10-implementation-summary.md) |
| Modals | 24252-26700 | src/admin/modals/*.jsx + src/shared/ConfirmModal.jsx | ✅ | Full | [Phase 10 Report](implementation_reports/phase-10-implementation-summary.md) |
| Landing | 10541-11159 | src/pages/LandingPage.jsx | ✅ | Full | [Phase 11 Report](implementation_reports/phase-11-implementation-summary.md) |
| Auth Screens | CSS+HTML | src/auth/*.jsx | ✅ | Full | [Phase 12 Report](implementation_reports/phase-12-implementation-summary.md) |
| Jury Flow | 16351-17148 | src/jury/steps/*.jsx | ✅ | Full | [Phase 13 Report](implementation_reports/phase-13-implementation-summary.md) |
| App Shell | — | src/App.jsx, AdminPanel.jsx | ⏳ | Missing | Phase 14 |
| Charts Polish | — | src/charts/*.jsx | ⏳ | Missing | Phase 15 |
| CSS Refactor | — | src/styles/*.css | ⏳ | Missing | Phase 16 |
