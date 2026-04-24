# P0 — Mock Factory + Skor Aggregation + Cross-Org Boundary

**Tarih:** 2026-04-24
**Amaç:** Sahte güveni azaltmak — gerçekçi Supabase mock altyapısı, izole skor aggregation testleri, cross-org leakage boundary dokümantasyonu

---

## Sonuç

| Metrik | P0 Öncesi | P0 Sonrası |
|--------|-----------|------------|
| Test dosyası | 242 | 245 |
| Test sayısı | 774 | 802 |
| Failure | 0 | 0 |
| Supabase-shaped mock factory | yok | ✅ |

**Net delta:** +28 test, +3 dosya

---

## Teslim edilenler

### 1. Shared mock factory — `src/test/adminApiMocks.js`

Tüm admin testlerinin kullanacağı paylaşımlı fabrika. Gerçek Supabase response shape'i (`{ data, error, count }`) döndürür.

**Export'lar:**

| Fonksiyon | Amaç |
|-----------|------|
| `mockSuccess(data, count?)` | `{ data, error: null, count: count ?? data.length }` |
| `mockError(message, code?)` | `{ data: null, error: { message, code }, count: 0 }` |
| `mockEmpty()` | Boş array response |
| `makeScore(overrides?)` | `score_sheet_items` shape'li skor objesi |
| `makeCriteria(overrides?)` | `period_criteria` shape'li kriter objesi |
| `makeProject(overrides?)` | `projects` shape'li proje objesi |
| `makeJuror(overrides?)` | `jurors` shape'li jüri objesi |
| `makeSheetRow(overrides?)` | `score_sheets` select join'li row (project + juror nested) |
| `makeItem(key, value, overrides?)` | `score_sheet_items` + `period_criteria` join'li item |

**Kural:** Stub `{}` veya `[]` döndürmek artık yasak — factory helper'ları zorunlu.

### 2. Skor aggregation testleri — `src/shared/api/admin/__tests__/scores.test.js`

**22 test.** `pivotItems` (private) public API (`getScores`, `getProjectSummary`) üzerinden dolaylı test edildi.

**ID namespace:** `scores.pivot.01` → `scores.pivot.22`

**Kapsanan case'ler:**

| # | Case | Doğrulama |
|---|------|-----------|
| 01 | Normal pivot | Criteria key'leri + total |
| 02 | Boş items | Total = 0, criterion key yok |
| 03 | `null` items | Crash yok, total = 0 |
| 04 | `null` score_value | Null olarak korunuyor, total'e eklenmiyor |
| 05 | Eksik `criterion_key` (bad item) | Silent skip, `"undefined"` key oluşmuyor |
| 06 | Fallback key path | `period_criteria` yoksa `criterion_key` fallback çalışıyor |
| 07 | Priority key path | `period_criteria.key` > `criterion_key` |
| 08 | Negatif değer | Olduğu gibi pivot + total'e eklenir |
| 09 | Zero score (falsy) | **Not skipped** — total'e 0 olarak dahil |
| 10 | String coercion | `"85"` → number 85 |
| 11 | Çoklu criteria | Her biri ayrı key |
| 12 | Karışık null total | Null olanlar toplam dışı |
| 13 | DB error | `rejects` ile propagate |
| 14 | Boş sonuç | `[]` döndürür |
| 15 | Juror/project name mapping | `juryName`, `projectName`, `affiliation` doğru |
| 16 | Single juror aggregation | `count: 1`, `totalAvg` doğru |
| 17 | Multi-juror averaging | 2 juror → avg doğru |
| 18 | No submissions | `count: 0`, `totalAvg: null` |
| 19 | Per-criterion avg | `avg.c1` doğru |
| 20 | Multi-project isolation | Alpha ve Beta ayrı aggregate |
| 21 | `SCORE_QUERY_CAP` warn | `console.warn` `"hit row cap"` tetikleniyor |
| 22 | Projects error | `rejects` ile propagate |

### 3. Cross-org boundary testleri — `src/shared/api/admin/__tests__/crossOrgBoundary.test.js`

