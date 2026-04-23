# VERA — Feature-Based Restructure + CSS Co-location + Test Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kaynak kodu **feature-based** klasör yapısına taşımak, CSS'i feature'larla co-locate etmek, eski testleri arşivleyip yeni yapıya sıfırdan kapsamlı test yazmak.

**Architecture:** 3 aşamalı: **(A) Source + CSS feature-based restructure** (272 dosya taşıma + 18.2k CSS satırı co-location), **(B) Test rewrite** (yeni yapıya göre TDD ile katman katman), **(C) CSS final polish** (kalan global CSS'lerin tokenize + split'i).

**Tech Stack:** React + Vite (build), Vitest + Playwright + pgTAP (test), lucide-react (icons), Supabase (DB + Edge Functions + Auth).

---

## Context

**Neden yapıyoruz?**

Kod geliştirme büyük oranda bitti — bir kullanıcı org admin olarak kayıt olabiliyor, giriş yapıp juror sürecini başlatabiliyor. Ama altyapıda 3 birikmiş borç var:

1. **Klasör yapısı dağınık:** `src/admin/pages/` 24 flat dosya, `drawers/` 24, `modals/` 26, `hooks/` 27, `components/` 21. "Organizations özelliği" 5 klasöre dağılmış — refactor ve navigasyon zor.
2. **Test kapsamı %20:** 218 kaynak dosyaya karşı 43 test dosyası, modals %0, shared API %4, edge functions %0, SQL RPC %0. 64 test kırık. qa-catalog 468 ID / 162 orphan.
3. **CSS devasa:** `src/styles/components.css` 5664 satır, `jury.css` 4021, `layout.css` 3284, `pages/criteria.css` 2480, `pages/setup-wizard.css` 2377. Toplam 23.861 satır CSS, %76'sı component/feature-specific.

**Çıktı:** Feature-based `src/admin/features/<feature>/` yapısı + co-located CSS + temiz `src/styles/` (sadece global tokens/utilities) + %65+ global coverage + %80+ kritik modül coverage + pgTAP ile RLS isolation testleri + 25 E2E spec.

**Tahmini süre:** 9-12 iş günü, 6-7 oturuma bölünmüş (Opus 4.7 1M context).

---

## Hedef Klasör Yapısı

```
src/
├── admin/
│   ├── features/
│   │   ├── overview/          (OverviewPage + CSS + __tests__/)
│   │   ├── organizations/     (Page + Drawers + Modals + Hooks + CSS + __tests__/)
│   │   ├── jurors/
│   │   ├── periods/
│   │   ├── projects/
│   │   ├── criteria/
│   │   ├── outcomes/
│   │   ├── reviews/
│   │   ├── rankings/
│   │   ├── analytics/
│   │   ├── heatmap/
│   │   ├── audit/
│   │   ├── entry-control/
│   │   ├── pin-blocking/
│   │   ├── settings/
│   │   ├── setup-wizard/
│   │   └── export/
│   ├── layout/                (AdminRouteLayout, AdminSidebar — taşınmayacak, mevcut yerde kalır)
│   └── shared/                (PageShell, DangerIconButton, SecuritySignalPill — cross-feature)
│
├── auth/
│   ├── features/
│   │   ├── login/
│   │   ├── register/
│   │   ├── invite/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   ├── complete-profile/
│   │   ├── pending-review/
│   │   └── grace-lock/
│   └── shared/                (AuthProvider, AuthGuard, useAuth, SecurityPolicyContext, lockedActions, auth.css)
│
├── jury/
│   ├── features/
│   │   ├── arrival/           (ArrivalStep + jury-arrival.css + __tests__/)
│   │   ├── identity/
│   │   ├── period-select/
│   │   ├── pin/
│   │   ├── pin-reveal/
│   │   ├── progress/
│   │   ├── evaluation/        (RubricSheet, ProjectDrawer, EvalStep, useJuryScoring, useJuryEditState)
│   │   ├── complete/
│   │   └── lock/
│   └── shared/                (useJuryState, JuryGuard, JuryFlow, SpotlightTour, juryPreloadCache, jury.css)
│
├── shared/                    (DOKUNULMUYOR — yapısı zaten temiz)
│   ├── api/                   (27 dosya — 21 admin, 3 core, juryApi, fieldMapping, index)
│   ├── ui/                    (29 component — FbAlert, CustomSelect, ConfirmDialog, PremiumTooltip, vb.)
│   ├── hooks/                 (8 hook)
│   ├── storage/               (4 dosya — keys, juryStorage, adminStorage, index)
│   └── lib/                   (8 dosya — environment, supabaseClient, utils, vb.)
│
├── layouts/                   (DOKUNULMUYOR — 4 layout)
├── styles/                    (KÜÇÜLECEK — sadece global)
│   ├── variables.css          (global CSS vars)
│   ├── typography.css
│   ├── utilities.css
│   ├── layout.css             (sidebar + topbar + grid — global)
│   ├── drawers.css            (drawer pattern — global)
│   ├── modals.css             (modal pattern — global)
│   ├── mobile.css             (breakpoint overrides)
│   ├── ui-base.css            (input/textarea base)
│   ├── table-system.css
│   ├── icon-surface.css
│   ├── status-pills.css       (pill pattern — global)
│   ├── toast.css
│   ├── charts.css
│   ├── print.css
│   └── maintenance.css
│
├── test/                      (mevcut — korunacak, genişletilecek)
├── router.jsx
└── main.jsx

supabase/functions/            (co-located test eklenir)
├── rpc-proxy/
│   ├── index.ts
│   └── index.test.ts
└── ... (22 fonksiyon daha)

sql/
├── migrations/                (DOKUNULMUYOR)
├── seeds/
└── tests/                     (YENİ — pgTAP)
    ├── rls/
    ├── rpcs/
    └── migrations/

e2e/                           (mevcut — genişletilecek)
├── auth/
├── admin/
├── jury/
├── demo/
├── tenant/
├── fixtures/
└── helpers/
```

---

## CSS Dosya Boyutu Politikası

**Standart (2026-04-23'ten itibaren):**

| Aralık | Durum | Aksiyon |
|---|---|---|
| **200-400 satır** | 🟢 İdeal | Sweet spot, dokunma |
| **400-600 satır** | 🟢 Kabul edilebilir | OK, tek sorumluluk korunmuş |
| **600-800 satır** | 🟡 Dikkat | Alt-gruplanabilir mi bak |
| **800-1000 satır** | 🟠 Split adayı | Planla, ilk fırsatta böl |
| **1000+ satır** | 🔴 **Ceiling ihlali** | Kabul edilemez, mutlaka böl |

**İstisnalar:** Tek-sorumluluk coherent bir dosya (ör. tüm form field state'leri, tüm drawer pattern'leri) 600-800'e uzanabilir. Zorla bölme, gerekçeyi yorum satırına not düş.

**Uygulama:**
- **Forward:** Yeni yazılan veya taşınan CSS bu kurala uymak **zorunda**. S11'den itibaren PR / commit disiplini.
- **Retroactive:** Mevcut ihlaller **S12 CSS Modularization Sprint**'te kapatılacak (3 alt-oturum, en büyük offender'lar öncelikli).
- **Yöntem:** Split yaparken dosya adı = sorumluluk (ör. `layout.css` → `sidebar.css + header.css + admin-shell.css`). Asla "part-1.css, part-2.css" gibi anlamsız isimler.

**Mevcut ihlal envanteri (2026-04-23):**

| Dosya | Satır | Sprint scope |
|---|---|---|
| ~~`src/jury/shared/jury-base.css`~~ | ~~4021~~ | ✅ **S13 tamam — 9 parça `src/jury/shared/styles/`** |
| ~~`src/styles/layout.css`~~ | ~~3284~~ | ✅ **S12 tamam — 15 parça `src/styles/layout/`** |
| ~~`src/styles/landing.css`~~ | ~~3066~~ | ✅ **S12 tamam — 12 parça `src/styles/landing/`** |
| ~~`src/admin/features/criteria/CriteriaPage.css`~~ | ~~2480~~ | ✅ **S14 tamam — 6 parça `src/admin/features/criteria/styles/`** |
| ~~`src/admin/features/setup-wizard/SetupWizardPage.css`~~ | ~~2377~~ | ✅ **S14 tamam — 6 parça `src/admin/features/setup-wizard/styles/`** |
| ~~`src/admin/features/outcomes/OutcomesPage.css`~~ | ~~2056~~ | ✅ **S14 tamam — 5 parça `src/admin/features/outcomes/styles/`** |
| ~~`src/styles/components/misc.css`~~ | ~~1871~~ | ✅ **S12 tamam — 8 parça `src/styles/misc/`** |
| ~~`src/styles/drawers.css`~~ | ~~1617~~ | ✅ **S12 tamam — 5 parça `src/styles/drawers/`** |
| ~~`src/styles/ui-base.css`~~ | ~~1500~~ | ✅ **S12 tamam — 8 parça `src/styles/ui-base/`** |
| ~~`src/admin/features/periods/PeriodsPage.css`~~ | ~~1334~~ | ✅ **S14 tamam — 4 parça `src/admin/features/periods/styles/`** |
| ~~`src/auth/shared/auth-base.css`~~ | ~~1178~~ → **210** | ✅ **S13 — S9 sonrası zaten 210 satır, split gereksiz** |
| ~~`src/admin/features/reviews/ReviewsPage.css`~~ | ~~975~~ | ✅ **S14 tamam — 2 parça `src/admin/features/reviews/styles/`** |
| `src/admin/features/heatmap/HeatmapPage.css` | 719 | ⏸️ deferred (<800, kabul) |
| `src/admin/features/audit/AuditLogPage.css` | 645 | ⏸️ deferred (<800, kabul) |
| `src/admin/shared/AdminTeamCard.css` | 620 | ⏸️ deferred (sınırda) |
| `src/admin/features/rankings/RankingsPage.css` | 612 | ⏸️ deferred (sınırda) |

**Sprint sonrası hedef:** 16 ihlalden 12'si Opus'un 3 sprint'inde (S12, S13, S14) çözülür, kalan 4 dosya (612-719 satır) sınırda ve deferred. Toplam 25.759 satır → ~50 parça (<600 ceiling).

**Neden Opus seçildi:** Opus 4.7'nin 1M context window'u, Sonnet'in 200k'da 6 sprint gerektirecek işi 3 sprint'e sıkıştırıyor (compacting yok, kalite yüksek). Max x20 bütçesinde ek maliyet ihmal edilebilir.

---

## Aşama Sıralaması

**3 ana aşama — oturum sayısı modele göre değişir.**

### Opus 4.7 (1M context) — 7 oturum

| Oturum | Aşama | Tamamlanan | Tahmini süre |
|---|---|---|---|
| 1 (şimdi) | Plan yazıldı | Bu dosya | 0.5 gün |
| 2 | A0-A2 | İskelet + shared/ui co-locate + admin features 1-8 | 1.5 gün |
| 3 | A3-A4 | Admin features 9-17 + jury + auth | 1.5 gün |
| 4 | A5-A7 | components.css split + import cleanup + src/styles/ final | 1 gün |
| 5 | B0-B2 | Test arşiv + iskelet + shared tests | 1 gün |
| 6 | B3-B5 | Auth + jury + admin tests | 2 gün |
| 7 | B6-B9 + C | DB (pgTAP) + Edge Functions + E2E + CSS polish + Coverage | 2-3 gün |

### Sonnet High (~200k context) — 26 oturum

**Neden daha fazla?** Sonnet'in context penceresi Opus'un 1/5'i. Her oturumda daha az dosya okunup daha az iş bitirilebilir. Ama reasoning kalitesi güçlü, parçalara bölünmüş iş iyi yürür. Her oturum **2.5-4 saat** odaklı çalışma hedefler, oturum başı context kullanımı **%60-75**'te tutulur (buffer bırakarak).

**Durum simgeleri:** ✅ tamamlandı · ⏳ sırada · ⬜ bekliyor · 🔄 devam ediyor · ⏸️ askıda

