# TEDU VERA: Test, CI ve Audit Sistemi — Sıfırdan Yeniden Yapı

## Context

**Neden sıfırdan:**
Mevcut 50 test dosyası var ama organizasyon tutarsız — bazı testler çok yüzeysel (sadece
`renders correctly`), bazı hook'lar hiç test edilmemiş, coverage neyin nereye baktığı belli değil.
qaTest/qa-catalog sistemi iyi bir fikir ama schema aşırı verbose ve yeni test yazmayı yavaşlatıyor.
Karar: tüm test dosyalarını sil, sıfır zeminde tutarlı bir mimari kur.

**Ne korunuyor:** Vitest, Playwright, qaTest mekanizması (sadeleştirilmiş), Allure reporter,
vitest.config.js, playwright.config.ts, setup.js

**Ne silinecek:** `src/admin/__tests__/`, `src/jury/__tests__/`, `src/shared/__tests__/`,
`src/test/a11y.test.jsx`, `src/admin/hooks/__tests__/`, `src/test/qa-catalog.json` (sıfırlanacak)

---

## Yeni Test Felsefesi

**Temel kural:** Bir şeyin nasıl yapıldığını değil, ne yaptığını test et.

- `expect(component).toMatchSnapshot()` → YOK
- `expect(internalState).toBe(x)` → YOK
- `expect(onSave).toHaveBeenCalledWith(correctPayload)` → VAR
- `expect(screen.getByText("Hata mesajı")).toBeVisible()` → VAR

**Test piramidi:**

```text
        ┌───────────────────┐
        │   E2E (Playwright)│ ← 15-20 kritik senaryo, hepsi gerçek akış
        ├───────────────────┤
        │  Hook / Entegrasyon│ ← state geçişleri, CRUD sonuçları, hata akışları
        ├───────────────────┤
        │   Pure Functions  │ ← en fazla test, en hızlı çalışan
        └───────────────────┘
```

**Neyi TEST ETME:**

- Static render ("bileşen render oluyor" seviyesi)
- React veya Supabase iç davranışı
- Prop drilling doğruluğu (sadece entegrasyon testlerinde anlamlı)

---

## qa-catalog.json Sadeleştirilmiş Schema

Mevcut schema 7 alan içeriyor; 4 alan zorunlu olmayan verbose açıklama.
Yeni schema: sadece 4 alan.

```json
{
  "id": "criteria.total.01",
  "module": "Shared / Criteria",
  "scenario": "sums max values across all template criteria",
  "severity": "normal"
}
```

**Kaldırılan alanlar:** `area`, `story`, `whyItMatters`, `risk`, `coverageStrength`

**Korunan alan:** `id`, `module`, `scenario`, `severity` (`normal` | `critical`)

**qaTest.js değişikliği:** Allure annotation'larını yeni schema'ya göre güncelle.
Zorunlu alan sayısı azalınca test yazmak hızlanır.

---

## Klasör Yapısı

```text
src/
├── admin/
│   ├── hooks/
│   │   ├── useManageSemesters.js
│   │   └── __tests__/
│   │       └── useManageSemesters.test.js
│   └── __tests__/
│       └── ManageProjectsPanel.test.jsx
├── jury/
│   ├── hooks/
│   │   └── __tests__/          ← jury hook testleri (ihtiyaç duyulursa)
│   └── __tests__/
│       └── EvalStep.test.jsx
├── shared/
│   ├── criteriaHelpers.js
│   └── __tests__/
│       └── criteriaHelpers.test.js
└── test/
    ├── setup.js               ← değişmez
    ├── qaTest.js              ← schema güncellenir
    ├── qa-catalog.json        ← sıfırlanır, yeniden doldurulur
    └── a11y.test.jsx          ← en sona, diğerleri kurulduktan sonra
```

**Kural:** Her test dosyası kaynak dosyasının `__tests__/` kardeş klasöründe.
Hook testleri → `hooks/__tests__/`. Component testleri → üst `__tests__/`.

---

## Faz Planı

---

### Faz 0: Teardown + Altyapı Güncellemesi

**Amaç:** Eski sistem temizlenir, yeni altyapı yerleştirilir.

#### Silinecek Dosyalar