**6 test.** `ID namespace: scores.cross-org.01` → `scores.cross-org.06`

| # | Case | Bulgu |
|---|------|-------|
| 01 | `getScores` RLS 403 (`42501`) | Boş array değil, throw ediyor ✅ |
| 02 | `getProjectSummary` projects query 403 | Throw ediyor ✅ |
| 03 | `undefined` periodId | Client crash yok, Supabase'e ulaşıyor |
| 04 | `null` periodId | Client crash yok |
| 05 | **Mimari bulgu** | `pivotItems` client-side org_id filter içermiyor — RLS tek boundary |
| 06 | `listJurorsSummary` RLS 403 | Throw ediyor ✅ |

**`.cross-org.05` özelinde:** Test iki farklı org'un sheet'ini aynı response'ta döndürdüğünde her iki row'un da client'a geçtiğini assert ediyor. Bu bir güvenlik açığı değil (RLS DB seviyesinde koruyor) ama client kodunda savunma yok — belgelenmesi P1/P2 planlaması için önemli.

### 4. Shallow-smoke etiketleme

Denetimde "render-only, no behavior assertion" olarak tespit edilen 5 dosya:

- `src/admin/features/analytics/__tests__/AnalyticsTab.test.jsx`
- `src/admin/features/rankings/__tests__/ScoresTab.test.jsx`
- `src/admin/features/heatmap/__tests__/HeatmapMobileList.test.jsx`
- `src/admin/features/settings/__tests__/SettingsComponents.test.jsx` (UserAvatarMenu bölümü)
- `src/admin/features/criteria/__tests__/CriteriaConfirmModals.test.jsx`

Her birinin başına `// @quality: shallow-smoke — render only, no behavior assertion. Upgrade in Session D/P1.` yorumu eklendi.

**Planlanan listeden hariç tutulanlar** (yargı ile):

- `CoverageBar.test.jsx` — gerçek behavior assertion içeriyor, shallow değil
- `CriterionDeleteDialog.test.jsx` — confirm flow'un davranışını test ediyor

---

## Adaptasyonlar (plan → gerçek)

**1. `pivotItems` dolaylı test.**

Plan: "`pivotItems` ve `dbScoresToUi` fonksiyonları için minimum 20 test."
Gerçek: `pivotItems` dışa aktarılmıyor (private). Public API (`getScores`, `getProjectSummary`) üzerinden dolaylı test. Bu pragmatik çözüm — export aç + doğrudan test daha sağlam olurdu ama kaynak kod değişikliği P0 kapsamı dışındaydı.

**2. SCORE_QUERY_CAP test stratejisi.**

Plan: "25k skorlu period sessizce truncate → ranking yanlış — test et."
Gerçek: `console.warn` spy ile cap tetikleyicisi test edildi (`scores.pivot.21`). Truncate sonrası ranking yanlışlığı E2E kapsamı — unit'te sadece warn davranışı doğrulandı.

---

## Bulgular (mimari notlar)

1. **Cross-org boundary = RLS-only.** Client'ta `org_id` filter yok. RLS fail olursa (misconfiguration veya bypass) rows client'a sızar. Savunma derinliği yok. — P2'de adreslenebilir bir boşluk.

2. **`pivotItems` private.** Test edilebilirlik için export açmak değerli olur; şu an public API semantic coupling var.

3. **`makeSheetRow` shape'i `getScores` select join'ini yansıtıyor.** Select değişirse factory güncellenmeli (test-source coupling noktası).

---

## Dosyalar

**Oluşturulan:**

- `src/test/adminApiMocks.js` (99 satır)
- `src/shared/api/admin/__tests__/scores.test.js` (317 satır)
- `src/shared/api/admin/__tests__/crossOrgBoundary.test.js` (147 satır)

**Değiştirilen (yorum ekleme):**

- 5 shallow test dosyası (tek satır yorum eklendi)

**`qa-catalog.json`:** 28 yeni ID eklendi (`scores.pivot.*`, `scores.cross-org.*`).
