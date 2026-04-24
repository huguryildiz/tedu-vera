# VERA Unit Test Kalite Denetimi — Dürüst Rapor

**Tarih:** 2026-04-24
**Kapsam:** 242 test dosyası · 774 test · 585 suite · %100 pass · ~%49 satır coverage · 26 sıfır‑coverage dosya kaldı
**Rapor:** `test-results/test-report-2026-04-24_20-22.xlsx` (Summary + By Module + All Tests + QA Coverage)

> **Context:** Kullanıcı yeni test istemedi; mevcut suitein gerçekten ne doğruladığını öğrenmek istiyor. Bu doküman hem denetim raporu hem de P0/P1/P2 iyileştirme yol haritasıdır. Birlikte gözden geçirilmek üzere hazırlandı.

---

## Executive Summary (dürüst)

**%100 pass oranı sahte güven üretiyor.** Suite iki farklı kalite seviyesinden oluşuyor:

- **Sağlam bir çekirdek (~%20):** `stats`, `criteriaValidation`, `fieldMapping`, `criteriaSchema`, `useJuryState`, `reviewsKpiHelpers` — gerçekten iş mantığı doğrulayan, edge case'leri olan, regression koruması sağlayan testler. Burası iyi.
- **Yüzeysel çevre (~%65):** Özellikle A4–A6 sprintlerinde eklenen 100+ test, "render edildi, çökmedi" veya "mock'lanan child div'i göründü" seviyesinde. 15 dosyalık örneklemede **%67 SHALLOW, %27 MEDIUM (sadece happy‑path), %7 DEEP**.
- **Sessiz boşluk (~%15):** Edge Function'ların 21'inden 17'si sıfır unit test; tenant isolation / cross‑org sızıntı / RLS reddi / Kong 401 / export round‑trip / skor aggregation / period snapshot immutability pratikte test edilmiyor.

Plan Rule 6 "≥1 behavior assertion = dosya elimine sayılır" kuralı metriği oyunladı. Plan Rule 7 "exhaustive branch coverage E2E'ye ait" kuralı bilinçli bir derinlik kısıtıdır — ama bu kural UI için mantıklıyken **pure logic modüllerinde uygulanıyor gibi görünüyor** (score pivot, token prefix, session normalization). Bu bir boşluk.

**Net yargı:** Suite **kritik matematik hatalarını yakalar**, **prod'daki davranış regresyonlarını yakalamaz**. Jüri değerlendirme gününde jüri akışı bozulursa unit testler bunu haber vermeyecek.

---

## 1. Rapor Genel Tablosu

| Metrik | Değer | Yorum |
|---|---|---|
| Toplam test | 774 | Baseline 472'den +302 (A1–A6) |
| Pass oranı | %100 | **Kalite sinyali değil** — suite derinliği düşük |
| Test dosyası | 242 | Src/test ratio ~1:1.6 |
| Satır coverage | ~%49.1 (A5 sonu) | v8 + threshold‑checker arasında ~0.65pp fark |
| Branch coverage | ~%57.3 | 2pp buffer yok |
| Function coverage | ~%34.7 | Fonksiyonların %65'i hiç çağrılmıyor |
| Zero‑cov dosya | 26 (A6 sonu) | 149'dan düştü — **nicelik metriği, nitelik değil** |
| Edge Function test | 4/21 (%19) | Kritik boşluk |

**"By Module" dağılımı** (All Tests sekmesinden): Shared API 79, Shared Lib 53, Shared UI 53, Admin Utils 47, Admin Analytics 22, Jury Shared 26. Admin Feature sayfaları tek tek 5–10 testle geçiyor; çoğu page‑level smoke.

**"Why It Matters / Risk" sütunları** her satır için dolu ama çoğu placeholder tonda: "Inactive indicator tells users this column is sortable" gibi. Risk yazıları genelde UX, güvenlik/data integrity değil.

---