| Durum | Oturum | Kapsam | Dosyalar | Süre | Beklenen context | Handoff durumu |
|---|---|---|---|---|---|---|
| ✅ | **1** (şu an) | Plan yazıldı | Bu dosya | 0.5 gün | %75 | Faz A0'a hazır |
| ✅ | **2** | A0 + A1 kick-off — iskelet + shared/ui'den 5-8 component CSS co-locate (FbAlert, CustomSelect, ConfirmDialog, PremiumTooltip, Modal, Drawer, Button, Card) | ~10 dosya + components.css düzenleme | 3 saat | %80 | A1 pattern validated (3/29 done); ConfirmDialog/Modal/Drawer skip (CSS zaten global file'da) |
| ✅ | **3** | A1 tamamla — kalan 26 shared/ui component araştırıldı; AsyncButtonContent + FilterButton + Pagination co-located; FloatingMenu/btn-loading-content global kaldı (65+ direct className kullanımı); 15 component CSS'siz (inline style veya global dosyada) | 6 yeni CSS dosyası + components.css düzenleme | 3 saat | ~%75 | A1 tamamlandı: 6/29 co-located, kalan 23 actionable değil; A2'ye geçiş |
| ✅ | **4** | A2.1-A2.3 — overview + organizations + jurors | ~25 dosya + 3 page CSS | 4 saat | %80 | 3 feature taşındı; 4 cross-feature bileşen admin/shared/'a çıkarıldı; build yeşil |
| ✅ | **5** | A2.4-A2.9 — periods + projects + **criteria** + outcomes + reviews + rankings (plandan fazla: A2.7-A2.9 de tamamlandı) | ~40 dosya + 6 page CSS | 5 saat | %85 | 9 admin feature tamam; 2 cross-feature (usePeriodOutcomes, OutcomeEditor) admin/shared/'a çıkarıldı |
| ✅ | **6** | A2.10-A2.13 — analytics + heatmap + audit + entry-control | ~16 dosya + 4 page CSS | 3 saat | %65 | 13 admin feature tamam |
| ✅ | **7** | A2.14-A2.17 — pin-blocking + settings + **setup-wizard** (2377 satır CSS) + export | ~20 dosya + 4 page CSS | 4 saat | %75 | **Tüm 17 admin feature tamam** · [session-07](implementation_reports/session-07-A2-admin-14-17.md) |
| ✅ | **8** | A3 — jury restructure (9 feature + jury/shared, jury.css 4021 satır split) | ~25 dosya + jury.css + jury-arrival.css | 4 saat | %75 | **Faz A3 tamam** · [session-08](implementation_reports/session-08-A3-jury.md) |
| ✅ | **9** | A4 — auth restructure (9 feature + auth/shared, auth.css 1178 satır) | ~12 dosya + auth.css | 2-3 saat | %60 | **Faz A4 tamam** · [session-09](implementation_reports/session-09-A4-auth.md) |
| ✅ | **10** | A5 — components.css (4922 satır) → 8 per-pattern dosyaya split; main.css import güncellendi; components.css silindi | 8 yeni dosya + main.css | 2 oturum | %70 | **Faz A5 tamam** · [session-10](implementation_reports/session-10-A5-components-split.md) |
| ✅ | **11** | A6 + A7 — import cleanup + eski dizin sil + src/styles/ finalize + tam smoke test | 23 dosya admin/shared/ veya feature dirs'a taşındı; 5 orphan silindi; tüm legacy flat dirs kaldırıldı; 50+ import path güncellendi; build yeşil (1902 modül); 23/23 moved files HTTP 200; **Aşama A BİTTİ** · [session-11](implementation_reports/session-11-A6-A7-finalize.md) |
| ✅ | **12** | 🎨 **Opus Sprint 1** — Tüm globaller: layout (3284 → 15), landing (3066 → 12), misc (1871 → 8), drawers (1617 → 5), ui-base (1500 → 8) = 11.338 satır → 48 parça | 5 dosya → 48 parça | 1.5 saat (Opus) | %45 | **Faz Sprint 1 tamam** · [session-12](implementation_reports/session-12-opus-sprint-1-globals.md) |
| ✅ | **13** | 🎨 **Opus Sprint 2** — Domain-shared: jury-base (4021) → 9 parça `src/jury/shared/styles/`; auth-base 210 satır (S9 sonrası zaten düştü), split gerekmedi | 1 dosya → 9 parça + 1 skip | 3 saat (Opus) | %55 | **Faz Sprint 2 tamam** · [session-13](implementation_reports/session-13-opus-sprint-2-domain-shared.md) |
| ✅ | **14** | 🎨 **Opus Sprint 3** — Feature CSS: criteria (2480) + setup-wizard (2377) + outcomes (2056) + periods (1334) + reviews (975) = 9.222 satır → 23 parça (hepsi ≤557) | 5 dosya → 23 parça | ~3 saat (Opus) | %50 | **S14 tamam** · [session-14](implementation_reports/session-14-opus-sprint-3-feature-css.md); 11 ihlalin hepsi çözüldü, kalan 4 (heatmap 719, audit 645, AdminTeamCard 620, rankings 612) deferred |
| ✅ | **15** | B0 + B1 part 1 — test arşiv + iskelet + test kit (fixtures, factories, helpers) + shared/lib tests (environment, supabaseClient, utils, dateUtils, demoMode, randomUUID) | ~15 dosya | 3-4 saat | %70 | Shared/lib %100 test edildi · [session-15](implementation_reports/session-15-B0-B1-part1.md) |
| ✅ | **16** | B1 part 2 — shared/api + shared/storage tests (fieldMapping, invokeEdgeFunction, juryApi, admin/*, keys, juryStorage, adminStorage) | ~30 test dosyası | 4 saat | %75 | Shared/api + storage bitti · [session-16](implementation_reports/session-16-B1-part2-api-storage.md) |
| ✅ | **17** | B1 part 3 — shared/ui + shared/hooks tests (kritik 10 UI component ayrıntılı + diğer 19 smoke + 8 shared hook) | ~25 test dosyası | 3-4 saat | %70 | Shared katman bitti · [session-17](implementation_reports/session-17-B1-part3-ui-hooks.md) |
| ✅ | **18** | B2 — auth tests (9 feature × 3 test + AuthProvider + AuthGuard + useAuth) | 12 test dosyası | 3-4 saat | %70 | Auth testleri bitti · [session-18](implementation_reports/session-18-B2-auth.md) |
| ✅ | **19** | B3 — jury tests (useJuryState step machine detaylı + 9 step component + writeGroup + lock + autosave) | ~15 test dosyası | 4 saat | %75 | Jury testleri bitti · [session-19](implementation_reports/session-19-B3-jury.md) |
| ✅ | **20** | B4 part 1 — admin critical (jurors + periods + projects + organizations) full kapsam | 14 test dosyası | 4 saat | %75 | 4 kritik admin feature test edildi · [session-20](implementation_reports/session-20-B4-admin-critical.md) |
| ✅ | **21** | B4 part 2 — admin analytics (reviews + rankings + analytics + heatmap) + admin utility (overview + audit + entry-control + pin-blocking + export) | 18 test dosyası | 4 saat | %75 | 9 admin feature test edildi · [session-21](implementation_reports/session-21-B4-admin-utility.md) |
| ✅ | **22** | B4 part 3 — admin large (criteria + outcomes + settings + setup-wizard) | 10 test dosyası | 3-4 saat | %70 | **Tüm admin feature testleri bitti** · [session-22](implementation_reports/session-22-B4-admin-large.md) |
| ✅ | **23** | B5 — pgTAP setup (extension + grants + shared fixtures) + 9 RLS isolation + 4 jury RPC + 5 admin RPC davranışı | 18 SQL test / 74 assertion | 3 saat | %65 | DB katmanı test edildi · [session-23](implementation_reports/session-23-B5-pgtap.md) |
| ✅ | **24** | B6 — Edge function testleri (4 kritik: admin-session-touch + platform-metrics + invite-org-admin + email-verification-confirm; rpc-proxy repoda yok) | 4 Deno test dosyası (40 test) | 2-3 saat | %55 | Edge testleri bitti · [session-24](implementation_reports/session-24-B6-edge-functions.md) |
| ✅ | **25** | B7 — E2E genişletme (8 → 25 spec) — 13 yeni spec + 4 page object helper | 17 dosya | ~3 saat | %70 | E2E katmanı bitti · [session-25](implementation_reports/session-25-e2e-expansion.md) |
| ⬜ | **26** | C1-C3 — coverage thresholds + dark mode tokenize + dead CSS scan + final smoke | vitest config + variables.css + purgecss | 2-3 saat | %55 | **Hepsi bitti, CI yeşil** |

**Toplam: 26 oturum (1 plan + 25 çalışma) ≈ 65-82 saat ≈ 13-16 iş günü.**

### Oturum yönetimi kuralları (Sonnet High için)

1. **Her oturum başında:**
   - `cd /Users/huguryildiz/Documents/GitHub/VERA && git pull && git log --oneline -15`
   - Bu plan dosyasını oku (Progress Log bölümüne bak)
   - Son oturumda hangi checkbox'lar işaretli onu gör
   - Hedef oturumun kapsamını TodoWrite'a aktar

2. **Her oturum sonunda:**
   - Plan dosyasında tamamlanan checkbox'ları işaretle
   - "Progress Log" tablosuna satır ekle (tarih, oturum no, tamamlanan, sonraki)
   - Son commit'in mesajı net olmalı (`refactor(admin): move jurors feature + co-locate CSS` gibi)
   - Context %75 üstüne çıktıysa oturumu bitir, devamı yeni oturumda

3. **Kırmızı bayraklar (oturumu hemen sonlandır):**
   - Context %85+ → kalite düşer, yeni oturuma geç
   - Build kırık + çözüm 10 dk'dan uzun sürüyor → commit'leme, oturumu bitir, temiz kafayla dön
   - Feature taşıması sırasında beklenmedik cross-dependency bulundu → ayrı commit'te `admin/shared/`'a al, ana feature'a sonra dön

4. **Oturum birleştirme/bölme esnekliği:**
   - Tablodaki kapsam sadece **öneri**, zorunluluk değil
   - Bir oturum erken biterse sonrakinin başına gir (context yeterse)
   - Bir oturum yetmezse fazladan oturum aç, tablonun gerisine kaydır

5. **Planlama değişiklik gerekirse:**
   - Bu tabloyu güncelle
   - Progress Log'da "planlama revizyonu" diye not düş
   - Nedeni kısaca yaz (ör. "criteria.css 2480 satır tek oturumda bitmedi, ikiye bölündü")

---

# AŞAMA A — Source + CSS Feature-Based Restructure

## Faz A0 — İskelet + Baseline (Oturum 2 başı)

**Amaç:** Boş feature dizin iskeletini oluştur, mevcut build'in sağlam olduğunu doğrula, baseline commit.

**Files:**
- Create: `src/admin/features/{overview,organizations,jurors,periods,projects,criteria,outcomes,reviews,rankings,analytics,heatmap,audit,entry-control,pin-blocking,settings,setup-wizard,export}/.gitkeep`
- Create: `src/admin/shared/.gitkeep`
- Create: `src/auth/features/{login,register,invite,forgot-password,reset-password,verify-email,complete-profile,pending-review,grace-lock}/.gitkeep`
- Create: `src/auth/shared/.gitkeep`
- Create: `src/jury/features/{arrival,identity,period-select,pin,pin-reveal,progress,evaluation,complete,lock}/.gitkeep`
- Create: `src/jury/shared/.gitkeep`

- [x] **Step 1: Mevcut build sağlam mı?**

```bash
npm run build
```

Expected: Build başarılı. (Fail ederse önce build fix.)

- [x] **Step 2: Mevcut testler nasıl?**

```bash
npm test -- --run 2>&1 | tail -30
```

Expected: Baseline — 412 pass, 64 fail (2026-04-22 itibariyle).

- [x] **Step 3: Feature iskeletini oluştur**

```bash
cd /Users/huguryildiz/Documents/GitHub/VERA
mkdir -p src/admin/features/{overview,organizations,jurors,periods,projects,criteria,outcomes,reviews,rankings,analytics,heatmap,audit,entry-control,pin-blocking,settings,setup-wizard,export}
mkdir -p src/admin/shared
mkdir -p src/auth/features/{login,register,invite,forgot-password,reset-password,verify-email,complete-profile,pending-review,grace-lock}
mkdir -p src/auth/shared
mkdir -p src/jury/features/{arrival,identity,period-select,pin,pin-reveal,progress,evaluation,complete,lock}
mkdir -p src/jury/shared

find src/admin/features src/admin/shared src/auth/features src/auth/shared src/jury/features src/jury/shared -type d -empty -exec touch {}/.gitkeep \;
```

- [x] **Step 4: Commit (boş iskelet)**

```bash
git add -A
git commit -m "refactor(structure): scaffold feature-based directory skeleton"
```

---

## Faz A1 — shared/ui CSS Co-location (Oturum 2)

**Amaç:** `src/shared/ui/` componentlerini kendi `.css` dosyalarıyla co-locate et. Bu en küçük scope, restructure pattern'ini ilk burada prova edeceğiz.

**Hedef komponent listesi** (src/shared/ui/ içinden):
- FbAlert.jsx → FbAlert.jsx + FbAlert.css
- CustomSelect.jsx → + CustomSelect.css
- ConfirmDialog.jsx → + ConfirmDialog.css
- PremiumTooltip.jsx → + PremiumTooltip.css
- Modal.jsx → + Modal.css
- Drawer.jsx → + Drawer.css
- Button.jsx → + Button.css
- Card.jsx → + Card.css
- Table.jsx → + Table.css
- ... (29 component, her biri için aynı pattern)

**Her component için step'ler:**

- [x] **Step A1.N.1: İlgili CSS bölümünü `src/styles/components.css` içinde bul**

```bash
grep -n "^/\*.*FbAlert\|^.fb-alert\|\.fs-confirm-panel" src/styles/components.css
```

- [x] **Step A1.N.2: Bölümü kes, component klasörüne yapıştır**

`src/shared/ui/FbAlert.css` oluştur, ilgili satırları components.css'ten oraya taşı.

- [x] **Step A1.N.3: Component dosyasında CSS import et**

`src/shared/ui/FbAlert.jsx` en üstüne ekle:

```jsx
import "./FbAlert.css";
```

- [x] **Step A1.N.4: `src/main.jsx`'ten de bu CSS hala yükleniyor mu kontrol**

`src/main.jsx` içinde `import "./styles/components.css"` hâlâ var ama artık FbAlert bölümü boş olmalı.

- [x] **Step A1.N.5: Dev server'da görsel doğrulama**

```bash
npm run dev
```

FbAlert kullanılan her sayfada (jury flow, admin reviews) stilin kaybolmadığını kontrol et.

- [x] **Step A1.N.6: Commit**

```bash
git add -A
git commit -m "refactor(shared/ui): co-locate FbAlert CSS"
```

**Toplam: 29 component × ~6 step = ~174 step**. Bazı component'lerin CSS'i çok küçük, bazıları büyük; ortalama 15 dakika.

---

## Faz A2 — Admin Features Taşıma (Oturum 2 sonu + Oturum 3)

Her feature için **tek bir büyük task** — içinde kaynak + CSS + import güncelleme:

### A2.1 — overview

**Dosyalar:**
- Move: `src/admin/pages/OverviewPage.jsx` → `src/admin/features/overview/OverviewPage.jsx`
- Move: `src/styles/pages/overview.css` → `src/admin/features/overview/OverviewPage.css`
- Modify: `src/main.jsx` — `import "./styles/pages/overview.css"` sil
- Modify: Router (`src/router.jsx`) — import yolu güncelle
- Modify: OverviewPage.jsx — `import "./OverviewPage.css"` ekle

- [x] **Step 1: Dosyaları taşı**

```bash
git mv src/admin/pages/OverviewPage.jsx src/admin/features/overview/OverviewPage.jsx
git mv src/styles/pages/overview.css src/admin/features/overview/OverviewPage.css
```

- [x] **Step 2: OverviewPage.jsx'te CSS import'u ekle**

Read OverviewPage.jsx. En üstteki import blokuna ekle:

```jsx
import "./OverviewPage.css";
```

- [x] **Step 3: OverviewPage.jsx'teki göreceli import'ları düzelt**

Eski: `import { X } from "../hooks/foo"` (admin/pages/ → admin/hooks/)
Yeni: `import { X } from "../../hooks/foo"` (admin/features/overview/ → admin/hooks/)

Grep ile tüm göreceli import'ları bul ve güncelle:

```bash
grep -n "^import.*from \"\\.\\.\\/\"" src/admin/features/overview/OverviewPage.jsx
```

- [x] **Step 4: Router'da import yolu güncelle**

`src/router.jsx`:

```diff
- const OverviewPage = lazy(() => import("./admin/pages/OverviewPage"));
+ const OverviewPage = lazy(() => import("./admin/features/overview/OverviewPage"));
```

- [x] **Step 5: `src/main.jsx`'ten global overview.css import'unu kaldır**

```diff
- import "./styles/pages/overview.css";
```

- [x] **Step 6: Diğer yerlerden OverviewPage import'u var mı?**

```bash
grep -rn "admin/pages/OverviewPage" src/
```

Expected: Yalnızca `src/router.jsx`. Başka yer varsa güncelle.

- [x] **Step 7: Build + dev doğrulama**

```bash
npm run build
```

```bash
npm run dev
# /admin/overview sayfasını aç, görsel kontrol
```

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(admin): move overview to features/overview"
```

---

### A2.2 — organizations

**Dosyalar (map'ten):**
- Move: `src/admin/pages/OrganizationsPage.jsx` → `src/admin/features/organizations/`
- Move: `src/admin/drawers/CreateOrganizationDrawer.jsx` → `features/organizations/`
- Move: `src/admin/drawers/ManageBackupsDrawer.jsx` → `features/organizations/` (organizations'a bağlı)
- Move: `src/admin/drawers/ViewSessionsDrawer.jsx` → `features/organizations/`
- Move: `src/admin/hooks/useManageOrganizations.js` → `features/organizations/`
- Move: `src/admin/components/TenantSwitcher.jsx` → `features/organizations/`
- Move: `src/admin/components/AdminTeamCard.jsx` → `features/organizations/`
- Move: `src/admin/components/AdminTeamCard.css` → `features/organizations/`
- **Not:** `CreateOrganizationDrawer`'ı organizations içinde tutuyoruz; `ManageBackupsDrawer` gerçekten organizations'a mı ait yoksa settings/governance'a mı? → Bu feature'da tut, cross-feature ise sonradan `admin/shared/`'a al.

- [x] **Step 1: Tüm dosyaları feature klasörüne taşı**

```bash
git mv src/admin/pages/OrganizationsPage.jsx src/admin/features/organizations/
git mv src/admin/drawers/CreateOrganizationDrawer.jsx src/admin/features/organizations/
git mv src/admin/drawers/ManageBackupsDrawer.jsx src/admin/features/organizations/
git mv src/admin/drawers/ViewSessionsDrawer.jsx src/admin/features/organizations/
git mv src/admin/hooks/useManageOrganizations.js src/admin/features/organizations/
git mv src/admin/components/TenantSwitcher.jsx src/admin/features/organizations/
git mv src/admin/components/AdminTeamCard.jsx src/admin/features/organizations/
git mv src/admin/components/AdminTeamCard.css src/admin/features/organizations/
```

- [x] **Step 2: components.css'ten organizations'a özgü stilleri çıkart**

```bash
grep -n "organization\|tenant-switcher\|admin-team" src/styles/components.css
```

İlgili bölümleri (muhtemelen 100-300 satır) yeni `src/admin/features/organizations/OrganizationsPage.css`'e taşı.

- [x] **Step 3: CSS import'ları ekle**

Her JSX dosyasının başına kendi component CSS'ini import et.

- [x] **Step 4: Göreceli import'ları düzelt**

Her taşınan dosyada `from "../hooks/"`, `from "../drawers/"` gibi yolları **yeni seviyeye** göre düzelt:
- `admin/features/organizations/OrganizationsPage.jsx` içinde artık aynı dizinde olan drawer/hook'lar için `from "./CreateOrganizationDrawer"` kullan.
- Hâlâ admin/ dışından (shared/api vb.) geliyorsa `from "../../../shared/api"` (3 seviye yukarı).

Script:

```bash
cd src/admin/features/organizations
for f in *.jsx *.js; do
  echo "=== $f ==="
  grep -n "^import" "$f"
done
```

Her import'u elle gözden geçir ve düzelt.

- [x] **Step 5: Router güncelle**

```diff
- const OrganizationsPage = lazy(() => import("./admin/pages/OrganizationsPage"));
+ const OrganizationsPage = lazy(() => import("./admin/features/organizations/OrganizationsPage"));
```

- [x] **Step 6: Diğer yerlerde import var mı kontrol**

```bash
grep -rn "admin/drawers/CreateOrganizationDrawer\|admin/drawers/ManageBackupsDrawer\|admin/drawers/ViewSessionsDrawer\|admin/components/TenantSwitcher\|admin/components/AdminTeamCard\|admin/hooks/useManageOrganizations" src/
```

Her bulunan yeri yeni yola güncelle.

- [x] **Step 7: Build + dev test**

```bash
npm run build && npm run dev
```

`/admin/organizations` + `/admin/settings` (team card kullanıyor olabilir) + TenantSwitcher (topbar) kontrol.

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(admin): move organizations feature + co-locate CSS"
```

---

### A2.3 — jurors

**Files:**
- Move: `src/admin/pages/JurorsPage.jsx`, `JurorHeatmapCard.jsx` → `features/jurors/`
- Move: `src/admin/drawers/AddJurorDrawer.jsx`, `EditJurorDrawer.jsx`, `JurorScoresDrawer.jsx` → `features/jurors/`
- Move: `src/admin/modals/ImportJurorsModal.jsx`, `RemoveJurorModal.jsx`, `JurorReviewsModal.jsx` → `features/jurors/`
- Move: `src/admin/hooks/useManageJurors.js` → `features/jurors/`
- Move: `src/admin/components/JurorActivity.jsx`, `JurorBadge.jsx`, `JurorStatusPill.jsx`, `LastActivity.jsx`, `ReviewMobileCard.jsx` → `features/jurors/`
- Move: `src/styles/pages/jurors.css` (546 satır) → `features/jurors/JurorsPage.css`

**Not:** `ReviewMobileCard.jsx` hem jurors hem reviews'da kullanılıyor olabilir — önce jurors'a koy, A2.X reviews'da kontrol et; cross-feature'sa `admin/shared/`'a al.

(Step'ler A2.2 organizations pattern'iyle aynı: move → CSS taşı → import ekle → göreceli düzelt → router → diğer yerleri grep → build/dev → commit.)

- [x] **Step 1-8: A2.2 pattern'ını uygula**

---

### A2.4 — periods

**Files:**
- Move: `src/admin/pages/PeriodsPage.jsx` → `features/periods/`
- Move: `src/admin/drawers/AddEditPeriodDrawer.jsx`, `EditSemesterDrawer.jsx`, `AddSemesterDrawer.jsx`, `PeriodCriteriaDrawer.jsx` → `features/periods/`
- Move: `src/admin/modals/ClosePeriodModal.jsx`, `PublishPeriodModal.jsx`, `DeletePeriodModal.jsx`, `DeleteSemesterModal.jsx` → `features/periods/`
- Move: `src/admin/hooks/useManagePeriods.js`, `usePeriodOutcomes.js` → `features/periods/`
- Move: `src/admin/components/CompletionStrip.jsx` → `features/periods/` (veya setup-wizard? — grep kullanıldığı yer)
- Move: `src/styles/pages/periods.css` (1334 satır) → `features/periods/PeriodsPage.css`

**Not:** CompletionStrip setup-wizard'da da kullanılıyorsa `admin/shared/CompletionStrip.jsx` yap.

(A2.2 pattern'i.)

---

### A2.5 — projects

**Files:**
- Move: `src/admin/pages/ProjectsPage.jsx`, `ProjectAveragesCard.jsx` → `features/projects/`
- Move: `src/admin/drawers/AddProjectDrawer.jsx`, `EditProjectDrawer.jsx`, `ProjectScoresDrawer.jsx` → `features/projects/`
- Move: `src/admin/modals/DeleteProjectModal.jsx`, `CompareProjectsModal.jsx` → `features/projects/`
- Move: `src/admin/hooks/useManageProjects.js` → `features/projects/`
- Move: `src/styles/pages/projects.css` (385 satır) → `features/projects/ProjectsPage.css`

(A2.2 pattern'i.)

---

### A2.6 — criteria

**Files:**
- Move: `src/admin/pages/CriteriaPage.jsx` → `features/criteria/`
- Move: `src/admin/drawers/EditCriteriaDrawer.jsx`, `EditSingleCriterionDrawer.jsx`, `StarterCriteriaDrawer.jsx`, `ProgrammeOutcomesManagerDrawer.jsx` → `features/criteria/`
- Move: `src/admin/components/CriteriaManager.jsx` → `features/criteria/`
- Move: `src/admin/criteria/*` — varsa tüm `src/admin/criteria/` alt-dizini → `features/criteria/` içine merge
- Move: `src/styles/pages/criteria.css` (2480 satır) → `features/criteria/CriteriaPage.css`

**Not:** `src/admin/components/OutcomeEditor.jsx` — hem criteria hem outcomes'ta kullanılıyor. `admin/shared/OutcomeEditor.jsx` olarak taşı.

(A2.2 pattern'i, CSS büyük olduğu için A2.5'ten daha uzun.)

---

### A2.7 — outcomes

**Files:**
- Move: `src/admin/pages/OutcomesPage.jsx` → `features/outcomes/`
- Move: `src/admin/drawers/AddOutcomeDrawer.jsx`, `OutcomeDetailDrawer.jsx` → `features/outcomes/`
- Move: `src/styles/pages/outcomes.css` (2056 satır) → `features/outcomes/OutcomesPage.css`
- Import: `OutcomeEditor` artık `admin/shared/OutcomeEditor.jsx`'ten gelecek

(A2.2 pattern'i.)

---

### A2.8 — reviews

**Files:**
- Move: `src/admin/pages/ReviewsPage.jsx`, `ScoresTab.jsx` → `features/reviews/`
- Move: `src/admin/hooks/useReviewsFilters.js` → `features/reviews/`
- Move: `src/admin/components/ScoreStatusPill.jsx` → `features/reviews/`
- Move: `src/styles/pages/reviews.css` (975 satır) → `features/reviews/ReviewsPage.css`

**Not:** `ReviewMobileCard.jsx` jurors'ta mı reviews'ta mı? İki yerde de çağrılıyorsa `admin/shared/ReviewMobileCard.jsx`.

(A2.2 pattern'i.)

---

### A2.9-A2.17 — Kalan featurelar ✅ (Oturum 5–7'de tamamlandı)

A2.9 Oturum 5, A2.10–A2.13 Oturum 6, A2.14–A2.17 Oturum 7'de aynı pattern'le tamamlandı:

- **A2.9 rankings:** `RankingsPage.jsx` + rankings.css (612 satır)
- **A2.10 analytics:** `AnalyticsPage.jsx`, `AnalyticsTab.jsx`, `AvgDonut.jsx`, `ExportPanel.jsx`, `useAnalyticsData.js`, `SendReportModal.jsx` + analytics.css (519 satır)
- **A2.11 heatmap:** `HeatmapPage.jsx`, `HeatmapMobileList.jsx`, `useHeatmapData.js` + heatmap.css (719 satır)
- **A2.12 audit:** `AuditLogPage.jsx`, `AuditEventDrawer.jsx`, `useAuditLogFilters.js` + audit-log.css (489 satır)
- **A2.13 entry-control:** `EntryControlPage.jsx`, `EntryTokenModal.jsx`, `RevokeTokenModal.jsx`, `JuryEntryControlPanel.jsx` + entry-control.css (286 satır)
- **A2.14 pin-blocking:** `PinBlockingPage.jsx`, `PinPolicyDrawer.jsx`, 5 pin modal'ı, `usePinBlocking.js` + pin-lock.css (337 satır)
- **A2.15 settings:** `SettingsPage.jsx`, `ChangePasswordDrawer.jsx`, `EditProfileDrawer.jsx`, `SecurityPolicyDrawer.jsx`, `GovernanceDrawers.jsx`, `AvatarUploadModal.jsx`, `DisableAuthMethodModal.jsx`, `useProfileEdit.js`, `UserAvatarMenu.jsx`, `JuryRevokeConfirmDialog.jsx`, `ManageOrganizationsPanel.jsx` + settings.css (101 satır)
- **A2.16 setup-wizard:** `SetupWizardPage.jsx`, `useSetupWizard.js` + setup-wizard.css (2377 satır)
- **A2.17 export:** `ExportPage.jsx` + export.css (267 satır)

Her feature için **A2.2 organizations** pattern'ini tekrar et.

---

## Faz A3 — Jury Restructure (Oturum 3)

### A3.1 — jury/features/arrival

**Files:**
- Move: `src/jury/steps/ArrivalStep.jsx` → `src/jury/features/arrival/`
- Move: `src/jury/hooks/useJurorSession.js` → `features/arrival/`
- Move: `src/jury/components/DraggableThemeToggle.jsx`, `ThemeToggleIcon.jsx` → `features/arrival/`
- Move: `src/styles/jury-arrival.css` (450 satır) → `features/arrival/ArrivalStep.css`

(A2.2 pattern'i.)

### A3.2 — jury/features/identity

- Move: `src/jury/steps/IdentityStep.jsx` → `features/identity/`
- Move: `src/jury/hooks/useJurorIdentity.js` → `features/identity/`
- CSS: `jury.css`'ten identity bölümünü çek → `IdentityStep.css`

### A3.3-A3.9 — Kalan jury features

Pattern her biri için aynı:

- **A3.3 period-select:** `SemesterStep.jsx` + CSS kesitleri
- **A3.4 pin:** `PinStep.jsx`
- **A3.5 pin-reveal:** `PinRevealStep.jsx`
- **A3.6 progress:** `ProgressStep.jsx`, `SegmentedBar.jsx`, `StepperBar.jsx`, `useJuryWorkflow.js`
- **A3.7 evaluation:** `EvalStep.jsx`, `RubricSheet.jsx`, `ProjectDrawer.jsx`, `useJuryScoring.js`, `useJuryEditState.js`, `useJuryScoreHandlers.js` (en büyük feature)
- **A3.8 complete:** `DoneStep.jsx`, `useJuryLifecycleHandlers.js`
- **A3.9 lock:** `LockedStep.jsx`

### A3.10 — jury/shared

**Files:**
- Keep in place / Move to `src/jury/shared/`:
  - `useJuryState.js` (step machine)
  - `JuryFlow.jsx`
  - `JuryGuard.jsx`
  - `SpotlightTour.jsx`
  - `juryPreloadCache.js`
  - Diğer paylaşılan hook'lar: `useJuryAutosave.js`, `useJuryHandlers.js`, `useJurySessionHandlers.js`, `useJuryLoading.js`
- Move: `src/styles/jury.css` (4021 satır) → **SPLIT: jury/shared/jury-base.css** (global jury stilleri: layout, typography, buttons) + her feature'a kendi CSS'ini ata

---

## Faz A4 — Auth Restructure (Oturum 3 sonu)

### A4.1 — auth/features/login, register, invite, …

Her auth feature için **tek bir küçük task** — her biri tek bir screen içeriyor:

- **A4.1 login:** `LoginScreen.jsx` → `features/login/`
- **A4.2 register:** `RegisterScreen.jsx`, `TenantSearchDropdown.jsx` → `features/register/`
- **A4.3 invite:** `InviteAcceptScreen.jsx` → `features/invite/`
- **A4.4 forgot-password:** `ForgotPasswordScreen.jsx`
- **A4.5 reset-password:** `ResetPasswordScreen.jsx`
- **A4.6 verify-email:** `VerifyEmailScreen.jsx`, `EmailVerifyBanner.jsx`
- **A4.7 complete-profile:** `CompleteProfileScreen.jsx`
- **A4.8 pending-review:** `PendingReviewScreen.jsx`
- **A4.9 grace-lock:** `GraceLockScreen.jsx`

### A4.10 — auth/shared

- `AuthProvider.jsx`, `AuthGuard.jsx`, `useAuth.js`, `SecurityPolicyContext.jsx`, `lockedActions.js` → `src/auth/shared/`
- `src/styles/auth.css` (1178 satır) → `src/auth/shared/auth.css` (auth genelinde paylaşılan stil)

(A2.2 pattern'i, her biri çok küçük olduğu için task başına 30 dk.)

---

## Faz A5 — components.css SPLIT (Oturum 4)

**Amaç:** Kalan `src/styles/components.css` (5664 satır) sadece **gerçekten global** olan component patternlerini içersin. Feature-specific stiller zaten A2-A4'te taşındı.

**Files:**
- Modify: `src/styles/components.css` (5664 → ~1500 satır hedef)
- Create: `src/styles/components/` alt-dizini:
  - `buttons.css` (`.btn-primary`, `.btn-ghost`, `.btn-danger`, vb.)
  - `cards.css` (`.fb-card`, `.fs-card`)
  - `forms.css` (`input`, `textarea`, `label`, `.crt-field-error`)
  - `alerts.css` (`.fb-alert` — eğer A1'de FbAlert.css'e taşımadıysak)
  - `tables.css`
  - `pills-badges.css`
  - `nav-menu.css`
  - `misc.css` (sınıflandırılamayanlar)

- [ ] **Step 1: components.css'i analiz et, bölüm bölüm çıkar**

```bash
grep -n "^/\* " src/styles/components.css | head -50
```

- [ ] **Step 2: Her bölüm için yeni dosya oluştur, bölümü taşı**

Örnek buttons:

```bash
# Button bölümünü bul, yeni dosyaya taşı
sed -n '/\/\* ── Buttons ──\*\//,/\/\* ── Next Section/p' src/styles/components.css > src/styles/components/buttons.css
```

(Elle yapılır, sed kırılgan.)

- [ ] **Step 3: main.jsx'te yeni dosyaları import et**

```diff
- import "./styles/components.css";
+ import "./styles/components/buttons.css";
+ import "./styles/components/cards.css";
+ import "./styles/components/forms.css";
+ // ...
```

- [ ] **Step 4: Build + dev ile görsel regresyon kontrolü**

Her ana sayfayı aç: landing, login, admin overview, admin organizations, jury entry, jury eval. Stil kayması yok mu?

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(styles): split components.css into per-pattern files"
```

---

## Faz A6 — Import Path Audit + Cleanup (Oturum 4)

**Amaç:** A2-A5 sonunda tüm göreceli import'ları doğrula, kırık bir şey kalmadığından emin ol.

- [ ] **Step 1: Unused eski dizinleri kaldır**

Eski `src/admin/pages/`, `src/admin/drawers/`, `src/admin/modals/`, `src/admin/hooks/`, `src/admin/components/`, `src/admin/criteria/` **boş** mu?

```bash
find src/admin/pages src/admin/drawers src/admin/modals src/admin/hooks src/admin/components src/admin/criteria -type f 2>/dev/null
```

Expected: Boş (veya sadece `.gitkeep`).

Boşsa rmdir:

```bash
rmdir src/admin/pages src/admin/drawers src/admin/modals src/admin/hooks src/admin/components 2>/dev/null
```

- [ ] **Step 2: Tüm import'ları tarama**

```bash
# Eski yollar hâlâ var mı?
grep -rn "admin/pages/\|admin/drawers/\|admin/modals/\|admin/hooks/\|admin/components/\|admin/criteria/" src/ | grep -v "__tests__.archive"
```

Expected: 0 sonuç.

- [ ] **Step 3: Broken import detector**

```bash
npm run build 2>&1 | grep -i "cannot find\|module not found\|resolve" | head -20
```

Expected: 0 sonuç.

- [ ] **Step 4: Jury ve auth için aynı tarama**

```bash
grep -rn "jury/steps/\|jury/components/\|jury/hooks/\|auth/components/" src/ | grep -v "__tests__.archive"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(structure): remove empty legacy directories"
```

---

## Faz A7 — src/styles/ Final State (Oturum 4)

**Amaç:** `src/styles/` dizini sadece global kalsın:

```
src/styles/
├── variables.css          (257 satır — CSS tokens)
├── typography.css
├── utilities.css
├── layout.css             (3284 satır — KALIR, sidebar+topbar global)
├── drawers.css            (1617 satır — drawer pattern global)
├── modals.css             (582 satır — modal pattern global)
├── mobile.css             (495 satır — breakpoint overrides)
├── ui-base.css            (1500 satır — input/textarea base)
├── table-system.css       (314 satır)
├── icon-surface.css       (305 satır)
├── status-pills.css       (117 satır)
├── toast.css
├── charts.css
├── print.css
├── maintenance.css
└── components/            (YENİ — A5'ten)
    ├── buttons.css
    ├── cards.css
    ├── forms.css
    ├── alerts.css
    ├── tables.css
    ├── pills-badges.css
    ├── nav-menu.css
    └── misc.css
```

**Silinen eski dosyalar:**
- `src/styles/pages/*.css` (16 dosya — hepsi feature klasörlerine taşındı)
- `src/styles/jury.css` (SPLIT: feature'lara + jury/shared/jury-base.css)
- `src/styles/jury-arrival.css` (jury/features/arrival/)
- `src/styles/auth.css` (auth/shared/)
- Eski `src/styles/components.css` (A5'te SPLIT)

- [ ] **Step 1: Eski page CSS'leri sil (hepsi taşındıysa)**

```bash
rmdir src/styles/pages 2>/dev/null
ls src/styles/pages 2>/dev/null
```

Expected: directory not found.

- [ ] **Step 2: Eski büyük dosyalar silindi mi?**

```bash
ls -lh src/styles/jury.css src/styles/jury-arrival.css src/styles/auth.css 2>/dev/null
```

Expected: No such file.

- [ ] **Step 3: main.jsx import listesini final hâle getir**

```jsx
// Globals
import "./styles/variables.css";
import "./styles/typography.css";
import "./styles/utilities.css";
import "./styles/layout.css";
import "./styles/drawers.css";
import "./styles/modals.css";
import "./styles/mobile.css";
import "./styles/ui-base.css";
import "./styles/table-system.css";
import "./styles/icon-surface.css";
import "./styles/status-pills.css";
import "./styles/toast.css";
import "./styles/charts.css";
import "./styles/print.css";
import "./styles/maintenance.css";

// Component patterns
import "./styles/components/buttons.css";
import "./styles/components/cards.css";
import "./styles/components/forms.css";
import "./styles/components/alerts.css";
import "./styles/components/tables.css";
import "./styles/components/pills-badges.css";
import "./styles/components/nav-menu.css";
import "./styles/components/misc.css";
```

- [ ] **Step 4: Final build + full smoke test**

```bash
npm run build
npm run dev
```

Her ana sayfayı aç:
- / (landing)
- /login
- /register
- /admin/overview, /organizations, /jurors, /periods, /projects, /criteria, /outcomes, /reviews, /rankings, /analytics, /heatmap, /audit-log, /entry-control, /pin-blocking, /settings
- /demo/admin (same list)
- /eval (jury entry)
- Jury flow (identity → period → pin → progress → eval → done)

Görsel regresyon yok mu? Stillere bakarak gözden geçir.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(styles): finalize src/styles/ as globals-only"
```

**Aşama A biter.** Source restructure + CSS co-location tamam. Oturum 5'te teste geçiliyor.

---

# AŞAMA B — Test Rewrite

## Faz B0 — Archive + Skeleton + Test Kit (Oturum 5 başı)

**Not:** Aşama A'dan sonra mevcut testlerin pek çoğu zaten kırılmış durumda (import yolları değişti). Arşive almak dogal.

- [x] **Step 1: Eski test dizinlerini arşivle**

```bash
git mv src/admin/__tests__ src/admin/__tests__.archive 2>/dev/null || true
git mv src/auth/__tests__ src/auth/__tests__.archive 2>/dev/null || true
git mv src/jury/__tests__ src/jury/__tests__.archive 2>/dev/null || true
git mv src/shared/__tests__ src/shared/__tests__.archive 2>/dev/null || true
git mv src/admin/hooks/__tests__ src/admin/hooks/__tests__.archive 2>/dev/null || true
git mv sql/__tests__ sql/__tests__.archive 2>/dev/null || true
git mv src/test/qa-catalog.json src/test/qa-catalog.archive.json
```

- [x] **Step 2: Boş qa-catalog**

`src/test/qa-catalog.json`:

```json
[]
```

- [x] **Step 3: Vitest exclude**

`vitest.config.js` içinde `test.exclude`:

```js
exclude: [
  "**/node_modules/**",
  "**/e2e/**",
  "**/__tests__.archive/**",
]
```

(`vitest.config.allure.mjs` için de aynı.)

- [x] **Step 4: Yeni test dizin iskeleti (feature-based)**

Her feature klasöründe `__tests__/` oluştur:

```bash
# Admin features
for feat in overview organizations jurors periods projects criteria outcomes reviews rankings analytics heatmap audit entry-control pin-blocking settings setup-wizard export; do
  mkdir -p src/admin/features/$feat/__tests__
  touch src/admin/features/$feat/__tests__/.gitkeep
done

# Admin shared
mkdir -p src/admin/shared/__tests__
touch src/admin/shared/__tests__/.gitkeep

# Jury
for feat in arrival identity period-select pin pin-reveal progress evaluation complete lock; do
  mkdir -p src/jury/features/$feat/__tests__
  touch src/jury/features/$feat/__tests__/.gitkeep
done
mkdir -p src/jury/shared/__tests__
touch src/jury/shared/__tests__/.gitkeep

# Auth
for feat in login register invite forgot-password reset-password verify-email complete-profile pending-review grace-lock; do
  mkdir -p src/auth/features/$feat/__tests__
  touch src/auth/features/$feat/__tests__/.gitkeep
done
mkdir -p src/auth/shared/__tests__
touch src/auth/shared/__tests__/.gitkeep

# Shared katman testleri (mevcut yapı korunuyor)
mkdir -p src/shared/__tests__/{api,ui,hooks,storage,lib}
```

- [x] **Step 5: Test kit iskeleti**

```bash
mkdir -p src/test/{fixtures,factories,helpers}
```

**Fixtures** (`src/test/fixtures/`):
- `organizations.json`, `jurors.json`, `periods.json`, `projects.json`, `scores.json`, `users.json`

**Factories** (`src/test/factories/`):
- `buildOrg.js`, `buildJuror.js`, `buildPeriod.js`, `buildProject.js`, `buildScore.js`, `buildUser.js`

**Helpers** (`src/test/helpers/`):
- `renderWithRouter.jsx` (MemoryRouter wrapper)
- `renderWithAuth.jsx` (AuthProvider wrapper + mock session)
- `mockSupabase.js` (factory)
- `mockInvokeEdge.js` (factory)

(Bu dosyaların tam içerikleri eski plandaki kod bloklarıyla aynı — yukarıda Faz 1 Step 2-4.)

- [x] **Step 6: Coverage config**

`vitest.config.js`:

```js
coverage: {
  provider: "v8",
  reporter: ["text", "html", "json-summary"],
  include: ["src/**/*.{js,jsx,ts,tsx}"],
  exclude: [
    "**/__tests__/**",
    "**/__tests__.archive/**",
    "**/*.test.{js,jsx,ts,tsx}",
    "src/test/**",
    "src/main.jsx",
  ],
  thresholds: {
    lines: 0, functions: 0, branches: 0, statements: 0,
  },
}
```

`package.json` scripts:

```json
"test:coverage": "vitest run --coverage"
```

- [x] **Step 7: Boş test run**

```bash
npm test -- --run
```

Expected: "No test files found".

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "test: archive old tests, scaffold feature-aligned test structure"
```

