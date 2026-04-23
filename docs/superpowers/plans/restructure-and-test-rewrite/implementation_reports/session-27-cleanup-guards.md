# Session 27 Implementation Summary — Legacy Artifact Cleanup + Guard Scripts + HeatmapPage.css Split

**Date:** 2026-04-23
**Status:** Done
**Build:** ✅ `npm run build` pass (5.74s) | ✅ `npm test -- --run` (278/278) | ✅ all `check:*` scripts exit 0
**Context kullanımı:** ~%85 (Sonnet High ~200k, 2-part session with compaction)
**Süre:** ~2h

---

## Yapılanlar

- ✅ 36 `.gitkeep` dosyası silindi (boş dizin tutucular — hiçbiri artık gereksiz)
- ✅ 2 `__tests__.archive` dizini silindi (`src/admin/__tests__/archive/`, `src/jury/__tests__/archive/`) + 13 arşiv test dosyası
- ✅ `legacy-shell.css` (338 satır) + `legacy-eyebrow.css` (287 satır) silindi + `main.css`'ten import'ları kaldırıldı
- ✅ `crud-legacy.css` import'u `main.css`'ten kaldırıldı (dosya S26c'de zaten temizlenmişti)
- ✅ PostCSS AST dead CSS scan: 26 kural / ~91 satır silindi — 9 dosya
- ✅ `scripts/check-js-file-size.mjs` yazıldı + `package.json`'a `check:js-size` script'i eklendi
- ✅ `scripts/check-css-file-size.mjs` yazıldı + `package.json`'a `check:css-size` script'i eklendi
- ✅ `check:all` composite script güncellendi (js-size + css-size eklendi)
- ✅ 12 mevcut JSX dosyasına retroactive `// size-ceiling-ok:` escape hatch eklendi
- ✅ `HeatmapPage.css` (719 satır) → `HeatmapPage.css` (595 satır) + `HeatmapPage.responsive.css` (125 satır) split
- ✅ `HeatmapPage.jsx`'e `import "./HeatmapPage.responsive.css"` eklendi

## Oluşturulan Dosyalar

| Dosya | Açıklama |
| ----- | -------- |
| `scripts/check-js-file-size.mjs` | JSX/JS file size guard — WARN >800, HARD >1000 satır; `// size-ceiling-ok:` escape hatch |
| `scripts/check-css-file-size.mjs` | CSS file size guard — WARN >600, HARD >1000 satır; `/* size-ceiling-ok: */` escape hatch |
| `src/admin/features/heatmap/HeatmapPage.responsive.css` | HeatmapPage responsive breakpoints (4 @media block, 125 satır) |

## Güncellenen Dosyalar

| Dosya | Değişiklik |
| ----- | ---------- |
| `src/admin/features/heatmap/HeatmapPage.css` | 719→595 satır: 4 @media blok → responsive companion dosyaya taşındı |
| `src/admin/features/heatmap/HeatmapPage.jsx` | `import "./HeatmapPage.responsive.css"` line 21'e eklendi |
| `src/styles/main.css` | `legacy-shell.css`, `legacy-eyebrow.css`, `crud-legacy.css` import'ları kaldırıldı |
| `package.json` | `check:js-size`, `check:css-size` script'leri eklendi; `check:all` güncellendi |
| 12 × `src/admin/pages/*.jsx` | Retroactive `// size-ceiling-ok:` escape hatch (SetupWizardPage 2157, PeriodsPage 1765, OrganizationsPage 1712, EntryControlPage 1565, OutcomesPage 1534, CriteriaPage 1468, GovernanceDrawers 1307, JurorsPage 1271, LandingPage 1183, RankingsPage 1126, ProjectsPage 1032, AnalyticsPage 826, AuditLogPage 918, OverviewPage 901, ReviewsPage 877, AuthProvider 811) |

## Silinen Dosyalar

- `src/styles/landing/legacy-shell.css` (338 satır) — duplikasyon artığı, aktif import yoktu
- `src/styles/landing/legacy-eyebrow.css` (287 satır) — duplikasyon artığı, aktif import yoktu
- 36 × `.gitkeep` — boş dizin tutucular, artık gerekmiyor
- `src/admin/__tests__/archive/` — 13 arşiv test dosyası (S1 öncesi legacy)
- `src/jury/__tests__/archive/` — arşiv dizini

---

## Mimari / Logic Notları

**Dead CSS scan false-positive:** `.compare-select` class'ı, JSX'te bir template literal içinde dinamik olarak oluşturuluyordu (`className={...compare-select...}`). Boundary-regex tabanlı AST scanner bunu "dead" olarak işaretledi. Kural `modals.css`'e geri yüklendi. Dinamik class kullanımlarını boundary regex ile yakalamak mümkün değil — scanner bu pattern'i yanlış pozitif verir. Sonraki dead CSS sprint'lerinde bu göz önünde bulundurulmalı.

**CSS split stratejisi:** `HeatmapPage.css` split yapısı: tüm `@media` blokları (hem 4 breakpoint hem de son `swap table` bloğu) `*.responsive.css` companion dosyasına taşındı. Minified vera.css duplikası + framework selector + mobile card list (hiçbirinde `@media` yok) core dosyada kaldı. Son `@media (max-width: 900px) and (orientation: portrait)` bloğu (sadece 4 satır, swap kuralı) companion dosyanın ilk portrait ≤900px bloğuna merge edildi — ayrı block olarak tutmak gereksizdi.

**check-js-file-size.mjs exclusions:** `__tests__` dizinleri ve `.archive` dosyaları exclude edildi. Script `scripts/` dizinini de exclude eder (kendi kendini taramaz). Escape hatch `// size-ceiling-ok: <reason>` formatı — reason ilk 5 satırda bulunmalı.

**check-css-file-size.mjs escape hatch:** CSS comment formatı `/* size-ceiling-ok: <reason> */` — ilk 5 satırda bulunmalı. Çok satırlı CSS block comment içinde `*/` kullanmak template literal hatası riskine yol açar (JSDoc format); description plain text bırakıldı.

**Retroactive escape hatch sayısı:** JS checker 5 WARN (AnalyticsPage 826, AuditLogPage 918, OverviewPage 901, ReviewsPage 877, AuthProvider 811) + CSS checker 6 WARN üretiyor — bunlar warn range'de, hard violation yok. 12 JSX dosyası (1000+) retroactive escape hatch aldı; bunların gerçek spliti S29–S32'de planlanmış.

## Doğrulama

- [x] `npm run build` — Exit code 0, 5.74s
- [ ] `npm run dev` — Görsel smoke yapılmadı (kullanıcı başka işlemde)
- [x] `npm test -- --run` — 278/278 pass
- [x] `npm run check:no-native-select` — exit 0
- [x] `npm run check:no-nested-panels` — exit 0
- [x] `npm run check:no-table-font-override` — exit 0
- [x] `npm run check:js-size` — exit 0 (5 warn, 0 hard violation)
- [x] `npm run check:css-size` — exit 0 (6 warn, 0 hard violation)

## Bilinen Sorunlar / Sonraki Oturuma Devir

- JS size WARN'lar (5 dosya 800–1000 satır arası): AnalyticsPage, AuditLogPage, OverviewPage, ReviewsPage, AuthProvider — retroactive escape hatch YOK (800–1000 arası warn, hard değil). S33'te değerlendirilecek.
- CSS size WARN'lar (6 dosya 600–800 satır arası): AuditLogPage.css 646, RankingsPage.css 613, AdminTeamCard.css 621, demo-mirror.css 656, responsive.css 611, portrait-toolbar.css 640 — split planı yok, review edilecek.
- `HeatmapPage.css` hâlâ 595 satır (sweet spot sınırında). İçerdiği minified vera.css duplicate bloğu (lines ~318-362) ayrı bir temizlik fırsatı.

## Git Commit'leri

Commit atılmadı — kullanıcı açıkça isteyene kadar.

## Parity Tracker Güncellemesi

Bu oturum parity tracker tablosunu etkilemedi (feature taşıma yapılmadı). Guard script'leri ve cleanup altyapısı çalışması.

**README.md'deki S27 oturum satırı güncellendi mi?** ✅

## Sonraki Adım

**Session 28 — Rename Sprint (Semester→Period + Students→Team Members)**

Plan referansı: `README-2.md` S28 satırı
Hedef: `Semester` → `Period` rename (55 dosya, UI katmanı), `Students` → `Team Members` rename (15 dosya, UI-only), memory housekeeping
Dikkat: API fieldMapping'de `semester_id` DB adı korunacak — yalnız UI label'ları değişecek; storage key'ler de etkilenebilir