## 2. On Soruya Dürüst Cevaplar

**S1 — Testler gerçek iş mantığı mı test ediyor?**
Karışık. Pure logic modülleri (stats, criteriaValidation, fieldMapping, scoreSnapshot hata sınıflandırması) evet — girdi→çıktı, edge case, boundary. Ama suite'in çoğunluğu render‑smoke: `render(<X />); expect(container.firstChild).toBeTruthy()` veya mocklanan child'ın label'ını kontrol. A4–A6'nın ~10/15 sample'ı bu kategoride. **"İş mantığı" = ~%20, "render smoke" = ~%65.**

**S2 — Test edilen dosyalar VERA'nın kritik risklerini temsil ediyor mu?**
Kısmen. Math/schema tarafı temsilî. Ama "multi‑tenant jury platform" risk haritasına göre **eksik** olanlar: tenant isolation boundary, RLS reddi altında UI davranışı, entry token lifecycle race condition, period snapshot atomicity, skor aggregation tutarlılığı (criteria × weight → composite), export round‑trip integrity, Kong vs function‑internal 401 ayrımı, audit log tam kayıt.

**S3 — Hangi testler değerli regression koruması?**
`shared/__tests__/criteriaValidation.test.js` · `shared/__tests__/stats.test.js` · `shared/api/__tests__/fieldMapping.test.js` · `shared/__tests__/criteriaSchema.test.js` · `jury/shared/__tests__/scoreSnapshot.test.js` (session error sınıflandırması) · `admin/features/reviews/__tests__/reviewsKpiHelpers` benzerleri · `admin/features/heatmap/__tests__/useGridSort` (state machine) · `admin/features/projects/__tests__/ProjectsPage` (koşullu state). Bu ~8–10 dosya gerçekten koruma sağlıyor.

**S4 — Hangi testler yüzeysel/kırılgan/gereksiz?**
A4–A6'dan tipik örnekler:
- `AnalyticsTab.test.jsx:11` — `expect(typeof AnalyticsTab).toBe("function")` (render bile etmiyor, tautology)
- `ScoresTab.test.jsx:21` — `<RankingsPage>` mock'lanmış `<div>RankingsPage</div>`; test mock'un kendini doğruluyor
- `HeatmapMobileList.test.jsx:8-26` — boş props ile render, `firstChild).toBeTruthy()`
- `CoverageBar.test.jsx:13-21` — sadece hardcoded label kontrolü, band renderı/hesap yok
- `SettingsComponents.test.jsx:38-43` — `UserAvatarMenu` sıfır bilgi assertion
- `AvgDonut.test.jsx` — NaN/Infinity/negatif yok, sadece formatlanmış sayı kontrolü
- `CriteriaConfirmModals.test.jsx:15-17` — `TrashIcon`/`TriangleAlertLucideIcon` → `null` mock, modal yapısı tamamen delilsiz

**S5 — Mock gerçekçiliği?**
**Düşük.** Sample'lanan 15 dosyada **hiçbiri Supabase yanıt şeklini (`{ data, error, count }`) simüle etmiyor**. Yaygın örüntü: stub `[]`, `{}` veya literal string/bool döndürüyor (`computeRingModel: () => ({ percent: 50 })`). `juryApi.test.js` RPC parametre shape'ini doğrulamıyor — `upsertScore` gerçek prod'da `{ data: null, error_code: 'session_expired' }` dönerse test yine geçecek. Child component'leri `() => null` mock'lamak drawer/modal yapısının hiçbir kısmını doğrulamıyor.

**S6 — Selector/adapter, skor, criteria mapping, status logic, storage, admin API, jury flow yeterince test edilmiş mi?**