```text
src/admin/__tests__/           (22 dosya)
src/jury/__tests__/            (12 dosya)
src/shared/__tests__/          (6 dosya)
src/admin/hooks/__tests__/     (1 dosya — yeni eklenen)
src/test/a11y.test.jsx
src/test/qa-catalog.json       (silinmez, içeriği sıfırlanır → [])
```

**NOT:** Silme işlemi tek commit'te yapılır; yarım bırakma yok.

#### Güncellenecek Dosyalar

**`src/test/qaTest.js`:**
- Allure annotation'larını yeni 4-alan schema'ya göre güncelle
- Zorunlu alan kontrolünü sadeleştir (`id`, `module`, `scenario`, `severity`)

**`src/test/qa-catalog.json`:**
- İçerik `[]` ile sıfırlanır
- Yeni testler yazılırken doldurulur

**`src/test/setup.js`:** Dokunma.

#### Tamamlanma Kriteri

- `npm test -- --run` koşulur, hiçbir test dosyası yok → 0 test, 0 hata
- qa-catalog.json boş array: `[]`
- qaTest.js yeni schema'yı tanıyor

---

### Faz 1: Pure Function Test Süiti

**Amaç:** Tüm pure/utility fonksiyonlar test altına alınır. Mock yok, altyapı karmaşıklığı yok.

#### Hedef Dosyalar (Öncelik Sırası)

**1. `src/shared/criteriaHelpers.js` → `src/shared/__tests__/criteriaHelpers.test.js`**

Test edilecek her fonksiyon için en az 3 senaryo: normal, boundary, boş/null.

| Fonksiyon | Kritik Senaryo |
|-----------|----------------|
| `getActiveCriteria(template)` | boş template → config default'a döner |
| `computeCriteriaTotal(criteria)` | 4 kriter toplamı, boş array → 0 |
| `isCriteriaScoreComplete(entry, criteria)` | eksik bir kriter → false |
| `normalizeCriterion(c)` | eski shape → yeni shape dönüşümü |
| `templateToCriteria(template)` | rubric band max clamp |
| `normalizeSemesterCriteria(template)` | null alan → default değer |
| `defaultCriteriaTemplate()` | 4 kriter, doğru key'ler |
| `buildMudekLookup(mudekTemplate)` | boş template → {} |
| `pruneCriteriaMudekMappings(criteria, mt)` | silinmiş MÜDEK kodu temizlenir |

**2. `src/admin/hooks/useScoreDetailsFilters.js` → `src/admin/hooks/__tests__/useScoreDetailsFilters.test.js`**

| Fonksiyon | Kritik Senaryo |
|-----------|----------------|
| `buildScoreCols(criteria)` | 4 kriter → 4 sütun |
| `normalizeScoreFilterValue(v)` | boşluk trim, type coerce |
| `clampScoreInput(v, min, max)` | min/max boundary |
| `hasActiveValidNumberRange(filter)` | min > max → false |
| `buildEmptyScoreFilters(criteria)` | her kriter için boş filter |

**3. `src/shared/stats.js` → `src/shared/__tests__/stats.test.js`**

Mevcut istatistiksel hesaplama testleri yeniden yazılır (sıfırdan ama aynı mantık).

**4. `src/admin/scoreHelpers.js` → `src/admin/__tests__/scoreHelpers.test.js`**

`computeOverviewMetrics` ve `getCellState` fonksiyonları test edilir.

#### qa-catalog Formatı (örnek)

```json
[
  {
    "id": "criteria.total.01",
    "module": "Shared / Criteria",
    "scenario": "returns sum of all criterion max values",
    "severity": "critical"
  },
  {
    "id": "criteria.complete.01",
    "module": "Shared / Criteria",
    "scenario": "returns false when any criterion score is missing",
    "severity": "critical"
  }
]
```

#### Tamamlanma Kriteri

- 4 test dosyası, toplam ~60 test
- `npm test -- --run` yeşil
- qa-catalog'da her test ID'si kayıtlı

---

### Faz 2: Admin Hook Test Süiti

**Amaç:** Admin hook'larının davranışını test et — state geçişleri, CRUD sonuçları, hata akışları.
**Mock stratejisi:** `vi.mock("../../shared/api", () => ({ ... }))` — sadece API katmanı mock'lanır.

