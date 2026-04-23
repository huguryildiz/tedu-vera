# VERA — Post-Restructure Cleanup, Rename & Refactor Sprint

> **Extension of:** `docs/superpowers/plans/restructure-and-test-rewrite/README.md`
> **Final location after approval:** `docs/superpowers/plans/restructure-and-test-rewrite/README-2.md`
> **Added sessions:** 27 → 33 (Sonnet High ~200k context)
> **Parent plan status at entry:** S1–S26c tamam, ana restructure kapandı. Bu uzantı closure sonrası ortaya çıkan teknik borçları adresliyor.

**Execution step 0 (before S27):** Bu plan dosyası `/Users/huguryildiz/.claude/plans/agile-hatching-stonebraker.md` konumundan alınıp `docs/superpowers/plans/restructure-and-test-rewrite/README-2.md` olarak repo'ya kopyalanacak. README.md'deki parent plan ile yan yana dursun, session executor'lar tek yerden okusun.

---

## Context

S1–S26c restructure + test rewrite + safe CSS cleanup kapandıktan sonra şu teknik borçlar geriye kaldı:

1. **Dead / duplicate CSS (A):** Bu oturumda `legacy-sections.css`, `legacy-responsive.css`, `legacy-light-mode.css` + sections.css'teki 3 ölü blok silindi (−885 satır). Ama `legacy-shell.css` (337) + `legacy-eyebrow.css` (287) değer farkları nedeniyle bırakıldı; global `src/styles/` CSS'lerinin dead-rule taraması henüz yapılmadı; `check:*-file-size` guard script'leri yok → CLAUDE.md kurallarının forward enforcement'ı eksik.
2. **Restructure artifacts (yeni bulgu):** Restructure iskeletinden kalan atıklar var: **36 adet `.gitkeep`** dosyası (klasörler artık dolu, placeholder gereksiz); **`src/jury/__tests__.archive/` + `src/admin/__tests__.archive/`** (5140 satır, 20+ eski test dosyası); **`src/admin/shared/useDeleteConfirm.test.archive.jsx`**; **`src/test/qa-catalog.archive.json`**; **`src/styles/drawers/crud-legacy.css`** (main.css'ten import ediliyor ama ismi "legacy" — incele ve ya sil ya da yeniden adlandır).
3. **Semester → Period rename (Kullanıcı direktifi):** `AddSemesterDrawer.jsx`, `EditSemesterDrawer.jsx`, `DeleteSemesterModal.jsx` (periods feature'ında) Period adıyla anılmalı. Tarama: 55 source dosyada "semester" ref'i var (admin + jury + styles + storage + tests; DB/edge temiz).
4. **Generic naming rename (Memory'den):** VERA'nın akademik-spesifik terimlerinden kurtulup geniş kitleye hitap etmesi için:
   - **"Students" → "Team Members"** (15 source dosyada referans, DB kolonu `students` kalabilir — sadece UI)
   - **"Supervisor" → "Advisor"** ZATEN YAPILMIŞ (0 source ref, memory stale — güncellensin)
   - ~~"Project Title" → "Title"~~ KAPSAM DIŞI (kullanıcı kararı 2026-04-23: "Project Title" olarak kalsın)
3. **JSX 1000+ violations (B):** CLAUDE.md'ye eklenen yeni JSX ceiling kuralı (500/800/1000) 11 dosyayı retroactive violation yapıyor: SetupWizardPage 2157, PeriodsPage 1765, OrganizationsPage 1712, EntryControlPage 1565, OutcomesPage 1534, CriteriaPage 1468, GovernanceDrawers 1307, JurorsPage 1271, LandingPage 1183, RankingsPage 1126, ProjectsPage 1032.
4. **CSS 600+ (C):** `HeatmapPage.css` 719 — 600 tavanını aşan tek hard candidate. Diğer 600-700 bandı (demo-mirror, AuditLog, portrait-toolbar, AdminTeamCard, RankingsPage) coherent, dokunulmuyor.
5. **Test coverage (D):** S26 coverage baseline `%33.58 lines`. Modals %0, edge functions kısmi, shared API %4. Hedef: %65+ global, %80+ kritik modül.

**Çıktı:** Tüm bu borçlar 7 oturum içinde kapanır; her oturum kendi implementation report'u, commit'i ve README/XLSX/Progress Log güncellemesiyle biter. Plan'ın en önemli prensibi parent plan'dakiyle aynı: **forward-only; retroactive fix yok; kuralı kır, plan'ı güncelle.**

---

## Scope (Dışarıda Bırakılanlar)

- Dark mode tokenize (parent plan'da C2 opsiyonel işaretlendi — ayrı sprint)
- E2E spec expansion (parent plan B7'de kapatıldı)
- pgTAP genişletme (parent plan B5'te kapatıldı)
- CLAUDE.md'de zaten yazılı yeni kuralın kendisi (eklendi, uygulanmaya başlandı)

---

## Session Plan (27 → 33)

Her session:

- Tek sorumluluk (rename, split, cleanup gibi)
- Bağımsız commit'lenebilir, geri alınabilir
- Kendi implementation report'u: `docs/superpowers/plans/restructure-and-test-rewrite/implementation_reports/session-NN-<slug>.md`
- Her session sonunda **3 yer** güncellenir: (1) README session table satırı `⏳ → ✅`, (2) XLSX satırı `DEVAM EDIYOR → TAMAMLANDI`, (3) Progress Log yeni satır.

### Session 27 — Legacy artifact cleanup + Guard scriptleri + HeatmapPage split

**Hedef:** Restructure'dan kalan atıkları sil, S26c'nin kaçırdığı iki legacy CSS dosyasını bitir, global CSS dead scan, iki guard script ekle, HeatmapPage.css 719 → split.

**Görevler:**

1. **`.gitkeep` temizliği** (36 dosya) — Her feature klasörü artık dolu. Güvenli sil komutu: `find src -name .gitkeep -delete`. Git tracked olanları `git rm` ile çıkar.
2. **Test archive klasörleri** (5140 satır):
   - `src/jury/__tests__.archive/` — 5 dosya
   - `src/admin/__tests__.archive/` — 16 dosya
   - `src/admin/shared/useDeleteConfirm.test.archive.jsx` — tek dosya
   - `src/test/qa-catalog.archive.json` — 0 referans
   - Vitest config'de zaten `*.archive*` glob'a dahil değil (include pattern `*.test.{js,jsx}`). Silmek güvenli. Ancak silmeden önce: git log ile referans göster, restructure kapandığı için history'de zaten erişilebilir.
3. **`src/styles/drawers/crud-legacy.css` değerlendirmesi** — main.css'ten hâlâ import ediliyor. Sınıfları (`.crud-overlay`, `.crud-drawer`, `.crud-form-group`) JSX'te kullanılıyor mu tara:
   - Kullanılıyorsa → `crud.css` olarak yeniden adlandır (legacy adı yanıltıcı)
   - Kullanılmıyorsa → sil + main.css'ten import satırını çıkar
4. **`legacy-shell.css` + `legacy-eyebrow.css` karar** — her dosya için:
   - Her selector için legacy'deki değer vs main'deki (hero/sections/light-mode) değer karşılaştır (diff script)
   - Aynı → legacy satır sil, main'de bırak
   - Farklı → hangisi doğru? Çalışan landing'i referans al, yanlış olanı sil. Her karar için 1 satır inline gerekçe (implementation report'a)
5. **Global CSS dead scan** — `src/styles/` altındaki non-feature dosyalar (variables, typography, utilities, layout, drawers/*, modals, ui-base/*, misc/*, table-system, status-pills, icon-surface, toast, maintenance, theme/*):
   - Mevcut PostCSS AST scripti S26c'den yeniden kullan (`dead-css-scan-2026-04-23.md`'de referans var)
   - Sadece kesin-dead (0 JSX match + 0 dinamik class construction) kuralları sil
6. **Guard scriptleri** — `scripts/` altına:
   - `check-js-file-size.mjs` → `src/**/*.{js,jsx}` tarar, 1000+ için HARD VIOLATION (exit 1), 800-1000 için WARN (exit 0, stderr). `__tests__` ve `.archive` hariç tut.
   - `check-css-file-size.mjs` → `src/**/*.css`, 1000+ HARD VIOLATION, 600-800 WARN. `/* size-ceiling-ok: <reason> */` üstbilgili dosyalar exempt (CLAUDE.md'de zaten bu escape hatch yazılı).
   - `package.json`'a script eklentileri: `check:js-size`, `check:css-size`. README/CLAUDE.md'de kullanım notu.
7. **HeatmapPage.css split** — 719 satır → `HeatmapPage.css` (core, ~400) + `HeatmapPage.responsive.css` (breakpoint overrides, ~300). Import chain düzelt.

**Beklenen dosya sayısı:** 36 .gitkeep sil + 22 archive test sil + 3 değerlendirme (crud-legacy + legacy-shell + legacy-eyebrow) + 2 yeni guard script + 1 CSS split + 2 rapor
**Süre:** ~2 saat (Sonnet High)
**Context:** ~%60
**Handoff:** S28 için temiz zemin

### Session 28 — Rename sprint (Semester → Period + Generic naming)

**Hedef:** Üç domain rename'ini tek oturumda bitir — birbirine yakın pattern'ler, tek grep/test döngüsü.

**28a — Semester → Period** (Kullanıcı direktifi, 55 dosya):

1. **Dosya renameları** (git mv, test path'leri de güncelle):
   - `src/admin/features/periods/AddSemesterDrawer.jsx` → `AddPeriodDrawer.jsx`
   - `src/admin/features/periods/EditSemesterDrawer.jsx` → `EditPeriodDrawer.jsx`
   - `src/admin/features/periods/DeleteSemesterModal.jsx` → zaten var `DeletePeriodModal.jsx` → ilk iş iki dosyayı diff'le. Aynı ise silme; farklı ise hangisi aktif kullanılıyorsa onu koru, diğerini sil ve usage'ları yönlendir. Kararı raporla.
   - `src/jury/features/period-select/SemesterStep.jsx` → `PeriodStep.jsx`
   - `src/jury/features/period-select/__tests__/SemesterStep.test.jsx` → `PeriodStep.test.jsx`
2. **Identifier refactor** — 55 dosyada: `semester`/`semesterId`/`semesters`/`currentSemester` → `period`/`periodId`/`periods`/`currentPeriod`. Props (`<X semester={...} />` → `<X period={...} />`), string literals ("Semester" → "Period"; TR "Dönem" korunabilir), comment'ler.
3. **Storage keys** — `src/shared/storage/{adminStorage,keys}.js`:
   - Eski: `vera:admin:filters:semester` → Yeni: `vera:admin:filters:period`
   - **Migration shim:** adminStorage init'te eski key varsa okuyup yeni'ye yaz, sonra sil. User preference'ları kaybolmasın.
4. **Verification:** `grep -ri "semester" src/` → 0.

**28b — Students → Team Members** (Memory, 15 dosya):

1. **UI layer rename** — sadece component, label, mesaj metinleri. DB kolonu `students` kalır; `fieldMapping` gerekmiyor çünkü UI-only.
2. Komponent prop isimleri: `students`, `studentList` → `teamMembers`, `teamMemberList` (opsiyonel — iç variable'lar değişmeyebilir, ana hedef UI string'leri)
3. Test fixture: `src/test/factories/buildProject.js` — students array'ini teamMembers olarak da expose et (backward compat için ikisi de dönebilir, yeni testler teamMembers kullanır)
4. Label çeviri örnekleri: "Students" → "Team Members", "Add Student" → "Add Team Member", "Student count" → "Member count"

**28c — Memory housekeeping:**

- `project_generic_naming.md`: Supervisor→Advisor satırını "✅ Done (2026-04-XX)" olarak işaretle (0 source ref bulundu — zaten yapılmış)
- Aynı memory'ye Semester→Period satırı ekle
- "Project Title → Title" satırını "❌ Scope'tan çıkarıldı (kullanıcı kararı 2026-04-23)" olarak işaretle

**Beklenen dosya sayısı:** ~70 edit + 5 rename + 2 storage shim + 1 test factory + 1 memory update
**Süre:** ~2 saat
**Context:** ~%70
**Handoff:** S29 için JSX split başlangıcı

### Session 29 — SetupWizardPage split (En büyük JSX)

**Hedef:** `src/admin/features/setup-wizard/SetupWizardPage.jsx` 2157 → 7 step modülü + orchestrator.

**Strateji:**

1. Mevcut `useSetupWizard.js` state orchestrator — dokunma (single source of state).
2. Her step content JSX'ini ayrı dosyaya:
   - `src/admin/features/setup-wizard/steps/WelcomeStep.jsx`
   - `…/steps/OrganizationStep.jsx`
   - `…/steps/PeriodStep.jsx` (S28'den sonra, adı hazır)
   - `…/steps/CriteriaStep.jsx`
   - `…/steps/FrameworkStep.jsx`
   - `…/steps/ProjectsStep.jsx`
   - `…/steps/JurorsStep.jsx`
   - `…/steps/CompletionStep.jsx`
3. `SetupWizardPage.jsx` orchestrator — stepper + router + `<{ActiveStep} wizard={wizard} />` pattern, ~300 satır hedef.
4. Her step ≤300 satır hedef; `useSetupWizard` prop drilling yerine tek `wizard` object.
5. Test dosyası path'leri güncelle (`__tests__/SetupWizardPage.test.jsx` + `useSetupWizard.test.js` dokunulmuyor).

**Beklenen dosya sayısı:** 1 page refactor + 8 new step files + 1 test path update
**Süre:** ~2.5 saat
**Context:** ~%75
**Handoff:** S30 için pattern validated

### Session 30 — Admin large pages split Part 1

**Hedef:** PeriodsPage 1765 + OrganizationsPage 1712 split.

**PeriodsPage breakdown:**

- `PeriodsPage.jsx` — orchestrator + handlers (~400 hedef)
- `PeriodsTable.jsx` — desktop table + row (~300)
- `PeriodsMobileCards.jsx` — mobile portrait cards (~200)
- `ReadinessPopover.jsx` — ZATEN AYRI (page içinde tanımlı değil, inline sub-component mi? S29 sonrası doğrula) — ayrıysa dokunma, değilse extract
- `LifecycleBar.jsx` — period lifecycle visualization extract (~150)

**OrganizationsPage breakdown:**

- `OrganizationsPage.jsx` — orchestrator (~400)
- `OrgTable.jsx` — super-admin table (~300)
- `UnlockRequestsPanel.jsx` — pending unlock requests (~200)
- `OrgStatusBadge.jsx` — status pill component (~80)
- `GovernanceDrawers.jsx` — ZATEN AYRI 1307 satır, S32'de değerlendirilecek (dokunma)

Her dosya hedefi ≤500 satır. Test coverage'ı korumak için existing `__tests__/PeriodsPage.test.jsx` + `OrganizationsPage.test.jsx` güncellenmeli (lightweight import assertion pattern'de — S22 örüntüsü).

**Beklenen dosya sayısı:** 2 page refactor + ~7 new component files + 2 test update
**Süre:** ~3 saat
**Context:** ~%80
**Handoff:** S31 için aynı pattern

### Session 31 — Admin large pages split Part 2

**Hedef:** EntryControlPage 1565 + OutcomesPage 1534 split.

**EntryControlPage breakdown:**

- `EntryControlPage.jsx` — orchestrator (~400)
- `TokenGenerator.jsx` — QR generation + token form (~350)
- `SessionHistoryTable.jsx` — session list (~250)
- `RevokeFlow.jsx` — revoke modal + confirm (~150)

**OutcomesPage breakdown:**

- `OutcomesPage.jsx` — orchestrator (~400)
- `OutcomeTable.jsx` — outcome CRUD table (~300)
- `OutcomeMappingPanel.jsx` — criterion↔outcome mapping (~400)
- Shared `OutcomeEditor.jsx` (667 satır) — `src/admin/shared/` altında, dokunulmuyor (zaten shared)

**Beklenen dosya sayısı:** 2 page refactor + ~7 new files + 2 test update
**Süre:** ~2.5 saat
**Context:** ~%75
**Handoff:** S32 için kalan büyükler

### Session 32 — Admin large pages split Part 3 + GovernanceDrawers değerlendirmesi

**Hedef:** CriteriaPage 1468 split + GovernanceDrawers 1307 değerlendirmesi.

**CriteriaPage breakdown:**

- `CriteriaPage.jsx` — orchestrator (~400)
- `CriteriaTable.jsx` — rubric table with inline editors (~500, coherent — inline editor pattern CLAUDE.md'de allowed)
- `EditSingleCriterionDrawer.jsx` 595 — zaten ayrı, dokunma
- `StarterCriteriaDrawer.jsx`, `ProgrammeOutcomesManagerDrawer.jsx` — zaten ayrı

**GovernanceDrawers.jsx 1307 satır değerlendirmesi:**

- İçinde 6 drawer tanımlı: GlobalSettingsDrawer, SystemHealthDrawer, MaintenanceDrawer, FeaturesDrawer, BackupDrawer, ExportDrawer
- Her drawer ~200-250 satır → CLAUDE.md kural istisnası (coherent bundle 1000-1500 allowed)
- **Karar:** İki seçenek raporla:
  - (a) Bırak (bundle file pattern allowed per yeni kural)
  - (b) Her drawer ayrı dosyaya (`src/admin/drawers/governance/<Drawer>.jsx`) + barrel
- Kullanıcı onayı alıp uygula

**Beklenen dosya sayısı:** 1 page refactor + ~2 new + (opsiyonel) 6 drawer split + tests
**Süre:** ~2 saat
**Context:** ~%70
**Handoff:** S33 için kalan mid-size (opsiyonel)

### Session 33 — Mid-size pages + Test coverage build-out (D)

**Hedef:** JurorsPage 1271 + LandingPage 1183 + RankingsPage 1126 + ProjectsPage 1032 — hepsi 1000-1300 bandında, split borderline. Değerlendir + kritik olanları split.

**Plan:**

1. Her dosyayı oku, CLAUDE.md'deki "sinyaller" listesine göre skor (multiple domain? 5+ useState? 3+ iç-component? 500+ JSX? mental model zorluğu?).
2. Skora göre:
   - 3+ sinyal → split et
   - ≤2 sinyal → bırak, inline `/* size-ok: <reason> */` comment ekle
3. `check:js-file-size` WARN üretiyor olsa bile kabul — guard script zaten WARN'da exit 0.

**Test coverage paralel iş (D):**

- Modals için yeni test dosyaları (S20/S21/S22 pattern) — en kritik 5-6 modal
- Shared API için 3-4 smoke test (`listPeriods`, `upsertScore`, `generateEntryToken`)
- Edge function genişletme: kalan 2-3 edge function
- **Hedef coverage:** global %50+ (S26 baseline %33.58 → +17 puan)

**Beklenen dosya sayısı:** 0-4 page split + ~10 new test
**Süre:** ~2.5 saat
**Context:** ~%75
**Handoff:** Plan kapanışı (S34 gerekli görülmezse)

---

## Critical Files / Paths

### Plan dosyaları (her session sonu güncellenir)

- `docs/superpowers/plans/restructure-and-test-rewrite/README.md` (1597 satır):
  - Session plan table satır 204-233 (S27-33 satırları eklenir)
  - Progress Log satır 1530+ (her session sonu bir satır)
- `docs/superpowers/plans/restructure-and-test-rewrite/sonnet-session-plan.xlsx`:
  - Sheet "Sonnet+Opus Oturum Plani", kolonlar A-H
  - S27-33 için yeni 7 satır `DEVAM EDIYOR`/`TAMAMLANDI` status'üyle
- `docs/superpowers/plans/restructure-and-test-rewrite/implementation_reports/`:
  - Her session için `session-27-cleanup-guards.md`, `session-28-semester-to-period.md`, vb.
  - `_TEMPLATE.md`'yi takip et (header + done checklist + files table + architectural notes + verification + issues + commits + tracker + next step)

### Ana refactor dosyaları

**S27 Cleanup:**

- `src/jury/__tests__.archive/` + `src/admin/__tests__.archive/` (silinecek)
- `src/admin/shared/useDeleteConfirm.test.archive.jsx` (silinecek)
- `src/test/qa-catalog.archive.json` (silinecek)
- `src/**/.gitkeep` (36 dosya, silinecek)
- `src/styles/drawers/crud-legacy.css` (rename ya da sil)
- `src/styles/landing/legacy-shell.css`, `legacy-eyebrow.css` (karar)
- `src/styles/main.css` (import satırları güncelle)
- `src/admin/features/heatmap/HeatmapPage.css` (719 → split)
- `scripts/check-js-file-size.mjs` (yeni)
- `scripts/check-css-file-size.mjs` (yeni)
- `package.json` (iki script entry)

**S28 Rename:**

- `src/admin/features/periods/{Add,Edit}SemesterDrawer.jsx` (rename)
- `src/admin/features/periods/DeleteSemesterModal.jsx` (çakışma çözümü)
- `src/jury/features/period-select/SemesterStep.jsx` (rename)
- `src/shared/storage/{adminStorage,keys}.js` (storage key migration shim)
- `src/test/factories/buildProject.js` (teamMembers alias)
- 55 source (Semester) + 15 source (Students) identifier/string replace
- `~/.claude/projects/-Users-huguryildiz-Documents-GitHub-VERA/memory/project_generic_naming.md` (status update)

**S29–32 Split targets:** Her session başlığı altında yazılı.

**Reuse (mevcut pattern'ler):**

- S26c dead-css AST scripti (`dead-css-scan-2026-04-23.md` referansı)
- S22 lightweight test assertion pattern (büyük komponent OOM fix)
- S23 pgTAP helper pattern (gerekirse yeni test altyapısı için)
- `useCardSelection` hook pattern (`src/shared/hooks/`) — split edilen mobile card'lar için
- `CustomSelect`, `ConfirmDialog`, `FbAlert` — UI conventions'ı koru

---

## Verification (her session sonu)

**Zorunlu:**

```bash
npm run build                    # Vite build clean
npm test -- --run                # 278+ test geçer, regresyon yok
npm run check:no-native-select   # OK
npm run check:no-nested-panels   # OK
npm run check:no-table-font-override # OK
npm run check:js-file-size       # (S27 sonrası) OK veya WARN-only
npm run check:css-file-size      # (S27 sonrası) OK veya WARN-only
git status                       # Beklenen dosya seti
```

**S28 Rename sprint için ek:**

```bash
grep -ri "semester" src/                  # 0 sonuç
grep -rE "\"Students\"|'Students'" src/   # 0 sonuç (UI label rename doğrulaması)
# NOT: "Project Title" scope dışı, rename edilmiyor
```

**UI smoke (Playwright zaten plan B7'de yazılı):**

- `npm run dev` + manuel: login → overview → periods → organizations → setup-wizard flow
- Landing page dark/light mode görsel kontrol (S27 legacy CSS kaldırma için)

**Coverage (S33 sonunda):**

- `npm run test:coverage` → global lines ≥ %50 hedef

---

## Riskler & Mitigation

| Risk | Mitigation |
|---|---|
| S27 legacy CSS silindiğinde landing page görsel regresyon | Her karar için before/after screenshot (`npm run dev` + Playwright `browser_take_screenshot`), implementation report'a ekle |
| S27 `crud-legacy.css` silinirse drawer görsel regresyon | Class-by-class JSX grep öncesi, sadece 0-referans sınıfları sil; kullanılan sınıflar varsa dosyayı `crud.css`'e rename et |
| S27 archive test dosyaları silinmesi CI'ı kırar mı? | Vitest test glob `*.test.{js,jsx}` — `.archive` içeriği zaten run edilmiyor. Silinmeden önce `npm test -- --run` ile baseline doğrulanır |
| S28 Semester rename sırasında storage key eski user preference'ları kaybeder | One-time migration shim: eski key okuyup yeni'ye yaz, sonra sil. adminStorage init'te çalışır |
| S28 DeleteSemesterModal vs DeletePeriodModal çakışması | İlk iş: iki dosyayı diff'le. Aynı → silme. Farklı → hangisi aktif kullanılıyorsa onu koru, diğerini sil, usage'ları yönlendir |
| S28 Students→Team Members UI-only rename'inde DB alanı geride kalır | Kasıtlı: DB kolonu `students` kalır, sadece UI stringleri değişir. Future-proof için `fieldMapping.js` override'ı gerekirse S28b içinde ekle |
| S29-32 split regresyonları | Her split öncesi page'in smoke test'i çalıştır; sonrası tekrar çalıştır (lightweight assertion pattern — S22 örneği) |
| JSX split'ler prop drilling artırır | `useManageXxx` hook'ları tek kaynak state; child component'ler hook'u re-kullanır veya parent'tan prop alır (tercih: parent prop, hook ayırması küçük component'lerde overhead) |
| S33 test yazımı mock heavy → tekrar OOM (S22 gibi) | Büyük komponent testleri için lightweight assertion (sadece `typeof X === "function"`), full render yerine |
| Plan süresi tahminden uzarsa | Her session self-contained, ertelenebilir. Sıkışan session atlanıp sonraki başlatılabilir |

---

## Out of Scope (YAGNI — parent plan'dan devralınan)

- Dark mode tokenize (C2 opsiyonel)
- Full a11y audit
- i18n (şu an TR/EN karışık — ayrı iş)
- Bundle size optimization (xlsx 627kB uyarısı dahil — ayrı iş)

---

## Handoff & Sessions Summary

| Session | Scope | ~Context | Süre |
|---|---|---|---|
| 27 | Legacy artifact cleanup (.gitkeep, archive dirs) + Guard scripts + HeatmapPage split | 60% | 2h |
| 28 | Rename sprint: Semester→Period + Students→Team Members | 70% | 2h |
| 29 | SetupWizardPage split (2157 → 7 step) | 75% | 2.5h |
| 30 | PeriodsPage + OrganizationsPage split | 80% | 3h |
| 31 | EntryControlPage + OutcomesPage split | 75% | 2.5h |
| 32 | CriteriaPage split + GovernanceDrawers değerlendirmesi | 70% | 2h |
| 33 | Mid-size pages değerlendirmesi + Test coverage build-out | 75% | 2.5h |

**Toplam:** ~17h / 7 oturum

**Başlangıç koşulu:** Session 27 başlamadan önce CLAUDE.md'deki yeni JSX ceiling kuralı doğrulanmış (eklendi bu oturumda).

**Bitiş koşulu (S33 sonrası):**

- CLAUDE.md'deki JSX/CSS size ceiling kuralları guard script'lerle otomatik uygulanıyor
- "Semester" kelimesi codebase'den tamamen çıktı
- 1000+ satırlı JSX sayısı ≤ 2 (GovernanceDrawers istisnası + belki 1 borderline)
- Global test coverage ≥ %50
- README tablosu, XLSX, Progress Log tutarlı, S27-33 hepsi ✅

---

## Kickoff Prompt (yeni chat için)

Aşağıdaki prompt'u yeni bir Claude Code sohbetinde (VERA repo'sunda, Sonnet High) yapıştır — o session S27'yi çalıştırır:

```text
VERA post-restructure cleanup & refactor sprint'ine başlıyoruz. Plan 7 oturuma bölünmüş (S27-33), toplam ~17 saat.

**İlk iş (1 dakika):** Planı repoya taşı:
  cp /Users/huguryildiz/.claude/plans/agile-hatching-stonebraker.md docs/superpowers/plans/restructure-and-test-rewrite/README-2.md

Sonra `docs/superpowers/plans/restructure-and-test-rewrite/README-2.md` dosyasını oku — bu sprint'in tam planı.

**Bu oturumda (Session 27) yapılacaklar:**
1. Legacy artifact cleanup: 36 adet `.gitkeep` dosyası, `src/jury/__tests__.archive/` + `src/admin/__tests__.archive/` klasörleri, `src/admin/shared/useDeleteConfirm.test.archive.jsx`, `src/test/qa-catalog.archive.json` — hepsini sil.
2. `src/styles/drawers/crud-legacy.css` değerlendir: class'ları kullanılıyorsa `crud.css`'e rename et, kullanılmıyorsa sil + `src/styles/main.css` import satırını çıkar.
3. `src/styles/landing/legacy-shell.css` (337) + `legacy-eyebrow.css` (287) karar: her selector için legacy değer vs main değer karşılaştır, doğru olanı bırak, legacy'i sil. `src/styles/main.css`'teki iki import satırını temizle.
4. Global CSS dead scan: `src/styles/` altındaki non-feature dosyalarda kesin-dead rule'ları sil (S26c PostCSS AST scripti referansı: `docs/superpowers/plans/restructure-and-test-rewrite/dead-css-scan-2026-04-23.md`).
5. Guard scriptleri yaz:
   - `scripts/check-js-file-size.mjs`: src/**/*.{js,jsx} tara; 1000+ = FAIL (exit 1), 800-1000 = WARN (exit 0). __tests__ ve .archive hariç.
   - `scripts/check-css-file-size.mjs`: src/**/*.css; 1000+ = FAIL, 600-800 = WARN. `/* size-ceiling-ok: <reason> */` exempt.
   - `package.json`: `check:js-size` ve `check:css-size` script entry'leri.
6. HeatmapPage.css split: `src/admin/features/heatmap/HeatmapPage.css` (719) → core (~400) + `HeatmapPage.responsive.css` (~300). Import chain düzelt.

**Doğrulama (session sonu):**
  npm run build
  npm test -- --run
  npm run check:no-native-select
  npm run check:no-nested-panels
  npm run check:no-table-font-override
  npm run check:js-size
  npm run check:css-size

**Session kapanışında (3 yer güncelle):**
1. `docs/superpowers/plans/restructure-and-test-rewrite/README.md` — session plan tablosuna (~satır 233'ten sonra) `| ✅ | **27** | ... | ... | ~2h | %60 | ... |` satırı ekle; Progress Log'a (~satır 1562 sonrası) yeni satır.
2. `docs/superpowers/plans/restructure-and-test-rewrite/sonnet-session-plan.xlsx` — yeni satır `TAMAMLANDI | Sonnet | 27 | ... | ... | 2h | %60 | ...`.
3. `docs/superpowers/plans/restructure-and-test-rewrite/implementation_reports/session-27-cleanup-guards.md` — `_TEMPLATE.md`'yi takip eden detaylı rapor yaz.

**Kurallar (CLAUDE.md'den, özellikle yeni eklenen):**
- JSX/JS file size ceiling: 500 sweet, 800 kabul, 1000+ split adayı
- CSS 600 tavan, 1000+ hard violation
- Git: commit/push kullanıcı açıkça istemedikçe yapma
- Never use native <select>, nested panels, inline popovers in table rows

Kullanıcı "auto mode"da — her adımda onay isteme, modüler ilerle, milestone'larda raporla.
```

Bu prompt'u yeni sohbete yapıştırdığında Claude S27'yi baştan sona çalıştırır, plan dosyasını repoya taşır, tracker'ı günceller.