| Alan | Durum |
|---|---|
| fieldMapping (design↔written, delivery↔oral) | ✅ iyi |
| criteriaSchema + validation | ✅ iyi |
| stats (stdev, quantile, IQR, outlier) | ✅ iyi |
| jury step state machine (happy) | 🟡 kısmi — error recovery yok |
| useJuryAutosave | 🟡 dedup var, race/network failure yok |
| adminSession / juryStorage / adminStorage | 🟡 varoluş test'i var, Safari private / quota exceeded yok |
| Skor aggregation (mean/median/weight × criterion) | 🔴 **izole unit test yok** |
| Ranking compute | 🔴 yok |
| Criteria weight application (sum=100 enforcement) | 🔴 yok (schema var, apply yok) |
| Admin API error mapping | 🔴 mock'lar ideal cevap |
| Period snapshot / freeze / immutability | 🔴 yok |
| Entry token lifecycle (TTL/revocation/session count) | 🔴 yok |

**S7 — Supabase/RPC, auth, tenant isolation, scoring consistency, period snapshot, export/import?**
- **Tenant isolation:** 🔴 Hiçbir test "org A, org B verisi dönmez"i doğrulamıyor. RLS istemci kenarında güven ediliyor ama güvenin test'i yok.
- **Auth/OAuth recovery:** 🟡 Var ama `isRecoverableAuthLockError`, refresh token expiry, tenant membership transition edge case'leri yok.
- **Kong 401 vs function‑internal 401:** 🔴 CLAUDE.md'nin uyardığı ayrım (execution_time_ms ≈ 0) test edilmiyor. `invokeEdgeFunction.test.js` sadece mock fetch.
- **Scoring consistency:** 🔴 `pivotItems()`, `normalizeScore()` clamp, criteria × weight → composite çıkarımı — izole test yok.
- **Period snapshot:** 🔴 `freezePeriodSnapshot()` idempotent mi, double‑call zararlı mı, snapshot sonrası jüri yazamaz mı — yok.
- **Export/import:** 🔴 XLSX header sıralaması, formül doğruluğu, round‑trip (export → parse → kıyas) yok. `logExportInitiated` sadece validation rejection test'i.
- **Audit log:** 🟡 DB trigger'ları var, istemci `writeAuditLog` pratikte test edilmiyor; failure escalation (`audit-anomaly-sweep` 318 LOC Edge Function) sıfır unit test.

**S8 — Yüksek pass oranı gerçek kalite mi, sahte güven mi?**
**Sahte güven.** 774/774 geçiyor çünkü suite ağırlıklı olarak "fonksiyon var / component render oldu" kontrolü yapıyor — prod'daki risklerin büyük kısmı suite'e girmiyor. Baseline 472'den 774'e +302 test eklendi ama bunların **~200'ü breadth metriği için yazıldı (zero‑cov sayacı), depth için değil**. Real‑world bug'lar şu anki suite ile çoğunlukla yakalanmaz. Coverage %41 → %49 geçişi de aldatıcı: payda büyürken paya eklenen satırlar çoğunlukla JSX render'ı.

**S9 — Hiç test edilmemiş ama mutlaka test edilmesi gereken top 10 konu:**

1. **Skor aggregation pipeline** (`src/shared/api/admin/scores.js` `pivotItems`) — null criteria, negatif skor, NaN total, eksik `criterion_key`
2. **Tenant isolation client boundary** — `adminApi` fonksiyonları org B datası dönerse UI ne yapar (null‑ref crash vs boş state)
3. **Entry token race condition** (`tokens.js` `makeTokenPrefix`, `normalizeSessionCount`) — prefix collision, eşzamanlı revoke
4. **Period snapshot atomicity** — freeze sırasında jüri yazımı, idempotent çağrı, `snapshot_frozen_at` altında admin outcome düzenlemesi
5. **Export round‑trip integrity** — `fullExport()` + `logExportInitiated` atomik mi (file gitti, log gitmedi senaryosu)
6. **Kong pre‑rejection ayrımı** (`invokeEdgeFunction.js`) — `execution_time_ms ≈ 0` 401 ile function‑internal 401 — CLAUDE.md gotcha'sı
7. **useJuryState error propagation** — 8 sub‑hook'tan biri fail olursa (örn. period load), step guard advance'i engelliyor mu
8. **Auth lock‑breaking + retry backoff** — `AuthProvider.jsx` `getSessionWithRetry` (120ms × i), `isRecoverableAuthLockError` edge'leri
9. **Audit anomaly escalation** (`supabase/functions/audit-anomaly-sweep`) — N failed login sonrası severity, rate limit, PII redaction
10. **Score cap davranışı** (`SCORE_QUERY_CAP` warn‑but‑not‑fail, scores.js:11) — 25k skorlu period sessizce truncate → ranking yanlış