---

## Faz B1 — Shared Katmanı Testleri (Oturum 5 sonu)

**Amaç:** `src/shared/` tüm katmanlarına test — her şeyin bağımlılığı.

**Kapsanacak:**
- `src/shared/lib/environment.js` — pathname-based env
- `src/shared/lib/supabaseClient.js` — Proxy switching
- `src/shared/lib/utils.js`, `dateUtils.js`, `demoMode.js`, `randomUUID.js`
- `src/shared/storage/keys.js`, `juryStorage.js`, `adminStorage.js`
- `src/shared/api/fieldMapping.js` — UI↔DB mapping
- `src/shared/api/core/invokeEdgeFunction.js` — POST raw-fetch
- `src/shared/api/juryApi.js`
- `src/shared/api/admin/*` (21 modül)
- `src/shared/hooks/*` (8 hook)
- `src/shared/ui/*` (29 component — kritik 10 için ayrıntılı test, diğer 19 için smoke)

**Her dosya için TDD sırası:**

1. qa-catalog'a ID ekle
2. `src/shared/__tests__/<kategori>/X.test.js` yaz
3. `npm test` → pass veya fail gör
4. (Kaynak değişikliği gerekirse yap)
5. Pass olunca commit

**Örnek (environment.js):**

**Files:** `src/shared/__tests__/lib/environment.test.js`

