# Session 26c Implementation Summary — Dead CSS Safe Wins (Option C)

**Date:** 2026-04-23
**Status:** Done
**Build:** ✅ `npm run build` pass (5.87s) | ✅ `npm test -- --run` (278 pass / 112 files) | ✅ 3 lint check clean
**Context kullanımı:** ~%60 (Opus, S26 + S26b ile aynı oturum)
**Süre:** ~45 dk

---

## Yapılanlar

S26b'de ertelenen "dead CSS silme" işinin **güvenli alt-kümesi** (Option C) uygulandı. Sadece sıfır-referanslı class'ların rule bloğu silindi; dosya bütünüyle silinmedi.

- ✅ PostCSS-based class referans analizi (`/tmp/find-dead-classes-v2.mjs`)
- ✅ Dynamic class filter (template literal, library prefixes)
- ✅ PostCSS AST'i üzerinden rule removal (regex değil — güvenli)
- ✅ **311 rule · 527 satır · 13 CSS dosyası** temizlendi
- ✅ Partial-dead selector'larda (`.alive, .dead { ... }`) canlı branch korundu
- ✅ Build + test + lint hepsi yeşil (regresyon yok)
- ✅ Script geçici, `scripts/` altında kalıcı araç olarak tutulmadı — commit'e girmedi

## Dosya Bazında Sonuç

| Dosya | Silinen rule | Silinen satır | Target dead class sayısı |
|---|---:|---:|---:|
| `showcase-slides.css` | 82 | 94 | 55 |
| `drawers/crud-legacy.css` | 60 | 76 | 41 |
| `components/forms.css` | 36 | 61 | 29 |
| `drawers/base.css` | 32 | 46 | 21 |
| `components/tables.css` | 20 | 20 | 16 |
| `layout/admin-shell.css` | 19 | 19 | 13 |
| `components/alerts.css` | 18 | 18 | 17 |
| `misc/empty-state-card.css` | 15 | 74 | 12 |
| `ui-base/mop-base.css` | 11 | 81 | 8 |
| `layout/portrait-overview.css` | 6 | 12 | 6 |
| `misc/security-pill.css` | 5 | 5 | 5 |
| `components/pills-badges.css` | 4 | 7 | 6 |
| `misc/mobile-row.css` | 3 | 14 | 5 |
| **TOPLAM** | **311** | **527** | **234** |

## Filtreleme Stratejisi

Script iki aşamalı filtre uyguladı:

### 1. Class referans taraması

- CSS dosyalarından tüm class adları extract edildi
- Her class için:
  - JSX/JS içinde quoted literal veya whitespace-bounded kullanım arandı
  - Diğer CSS dosyalarında compositional selector (`.a .b`, `.a > .b`) arandı
- Her iki tarama sıfır ise "dead candidate"

### 2. Dinamik class false-positive filtresi

Bu class'lar silme listesinden **çıkarıldı**:

- Library prefix'leri: `recharts-*`, `rt-*`, `rdp-*`, `react-*`, `ql-*`
- Suffix pattern'ler: `-primary`, `-danger`, `-warning`, `-success`, `-high`, `-mid`, `-low`, `-completed`, `-progress`, `-small`, `-medium`, `-large`, `-manual`, `-auto`, `-snapshot`, vb.
- Template literal detection: koddaki `"${prefix}-${suffix}"` kalıpları taranıp eşleşen class ailesi korundu

Örnek: `variant-danger`, `variant-warning` silinmedi — `fb-alert` template `` `fba-${variant}` `` üretiyor (bu sebeple `fba-info/warning/danger/success` korundu ama static `fbb-*` dead olarak işaretlendi).

### 3. Rule silme güvenlik kuralı

PostCSS ile AST walking:

- Selector tam class listesi extract edildi
- Rule **tümüyle** silindi yalnızca: **selectorün tüm class'ları dead ise**
- Multi-selector rule'lar (`.a, .b { ... }`) → canlı selector'lar korundu
- Empty media query'ler temizlendi

## Silinemeyen "Potansiyel Ölü" ~3500 Satır

PurgeCSS raporu 4094 satır ölü diyordu. Bu sprint 527 sildik. Farkın sebepleri:

1. **Responsive breakpoint class'ları** — `@media (max-width: 600px)` altındaki stiller; PurgeCSS runtime'da bunlar aktif olmayabildiği için "kullanılmıyor" gibi görür. Ama farklı viewport'ta kritik.
2. **Library-injected class'lar** — Recharts, dnd-kit, Radix UI render sırasında class ekliyor; statik grep bulamaz.
3. **Dinamik class'lar** — `className={`${prefix}-${suffix}`}` ile üretilenler; template literal filter'ı tüm varyasyonları yakalayamadı.
4. **Pseudo-class / attribute selector'lar** — `.foo[data-open="true"]`, `.foo:hover` gibi; bu sprint bunlara dokunmadı.

Bu ~3500 satır için derin sprint gerekir (dark-mode tokenize ile birleştirilebilir).

## Oluşturulan / Güncellenen Dosyalar

| Dosya | Değişiklik |
| ----- | ---------- |
| 13 × `src/styles/**/*.css` | 311 rule silindi, 527 satır |
| `implementation_reports/session-26c-dead-css-safe-wins.md` | Bu dosya |

## Doğrulama

- [x] `npm run build` — Exit 0, 5.87s
- [x] `npm test -- --run` — 278 / 278 pass
- [x] `npm run check:no-native-select` — clean
- [x] `npm run check:no-nested-panels` — clean
- [x] `npm run check:no-table-font-override` — clean

**Görsel smoke yapılmadı** — kullanıcı telefondaydı. Dev server'da landing + admin + jury sayfaları açılıp gözle kontrol edilmeli. PostCSS AST-based silme güvenli ama hiç silme %100 risksiz değil.

## Bilinen Sorunlar / Sonraki Oturuma Devir

- **Görsel smoke eksik.** Mobil görünüm, dark mode, responsive breakpoint'lerde regresyon olabilir. Dev server'a bakılmalı.
- **~3500 satır daha potansiyel ölü kaldı.** Option A (per-class deep audit) veya dark mode tokenize sprint'inde adreslenebilir.
- **legacy-* ve mop-* dosyaları durduruldu** — bu sprint'te sadece `ui-base/mop-base.css`'ten 81 satır alındı (8 class). `landing/legacy-*` ve `ui-base/mop-dark-outcome.css` per-file audit ister.

## Git Commit

```
f2952d6 refactor(styles): remove 311 dead CSS rules (527 lines) — Option C safe wins
```

## Parity Tracker Güncellemesi

Tracker'da yeni satır eklemeye gerek yok (dead CSS scan zaten S26'da ✅ "Raporlandı" durumuna geçmişti). Bu sprint rapor üzerine **eylem** sprinti.

Toplam altyapı hâlâ **11 / 11 task tamam**.

## Sonraki Adım

Plan kapandı. Bu sprint bonus temizlikti. İsteğe bağlı kalanlar:

1. **Dark mode tokenize** (~3 saat) — variables.css dominant-token
2. **Option A derin audit** (~3 saat) — ~3500 satır daha ölü CSS
3. **E2E çalıştırma** — kullanıcı elinde
4. **Coverage bumping** — admin/auth/jury integration