**S10 — Dürüst puanlar:**

| Boyut | Puan | Gerekçe |
|---|---|---|
| Test kalitesi | **5/10** | Çekirdek iyi; A4–A6 katmanı metrik oyunu |
| İş mantığı coverage | **4/10** | Math var, kritik akışlar yok |
| Regression yakalama | **4/10** | Math regresyonunu yakalar, shape/error‑path'i kaçırır |
| Mock gerçekçiliği | **3/10** | Supabase response shape'ini kimse simüle etmiyor |
| Production confidence | **4/10** | %100 pass oranı yanıltıcı — prod'da kırılacak şeyler test dışında |

---

## 3. En Değerli Testler (korunmalı, referans alınmalı)

1. `src/shared/__tests__/criteriaValidation.test.js` — gap/overlap/sum=100 detection
2. `src/shared/__tests__/stats.test.js` — population vs sample variance, quantile ordering
3. `src/shared/api/__tests__/fieldMapping.test.js` — bidirectional round‑trip
4. `src/jury/shared/__tests__/scoreSnapshot.test.js` — session error taksonomisi
5. `src/shared/__tests__/criteriaSchema.test.js` — şema bütünlüğü
6. `src/admin/features/heatmap/__tests__/useGridSort.test.jsx` — toggle state machine
7. `src/admin/features/projects/__tests__/ProjectsPage.test.jsx:140-156` — state‑driven UI geçişleri
8. `src/admin/features/reviews/__tests__/` KPI helpers (dedupe + math)

---

## 4. En Zayıf / Yüzeysel Testler (ya silinmeli ya yükseltilmeli)

| Dosya | Problem |
|---|---|
| `AnalyticsTab.test.jsx:11` | `typeof === "function"` tautology |
| `ScoresTab.test.jsx:21-24` | mock'un kendini test ediyor |
| `HeatmapMobileList.test.jsx:8-26` | boş props render smoke |
| `CoverageBar.test.jsx` | yalnız label kontrolü |
| `SettingsComponents.test.jsx:38-43` | `firstChild toBeTruthy` |
| `CriteriaConfirmModals.test.jsx:15-17` | icon'lar null mock, modal yapısı delilsiz |
| `PeriodsTable.test.jsx:36-44` | `formatRelative: () => "1d ago"` mock literal |
| `AvgDonut.test.jsx` | NaN/Infinity/negatif dışında bir şey |
| `juryApi.test.js` | RPC parametre shape assertion yok |
| `invokeEdgeFunction.test.js` | 401 retry'da auth header güncellemesi doğrulanmıyor |
| `exportXLSX.test.js` | sadece filename regex, hücre/formül yok |

---

## 5. Büyük Coverage Boşlukları

**Business logic:**

- Skor aggregation (`scores.js:pivotItems`), ranking compute, composite formula
- Entry token yaşam döngüsü (`tokens.js:makeTokenPrefix`, `normalizeSessionCount`, `latestTimestamp`, `isTokenUnexpired`)
- Period snapshot/freeze atomicity ve idempotency
- Cross‑org data leakage boundary

**Edge Functions (17/21 sıfır test):**