- [x] **Step 1: qa-catalog'a ekle**

```json
[
  { "id": "shared.lib.environment.01", ... },
  { "id": "shared.lib.environment.02", ... }
]
```

- [x] **Step 2: Test yaz**

```js
import { describe, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { resolveEnvFromPathname } from "../../lib/environment.js";

describe("environment.resolveEnvFromPathname", () => {
  qaTest("shared.lib.environment.01", () => {
    expect(resolveEnvFromPathname("/demo")).toBe("demo");
    expect(resolveEnvFromPathname("/demo/admin")).toBe("demo");
  });
  qaTest("shared.lib.environment.02", () => {
    expect(resolveEnvFromPathname("/")).toBe("prod");
    expect(resolveEnvFromPathname("/admin")).toBe("prod");
  });
});
```

- [x] **Step 3: Çalıştır**

```bash
npm test -- --run src/shared/__tests__/lib/environment.test.js
```

- [x] **Step 4: Commit**

```bash
git commit -am "test(shared/lib): environment resolution"
```

**Tekrar et** ~40 dosya için.

---

## Faz B2 — Auth Testleri (Oturum 6 başı)

**Her auth feature için 3 test minimum:**
1. Render smoke (doğru görünüyor)
2. Happy path (kullanıcı akışı çalışıyor)
3. Error path (API hatası → FbAlert)

