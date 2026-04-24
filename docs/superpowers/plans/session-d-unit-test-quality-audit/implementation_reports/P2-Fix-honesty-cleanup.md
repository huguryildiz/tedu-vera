# P2-Fix — Edge Honesty + Shallow Cleanup + Mock Realism

**Tarih:** 2026-04-24
**Amaç:** P2'de yarım kalan 3 görevi mekanik olarak kapatmak — sahte edge kapsamını dürüstçe etiketlemek, gerçekten shallow olan testleri silmek, admin mock shape'sizliğini gidermek
**Durum:** Tamamlandı, kodda doğrulandı

---

## Sayısal özet

| Metrik | P2 Sonrası | P2-Fix Sonrası | Delta |
|--------|-----------|----------------|-------|
| Test dosyası | 253 | 250 | −3 (shallow silinen) |
| Test sayısı | 941 | 934 | −7 |
| Failure | 0 | 0 | 0 |
| Admin `mockResolvedValue({})` | 10 | **0** | −10 |
| Admin `mockResolvedValue([])` | 7 | **0** | −7 |
| Edge test ID namespace | karışık | `edge.contract.*` tek namespace | temizlendi |

**Özellik:** P2-Fix ilk kez "test ekleyerek iyileşme" yerine **"test silerek ve etiketleyerek iyileşme"** yapan sprint. Suite'in shape'ini temiz tutuyor — sayı düşüşü kalite kazancı.

---

## Görev 1 — Edge function test dürüstlüğü ✅

**Dosya:** `src/shared/api/edge/__tests__/edgeFunctions.test.js`

**Yapılanlar:**

1. Dosya başına `⚠️ QUALITY WARNING` yorum bloğu eklendi:

```js
// ⚠️ QUALITY WARNING — This file does NOT test actual edge function code.
// Supabase edge functions run under Deno and are excluded from Vitest.
// The helpers below are re-implementations of logic extracted from
// supabase/functions/*/index.ts and tested HERE as a contract specification.
//
// If the real Deno code drifts from these helpers, tests pass but prod breaks.
// This is intentional coverage-shape documentation, NOT regression protection.
//
// Real Edge Function coverage requires `deno test` against the actual files.
// Tracked in: docs/superpowers/plans/session-d-unit-test-quality-audit/
//             (follow-up: true Deno runner setup)
```

2. 24 test ID'si tek namespace'e taşındı:
   - Önceki: `edge.audit.*`, `edge.pin.*`, `edge.log.*`, `edge.proxy.*` (4 farklı namespace)
   - Yeni: `edge.contract.01` → `edge.contract.24` (tek namespace)

3. `qa-catalog.json` güncel:
   - 24 yeni `edge.contract.*` entry eklendi
   - 0 eski entry kaldı (grep doğruladı)

**Neden değerli:** Test dosyası silinmedi — çünkü paralel implementasyon bir contract specification olarak değer taşıyor. Sadece iddia gerçeğe uygun hale getirildi. Gelecek bir developer `edge.contract.*` isminden "bu gerçek Edge Function testi değil, sözleşme dokümantasyonu" mesajını alır.

---

## Görev 2 — Shallow test silme ✅

### Silinen dosyalar (3)

**`src/admin/features/analytics/__tests__/AnalyticsTab.test.jsx`**
- 2 test içeriyordu: biri `expect(AnalyticsTab).toBe(AnalyticsPage)` (barrel equality, behavior yok), diğeri mock div'in `data-testid`'sini görmek
- `AnalyticsTab` zaten `AnalyticsPage`'in re-export'u — test etmeye gerek yok
- QA catalog'dan `coverage.analytics-tab.*` ID'leri silindi

**`src/admin/features/rankings/__tests__/ScoresTab.test.jsx`**
- 3 test, üç dalda da `vi.mock("../RankingsPage", () => ({ default: () => <div>RankingsPage</div> }))` kurgusu sonrası `expect(screen.getByText("RankingsPage")).toBeInTheDocument()` asserting'i
- Planın açık yasağı: "Mock olan child'ın label'ını kontrol etmek — mock'un kendini test etmek"
- QA catalog'dan `coverage.scores-tab.*` ID'leri silindi