- `audit-anomaly-sweep/index.ts` (318 LOC) — severity escalation
- `request-pin-reset/index.ts` (347 LOC) — rate limit, RLS, mail failure
- `send-export-report/index.ts` (345 LOC) — tenant isolation, size limit
- `notify-maintenance/index.ts` (402 LOC) — queue, delivery verification
- `log-export-event/index.ts` — transactional semantic
- `rpc-proxy/index.ts` — prod admin path ama zero test
- `admin-session-touch/index.ts`, `platform-metrics/index.ts` dışındaki çoğu

**Error path / boundary:**

- Kong 401 vs function‑internal 401 ayrımı
- RLS 403 altında UI degrade (crash vs empty state)
- `visibilitychange` + network failure eşzamanlı autosave race
- Session expired (`P0401`) mid‑finalization rollback
- Storage quota exceeded / Safari private mode (CLAUDE.md try/catch kuralı test edilmiyor)

**Tenant isolation:**

- `_assert_tenant_admin` SQL'de var, istemci API'sinde test yok
- Super‑admin (`organization_id IS NULL`) vs tenant‑admin dalları test edilmiyor
- `organizationId` mid‑hook değişirse `useAdminData` davranışı

---

## 6. P0 / P1 / P2 İyileştirme Planı

### P0 — Sahte güveni azaltan, en yüksek risk/çaba oranı (1–2 sprint)

1. **`adminApiMocks.js` altyapı katmanı yaz.** Tüm admin test'leri gerçekçi Supabase response shape'i (`{ data, error, count }`) döndüren paylaşılan mock fabrikası kullansın. Stub `{}` döndürmek yasak. Lint rule ekle: `mockResolvedValue(undefined)` / `({})` pattern'i `admin/features/**/__tests__/**` altında yasak.
2. **Skor aggregation izole test seti.** `scores.js` `pivotItems`, `dbScoresToUi` ile composite score matematiği için minimum 20 testlik dosya: null criteria, negatif score, NaN, eksik key, SCORE_QUERY_CAP, karışık org, weight overflow.
3. **Cross‑org data leakage testi.** `adminApi` seviyesinde "org A token ile org B query" senaryosu. UI katmanında 403 Forbidden dönerse component crash etmiyor mu? Bu bir boundary test seti.
4. **A4–A6'daki SHALLOW testleri listele ve etiketle.** `@shallow-smoke` veya `qa-catalog` metadata'sına "depth: smoke" ekle. Geçmişte elimine edilmiş dosyaların ~%67'sini derinleştirme backlog'u çıkar. Metriği `zero‑cov count` yerine `behavior assertion density` (file başına logic assertion / render‑smoke assertion oranı) yap.

### P1 — Kritik akış regression'ı (2–3 sprint)

5. **`useJuryState` error propagation kapsamı.** 8 sub‑hook'un her biri için fail senaryosu: `useJuryLoading` fail → step guard davranışı; `writeGroup` P0401 → locked step; `visibilitychange` + offline → dedup doğru mu.
6. **Entry token race condition unit testleri.** `makeTokenPrefix` collision, `normalizeSessionCount` concurrent revoke, `isTokenUnexpired` NaN ISO parse.
7. **Period snapshot immutability.** `freezePeriodSnapshot` double‑call, snapshot sonrası write retries, admin outcome edit while frozen.
8. **`invokeEdgeFunction.js` Kong ayrımı.** `execution_time_ms ≈ 0` mock'u ile Kong 401, gerçek function‑internal 401 senaryosu — farklı error handling path'leri doğrulanmalı.
9. **`AuthProvider` recovery.** `getSessionWithRetry` 3 attempt × 120ms backoff, `isRecoverableAuthLockError` true/false dalları, refresh token expiry, tenant membership eklendi/çıkarıldı transition'ı.
10. **Export round‑trip integrity.** `fullExport()` sonucu XLSX'i parse edip orijinal dataset ile karşılaştıran test; `logExportInitiated` başarısızsa export abort eden atomicity testi.