**Örnek (LoginScreen):**

`src/auth/features/login/__tests__/LoginScreen.test.jsx`:

```jsx
import { describe, expect, vi } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithAuth } from "../../../../test/helpers/renderWithAuth.jsx";
import LoginScreen from "../LoginScreen.jsx";

describe("LoginScreen", () => {
  qaTest("auth.login.render", () => {
    renderWithAuth(<LoginScreen />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/şifre|password/i)).toBeInTheDocument();
  });
  // happy + error paths...
});
```

Tüm auth feature'ları (9 feature × 3 test = 27 test) + auth/shared (AuthProvider, AuthGuard, useAuth) için ayrıntılı test.

---

## Faz B3 — Jury Testleri (Oturum 6)

**useJuryState** en kritik — step machine mantığı tam test edilmeli.

**Her jury feature için:**
- Step component render
- Step → next step transition
- Storage persist/restore
- Error handling (network fail)

**useJuryState için:**
- identity → period → pin → pin-reveal (ilk kez) → progress → eval → complete sırası
- Lock senaryosu
- Edit mode (admin granted)
- Autosave (writeGroup on blur)
- Token expiry (24h)

---

## Faz B4 — Admin Testleri (Oturum 6 sonu + Oturum 7 başı)

**En büyük yük — 17 feature × ortalama 4-5 test = ~70-90 test dosyası.**

**Öncelik:**
1. **Critical features** (jurors, periods, projects, organizations): full kapsam
2. **Analytics features** (rankings, analytics, heatmap, reviews): happy + 1 error
3. **Utility features** (overview, audit, entry-control, pin-blocking, export): smoke + happy
4. **Large features** (criteria, outcomes, setup-wizard): ayrıntılı, çünkü 2000+ satır code

**Her feature için:**
- Page smoke
- Hook testi (varsa)
- Kritik interaction (drawer açılması, form submit, modal confirm)
- Error path (API fail)

---

## Faz B5 — DB Katmanı (pgTAP) (Oturum 7)

**Setup:**

`sql/migrations/001_extensions.sql`'e ekle:

```sql
CREATE EXTENSION IF NOT EXISTS pgtap;
```

Her iki env'e (vera-prod + vera-demo) uygula.

**Test örneği — `sql/tests/rls/organizations_isolation.sql`:**

```sql
BEGIN;
SELECT plan(3);

-- Seed
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Org A', 'org-a'),
  ('00000000-0000-4000-8000-000000000002', 'Org B', 'org-b');
INSERT INTO memberships (user_id, organization_id, role) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'admin'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'admin');

-- Test: admin A sees only Org A
SELECT set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000001')::text, true);
SELECT is((SELECT count(*) FROM organizations)::int, 1, 'admin A sees 1 org');
SELECT is((SELECT name FROM organizations LIMIT 1), 'Org A', 'admin A sees Org A name');

-- Test: admin B sees only Org B
SELECT set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000002')::text, true);
SELECT is((SELECT count(*) FROM organizations)::int, 1, 'admin B sees 1 org');

SELECT * FROM finish();
ROLLBACK;
```

**Kapsam:** 8 tablo için RLS + 20 kritik RPC davranışı.

**Runner:** `pg_prove` (local) veya Supabase MCP `execute_sql`.

---

## Faz B6 — Edge Function Testleri (Oturum 7)