#### Öncelik Sırası

**P1: `useManageSemesters.js` → `src/admin/hooks/__tests__/useManageSemesters.test.js`**

Test edilecek davranışlar (uygulama detayı değil):

- Semester oluşturma: başarı → liste güncellenir
- Semester oluşturma: isim çakışması → hata state'i set edilir
- Eval-lock açma: onay sonrası is_locked → true
- Eval-lock kapatma: is_locked → false
- Semester silme: API başarılı → listeden kalkar
- Semester silme: API fail → hata gösterilir, liste değişmez

**P2: `useManageProjects.js` → `src/admin/hooks/__tests__/useManageProjects.test.js`**

- Proje oluşturma: başarı → listeye eklenir
- Proje güncelleme: title değişir → liste güncellenir
- CSV import: geçerli format → projeler eklenir
- CSV import: geçersiz başlık → hata dönülür
- Semester locked iken oluşturma → hata

**P3: `useManageJurors.js` → `src/admin/hooks/__tests__/useManageJurors.test.js`**

- Juror oluşturma: başarı / çakışma
- PIN reset: yeni PIN döndürülür ve dialog'a geçer
- Edit-mode açma: yalnızca final submission sonrası mümkün
- Edit-mode kapatma (force-close)
- Juror silme: skoru olan juror → hata

**P4: `useDeleteConfirm.js` → `src/admin/hooks/__tests__/useDeleteConfirm.test.js`**

- Silme başarılı → onSuccess çağrılır
- Silme fail ama entity zaten yok → başarı sayılır (mevcut 1 test genişletilir)
- Cascade count yüklenir → dialog'a yansır

**P5-P8 (sonraki tur):**
`useAdminData`, `useAnalyticsData`, `useAuditLogFilters`, `useAdminTabs`

#### Tamamlanma Kriteri

- 4 hook dosyası, toplam ~40 test
- Her hook için başarı + hata + edge case senaryoları var
- `npm test -- --run` yeşil

---

### Faz 3: Component Test Süiti

**Amaç:** Kullanıcı etkileşimi gerektiren component davranışlarını test et.
**Kural:** "Render oluyor" testi YOK. Sadece etkileşim, hata state'i, erişilebilirlik.

#### Hedef Componentler (Seçici)

**Jury flow — kritik adımlar:**

| Component | Ne Test Edilir |
|-----------|----------------|
| `EvalStep` | slider input → skor state güncellenir; tab ile navigation |
| `PinStep` | 4 haneli giriş → submit; yanlış PIN → hata mesajı |
| `PinRevealStep` | PIN görüntülenir; kopyala butonu çalışır |
| `DoneStep` | submission durumu doğru gösterilir |

**Admin kritik componentler:**

| Component | Ne Test Edilir |
|-----------|----------------|
| `ManageProjectsPanel` | CSV drag-drop parse; grup no çakışması uyarısı |
| `CriteriaManager` | kriter ekle/sil; max değer clamp |
| `RankingsTab` | sıralama doğruluğu; tie handling; empty state |
| `ScoreGrid` | hücre rengi state'e göre değişir; filtre uygulanır |

**Erişilebilirlik (a11y):**

Faz sonunda `src/test/a11y.test.jsx` yeniden yazılır: EvalStep, ScoreGrid,
PinRevealStep, RankingsTab axe-core ile taranır.

#### Tamamlanma Kriteri

- ~8 component test dosyası, ~50 test
- a11y.test.jsx yeşil
- `npm test -- --run` tüm suite yeşil

---

### Faz 4: CI Hardening

**Amaç:** Test fail → PR bloklanır. Coverage görünür olur.

#### .github/workflows/ci.yml Değişiklikleri

1. Coverage raporlama eklenir:

```yaml
- name: Run tests with coverage
  run: npm test -- --run --coverage

- name: Upload coverage report
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
    retention-days: 30
```

2. **Branch protection (GitHub repo ayarı, CI değil):**
   - Settings → Branches → `main`
   - Require status checks: `test` job
   - Require PR: opsiyonel (küçük ekip için esnek bırak)

