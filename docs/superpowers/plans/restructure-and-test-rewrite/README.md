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

### Sonnet High (~200k context) — 24 oturum

**Neden daha fazla?** Sonnet'in context penceresi Opus'un 1/5'i. Her oturumda daha az dosya okunup daha az iş bitirilebilir. Ama reasoning kalitesi güçlü, parçalara bölünmüş iş iyi yürür. Her oturum **2.5-4 saat** odaklı çalışma hedefler, oturum başı context kullanımı **%60-75**'te tutulur (buffer bırakarak).

**Durum simgeleri:** ✅ tamamlandı · ⏳ sırada · ⬜ bekliyor · 🔄 devam ediyor · ⏸️ askıda

| Durum | Oturum | Kapsam | Dosyalar | Süre | Beklenen context | Handoff durumu |
|---|---|---|---|---|---|---|
| ✅ | **1** (şu an) | Plan yazıldı | Bu dosya | 0.5 gün | %75 | Faz A0'a hazır |
| ✅ | **2** | A0 + A1 kick-off — iskelet + shared/ui'den 5-8 component CSS co-locate (FbAlert, CustomSelect, ConfirmDialog, PremiumTooltip, Modal, Drawer, Button, Card) | ~10 dosya + components.css düzenleme | 3 saat | %80 | A1 pattern validated (3/29 done); ConfirmDialog/Modal/Drawer skip (CSS zaten global file'da) |
| ✅ | **3** | A1 tamamla — kalan 26 shared/ui component araştırıldı; AsyncButtonContent + FilterButton + Pagination co-located; FloatingMenu/btn-loading-content global kaldı (65+ direct className kullanımı); 15 component CSS'siz (inline style veya global dosyada) | 6 yeni CSS dosyası + components.css düzenleme | 3 saat | ~%75 | A1 tamamlandı: 6/29 co-located, kalan 23 actionable değil; A2'ye geçiş |
| ⬜ | **4** | A2.1-A2.3 — overview + organizations + jurors | ~25 dosya + 3 page CSS | 3-4 saat | %70 | 3 feature taşındı, build yeşil |
| ⬜ | **5** | A2.4-A2.6 — periods + projects + **criteria** (criteria.css 2480 satır — ağır) | ~22 dosya + 3 page CSS | 4 saat | %75 | Criteria en büyük riski geçti |
| ⬜ | **6** | A2.7-A2.9 — **outcomes** (2056 satır CSS) + reviews + rankings | ~15 dosya + 3 page CSS | 3-4 saat | %70 | 9 admin feature tamam |
| ⬜ | **7** | A2.10-A2.13 — analytics + heatmap + audit + entry-control | ~16 dosya + 4 page CSS | 3 saat | %65 | 13 admin feature tamam |
| ⬜ | **8** | A2.14-A2.17 — pin-blocking + settings + **setup-wizard** (2377 satır CSS) + export | ~20 dosya + 4 page CSS | 4 saat | %75 | **Tüm 17 admin feature tamam** |
| ⬜ | **9** | A3 — jury restructure (9 feature + jury/shared, jury.css 4021 satır split) | ~25 dosya + jury.css + jury-arrival.css | 4 saat | %75 | Jury bitti |
| ⬜ | **10** | A4 — auth restructure (9 feature + auth/shared, auth.css 1178 satır) | ~12 dosya + auth.css | 2-3 saat | %60 | **Aşama A source taşıma bitti** |
| ⬜ | **11** | A5 — components.css (5664 → ~1500 satır) split + main.jsx import yeniden düzenleme | components.css + 8 yeni dosya + main.jsx | 3-4 saat | %70 | Kalan components.css global |
| ⬜ | **12** | A6 + A7 — import cleanup + eski dizin sil + src/styles/ finalize + tam smoke test | Grep + cleanup + 17 admin page + jury + demo gezerek visual check | 3 saat | %60 | **Aşama A bitti**, tüm sayfalar görsel OK |
| ⬜ | **13** | B0 + B1 part 1 — test arşiv + iskelet + test kit (fixtures, factories, helpers) + shared/lib tests (environment, supabaseClient, utils, dateUtils, demoMode, randomUUID) | ~15 dosya | 3-4 saat | %70 | Shared/lib %100 test edildi |
| ⬜ | **14** | B1 part 2 — shared/api + shared/storage tests (fieldMapping, invokeEdgeFunction, juryApi, admin/*, keys, juryStorage, adminStorage) | ~30 test dosyası | 4 saat | %75 | Shared/api + storage bitti |
| ⬜ | **15** | B1 part 3 — shared/ui + shared/hooks tests (kritik 10 UI component ayrıntılı + diğer 19 smoke + 8 shared hook) | ~25 test dosyası | 3-4 saat | %70 | **Shared katman bitti, en büyük bağımlılık sağlam** |
| ⬜ | **16** | B2 — auth tests (9 feature × 3 test + AuthProvider + AuthGuard + useAuth) | ~30 test dosyası | 3-4 saat | %70 | Auth testleri bitti |
| ⬜ | **17** | B3 — jury tests (useJuryState step machine detaylı + 9 step component + writeGroup + lock + autosave) | ~15 test dosyası | 4 saat | %75 | Jury testleri bitti |
| ⬜ | **18** | B4 part 1 — admin critical (jurors + periods + projects + organizations) full kapsam | ~20 test dosyası | 4 saat | %75 | 4 kritik admin feature test edildi |
| ⬜ | **19** | B4 part 2 — admin analytics (reviews + rankings + analytics + heatmap) + admin utility (overview + audit + entry-control + pin-blocking + export) | ~25 test dosyası | 4 saat | %75 | 13 admin feature test edildi |
| ⬜ | **20** | B4 part 3 — admin large (criteria + outcomes + settings + setup-wizard) | ~15 test dosyası | 3-4 saat | %70 | **Tüm admin feature testleri bitti** |
| ⬜ | **21** | B5 — pgTAP setup (extension) + 8 RLS isolation + 20 kritik RPC davranışı | ~28 SQL test | 3 saat | %65 | DB katmanı test edildi |
| ⬜ | **22** | B6 — Edge function testleri (5 kritik: rpc-proxy, admin-session-touch, platform-metrics, invite-org-admin, email-verification-confirm) | ~5 Deno test | 2-3 saat | %55 | Edge testleri bitti |
| ⬜ | **23** | B7 — E2E genişletme (13 yeni spec + page objects) | ~15 spec + helpers | 4 saat | %75 | **Test yazımı bitti (Aşama B)** |
| ⬜ | **24** | C1-C3 — coverage thresholds + dark mode tokenize + dead CSS scan + final smoke | vitest config + variables.css + purgecss | 2-3 saat | %55 | **Hepsi bitti, CI yeşil** |

**Toplam: 24 oturum (1 plan + 23 çalışma) ≈ 60-75 saat ≈ 12-15 iş günü.**

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

- [ ] **Step 1: Mevcut build sağlam mı?**

```bash
npm run build
```

Expected: Build başarılı. (Fail ederse önce build fix.)

- [ ] **Step 2: Mevcut testler nasıl?**

```bash
npm test -- --run 2>&1 | tail -30
```

Expected: Baseline — 412 pass, 64 fail (2026-04-22 itibariyle).

- [ ] **Step 3: Feature iskeletini oluştur**

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

- [ ] **Step 4: Commit (boş iskelet)**

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

- [ ] **Step A1.N.1: İlgili CSS bölümünü `src/styles/components.css` içinde bul**

```bash
grep -n "^/\*.*FbAlert\|^.fb-alert\|\.fs-confirm-panel" src/styles/components.css
```

- [ ] **Step A1.N.2: Bölümü kes, component klasörüne yapıştır**

`src/shared/ui/FbAlert.css` oluştur, ilgili satırları components.css'ten oraya taşı.

- [ ] **Step A1.N.3: Component dosyasında CSS import et**

`src/shared/ui/FbAlert.jsx` en üstüne ekle:

```jsx
import "./FbAlert.css";
```

- [ ] **Step A1.N.4: `src/main.jsx`'ten de bu CSS hala yükleniyor mu kontrol**

`src/main.jsx` içinde `import "./styles/components.css"` hâlâ var ama artık FbAlert bölümü boş olmalı.

- [ ] **Step A1.N.5: Dev server'da görsel doğrulama**

```bash
npm run dev
```

FbAlert kullanılan her sayfada (jury flow, admin reviews) stilin kaybolmadığını kontrol et.

- [ ] **Step A1.N.6: Commit**

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

- [ ] **Step 1: Dosyaları taşı**

```bash
git mv src/admin/pages/OverviewPage.jsx src/admin/features/overview/OverviewPage.jsx
git mv src/styles/pages/overview.css src/admin/features/overview/OverviewPage.css
```

- [ ] **Step 2: OverviewPage.jsx'te CSS import'u ekle**

Read OverviewPage.jsx. En üstteki import blokuna ekle:

```jsx
import "./OverviewPage.css";
```

- [ ] **Step 3: OverviewPage.jsx'teki göreceli import'ları düzelt**

Eski: `import { X } from "../hooks/foo"` (admin/pages/ → admin/hooks/)
Yeni: `import { X } from "../../hooks/foo"` (admin/features/overview/ → admin/hooks/)

Grep ile tüm göreceli import'ları bul ve güncelle:

```bash
grep -n "^import.*from \"\\.\\.\\/\"" src/admin/features/overview/OverviewPage.jsx
```

- [ ] **Step 4: Router'da import yolu güncelle**

`src/router.jsx`:

```diff
- const OverviewPage = lazy(() => import("./admin/pages/OverviewPage"));
+ const OverviewPage = lazy(() => import("./admin/features/overview/OverviewPage"));
```

- [ ] **Step 5: `src/main.jsx`'ten global overview.css import'unu kaldır**

```diff
- import "./styles/pages/overview.css";
```

- [ ] **Step 6: Diğer yerlerden OverviewPage import'u var mı?**

```bash
grep -rn "admin/pages/OverviewPage" src/
```

Expected: Yalnızca `src/router.jsx`. Başka yer varsa güncelle.

- [ ] **Step 7: Build + dev doğrulama**

```bash
npm run build
```

```bash
npm run dev
# /admin/overview sayfasını aç, görsel kontrol
```

- [ ] **Step 8: Commit**

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

- [ ] **Step 1: Tüm dosyaları feature klasörüne taşı**

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

- [ ] **Step 2: components.css'ten organizations'a özgü stilleri çıkart**

```bash
grep -n "organization\|tenant-switcher\|admin-team" src/styles/components.css
```

İlgili bölümleri (muhtemelen 100-300 satır) yeni `src/admin/features/organizations/OrganizationsPage.css`'e taşı.

- [ ] **Step 3: CSS import'ları ekle**

Her JSX dosyasının başına kendi component CSS'ini import et.

- [ ] **Step 4: Göreceli import'ları düzelt**

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

- [ ] **Step 5: Router güncelle**

```diff
- const OrganizationsPage = lazy(() => import("./admin/pages/OrganizationsPage"));
+ const OrganizationsPage = lazy(() => import("./admin/features/organizations/OrganizationsPage"));
```

- [ ] **Step 6: Diğer yerlerde import var mı kontrol**

```bash
grep -rn "admin/drawers/CreateOrganizationDrawer\|admin/drawers/ManageBackupsDrawer\|admin/drawers/ViewSessionsDrawer\|admin/components/TenantSwitcher\|admin/components/AdminTeamCard\|admin/hooks/useManageOrganizations" src/
```

Her bulunan yeri yeni yola güncelle.

- [ ] **Step 7: Build + dev test**

```bash
npm run build && npm run dev
```

`/admin/organizations` + `/admin/settings` (team card kullanıyor olabilir) + TenantSwitcher (topbar) kontrol.

- [ ] **Step 8: Commit**

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

- [ ] **Step 1-8: A2.2 pattern'ını uygula**

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

### A2.9-A2.17 — Kalan featurelar

Oturum 3'te aynı pattern'le tamamlanacak:

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

- [ ] **Step 1: Eski test dizinlerini arşivle**

```bash
git mv src/admin/__tests__ src/admin/__tests__.archive 2>/dev/null || true
git mv src/auth/__tests__ src/auth/__tests__.archive 2>/dev/null || true
git mv src/jury/__tests__ src/jury/__tests__.archive 2>/dev/null || true
git mv src/shared/__tests__ src/shared/__tests__.archive 2>/dev/null || true
git mv src/admin/hooks/__tests__ src/admin/hooks/__tests__.archive 2>/dev/null || true
git mv sql/__tests__ sql/__tests__.archive 2>/dev/null || true
git mv src/test/qa-catalog.json src/test/qa-catalog.archive.json
```

- [ ] **Step 2: Boş qa-catalog**

`src/test/qa-catalog.json`:

```json
[]
```

- [ ] **Step 3: Vitest exclude**

`vitest.config.js` içinde `test.exclude`:

```js
exclude: [
  "**/node_modules/**",
  "**/e2e/**",
  "**/__tests__.archive/**",
]
```

(`vitest.config.allure.mjs` için de aynı.)

- [ ] **Step 4: Yeni test dizin iskeleti (feature-based)**

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

- [ ] **Step 5: Test kit iskeleti**

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

- [ ] **Step 6: Coverage config**

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

- [ ] **Step 7: Boş test run**

```bash
npm test -- --run
```

Expected: "No test files found".

- [ ] **Step 8: Commit**

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

- [ ] **Step 1: qa-catalog'a ekle**

```json
[
  { "id": "shared.lib.environment.01", ... },
  { "id": "shared.lib.environment.02", ... }
]
```

- [ ] **Step 2: Test yaz**

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

- [ ] **Step 3: Çalıştır**

```bash
npm test -- --run src/shared/__tests__/lib/environment.test.js
```

- [ ] **Step 4: Commit**

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
| overview | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| organizations | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| jurors | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| periods | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| projects | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| criteria | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| outcomes | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| reviews | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| rankings | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| analytics | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| heatmap | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| audit | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| entry-control | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| pin-blocking | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| settings | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| setup-wizard | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| export | ⬜ | ⬜ | ⬜ | Bekliyor | — |

### Jury (9 feature)

| Feature | Source | CSS | Tests | Durum | Report |
|---|---|---|---|---|---|
| arrival | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| identity | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| period-select | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| pin | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| pin-reveal | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| progress | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| evaluation | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| complete | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| lock | ⬜ | ⬜ | ⬜ | Bekliyor | — |
| jury/shared | ⬜ | ⬜ | ⬜ | Bekliyor | — |

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
| components.css split (5664 → ~1500 satır) | ⬜ Bekliyor | — |
| src/styles/ finalize (globals-only) | ⬜ Bekliyor | — |
| Eski `__tests__/` → `__tests__.archive/` | ⬜ Bekliyor | — |
| Test kit (fixtures + factories + helpers) | ⬜ Bekliyor | — |
| qa-catalog.json sıfırla + yeniden yaz | ⬜ Bekliyor | — |
| pgTAP extension + 8 RLS + 20 RPC test | ⬜ Bekliyor | — |
| Edge function testleri (5 kritik) | ⬜ Bekliyor | — |
| E2E genişletme (8 → 25 spec) | ⬜ Bekliyor | — |
| Coverage thresholds + CI | ⬜ Bekliyor | — |
| Dark mode tokenize (opsiyonel) | ⬜ Bekliyor | — |
| Dead CSS scan (purgecss) | ⬜ Bekliyor | — |

### Toplam ilerleme

**0 / 35 feature taşındı** · **0 / 35 feature CSS co-located** · **0 / 40 modül test edildi** · **0 / 11 altyapı task tamam**

> Her oturum sonunda ilgili satırlar güncellenir ve Report sütununa `[session-NN-konu.md](implementation_reports/session-NN-konu.md)` linki eklenir.

---

## Progress Log

| Tarih | Oturum | Tamamlanan | Sonraki |
|---|---|---|---|
| 2026-04-22 | 1 | Plan yazıldı — feature-based restructure + test rewrite + CSS co-location + parity tracker | Faz A0 (iskelet) |
| 2026-04-22 | 2 | A0 iskelet (38 .gitkeep), A1: FbAlert + CustomSelect + PremiumTooltip CSS co-located (3/29); ConfirmDialog/Modal/Drawer skip (global dosyalarda) | Session 3: kalan 26 shared/ui component |
| 2026-04-22 | 3 | A1 tamamlandı: AsyncButtonContent + FilterButton + Pagination CSS co-located (6/29 toplam); FloatingMenu global kalacak (65+ direct className kullanımı); 15 component CSS'siz veya başka global dosyada; tüm 29 component incelendi | Session 4: A2.1–A2.3 admin feature taşıma (overview + organizations + jurors) |

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