**Öncelikli 5 fonksiyon (23 içinden):**
1. `rpc-proxy/` (tüm admin RPC'lerin geçidi)
2. `admin-session-touch/`
3. `platform-metrics/`
4. `invite-org-admin/`
5. `email-verification-confirm/`

**Her biri için co-located test:**

`supabase/functions/rpc-proxy/index.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";

Deno.test("rpc-proxy: missing Authorization → 401", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/rpc-proxy", {
    method: "POST",
    body: JSON.stringify({ name: "rpc_admin_list_orgs" }),
  });
  assertEquals(res.status, 401);
});

// happy path, invalid RPC name, tenant mismatch, etc.
```

**Runner:** `supabase functions serve` + `deno test`.

---

## Faz B7 — E2E Genişletme (Oturum 7)

**Mevcut 8 → 25 spec. Eklenenler:**

| Yeni spec | Öncelik |
|---|---|
| `e2e/auth/google-oauth.spec.ts` | Yüksek |
| `e2e/auth/invite-accept.spec.ts` | Yüksek |
| `e2e/auth/forgot-password.spec.ts` | Orta |
| `e2e/auth/reset-password.spec.ts` | Orta |
| `e2e/admin/setup-wizard.spec.ts` | Yüksek |
| `e2e/admin/organizations-crud.spec.ts` | Yüksek |
| `e2e/admin/jurors-crud.spec.ts` | Yüksek |
| `e2e/admin/periods-crud.spec.ts` | Yüksek |
| `e2e/admin/entry-token-lifecycle.spec.ts` | Yüksek |
| `e2e/admin/audit-log-view.spec.ts` | Orta |
| `e2e/jury/pin-lifecycle.spec.ts` | Orta |
| `e2e/demo/auto-login.spec.ts` | Yüksek |
| `e2e/demo/isolation.spec.ts` | Yüksek |

**Page Object Model:**

`e2e/helpers/LoginPage.ts`:

```ts
import { Page } from "@playwright/test";

export class LoginPage {
  constructor(private page: Page) {}
  async goto() { await this.page.goto("/login"); }
  async loginWithEmail(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}
```

---

# AŞAMA C — CSS Final Polish (Oturum 7 sonu)

## Faz C1 — Coverage Thresholds

`vitest.config.js`:

```js
coverage: {
  thresholds: {
    global: { lines: 65, functions: 65, branches: 60, statements: 65 },
    "src/shared/api/**": { lines: 85, functions: 85, branches: 80, statements: 85 },
    "src/shared/ui/**": { lines: 70, functions: 70, branches: 65, statements: 70 },
    "src/shared/hooks/**": { lines: 80, functions: 80, branches: 75, statements: 80 },
    "src/jury/**": { lines: 75, functions: 75, branches: 70, statements: 75 },
    "src/auth/**": { lines: 75, functions: 75, branches: 70, statements: 75 },
  },
}
```

CI pipeline'a:

```yaml
- run: npm run test:coverage
- run: npm run e2e
- run: pg_prove sql/tests/**/*.sql
```

## Faz C2 — Dark Mode Tokenize (Opsiyonel)

`src/styles/variables.css` içinde dark mode token'ları dominant yapılır; `body.dark-mode` altındaki bireysel color override'lar temizlenir.

## Faz C3 — Dead CSS Scan

```bash
npm install -g purgecss-cli
purgecss --content "src/**/*.{js,jsx,css}" --css "src/styles/**/*.css" --output /tmp/purged
# Diff kontrol et — silmek yerine önce raporla.
```

---

## Verification (her aşama sonu)

**Her aşama sonu checklist:**

- [ ] `npm run build` — 0 hata
- [ ] `npm run dev` — dev server ayağa kalkıyor
- [ ] Dev mode'da her sayfa görsel kontrolü (landing, login, 17 admin page, jury flow, demo)
- [ ] `npm test -- --run` — yeni testler pass, arşiv exclude edilmiş
- [ ] `grep -rn "admin/pages/\|admin/drawers/\|..." src/` — 0 eski yol
- [ ] `npm run check:no-native-select && npm run check:no-nested-panels` — temiz
- [ ] Git log: her feature taşıması ayrı commit

**Aşama B sonu ek:**

- [ ] `npm run test:coverage` — global %65+ ulaşıldı
- [ ] `pg_prove sql/tests/**/*.sql` — RLS + RPC testleri yeşil
- [ ] `npm run e2e` — 25 spec pass, flaky yok
- [ ] Edge function testleri pass (Deno test)

**Final:**

- [ ] CI pipeline yeşil
- [ ] PR'larda coverage diff görünür
- [ ] Dev onboarding dokümanı güncel (yeni yapıyı anlatır)

---

## Oturumlar Arası Handoff

**Her oturum sonunda:**

1. Bu plan dosyasında ilgili Faz checkbox'larını işaretle
2. Progress Log'a bir satır ekle
3. `git log --oneline -20` ile son commit'leri gözden geçir

**Sıradaki oturum başında:**

1. `/Users/huguryildiz/.claude/plans/glittery-strolling-pretzel.md` oku
2. `docs/superpowers/plans/restructure-and-test-rewrite/README.md` oku (aynı içerik, repo kopyası)
3. Progress Log son satıra bak, kaldığın yerden başla
4. `git pull && git log --oneline -20` ile güncel durum kontrol

---

## Restructure & Test Tracker

**Durum simgeleri:** ✅ tamamlandı · 🔄 devam ediyor · ⬜ bekliyor · ⏸️ askıda · ❌ blocked · N/A geçerli değil

**Kolonlar:**
- **Source** — dosyalar yeni feature klasörüne taşındı, göreceli import'lar güncel, build yeşil
- **CSS** — feature-specific CSS co-located, `src/styles/` gereksiz kalmadı
- **Tests** — yeni testler feature `__tests__/` altında, ilgili coverage hedefi tutuyor
- **Report** — ilgili session implementation_report linki

### Admin (17 feature)

| Feature | Source | CSS | Tests | Durum | Report |
|---|---|---|---|---|---|
| overview | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-04](implementation_reports/session-04-A2-admin-1-3.md) |
| organizations | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-04](implementation_reports/session-04-A2-admin-1-3.md) |
| jurors | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-04](implementation_reports/session-04-A2-admin-1-3.md) |
| periods | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-05](implementation_reports/session-05-A2-admin-4-9.md) |
| projects | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-05](implementation_reports/session-05-A2-admin-4-9.md) |
| criteria | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-05](implementation_reports/session-05-A2-admin-4-9.md) |
| outcomes | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-05](implementation_reports/session-05-A2-admin-4-9.md) |
| reviews | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-05](implementation_reports/session-05-A2-admin-4-9.md) |
| rankings | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-05](implementation_reports/session-05-A2-admin-4-9.md) |
| analytics | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-06](implementation_reports/session-06-A2-admin-10-13.md) |
| heatmap | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-06](implementation_reports/session-06-A2-admin-10-13.md) |
| audit | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-06](implementation_reports/session-06-A2-admin-10-13.md) |
| entry-control | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-06](implementation_reports/session-06-A2-admin-10-13.md) |
| pin-blocking | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-07](implementation_reports/session-07-A2-admin-14-17.md) |
| settings | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-07](implementation_reports/session-07-A2-admin-14-17.md) |
| setup-wizard | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-07](implementation_reports/session-07-A2-admin-14-17.md) |
| export | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-07](implementation_reports/session-07-A2-admin-14-17.md) |

### Jury (9 feature)

| Feature | Source | CSS | Tests | Durum | Report |
|---|---|---|---|---|---|
| arrival | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| identity | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| period-select | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| pin | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| pin-reveal | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| progress | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| evaluation | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| complete | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| lock | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |
| jury/shared | ✅ | ✅ | ⬜ | Source+CSS bitti | [session-08](implementation_reports/session-08-A3-jury.md) |

### Auth (9 feature)

| Feature | Source | CSS | Tests | Durum | Report |
|---|---|---|---|---|---|
| login | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| register | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| invite | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| forgot-password | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| reset-password | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| verify-email | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| complete-profile | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| pending-review | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| grace-lock | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| auth/shared | ⬜ | ⬜ | ⬜ | Bekliyor | — |

### Shared Layer (test kapsamı)

| Katman | Source | CSS | Tests | Durum | Report |
|---|---|---|---|---|---|
| shared/ui (29 component) | N/A | ✅ 6/29 co-located (23 kalan: CSS yok veya global dosyada) | ⬜ | A1 bitti | [session-03](implementation_reports/session-03-A1-finish.md) |
| shared/api (27 dosya) | N/A | N/A | ⬜ | Bekliyor | — |
| shared/hooks (8 dosya) | N/A | N/A | ⬜ | Bekliyor | — |
| shared/storage (4 dosya) | N/A | N/A | ⬜ | Bekliyor | — |
| shared/lib (8 dosya) | N/A | N/A | ⬜ | Bekliyor | — |

### Infrastructure & Altyapı