#### vitest.config.js Eklentisi

```js
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov', 'json-summary'],
  include: ['src/**/*.{js,jsx}'],
  exclude: ['src/test/**', 'src/**/__tests__/**', 'src/**/*.config.*']
}
```

#### package.json

```json
"test:coverage": "vitest run --coverage"
```

#### Tamamlanma Kriteri

- Her PR'da CI test job'u zorunlu geçiyor
- `npm run test:coverage` çalışıyor, lcov üretiyor
- Coverage artifact CI'da erişilebilir

---

### Faz 5: E2E Genişletme

**Amaç:** En değerli kullanıcı akışlarını gerçek browser'da test et.
Mevcut 6 E2E dosyasının bir kısmı korunabilir veya temizlenebilir.

#### E2E Kapsamı (Öncelik Sırası)

| Senaryo | Dosya | Durum |
|---------|-------|-------|
| Jury: kimlik → PIN → değerlendirme → gönder | `jury-flow.spec.ts` | İncelenir / yeniden yaz |
| Jury: lock state, edit mode | `jury-lock.spec.ts` | İncelenir |
| Admin: login | `admin-login.spec.ts` | Koru veya sadeleştir |
| Admin: semester CRUD + eval-lock | `admin-semesters.spec.ts` | YENİ |
| Admin: juror CRUD + PIN reset | `admin-jurors.spec.ts` | YENİ |
| Admin: results + export | `admin-results.spec.ts` | İncelenir |
| Admin: backup export/import | `admin-export.spec.ts` | İncelenir |
| Admin: CSV import | `admin-import.spec.ts` | İncelenir |

**Faz 5'te sadece YENİ dosyalar yazılır.** Mevcut dosyalar ayrı değerlendirmede.

#### Tamamlanma Kriteri

- 2 yeni E2E spec yeşil: `admin-semesters.spec.ts`, `admin-jurors.spec.ts`
- `npm run e2e` tüm suite yeşil

---

### Faz 6: Audit Document Sistemi

**Amaç:** Test kapsamını iş akışlarına bağlayan yaşayan dokümanlar.

#### Yapı

```text
docs/audit/module-coverage/
├── admin-hooks.md          her hook: durum, kapsanan senaryolar, açık riskler
├── jury-hooks.md
├── shared-utils.md
└── template.md             yeni modül audit'i için boş şablon

docs/audit/coverage-matrix.md  kritik akış → test eşleme tablosu
```

#### qa-catalog critical_flow Alanı (Faz 6'da eklenir)

Faz 1-5 tamamlanınca qa-catalog girişlerine `critical_flow` alanı eklenir:
`semester_create`, `jury_eval`, `score_submit`, `pin_reset`, `juror_crud`, vb.

Bu alan audit matrix ile cross-reference için kullanılır.

---

## Faz Sırası

```text
Faz 0: Teardown + altyapı       ─────────►
Faz 1: Pure function testleri           ──────────────►
Faz 2: Hook testleri                          ────────────────────►
Faz 3: Component testleri                              ───────────────────►
Faz 4: CI Hardening             ──────────────────────────────────────────►
Faz 5: E2E                                                      ──────────►
Faz 6: Audit docs                                                     ─────►
```

Faz 4 (CI) Faz 0'dan itibaren paralel başlayabilir.
Faz 6 en sona, coverage verisi toplandıktan sonra.

---

## Değişmeyecek Konvansiyonlar

1. **Her yeni test** `qaTest("id", ...)` kullanır — bare `it()` yasak
2. **Her yeni test ID** önce `qa-catalog.json`'a eklenir
3. **API mock'u her test dosyasında:**
   `vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }))`
4. **"Renders correctly" testi yazmak yasak** — davranış test et
5. **Hook testleri** `renderHook` + `act` kullanır
6. **Yorum ekleme** değiştirilmemiş koda — CLAUDE.md kuralı

---

## Tüm Doğrulama (Pipeline Tam Yeşil)

```bash
# 1. Unit testler
npm test -- --run

# 2. Coverage raporu
npm run test:coverage

# 3. E2E testler
npm run e2e

# 4. CI tam pipeline
# GitHub Actions → ci.yml → test job + e2e job → yeşil
```