### P2 — Derinlik genişletme (long tail)

11. **Edge Function unit testleri.** `supabase/functions/*` için Deno test runner ile minimum `audit-anomaly-sweep`, `request-pin-reset`, `log-export-event`, `rpc-proxy`. Auth check → membership → service role sırası mock'lansın.
12. **Storage policy test katmanı.** `juryStorage.js`, `adminStorage.js`, `persist.js` için: quota exceeded, Safari private, key namespace collision, dual‑write atomicity.
13. **Audit log completeness.** Hangi admin aksiyonu hangi event üretir matrisi — her RPC wrapper'ı için `expect(auditLogSpy).toHaveBeenCalledWith(...)` doğrulaması.
14. **A4–A6 SHALLOW testleri derinleştir veya sil.** Her dosya için ya meaningful assertion ekle, ya qa‑catalog'dan sil — zero‑cov sayacına geri dönmesine izin verme.
15. **Mock realism lint rule.** `vi.mock` factory'leri `EMPTY_ARRAY_FROZEN`, `realisticRpcResponse(...)` gibi named helper'lar kullansın; inline boş literal yasak.

### Metrik değişikliği önerisi

Zero‑cov file count ulaşıldı (149 → 26). **Bundan sonra primary metrik:**

- **Behavior assertion density** = (logic / state / branch assertion sayısı) ÷ (toplam test sayısı). Hedef ≥ 1.5.
- **Mock realism score** = Supabase shape'li mock kullanan test dosyası yüzdesi. Hedef ≥ %60.
- **Risk coverage matrix** = 10 kritik akışın her birinde en az bir deep test — boolean kontrol.

---

## 7. Sonuç (tek cümle)

VERA'nın unit test suite'i **matematik hatalarına karşı sağlam, davranış regresyonlarına karşı kör**: 774/774 pass demek "suite kendi sorularına doğru cevap veriyor" demek, "sistem doğru çalışıyor" demek değil.

---

## Doğrulama planı (bu rapor uygulanırsa)

```bash
# Mock realism oranı taraması
grep -rE "mockResolvedValue\((\{\}|\[\])\)" src/**/__tests__ | wc -l   # bu sayı P0 sonrası düşmeli

# SHALLOW test taraması
grep -rE "firstChild\)\.toBeTruthy\(\)$|typeof .+ \)\.toBe\(['\"]function" src | wc -l

# Behavior density (kabaca)
grep -rcE "^\s*expect\(" src/**/__tests__ | awk -F: '{s+=$2}END{print s}'
# / 774 → density

# Risk matrix doğrulaması
for flow in "scores.pivotItems" "tokens.makeTokenPrefix" "freezePeriodSnapshot" \
            "invokeEdgeFunction.Kong" "useJuryState.error" "AuthProvider.retry" \
            "export.roundTrip" "cross-org.boundary" "audit-anomaly" "scoreQueryCap"; do
  echo "$flow: $(grep -rl "$flow" src/**/__tests__ | wc -l)"
done
```

---

**Critical file references:**

- Rapor kaynağı: `test-results/test-report-2026-04-24_20-22.xlsx`
- Plan notları: `docs/superpowers/plans/session-a-unit-test-coverage/README.md` (Rule 6, Rule 7 — derinlik kısıtı)
- Coverage geçmişi: `docs/superpowers/plans/session-a-unit-test-coverage/coverage-history.md`
- CLAUDE.md — Edge Function gotcha'ları (satır 96–102): Kong 401, ES256, `execution_time_ms` ayrımı
- `src/shared/api/admin/scores.js` · `tokens.js` · `export.js` · `audit.js` — P0/P1 hedefleri
- `src/jury/shared/useJuryState.js` + `hooks/` — P1 error propagation
- `supabase/functions/` — P2 Edge Function testleri