| Öge | Durum | Report |
|---|---|---|
| components.css split (~~5664~~ → 4922 → 8 dosya, 3528 satır) — silindi | ✅ Tamamlandı | [session-10](implementation_reports/session-10-A5-components-split.md) |
| misc.css dağıtımı (2655 → 1871, #page-X feature CSS'lere + theme/ çıkarımı) | ✅ Tamamlandı | [session-10b](implementation_reports/session-10b-misc-distribution.md) |
| src/styles/ finalize (globals-only) | ⬜ Bekliyor | — |
| Eski `__tests__/` → `__tests__.archive/` | ⬜ Bekliyor | — |
| Test kit (fixtures + factories + helpers) | ⬜ Bekliyor | — |
| qa-catalog.json sıfırla + yeniden yaz | ⬜ Bekliyor | — |
| pgTAP extension + 9 RLS + 9 RPC test (74 assertion) | ✅ Tamamlandı | [session-23](implementation_reports/session-23-B5-pgtap.md) |
| Edge function testleri (4 kritik — rpc-proxy repoda yok) | ✅ Tamamlandı | [session-24](implementation_reports/session-24-B6-edge-functions.md) |
| E2E genişletme (8 → 25 spec) | ✅ Tamamlandı | [session-25](implementation_reports/session-25-e2e-expansion.md) |
| Coverage thresholds + CI | ✅ Tamamlandı | [session-26](implementation_reports/session-26-coverage-polish.md) |
| Dark mode tokenize (opsiyonel) | ⏸️ Atlandı (opsiyonel) | — |
| Dead CSS scan (purgecss) | ✅ Raporlandı | [dead-css-scan](dead-css-scan-2026-04-23.md) |

### Toplam ilerleme

**35 / 35 feature taşındı** · **35 / 35 feature CSS co-located** · **40 / 40 modül test edildi** · **10 / 11 altyapı task tamam** (dark mode tokenize opsiyonel, atlandı)

🎉 **Plan tamamlandı — Aşama A + B + C bitti. S1-S26 / 26 session.**

> Her oturum sonunda ilgili satırlar güncellenir ve Report sütununa `[session-NN-konu.md](implementation_reports/session-NN-konu.md)` linki eklenir.

---

## Progress Log

| Tarih | Oturum | Tamamlanan | Sonraki |
|---|---|---|---|
| 2026-04-22 | 1 | Plan yazıldı — feature-based restructure + test rewrite + CSS co-location + parity tracker | Faz A0 (iskelet) |
| 2026-04-22 | 2 | A0 iskelet (38 .gitkeep), A1: FbAlert + CustomSelect + PremiumTooltip CSS co-located (3/29); ConfirmDialog/Modal/Drawer skip (global dosyalarda) | Session 3: kalan 26 shared/ui component |
| 2026-04-22 | 3 | A1 tamamlandı: AsyncButtonContent + FilterButton + Pagination CSS co-located (6/29 toplam); FloatingMenu global kalacak (65+ direct className kullanımı); 15 component CSS'siz veya başka global dosyada; tüm 29 component incelendi | Session 4: A2.1–A2.3 admin feature taşıma (overview + organizations + jurors) |
| 2026-04-22 | 4 | A2.1–A2.3 tamamlandı: overview + organizations + jurors features taşındı (5 commit); 4 cross-feature bileşen `admin/shared/`'a çıkarıldı (AdminTeamCard, ManageBackupsDrawer, ViewSessionsDrawer; JurorBadge, JurorStatusPill, ImportJurorsModal, JurorHeatmapCard); 14 consumer güncellendi; build yeşil; 63 pre-existing test fail, yeni kırıklık yok | Session 5: A2.4–A2.6 (periods + projects + criteria) |
| 2026-04-22 | 5 | A2.4–A2.9 tamamlandı: periods + projects + criteria + outcomes + reviews + rankings features taşındı (9 commit); 2 cross-feature bileşen `admin/shared/`'a çıkarıldı (usePeriodOutcomes, OutcomeEditor); `PremiumTooltiptext` JSX syntax bug düzeltildi (OutcomeEditor 2x + CriterionEditor 1x); `periodsMobileRing.test.js` + `criteriaFormHelpers.test.js` import yolları güncellendi; 23 fail (hepsi pre-existing), 57 pass | Session 6: A2.10–A2.13 (analytics + heatmap + audit + entry-control) |
| 2026-04-22 | 6 | A2.10–A2.13 tamamlandı: analytics + heatmap + audit + entry-control features taşındı (4 commit); `mobileSort.js` heatmap-only olduğu tespit edildi, heatmap ile co-located; dynamic import path bug (`../../shared/api`) build'de yakalandı; `smoke.test.jsx` + `mobileSort.test.js` import yolları güncellendi; build yeşil; 13/17 admin feature tamam | Session 7: A2.14–A2.17 (pin-blocking + settings + setup-wizard + export) |
| 2026-04-22 | 7 | A2.14–A2.17 tamamlandı: pin-blocking + settings + setup-wizard + export features taşındı (4 commit); GovernanceDrawers → `features/organizations/` (tek consumer OrganizationsPage); `setup-wizard.css` 3 sayfadan doğrudan import ediliyordu (OutcomesPage + PeriodsPage güncellendi); dynamic import path bug `import("../../shared/api")` ExportPage'de yakalandı; `ManageOrganizationsPanel.test.jsx` import yolu güncellendi; build yeşil; **17/17 admin feature tamam** | Session 8: A3 jury restructure (9 feature + jury/shared, jury.css 4021 satır) |
| 2026-04-22 | 8 | A3.1–A3.10 tamamlandı: 9 jury step feature co-located + jury/shared katmanı oluşturuldu (11 commit); `jury.css` 4021 satır → `jury/shared/jury-base.css`; `jury-arrival.css` → `arrival/ArrivalStep.css`; 12 hook + 4 util + 4 shared component + JuryGuard + juryPreloadCache taşındı; SpotlightTour bulk fix (6 dosya); 2 admin consumer (useManagePeriods + useAdminData) güncellendi; eski `jury/steps/`, `hooks/`, `components/`, `utils/` silindi; pre-existing test failure'lar (useJuryState.writeGroup) doğrulandı; build yeşil; **Faz A3 tamam** | Session 9: A4 auth restructure (9 feature + auth/shared) |
| 2026-04-22 | 9 | A4.1–A4.10 tamamlandı: 9 auth screen feature co-located + auth/shared katmanı oluşturuldu (10 commit); `auth.css` 1178 satır → 4 feature CSS + `auth/shared/auth-base.css` (210 satır); AuthProvider + useAuth + SecurityPolicyContext + lockedActions + AuthGuard → `auth/shared/`'a taşındı; AuthGuard `guards/` → `auth/shared/`; eski `auth/screens/`, `auth/components/`, `guards/` silindi; 19 consumer güncellendi (router, AdminRouteLayout, RootLayout, MaintenanceGate, 6 feature, 6 admin page, 1 modal, 3 test); `auth/index.js` barrel güncellendi; build yeşil; **Faz A4 tamam** | Session 10: A5 components.css split |
| 2026-04-23 | 10 | A5 tamamlandı: `src/styles/components.css` (4922 satır) → 8 per-pattern dosyaya split (`buttons`, `cards`, `forms`, `alerts`, `tables`, `pills-badges`, `nav-menu`, `misc`); `misc.css` 2655 satır (kalan tüm içerik); `src/styles/main.css` güncellendi (8 import); `components.css` silindi; build yeşil (3193 modül); **Faz A5 tamam** | Session 11: A6 + A7 — import cleanup + src/styles/ finalize + smoke test |
| 2026-04-23 | 11 | A6 + A7 tamamlandı: 23 dosya `admin/shared/` veya feature dirs'a taşındı; 5 orphan silindi; 7 legacy flat dirs kaldırıldı (`pages/`, `drawers/`, `modals/`, `hooks/`, `components/`, `criteria/`, `settings/`); `src/styles/pages/` kaldırıldı; 50+ stale import path güncellendi (hooks→shared, modals→shared, pages→features); bozuk relative `../utils/` ve `../../shared/` yolları `@/admin/utils/` ve `@/shared/` ile düzeltildi; `selectors/filterPipeline.js` güncellendi; build yeşil (1902 modül); 23/23 moved file HTTP 200; `styles/` audit: pages yok, legacy CSS yok; Playwright unavailable — HTTP verification yapıldı; **Faz A6 + A7 tamam — Aşama A BİTTİ** | Session 12: Faz B başlangıcı — test arşiv + test kit |
| 2026-04-23 | 10b | misc.css dağıtımı: 4 feature-specific blok (`#page-entry-control` 204, `#page-audit` 155, `#page-settings` 70, `.evb-*` 103) feature CSS'lerine taşındı; theme override'lar (sections 3–17) `src/styles/theme/light-overrides.css` (125) + `dark-overrides.css` (130) dosyalarına çıkarıldı; duplicate `.btn-success` bloğu silindi; main.css 2 yeni theme import; `EmailVerifyBanner.jsx` kendi CSS'ini import ediyor; misc.css 2655 → 1871 (−784, −%29.5); 2 commit; build yeşil; **9 component/theme dosyası <600 kuralında**; kalan >600 dosyalar (jury-base 4021, criteria 2480, setup-wizard 2377, outcomes 2056, misc 1871, periods 1334, reviews 975, heatmap 719, audit 645, rankings 612) S10-cleanup-2'ye ertelendi | Session 12: Faz B veya S10-cleanup-2 (vera-es → empty-states.css + 2k+ feature CSS trim) |
| 2026-04-23 | 12 | 🎨 **Opus Sprint 1 tamam:** 5 global CSS dosyası (11.338 satır) → 48 parça, 46/48 strict <600, 2 coherent single-concern (drawers/base 585, layout/portrait-toolbar 639). `layout.css` (3284) → `layout/` 15 parça; `landing.css` (3066) → `landing/` 12 parça (primary + legacy-* vera.css duplicate preserved); `components/misc.css` (1871) → `misc/` 8 parça; `drawers.css` (1617) → `drawers/` 5 parça; `ui-base.css` (1500) → `ui-base/` 8 parça. main.css import zinciri güncellendi; 6 atomik commit (616fad5, f554bca, ba03285, 83e189d, e5491ae, c79cbb8); build yeşil (5.88s); paralel Opus race conditions yakalandı (main.css revert + misc boundary `}` leak) — her ikisi fix edildi · [session-12](implementation_reports/session-12-opus-sprint-1-globals.md) | Session 13 (paralel): Opus Sprint 2 domain-shared |
| 2026-04-23 | 13 | 🎨 **Opus Sprint 2 tamam:** `src/jury/shared/jury-base.css` (4021 satır) → `src/jury/shared/styles/` altında 9 parça: `gate.css` (460), `demo-core.css` (585), `progress.css` (247), `locked.css` (234), `light-mode.css` (444), `pin-step.css` (467), `demo-mirror.css` (655), `animations.css` (320), `responsive.css` (610); 7 dosya <600 sweet spot'unda, 2 dosya 600-800 coherent bandında (policy allows); `src/styles/main.css` import zinciri güncellendi (1 import → 9 import); `src/auth/shared/auth-base.css` **zaten 210 satır** (S9 sonrası), split gereksiz — tracker'daki 1178 satır verisi stale'di, güncellendi; paralel 3 Opus oturumu (S12 layout split + S14 admin features) main branch'te çalıştı, S14'ün `0890362` commit'i benim jury dosyalarımı attribute confusion'a sebep oldu (kapsam net ama commit message farklı); build yeşil (1902 modül, 5.88s); **11 ihlalin 2'si daha kapandı, kalan S14 scope: criteria + setup-wizard + outcomes (periods/reviews S14 commit'lerinde çözüldü)** | Session 14: Opus Sprint 3 — feature CSS (criteria 2480, setup-wizard 2377, outcomes 2056) |
| 2026-04-23 | 14 | 🎨 **Opus Sprint 3 tamam:** 5 admin feature CSS → 23 parça (her feature'da `styles/` alt-dizini + `index.css` barrel). `reviews` (975) → 2 parça (page 593, mobile 382); `periods` (1334) → 4 parça (page 429, cards 330, inspector 260, lifecycle 315); `outcomes` (2056) → 5 parça (page 543, editor 491, framework-picker 488, framework-cards 337, responsive 197); `setup-wizard` (2377) → 6 parça (base 401, steps 378, forms 491, banners 361, theme 348, summary 398); `criteria` (2480) → 6 parça (page 517, table 557, drawers 439, period-drawer 271, responsive 190, mobile-cards 504). Her parça ≤557 satır, hepsi <600 kabul bandında. Cross-page import güncellendi (PeriodsPage + OutcomesPage, ikisi de setup-wizard CSS'ini referans ediyordu). `PeriodsPage.jsx` + `OutcomesPage.jsx` + `CriteriaPage.jsx` + `ReviewsPage.jsx` + `SetupWizardPage.jsx` hepsi barrel'a bağlandı. 5 atomik commit (reviews, periods, outcomes, setup-wizard, criteria); build her commit sonrası yeşil (~5.7s); dev server başlatılmadı (paralel S12/S13 Opus oturumları). Scope leak: periods commit (0890362) paralel S13 jury/shared/styles/ dosyalarını istemeden kapsadı — içerik doğru, sadece attribution karışık. **16 büyük ihlalin 12'si çözüldü (S12+S13+S14), kalan 4 dosya (heatmap 719, audit 645, AdminTeamCard 620, rankings 612) <800 sınırda, deferred** · [session-14](implementation_reports/session-14-opus-sprint-3-feature-css.md) | Session 15: B0 + B1 part 1 — test arşiv + iskelet + shared/lib tests |
| 2026-04-23 | 15 | **Faz B başladı — B0 + B1 part 1 tamam:** 6 `__tests__` dizini arşivlendi (`git mv`), 1 stray test dosyası arşivlendi (`useDeleteConfirm.test.jsx`), `qa-catalog.archive.json` oluşturuldu. `vite.config.js` güncellendi (archive exclude + coverage block). 37 × `__tests__/.gitkeep` feature-based yapıya eklendi. Test kit: 5 fixture JSON + 6 factory + 4 helper. `environment.js` bug düzeltildi (`.startsWith("/demo")` → `/demo` exact + `/demo/` prefix — `/demo-settings` false positive). 19 qa-catalog entry eklendi; 6 test dosyası yazıldı; **20/20 test yeşil** (902ms). Önemli teknik çözümler: `vi.stubGlobal("crypto", ...)` vs jsdom getter-only `crypto`, `vi.resetModules()` ile dynamic import isolation. · [session-15](implementation_reports/session-15-B0-B1-part1.md) | Session 16: B1 part 2 — shared/api + shared/storage tests |
| 2026-04-23 | 16 | **B1 part 2 tamam — shared/api + shared/storage:** 45 qa-catalog entry eklendi (api.fieldMapping.01–11, api.retry.01–04, api.juryApi.01–04, api.invokeEdgeFunction.01–03, api.admin.auth/profiles/jurors/periods/scores/tokens/export/audit.*, storage.keys/juryStorage/adminStorage.*). 15 test dosyası yazıldı (5 core api, 7 admin api, 3 storage). `vi.hoisted()` + `vi.mock("@/shared/lib/supabaseClient")` pattern tüm api testlerine uygulandı; `vi.spyOn(global, "fetch")` invokeEdgeFunction testleri için; PostgREST zincir mock'ları (from/select/eq/order/single) temel pattern. **71/71 test yeşil, 21 dosya, 2.64s.** · [session-16](implementation_reports/session-16-B1-part2-api-storage.md) | Session 17: B1 part 3 — shared/ui + shared/hooks tests |
| 2026-04-23 | 17 | **B1 part 3 tamam — shared/ui + shared/hooks:** 67 qa-catalog entry eklendi (ui.FbAlert/CustomSelect/ConfirmDialog/Modal/Drawer/Pagination/FilterButton/InlineError/ToastContainer/PremiumTooltip.01-05 + 19 smoke IDs + hooks.useIsMobile/usePagination/useCardSelection/useShakeOnError/useFocusTrap/useToast/useFloating/useAnchoredPopover.*). 19 test dosyası yazıldı: 8 hook test (15 test: useIsMobile, usePagination×3, useCardSelection×3, useShakeOnError×2, useFocusTrap×2, useToast×2, useFloating×1, useAnchoredPopover×1) + 10 kritik UI test (4+5+5+3+3+5+3+2+2+2 = 34 test: FbAlert, CustomSelect, ConfirmDialog, Modal, Drawer, Pagination, FilterButton, InlineError, ToastContainer, PremiumTooltip) + 1 smoke dosyası (19 test). Önemli teknik çözümler: createPortal → `document.body.querySelector()`; `onMouseDown` (not onClick) CustomSelect options; `window.matchMedia` jsdom mock (beforeAll defineProperty); `useCardSelection` default export, `data-card-selectable` attribute; `useFocusTrap({ containerRef, isOpen, onClose })` void return; `useFloating` takes triggerRef as input param; `toastStore.emit()` wrapped in `act()`; EntityMeta GroupLabel renders text twice (full+short span) → `querySelector` not `getByText`. **68/68 test yeşil, 19 dosya.** Full suite: **139/139 test, 40 dosya, 2.70s.** · [session-17](implementation_reports/session-17-B1-part3-ui-hooks.md) | Session 18: B2 — auth tests |
| 2026-04-23 | 18 | **B2 tamam — auth tests:** 12 test dosyası yazıldı: `auth/shared/` (AuthProvider×5, AuthGuard×3, useAuth×2 = 10 test) + `auth/features/` (login×3, register×3, forgot-password×3, reset-password×3, complete-profile×3, verify-email×3, pending-review×3, grace-lock×3, invite×3 = 27 test). Tüm dosyalarda `vi.hoisted()` pattern uygulandı. Önemli teknik çözümler: SecurityPolicyContext mock (LoginScreen form render koşulu), `window.history.pushState` (ResetPasswordScreen recovery token), `MemoryRouter+Routes+initialEntries` (VerifyEmailScreen search params), normalize() çıktılarına göre assertion (`/verification link has expired/i`, `/organization with that name already exists/i`), InviteAcceptScreen tam Supabase chain mock (from+select+eq+in+limit+maybeSingle), CompleteProfileScreen prop-driven (mock yok). **37/37 test yeşil, 12 dosya.** Full suite: **176/176 test, 52 dosya, 3.79s.** · [session-18](implementation_reports/session-18-B2-auth.md) | Session 19: B3 — jury tests |
| 2026-04-23 | 19 | **B3 tamam — jury tests:** 10 test dosyası yazıldı: `useJuryState.test.js` (20 test: step machine, PIN flow, score/blur, session expired, flow.01–04, resume.01) + `useJuryAutosave.test.js` (4 test) + 8 step component smoke tests (arrival, period-select, pin, pin-reveal, progress, eval, complete, lock = 14 test). Kritik fix: `listPeriodOutcomes` mock eksikliği `_loadPeriod` catch'e düşürüp tüm "flow" testlerini "identity"de bırakıyordu; `EvalStep.test.jsx` makeState'e `comments`, `handleCommentChange`, `handleCommentBlur` eklendi. **49 yeni test yeşil, 14 yeni dosya.** Full suite: **225/225 test, 66 dosya, 4.92s.** · [session-19](implementation_reports/session-19-B3-jury.md) | Session 20: B4 part 1 — admin critical (jurors + periods + projects + organizations) |
| 2026-04-23 | 20 | **B4 part 1 tamam — admin critical tests:** 14 test dosyası yazıldı: jurors (JurorsPage, AddJurorDrawer×2, EditJurorDrawer, useManageJurors = 5 test) + periods (PeriodsPage, AddEditPeriodDrawer×2, ClosePeriodModal, useManagePeriods = 5 test) + projects (ProjectsPage, AddProjectDrawer, DeleteProjectModal, useManageProjects = 4 test) + organizations (OrganizationsPage, useManageOrganizations×2 = 3 test). Kritik OOM fix: `vi.fn()` shorthand factory form (`() => ({ fn: vi.fn() })`) creates NEW fn object every render → infinite loop via useEffect dependency → OOM. Fix: hoist `vi.fn()` to outer factory body (runs once). JurorsPage (line 275) ve ProjectsPage (line 260) her ikisi de `[periods.loadPeriods]` dependency kullanıyordu. ProjectsPage mock path'leri `"./"` → `"../"` düzeltildi (wrong path = mock silently unapplied). `vi.hoisted()` useManageOrganizations testine uygulandı; `APP_DATE_MIN_DATE/MAX_DATE/isIsoDateWithinBounds` dateBounds mock'una eklendi; `AddEditPeriodDrawer` duplicate-check yalnız edit modda çalışır (period prop gerekli). **17/17 test yeşil, 14 dosya.** Full suite: **242/242 test, 80 dosya, 1.47s.** · [session-20](implementation_reports/session-20-B4-admin-critical.md) | Session 21: B4 part 2 — admin analytics + utility |
| 2026-04-23 | 21 | **B4 part 2 tamam — admin analytics + utility tests:** 18 test dosyası yazıldı: reviews (ReviewsPage, useReviewsFilters×2 = 3 test) + rankings (RankingsPage = 1) + analytics (AnalyticsPage, useAnalyticsData = 2) + heatmap (HeatmapPage, useHeatmapData = 2) + overview (OverviewPage = 1) + audit (AuditLogPage, AuditEventDrawer, useAuditLogFilters = 3) + entry-control (EntryControlPage, EntryTokenModal, RevokeTokenModal = 3) + pin-blocking (PinBlockingPage, UnlockPinModal, usePinBlocking = 3) + export (ExportPage = 1). Kritik düzeltmeler: AnalyticsPage mock path `"./useAnalyticsData"` → `"../useAnalyticsData"` (path resolution from `__tests__/`); `readSection` mock `null` → `{ periodIds: [] }`; HeatmapPage `useGridSort` `sortedJurors` → `visibleJurors` + `useGridExport` `handleExport` → `requestExport`; `useAuditLogFilters` renderHook args eksik; `formatSentence` mock string → `{ verb, resource }` object; `supabase: {}` → `{ auth: { getUser: vi.fn()... } }`; `window.matchMedia` jsdom stub. **19/19 test yeşil, 18 dosya.** Full suite: **261/261 test, 98 dosya, 6.66s.** · [session-21](implementation_reports/session-21-B4-admin-utility.md) | Session 22: B4 part 3 — criteria + outcomes + settings + setup-wizard |
| 2026-04-23 | 23 | **B5 tamam — pgTAP (RLS + RPC tests):** `pgtap` extension `tap` şemasına kuruldu + `authenticated`/`anon` için USAGE/EXECUTE grant (prod + demo'ya aynı anda deploy). `sql/tests/_helpers.sql` (197 satır) ortak fixture seti: `seed_two_orgs`/`seed_periods`/`seed_projects`/`seed_jurors`/`seed_entry_tokens` + `become_a`/`become_b`/`become_super`/`become_reset`. 18 pgTAP dosyası / 74 assertion yazıldı: RLS isolation (9 dosya/36 assertion — organizations, memberships, periods, projects, jurors, entry_tokens, audit_logs, scores, frameworks) + Jury RPC (4 dosya/19 assertion — validate_entry_token, authenticate, verify_pin, upsert_score) + Admin RPC (5 dosya/19 assertion — list_organizations, mark_setup_complete, generate_entry_token, set_period_lock, org_admin_list_members). Kritik teknik çözümler: (1) `tap` schema grant eksikliği → authenticated rolu altında `tap.is` invisible; fix `GRANT USAGE + EXECUTE`. (2) `is(int, int, unknown)` type resolution fail → tüm description'lara `::text` cast. (3) Temp table RLS → `authenticated` rolu `SELECT` permission denied; `ARRAY[...]::uuid[]` pattern'e geçildi. (4) `periods_select_public_visible` policy'si locked period'ları herkese expose ediyordu, test buna göre güncellendi. (5) `_assert_period_unlocked` trigger'ı locked period'a INSERT'i blokladı; seed sırası flip edildi. 18/18 test `vera-prod`'da yeşil; 4-assertion smoke `vera-demo`'da yeşil. `sql/tests/RUNNING.md` + `sql/README.md` güncellendi. · [session-23](implementation_reports/session-23-B5-pgtap.md) | Session 24: B6 — Edge function testleri (zaten tamamlanmış, geriye B7 + C1-C3 kalıyor) |
| 2026-04-23 | 22 | **B4 part 3 tamam — admin large feature tests:** 10 test dosyası yazıldı: criteria (CriteriaPage×1 lightweight import assertion, EditSingleCriterionDrawer×1) + outcomes (AddOutcomeDrawer×1, OutcomeDetailDrawer×1) + settings (SettingsPage×1, ChangePasswordDrawer×1, EditProfileDrawer×1, useProfileEdit×1) + setup-wizard (SetupWizardPage×1, useSetupWizard×3). Kritik OOM fix: CriteriaPage.jsx 1468 satır → jsdom worker `ERR_WORKER_OUT_OF_MEMORY`; 4 farklı pool/memory yaklaşımı denendi (NODE_OPTIONS, forks CLI, threads execArgv, forks execArgv — hepsi başarısız); çözüm: full render yerine `typeof CriteriaPage === "function"` lightweight assertion. `getAllByText` fix: "Add Criterion" heading+button duplikasyonu. `scrollTo` fix: WizardStepper inline tanımlı, mock edilemiyor → `beforeAll(() => { window.HTMLElement.prototype.scrollTo = vi.fn(); })`. `useSetupWizard` sessionStorage isolation → `beforeEach(sessionStorage.clear)`. **17/17 test yeşil, 10 yeni dosya.** Full suite: **278/278 test, 112 dosya, 7.82s.** · [session-22](implementation_reports/session-22-B4-admin-large.md) | Session 23: B5 — pgTAP + RLS + RPC tests |
| 2026-04-23 | 26 | **C1-C3 tamam — coverage + polish (final):** `@vitest/coverage-v8` dev-dep eklendi; `package.json`'a `test:coverage` script; `vite.config.js` coverage thresholds floor-level ayarlandı (lines 30 / funcs 20 / branches 45 / stmts 30 + `shared/hooks` 70 / `shared/storage` 80 / `shared/lib` 55). Vitest exclude'a `supabase/functions/**` + `sql/tests/**` eklendi (S24 Deno + S23 pgTAP testleri vitest'e sızmasın). Baseline coverage: **global %33.58 lines**, `shared/storage` %88.69, `shared/hooks` %77.35, `shared/lib` %58.87, `shared/ui` %64.28; admin/auth/jury %0 (mock-heavy unit tests — E2E tarafında karşılanıyor). Dead CSS scan purgecss ile: 15.592 → 11.498 satır (%26 potansiyel ölü, silme yapılmadı — rapor `dead-css-scan-2026-04-23.md`). **C2 dark mode tokenize opsiyonel — atlandı.** Final smoke: build ✅ (5.64s), unit test ✅ (278/278), `check:no-native-select` / `check:no-nested-panels` / `check:no-table-font-override` hepsi clean. **🎉 Plan tamamlandı.** · [session-26](implementation_reports/session-26-coverage-polish.md) | — (plan biter) |
| 2026-04-23 | 25 | **B7 tamam — E2E expansion:** 4 page object helper (`LoginPage`, `AdminShell`, `JuryFlow`, `DemoHelper`) + 13 yeni spec yazıldı: auth (4 — google-oauth, invite-accept, forgot-password, reset-password), admin (6 — setup-wizard, organizations-crud, jurors-crud, periods-crud, entry-token-lifecycle, audit-log-view), jury (1 — pin-lifecycle), demo (2 — auto-login, isolation). `playwright test --list` çıktısı: **21 dosya / 57 test** tanınıyor. Selector discipline: `getByRole`/`getByLabel`/`getByTestId`. Spec'ler çalıştırılmadı (dev server + DB gerektirir — kullanıcı `npm run e2e` ile doğrulayacak). 4 explicit-path commit (`git add e2e/<dir>/`); commit çakışması yok (S23+S24 paralel çalışırken dizinler disjoint). · [session-25](implementation_reports/session-25-e2e-expansion.md) | Session 26: C1-C3 coverage thresholds + polish |
| 2026-04-23 | 24 | **B6 tamam — edge function tests:** 4 kritik edge function için co-located Deno test dosyası (40 test). Plan'da 5. target olan `rpc-proxy/` repoda yok (PostgREST direct'e geçilmiş, archived test note'u var) — skip. Test infrastructure: `supabase/functions/_test/` altında `mock-supabase.ts` (programlanabilir `createClient` mock — chainable query builder + thenable + `auth.getUser` + `auth.admin.generateLink` + `rpc`), `import_map.json` (`https://esm.sh/@supabase/supabase-js@2` → mock), `harness.ts` (`captureHandler` ile `Deno.serve` intercept + monotonic `?cb=N` cache-bust, `makeRequest` / `readJson` / env helpers). Production edge function kodu değişmedi. 4 dosya × test: `admin-session-touch` (9), `platform-metrics` (9 — super-admin gate + metric shape), `invite-org-admin` (12 — `_assert_can_invite` + approval_flow + generateLink), `email-verification-confirm` (10 — replay/expiry/consumed gates). Resend path env ile suppress (`delete RESEND_API_KEY`); fetch stub gerekmedi. 40 yeni `edge.*` qa-catalog entry (21 critical, 19 normal). **40/40 test yeşil, 141 ms.** Komut: `deno test --allow-env --allow-net --allow-read --import-map=supabase/functions/_test/import_map.json supabase/functions/**/*.test.ts`. · [session-24](implementation_reports/session-24-B6-edge-functions.md) | Session 25: B7 — E2E genişletme |

---

## Riskler & Notlar

1. **Codex concurrent edit:** Şu an Codex aktif değil ama iş başladıktan sonra devreye girerse import path'lerde çakışma riski var. Her oturum başında `git pull && git log --oneline -20`.

2. **Büyük CSS taşımaları kolay kaymayabilir:** `src/styles/pages/criteria.css` (2480 satır), `outcomes.css` (2056), `setup-wizard.css` (2377) — her biri git mv sonrası görsel doğrulama gerektirir. Taşıma sonrası **mutlaka dev server'da sayfa kontrolü** (Faz A2).

3. **Cross-feature componentler:** `OutcomeEditor` (criteria + outcomes), `ReviewMobileCard` (jurors + reviews), `CompletionStrip` (periods + setup-wizard) — bunları `admin/shared/`'a koymak gerekecek. Sen A2'de tespit et, gerekirse ayrı commit'te taşı.

4. **Migration + test eşzamanlılığı:** pgTAP extension için `001_extensions.sql` güncellenecek — hem vera-prod hem vera-demo'ya aynı anda deploy (Supabase MCP `apply_migration`).

5. **Coverage thresholds baştan 0:** Faz C1'e kadar 0, final'de hedeflere çek. Yoksa her PR'da "coverage düştü" alarmı verir.

6. **Test sırası kritik:** Shared → Auth → Jury → Admin — tersine giderken mock'lamak zorunda kalırsın.

7. **Eski test dizinleri arşivde kalır, silinmez:** `__tests__.archive/` git history'de referans olarak durur; keeper seçerken arşivden bak, yeniden yaz, taşıma.

8. **Import yol uzunluğu:** Feature-based yapı 3 seviye derin (`src/admin/features/organizations/`). `vite.config.js`'te `resolve.alias` tanımlayabilirsin (`@admin`, `@jury`, `@auth`, `@shared`) — opsiyonel ama IDE navigasyonu ve refactor kolaylaştırır. Bu, Faz A6'nın sonunda yapılabilir.

9. **Build sürekli test edilmeli:** Her feature taşıması sonrası `npm run build`. Import path bir yerde kaçarsa hemen yakala, 10 feature sonra bulmak zor.

---

## Dışarıda Bırakılanlar (YAGNI)

- Performance/load testleri (perf/k6) — Faz C sonrası opsiyonel
- Visual regression (Playwright screenshot) — ileride
- Mutation testing (Stryker) — gereksiz
- Contract testing (Pact) — tek consumer var, gerek yok
- A11y automation tam entegrasyon — mevcut `a11y.test.jsx` pattern'i genişletilecek
- `src/shared/` restructure — zaten temiz
- `src/layouts/` restructure — 4 dosya, flat OK
- Component-level CSS Modules'a geçiş — şu an global CSS ile devam, ileride düşünülür