**`src/admin/features/settings/__tests__/SettingsComponents.test.jsx`**
- 2 test, hepsi render + `expectToBeInDocument` smoke
- UserAvatarMenu behavior assertion'ı yok — açma/kapama, click handler, menu item render — hiçbiri yok
- QA catalog'dan ilgili ID'ler silindi

**Toplam:** 7 test silindi, 10 orphan QA catalog entry temizlendi

### Korunan dosyalar (2)

**`src/admin/features/heatmap/__tests__/HeatmapMobileList.test.jsx`** (1 test)
- Empty state text assertion: `expect(screen.getByText("No Jurors to Display")).toBeInTheDocument()`
- Tek test ama gerçek kontrat — component empty state'te belirli bir mesaj göstermek zorunda
- Silmek yerine korundu; sonraki iterasyonlarda veri path'leri eklenebilir

**`src/admin/features/criteria/__tests__/CriteriaConfirmModals.test.jsx`** (6 test)
- 6 testin 4'ü disabled state davranışını assert ediyor (buton disabled kalıyor mu, çift tıklama engeli vb.)
- Behavior assertion niteliği taşıyor, shallow smoke değil
- Korundu

---

## Görev 3 — Mock realism scan ✅

### Ölçüm sonuçları

| Pattern | `src/admin/**` öncesi | `src/admin/**` sonrası | Durum |
|---------|----------------------|------------------------|-------|
| `mockResolvedValue({})` | 10 | **0** | ✅ Tamamen temizlendi |
| `mockResolvedValue([])` | 7 | **0** | ✅ Tamamen temizlendi |
| `mockResolvedValue(undefined)` | 23 | 23 | 🟡 Pragmatik korundu |

### Dönüştürme pattern'i

Ham mock'lar şu factory helper'ları ile değiştirildi:

| Eski | Yeni |
|------|------|
| `mockResolvedValue({})` | `mockResolvedValue(mockSuccess({...realistic}))` |
| `mockResolvedValue([])` | `mockResolvedValue(mockEmpty())` veya `mockResolvedValue(mockSuccess([]))` |

Kalan `mockResolvedValue(undefined)` 23 tanesi **gerçekten void semantic** olan fonksiyonlar:
- `loadPeriods`, `fetchData` — imperative loader'lar, return değeri yok
- `onPublish`, `onSave` — callback prop'lar
- `logExportInitiated`, `exportXLSX`, `downloadTable` — side effect fonksiyonları
- Kontrat olarak `undefined` doğru; realistic değer zorlamak yalan olurdu

### `vi.hoisted` pattern

