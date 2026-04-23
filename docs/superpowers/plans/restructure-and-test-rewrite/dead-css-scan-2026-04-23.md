# Dead CSS Scan — 2026-04-23 (S26)

**Tool:** `purgecss` (keyword scan; no actual deletion)
**Input:**

- CSS: `src/styles/**/*.css` (71 dosya, 15.592 satır)
- Content: `src/**/*.{js,jsx,ts,tsx}`

**Output klasörü:** `test-results/dead-css/` (gitignore'a ekleyin, commit'lemeyin)

## Özet

- Toplam orijinal: **15.592 satır**
- Purge sonrası: **11.498 satır**
- Potansiyel ölü: **4.094 satır (%26)**

## ⚠️ Bu sayılar "ölü" değil — "dinamik olarak bulunamayan" demek

PurgeCSS statik tarar; aşağıdakileri genelde **false positive** işaretler:

- `cn()` / `clsx()` helper'ları üzerinden koşullu uygulanan class'lar
- JS tarafında `element.classList.add("...")` ile eklenenler
- `data-state`, `data-open`, `aria-*` seçicileri (PurgeCSS tanımıyor olabilir)
- `:hover`, `:focus-visible` gibi pseudo-class'larla zincirlenmiş class'lar (bazıları)
- 3rd party component class'ları (React Select, Lucide vb. doğrudan kullanılmıyor)

## En büyük 20 aday dosya (silme için INCELEMEYE değer)

| Δ satır | Dosya | Orijinal | Purge |
|---:|---|---:|---:|
| 380 | portrait-toolbar.css | 639 | 259 |
| 351 | mobile.css | 495 | 144 |
| 282 | maintenance.css | 368 | 86 |
| 151 | admin-shell.css | 454 | 303 |
| 150 | light-mode.css | 427 | 277 |
| 146 | legacy-light-mode.css | 426 | 280 |
| 141 | landscape-analytics.css | 174 | 33 |
| 135 | portrait-heatmap.css | 197 | 62 |
| 129 | very-small.css | 254 | 125 |
| 121 | crud-legacy.css | 356 | 235 |
| 108 | showcase-slides.css | 268 | 160 |
| 108 | mop-base.css | 398 | 290 |
| 107 | empty-state-card.css | 595 | 488 |
| 97 | portrait-charts.css | 156 | 59 |
| 83 | toast.css | 237 | 154 |
| 69 | hero.css | 292 | 223 |
| 66 | trust-usecase.css | 418 | 352 |
| 66 | portrait-filters.css | 117 | 51 |
| 66 | legacy-eyebrow.css | 287 | 221 |
| 65 | legacy-shell.css | 337 | 272 |

## Öneri

`legacy-*` ve `mop-*` dosyaları isim itibarıyla zaten elenme kapısında (eski landing pattern'leri). Bunlara manuel bak, varsa referans olmadığını doğrula, sil.

`portrait-*`, `landscape-*`, `very-small.css` gibi responsive override'lar beklenen olarak büyük purge gösterir — çünkü sadece belirli breakpoint'lerde aktif olan class'lar JS tarafında görünmez olabilir. **Dokunmadan önce responsive smoke test gerekli.**

`mobile.css` ve `maintenance.css` kritik kaldırım stilleri içerebilir — dokunulmamalı.

## Çalıştırma

```bash
npx --yes purgecss \
  --css "src/styles/**/*.css" \
  --content "src/**/*.{js,jsx,ts,tsx}" \
  --output test-results/dead-css
```