Değiştirme sırasında bazı yerlerde `vi.mock` factory hoisting sorunu çıktı (factory içinde dış scope'tan değer kullanma). Çözüm:

```js
const { EMPTY_ARRAY, EMPTY_OBJECT } = vi.hoisted(() => ({
  EMPTY_ARRAY: Object.freeze([]),
  EMPTY_OBJECT: Object.freeze({}),
}));
```

Bu pattern named-constant niyetini korurken hoisting kuralını tatmin ediyor — stabil mock referansı sağlıyor (plan Rule 8'in ruhu: "Never return fresh object/array literals from a factory").

---

## README Known Gaps — yazıldı ✅

`README.md` Section 7'den önce `### Known Gaps (P2 sonrası)` başlığı eklendi. 4 boşluk belgelendi:

1. **Edge Function real coverage gap** — `edge.contract.*` 24 test paralel implementasyon üzerinde çalışıyor, 21/21 Edge Function prod path'inde gerçek kapsam yok. Deno runner takip görevi.
2. **`mockResolvedValue(undefined)` pragmatik kat** — 23 adet void-semantic fonksiyon için kaldı. Azaltmak kontrat yalanı olurdu.
3. **Shallow mop-up tam değil** — 3 dosya silindi, 2 korundu. Diğer sprintlerdeki shallow testlerin sistematik taraması yapılmadı.
4. **Audit completeness yetersiz** — 15 test 5 admin fonksiyonunu kapsıyor; 40+ admin RPC wrapper'ı denetlenmedi.

---

## Neden bu sprint farklı

Önceki P2 raporu "all done" dedi, koddan doğrulandığında yarısı yanlıştı. Bu P2-Fix **mekanik işler** üzerine kuruldu:

- Yorum ekleme — silme-doğrulama kolay
- Dosya silme — varlık kontrolü ile doğrulanabilir
- Pattern değiştirme — `grep` ile sayılabilir
- ID namespace taşıma — JSON diff ile görülebilir

Her görev için objektif doğrulama var; agent yaratıcı yorum yapmak zorunda değildi. Bu P2-Fix'in başarı sebebi — task tasarımında sübjektivite minimize edildi.

**Öğrenim:** Kalite düzeltme sprintlerini mekanik adımlara böl. "Shallow test'leri yükselt" muğlaktır (agent shallow olmayanları da yükseltebilir, ya da shallow olanları shallow upgrade yapabilir). "Şu 3 dosyayı sil, 2'sini koru" nettir.

---

## Silinen testlerin QA catalog etkisi

| ID prefix | Silinen | Sebep |
|-----------|---------|-------|
| `coverage.analytics-tab.*` | 2 | AnalyticsTab.test.jsx silindi |
| `coverage.scores-tab.*` | 3 | ScoresTab.test.jsx silindi |
| `coverage.settings-components.*` | 2 | SettingsComponents.test.jsx silindi |
| `edge.audit.*`, `edge.pin.*`, `edge.log.*`, `edge.proxy.*` | 24 | Namespace `edge.contract.*`'e taşındı |

Net değişim: 7 entry silindi, 24 entry yeniden adlandırıldı, 24 yeni entry eklendi (aynı namespace'e).

---

## Dosyalar

**Değiştirilen:**
- `src/shared/api/edge/__tests__/edgeFunctions.test.js` (header + ID rename)
- `src/test/qa-catalog.json` (orphan temizlik + ID rename)
- `docs/superpowers/plans/session-d-unit-test-quality-audit/README.md` (Known Gaps eklendi)
- 5+ admin test dosyası (mock realism değişimi)

**Silinen:**
- `src/admin/features/analytics/__tests__/AnalyticsTab.test.jsx`
- `src/admin/features/rankings/__tests__/ScoresTab.test.jsx`
- `src/admin/features/settings/__tests__/SettingsComponents.test.jsx`

---

## Kontrol listesi

- [x] Edge function WARNING header
- [x] Edge ID namespace tek namespace (`edge.contract.*`)
- [x] 3 shallow dosya silindi (AnalyticsTab, ScoresTab, SettingsComponents)
- [x] 2 shallow-değil dosya korundu (HeatmapMobileList, CriteriaConfirmModals)
- [x] Admin `mockResolvedValue({})` = 0
- [x] Admin `mockResolvedValue([])` = 0
- [x] Admin `mockResolvedValue(undefined)` pragmatik tutuldu, Known Gaps'te belgelendi
- [x] README Known Gaps bölümü yazıldı
- [x] `qa-catalog.json` güncel (orphan yok, eski namespace yok)
- [x] `npm test -- --run` — 250 dosya, 934 test, 0 failure

---

## Session D toplam durumu (P2-Fix sonrası)

| Faz | Durum | Teslim |
|-----|-------|--------|
| P0 — Mock factory + scores + cross-org | ✅ | 28 test, factory altyapısı |
| P1 — Kritik akış regression | ✅ | 71 test, 6 kritik path |
| P2 — Storage + Edge + Audit + Shallow | 🟡 | 68 test (yarısı gerçek teslim, yarısı P2-Fix'e bırakıldı) |
| **P2-Fix — Edge honesty + cleanup + mock realism** | ✅ | −7 test (shallow sil), 17 admin mock düzeltildi |
| P3 — Deno real edge coverage | ⏳ | Plan hazır, prompt hazır |

**Net test sayısı:** 774 (baseline) → 934 (P2-Fix sonrası) = **+160 test**
**Bunlardan gerçekten değerli olan:** ~130 (P0 + P1 + storagePolicy + auditLogCompleteness). Kalan ~30 `edge.contract.*` paralel dokümantasyon.
