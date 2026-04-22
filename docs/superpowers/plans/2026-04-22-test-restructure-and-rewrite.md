# Test Klasör Yapısı Reorganizasyonu + Sıfırdan Test Yazımı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VERA projesinin mevcut test altyapısını arşivleyip yeni, domain-organize bir klasör yapısına geçmek ve katman katman sıfırdan güvenilir test kapsamı oluşturmak.

**Architecture:** Mevcut 87 test dosyası (412 geçen / 64 kırık) arşivlenir; yeni iskelet `src/<domain>/__tests__/<tip>/` hibrit modeliyle kurulur; paylaşılan test kit (fixtures + factories + helpers) önce hazırlanır; testler aşağıdan yukarı yazılır (shared → auth → jury → admin → DB → edge functions → E2E).

**Tech Stack:** Vitest + React Testing Library (unit/component), Playwright (E2E), pgTAP veya Vitest-SQL runner (DB), Deno test (edge functions), qaTest + qa-catalog.json (metadata), Allure (reporter).

---

## Context

**Neden yapıyoruz?**

Mevcut durum analizi (2026-04-22):

| Metrik | Değer |
|---|---|
| Kaynak/test oranı | 218 kaynak → 43 test dosyası (**%20 kapsam**) |
| Test çalıştırma | 412 geçiyor / **64 kırık** (%13.4 fail) |
| QA catalog | 468 ID tanımlı / 306 kullanılıyor / **162 orphan (%34.6)** |
| Admin modallar | 26 kaynak, **0 test** (%0) |
| Shared UI | 29 kaynak, **0 test** (%0) |
| Shared API | 27 kaynak, 1 test (%4) |
| Edge functions | 23 adet, **0 test** |
| SQL RPC | 113 adet, **0 test** |
| Son 30 gün | 560 kaynak / 101 test değişti (5.5:1) |
| Coverage ölçümü | Yok |
| Visual/perf/load | Yok |

**Sorun:** Kod testten çok daha hızlı büyüdü, mevcut testlerin önemli bir kısmı son refactor'larda kırıldı, kritik katmanlar (modals, API, edge functions, RLS, RPC) tamamen korumasız. Yamamaya çalışmak iki kat iş; sıfırdan temiz bir yapıyla daha hızlı ve daha güvenilir.

**Çıktı:** Reorganize edilmiş klasör yapısı + domain domain güvenilir test kapsamı + DB/edge function/E2E boşluklarının kapatılması + coverage ölçümü.

**Tahmini süre:** 6-8 gün (3-4 oturuma bölünmüş).

---

## Decisions Pending (karar verilecek)

Yeni oturuma geçmeden önce netleşmesi gereken 3 karar:

1. **Keeper listesi:** Mevcut testlerden hangilerini yeni yapıya taşıyalım? Öneri: domain bilgisi encode eden saf-mantık testleri (`fieldMapping`, `criteriaValidation`, `scoreHelpers`, `analyticsDatasets`, `csvParser`, `semesterFormat` gibi ~10-15 dosya). Geri kalan arşivde referans kalır.
   - **Seçenek A:** Ajanla otomatik keeper listesi çıkar, sonra kullanıcı onaylasın.
   - **Seçenek B:** Kullanıcı manuel seçsin (dosya dosya).
   - **Seçenek C:** Hiçbir şey taşıma, hepsini arşivle, sıfırdan yaz.

2. **DB test altyapısı:** `sql/tests/` için hangi runner?
   - **Seçenek A — pgTAP:** Endüstri standardı, SQL-native (`.sql` dosyaları). Kurulum: `CREATE EXTENSION pgtap;`. Supabase'de mevcut. CI'da `pg_prove` gerekir.
   - **Seçenek B — Vitest + service-role client:** Mevcut stack'te kalır, JS ile DB'ye direkt sorgu. Daha az öğrenme eğrisi ama RLS testleri için iki client (anon + service) yönetmek gerek.
   - **Öneri:** pgTAP (RLS testleri için çok daha temiz, hata mesajları daha anlamlı).

3. **Coverage hedefleri:** Baseline ne olsun?
   - **Öneri:** `shared/api` %85, `shared/ui` %70, `shared/hooks` %80, `pages/drawers/modals` %50, `jury/*` %75, `auth/*` %75, E2E critical-path %100 (login, jury eval, admin CRUD). Global %65 minimum.

---

## Hedef Klasör Yapısı

```
VERA/
│
├── src/                                    ← APP KAYNAĞI + UNIT/COMPONENT TESTLER
│   │
│   ├── test/                               ← Paylaşılan test kit
│   │   ├── setup.js                        (mevcut — korunur)
│   │   ├── qaTest.js                       (mevcut — korunur)
│   │   ├── qa-catalog.json                 (SIFIRDAN — eski 468 ID arşive)
│   │   ├── fixtures/                       (YENİ)
│   │   │   ├── organizations.json
│   │   │   ├── jurors.json
│   │   │   ├── periods.json
│   │   │   ├── projects.json
│   │   │   └── scores.json
│   │   ├── factories/                      (YENİ — test data builders)
│   │   │   ├── buildOrg.js
│   │   │   ├── buildJuror.js
│   │   │   ├── buildPeriod.js
│   │   │   ├── buildProject.js
│   │   │   └── buildScore.js
│   │   └── helpers/                        (YENİ — render + mock)
│   │       ├── renderWithRouter.jsx
│   │       ├── renderWithAuth.jsx
│   │       ├── mockSupabase.js
│   │       └── mockInvokeEdge.js
│   │
│   ├── admin/
│   │   ├── pages/*.jsx                     (kaynak — 24 dosya)
│   │   ├── drawers/*.jsx                   (kaynak — 24 dosya)
│   │   ├── modals/*.jsx                    (kaynak — 26 dosya)
│   │   ├── hooks/*.js                      (kaynak — 27 dosya)
│   │   ├── components/*.jsx                (kaynak — 17 dosya)
│   │   └── __tests__/                      ← YENİ alt-dizin yapısı
│   │       ├── pages/
│   │       ├── drawers/
│   │       ├── modals/
│   │       ├── hooks/
│   │       └── components/
│   │
│   ├── auth/
│   │   ├── components/*.jsx
│   │   ├── hooks/*.js
│   │   └── __tests__/
│   │       ├── components/
│   │       └── hooks/
│   │
│   ├── jury/
│   │   ├── components/*.jsx                (7 dosya)
│   │   ├── hooks/*.js                      (14 dosya)
│   │   ├── steps/*.jsx
│   │   └── __tests__/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── steps/
│   │
│   └── shared/
│       ├── api/**/*.js                     (27 dosya)
│       ├── ui/*.jsx                        (29 dosya)
│       ├── hooks/*.js                      (9 dosya)
│       ├── storage/*.js                    (3 dosya)
│       ├── lib/*.js
│       └── __tests__/
│           ├── api/
│           ├── ui/
│           ├── hooks/
│           ├── storage/
│           └── lib/
│
├── e2e/                                    ← PLAYWRIGHT (mevcut — genişletilecek)
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── register.spec.ts
│   │   ├── invite-accept.spec.ts           (YENİ)
│   │   ├── google-oauth.spec.ts            (YENİ)
│   │   ├── forgot-password.spec.ts         (YENİ)
│   │   └── reset-password.spec.ts          (YENİ)
│   ├── admin/
│   │   ├── organizations-crud.spec.ts      (YENİ)
│   │   ├── jurors-crud.spec.ts             (YENİ)
│   │   ├── periods-crud.spec.ts            (YENİ)
│   │   ├── projects-import.spec.ts         (mevcut)
│   │   ├── export.spec.ts                  (mevcut)
│   │   ├── setup-wizard.spec.ts            (YENİ)
│   │   ├── entry-token-lifecycle.spec.ts   (YENİ)
│   │   └── audit-log-view.spec.ts          (YENİ)
│   ├── jury/
│   │   ├── entry.spec.ts
│   │   ├── evaluation.spec.ts              (mevcut: jury-flow)
│   │   ├── pin-lifecycle.spec.ts           (YENİ)
│   │   └── lock.spec.ts                    (mevcut)
│   ├── demo/
│   │   ├── auto-login.spec.ts              (YENİ)
│   │   └── isolation.spec.ts               (YENİ)
│   ├── tenant/
│   │   └── multi-tenant-isolation.spec.ts  (mevcut — genişle)
│   ├── fixtures/
│   │   ├── global-setup.ts
│   │   └── seed-data.ts
│   └── helpers/
│       ├── LoginPage.ts                    (page objects)
│       ├── AdminNav.ts
│       └── JuryFlow.ts
│
├── sql/
│   ├── migrations/                         (mevcut — kaynak)
│   ├── seeds/
│   └── tests/                              ← YENİ — pgTAP
│       ├── rls/
│       │   ├── organizations_isolation.sql
│       │   ├── memberships_isolation.sql
│       │   ├── projects_isolation.sql
│       │   ├── jurors_isolation.sql
│       │   ├── periods_isolation.sql
│       │   ├── scores_isolation.sql
│       │   ├── audit_log_isolation.sql
│       │   └── entry_tokens_isolation.sql
│       ├── rpcs/jury/
│       │   ├── rpc_jury_auth.sql
│       │   ├── rpc_jury_write_scores.sql
│       │   └── rpc_jury_progress.sql
│       ├── rpcs/admin/
│       │   ├── rpc_admin_list_*.sql
│       │   ├── rpc_admin_upsert_*.sql
│       │   └── rpc_admin_delete_*.sql
│       └── migrations/
│           ├── idempotency.sql             (mevcut — taşı)
│           └── zero_to_latest_smoke.sql
│
├── supabase/
│   └── functions/
│       ├── rpc-proxy/
│       │   ├── index.ts                    (kaynak)
│       │   └── index.test.ts               ← co-located test
│       ├── admin-session-touch/
│       │   ├── index.ts
│       │   └── index.test.ts
│       └── ... (23 fonksiyon, her biri için)
│
└── perf/                                   ← Faz 7 (opsiyonel)
    └── k6/
        ├── jury-concurrent-load.js
        └── admin-dashboard-load.js
```

**Test konum kuralı:**

| Test tipi | Yer | Uzantı | Runner |
|---|---|---|---|
| Unit/component | `src/<domain>/__tests__/<tip>/` | `.test.{js,jsx}` | Vitest |
| Paylaşılan test kit | `src/test/` | — | Vitest |
| E2E | `e2e/<flow>/` | `.spec.ts` | Playwright |
| SQL (RLS + RPC) | `sql/tests/<kategori>/` | `.sql` | pgTAP |
| Edge Function | `supabase/functions/<fn>/` (co-located) | `.test.ts` | Deno test |
| Perf (opsiyonel) | `perf/k6/` | `.js` | k6 |

---

## Faz Planı (4 oturumda)

**Context budget (Opus 4.7 1M):**

| Oturum | Fazlar | Tahmini context | Süre |
|---|---|---|---|
| 1 (bu oturum kalan %34) | Faz 0 + 1 | ~%5-8 | 0.5 gün |
| 2 (temiz) | Faz 2 + 3a (Auth) | ~%25-30 | 1.5 gün |
| 3 (temiz) | Faz 3b (Jury) + 3c (Admin) | ~%40-50 | 2.5-3 gün |
| 4 (temiz) | Faz 4 + 5 + 6 + 7 | ~%30-40 | 2 gün |

---

## Faz 0 — Arşivleme + Keeper Seçimi

**Amaç:** Mevcut test klasörlerini arşive al, CI'dan exclude et, keeper listesini işaretle.

**Files:**
- Rename: `src/admin/__tests__/` → `src/admin/__tests__.archive/`
- Rename: `src/auth/__tests__/` → `src/auth/__tests__.archive/`
- Rename: `src/jury/__tests__/` → `src/jury/__tests__.archive/`
- Rename: `src/shared/__tests__/` → `src/shared/__tests__.archive/`
- Rename: `src/admin/hooks/__tests__/` → `src/admin/hooks/__tests__.archive/`
- Rename: `sql/__tests__/` → `sql/__tests__.archive/`
- Rename: `src/test/qa-catalog.json` → `src/test/qa-catalog.archive.json`
- Modify: `vitest.config.js` (exclude archive dizinlerini)
- Create: `docs/superpowers/plans/keeper-list.md`

- [ ] **Step 1: Mevcut test dosyalarını listele**

```bash
find src -type d -name "__tests__" -not -path "*/node_modules/*"
find sql -type d -name "__tests__"
```

Expected: 6 dizin (admin, auth, jury, shared, admin/hooks, sql).

- [ ] **Step 2: Arşive rename et**

```bash
git mv src/admin/__tests__ src/admin/__tests__.archive
git mv src/auth/__tests__ src/auth/__tests__.archive
git mv src/jury/__tests__ src/jury/__tests__.archive
git mv src/shared/__tests__ src/shared/__tests__.archive
git mv src/admin/hooks/__tests__ src/admin/hooks/__tests__.archive
git mv sql/__tests__ sql/__tests__.archive
git mv src/test/qa-catalog.json src/test/qa-catalog.archive.json
```

- [ ] **Step 3: qa-catalog.json'u sıfırdan boş yarat**

```json
[]
```

- [ ] **Step 4: Vitest config'te archive exclude**

`vitest.config.js` içinde `test.exclude` dizisine ekle:

```js
exclude: [
  "**/node_modules/**",
  "**/e2e/**",
  "**/__tests__.archive/**",
]
```

(Allure config için de aynı değişiklik: `vitest.config.allure.mjs`)

- [ ] **Step 5: `npm test -- --run` çalıştır, 0 test bekleniyor**

Expected: "No test files found" veya tüm arşiv dışlanmış şekilde boş sonuç.

- [ ] **Step 6: Keeper listesi çıkar**

`docs/superpowers/plans/keeper-list.md` dosyasına mevcut arşivden yeniden yazılacak/referans alınacak testleri not et. Aday liste:

```
src/admin/__tests__.archive/
  - criteriaFormHelpers.test.js      ← saf helper, taşı
  - scoreHelpers.test.js             ← saf helper, taşı
  - scoreHelpers.safety.test.js      ← edge case
  - csvParser.test.js                ← saf parser
  - analyticsDatasets.new.test.js    ← saf dönüşüm
  - analyticsExport.test.js          ← export mantığı
  - cloneFramework.test.js           ← framework clone
  - overviewMetrics.test.js          ← hesaplama
  - outcomeAttainmentTrend.test.js   ← istatistik
  - auditUtils.test.js               ← audit helper
src/shared/__tests__.archive/
  - criteriaHelpers.test.js
  - criteriaValidation.test.js
  - semesterFormat.test.js
  - avatarColor.test.js
  - LevelPill.test.js
  - withRetry.test.js
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: archive old test suite + empty qa-catalog for reset"
```

---

## Faz 1 — Yeni İskelet + Test Kit

**Amaç:** Yeni dizin ağacını kur, paylaşılan fixtures/factories/helpers'ı yaz.

**Files:**
- Create: `src/admin/__tests__/{pages,drawers,modals,hooks,components}/.gitkeep`
- Create: `src/auth/__tests__/{components,hooks}/.gitkeep`
- Create: `src/jury/__tests__/{components,hooks,steps}/.gitkeep`
- Create: `src/shared/__tests__/{api,ui,hooks,storage,lib}/.gitkeep`
- Create: `src/test/fixtures/{organizations,jurors,periods,projects,scores}.json`
- Create: `src/test/factories/build{Org,Juror,Period,Project,Score}.js`
- Create: `src/test/helpers/{renderWithRouter,renderWithAuth,mockSupabase,mockInvokeEdge}.{js,jsx}`
- Create: `sql/tests/{rls,rpcs/jury,rpcs/admin,migrations}/.gitkeep`
- Create: `e2e/{auth,admin,jury,demo,tenant,fixtures,helpers}/.gitkeep` (mevcut spec'ler yerinde kalır)
- Modify: `package.json` — `test:coverage` scripti ekle
- Modify: `vitest.config.js` — coverage config

- [ ] **Step 1: Boş dizin iskeletini oluştur**

```bash
mkdir -p src/admin/__tests__/{pages,drawers,modals,hooks,components}
mkdir -p src/auth/__tests__/{components,hooks}
mkdir -p src/jury/__tests__/{components,hooks,steps}
mkdir -p src/shared/__tests__/{api,ui,hooks,storage,lib}
mkdir -p src/test/{fixtures,factories,helpers}
mkdir -p sql/tests/{rls,rpcs/jury,rpcs/admin,migrations}
mkdir -p e2e/{auth,admin,jury,demo,tenant,fixtures,helpers}
```

(Her dizine `.gitkeep` koy ki commit'lenebilsin)

- [ ] **Step 2: Fixture JSON'ları yaz**

`src/test/fixtures/organizations.json`:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Test University",
    "slug": "test-uni",
    "plan": "free",
    "setup_completed_at": "2026-01-01T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  },
  {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "Other Org",
    "slug": "other-org",
    "plan": "pro",
    "setup_completed_at": null,
    "created_at": "2026-02-01T00:00:00Z"
  }
]
```

(Diğer fixtures için benzer 2-3 örnek veri; gerçek şema için `sql/migrations/002_tables.sql` referans.)

- [ ] **Step 3: Factory fonksiyonlarını yaz**

`src/test/factories/buildOrg.js`:

```js
import orgs from "../fixtures/organizations.json";

let counter = 1000;

export function buildOrg(overrides = {}) {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    name: `Org ${counter}`,
    slug: `org-${counter}`,
    plan: "free",
    setup_completed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export { orgs as orgFixtures };
```

(Diğer factories için aynı kalıp.)

- [ ] **Step 4: Render helper yaz**

`src/test/helpers/renderWithRouter.jsx`:

```jsx
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

export function renderWithRouter(ui, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
}
```

`src/test/helpers/mockSupabase.js`:

```js
import { vi } from "vitest";

export function createMockSupabase({ user = null, data = {}, error = null } = {}) {
  const rpc = vi.fn((name) => Promise.resolve({ data: data[name] ?? null, error }));
  const auth = {
    getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: user ? { user } : null }, error: null })),
  };
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }));
  return { rpc, auth, from };
}
```

- [ ] **Step 5: Coverage script ekle**

`package.json`:

```json
"scripts": {
  "test:coverage": "vitest run --coverage",
  ...
}
```

`vitest.config.js` içinde:

```js
test: {
  ...,
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
      lines: 0,
      functions: 0,
      branches: 0,
      statements: 0,
    },
  },
}
```

(Thresholds başta 0 — Faz 7'de yükseltilecek.)

- [ ] **Step 6: `npm run test:coverage` çalıştır, boş rapor bekleniyor**

Expected: Coverage raporu oluşur, `%0` ile başlar. `coverage/` dizini yaratılır.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: scaffold new test structure + fixtures/factories/helpers"
```

**Oturum 1 biter burada.** Sonraki oturuma geçerken bu plan dosyasını ve `docs/superpowers/plans/keeper-list.md`'yi referans al.

---

## Faz 2 — Shared Katmanı Testleri (Oturum 2)

**Amaç:** `src/shared/` tüm alt-katmanlarına test yaz. Bu katman diğer her şeyin bağımlılığı, önce burası sağlam olmalı.

**Kapsanacak modüller:**
- `src/shared/lib/environment.js` — pathname-based env resolver
- `src/shared/lib/supabaseClient.js` — Proxy client, env switching
- `src/shared/storage/keys.js` — key registry (hardcoded string yok kontrolü)
- `src/shared/storage/juryStorage.js`
- `src/shared/storage/adminStorage.js`
- `src/shared/storage/persist.js` — try/catch wrapper
- `src/shared/api/fieldMapping.js` — UI↔DB mapping (written↔design, oral↔delivery)
- `src/shared/api/core/invokeEdgeFunction.js` — POST raw-fetch
- `src/shared/api/juryApi.js`
- `src/shared/api/adminApi.js` ve `src/shared/api/admin/*` (modüler)
- `src/shared/hooks/useCardSelection.js`
- `src/shared/hooks/*` — diğer 8 hook
- `src/shared/ui/FbAlert.jsx`, `CustomSelect.jsx`, `ConfirmDialog.jsx`, `PremiumTooltip.jsx` — kritik UI primitives

**Her modül için TDD sırası:**
1. qa-catalog'a ID ekle (`shared.lib.environment.01` gibi)
2. Failing test yaz
3. Test'i çalıştır, fail gör
4. (Kaynak zaten var — düzeltme gerekirse yap)
5. Test pass
6. Commit

**Örnek — environment.js için:**

**Files:**
- Create: `src/shared/__tests__/lib/environment.test.js`
- Modify: `src/test/qa-catalog.json` (yeni ID'ler ekle)

- [ ] **Step 1: qa-catalog'a ID ekle**

```json
[
  {
    "id": "shared.lib.environment.01",
    "module": "shared.lib",
    "area": "environment",
    "story": "pathname-based env resolution",
    "severity": "critical",
    "scenario": "/demo/* pathname → demo env",
    "whyItMatters": "Demo ve prod ayrımı pathname'e bağlı; karışırsa tenant sızıntısı olur",
    "risk": "Veri ihlali, demo datası prod'a yazılabilir",
    "coverageStrength": "full"
  },
  {
    "id": "shared.lib.environment.02",
    "module": "shared.lib",
    "area": "environment",
    "story": "non-demo pathname → prod env",
    "severity": "critical",
    "scenario": "/ ve /admin/* → prod env",
    "whyItMatters": "Prod env default olmalı",
    "risk": "Kullanıcılar prod yerine demo'ya yönlenebilir",
    "coverageStrength": "full"
  }
]
```

- [ ] **Step 2: Failing test yaz**

`src/shared/__tests__/lib/environment.test.js`:

```js
import { describe, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { resolveEnvFromPathname } from "../../lib/environment.js";

describe("environment.resolveEnvFromPathname", () => {
  qaTest("shared.lib.environment.01", () => {
    expect(resolveEnvFromPathname("/demo")).toBe("demo");
    expect(resolveEnvFromPathname("/demo/admin")).toBe("demo");
    expect(resolveEnvFromPathname("/demo/jury/eval")).toBe("demo");
  });

  qaTest("shared.lib.environment.02", () => {
    expect(resolveEnvFromPathname("/")).toBe("prod");
    expect(resolveEnvFromPathname("/admin")).toBe("prod");
    expect(resolveEnvFromPathname("/jury/identity")).toBe("prod");
    expect(resolveEnvFromPathname("/login")).toBe("prod");
  });
});
```

- [ ] **Step 3: Çalıştır, pass olmalı (fonksiyon zaten var)**

```bash
npm test -- --run src/shared/__tests__/lib/environment.test.js
```

Expected: 2 test pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(shared/lib): environment pathname resolution"
```

**Tekrar et:** Aynı kalıp her `src/shared/` modülü için. Toplam ~40 test dosyası bekleniyor.

---

## Faz 3 — Domain Testleri (Oturum 2 devamı + Oturum 3)

### 3a — Auth (Oturum 2 sonu)

**Kapsanacak:**
- `src/auth/components/*.jsx` (LoginScreen, RegisterScreen, CompleteProfileForm, ForgotPassword, ResetPassword, EmailVerifyBanner, VerifyEmailScreen, PendingReviewGate)
- `src/auth/hooks/*.js`
- `src/shared/auth/AuthProvider.jsx` (OAuth, remember-me, tenant membership)
- `src/shared/auth/AuthGuard.jsx`, `JuryGuard.jsx`

### 3b — Jury (Oturum 3 başı)

**Kapsanacak:**
- `src/jury/useJuryState.js` (step machine: identity → period → pin → eval → done)
- `src/jury/hooks/*.js` (14 hook)
- `src/jury/components/*.jsx` (7 component)
- `src/jury/steps/*.jsx` (her step için integration test)

### 3c — Admin (Oturum 3 kalanı)

**En büyük yük — öncelik sırası:**
1. **Hooks** (27 dosya) — `useSettingsCrud`, `useAdminData`, `useAdminRealtime`, `useScoreGridData` kritik
2. **Pages** (24 dosya) — smoke + critical interaction testleri
3. **Drawers** (24 dosya) — açılış, form submit, inline confirm
4. **Modals** (26 dosya) — **şu an %0 test**, en büyük boşluk
5. **Components** (17 dosya) — zaten mevcut, en kolay

**Her page/drawer/modal için minimum 3 test:**
- Render smoke (prop'larla açılır)
- Happy path (ana CRUD eylemi)
- Error path (API hatası → FbAlert)

---

## Faz 4 — DB Katmanı (Oturum 4 başı)

**Amaç:** RLS isolation + kritik RPC davranışları pgTAP ile test et.

**Karar:** pgTAP (Decisions Pending #2)

**Setup:**

`sql/migrations/001_extensions.sql`'ye ekle:

```sql
CREATE EXTENSION IF NOT EXISTS pgtap;
```

**Test örneği — `sql/tests/rls/organizations_isolation.sql`:**

```sql
BEGIN;
SELECT plan(3);

-- Seed: 2 org, 2 admin user
SELECT set_test_admin_a_as_caller();
SELECT is((SELECT count(*) FROM organizations WHERE id = org_a_id()), 1::bigint,
         'admin A can see org A');
SELECT is((SELECT count(*) FROM organizations WHERE id = org_b_id()), 0::bigint,
         'admin A CANNOT see org B (RLS isolation)');

SELECT set_test_admin_b_as_caller();
SELECT is((SELECT count(*) FROM organizations WHERE id = org_a_id()), 0::bigint,
         'admin B CANNOT see org A');

SELECT * FROM finish();
ROLLBACK;
```

**Kapsam:** 8 tablo için RLS testi + ~20 kritik RPC davranış testi.

**Runner:** `pg_prove` veya Supabase MCP ile `execute_sql`.

```bash
pg_prove -h localhost -U postgres -d vera_test sql/tests/**/*.sql
```

---

## Faz 5 — Edge Function Testleri

**Kapsanacak:** 23 fonksiyon, ama öncelik:

1. `rpc-proxy/` (tüm admin RPC'ler bundan geçer)
2. `admin-session-touch/`
3. `platform-metrics/`
4. `invite-accept/`
5. `tenant-application-*` (eğer hâlâ varsa)

**Her fonksiyon için test:**

`supabase/functions/rpc-proxy/index.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";

Deno.test("rpc-proxy: missing JWT → 401", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/rpc-proxy", {
    method: "POST",
    body: JSON.stringify({ name: "rpc_admin_list_orgs" }),
  });
  assertEquals(res.status, 401);
});

Deno.test("rpc-proxy: valid JWT + tenant admin → 200", async () => {
  const token = await getTestAdminJWT();
  const res = await fetch("http://localhost:54321/functions/v1/rpc-proxy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "rpc_admin_list_orgs" }),
  });
  assertEquals(res.status, 200);
});
```

**Runner:** `supabase functions serve` + `deno test`.

---

## Faz 6 — E2E Genişletme

**Mevcut:** 8 spec. **Hedef:** ~25 spec.

**Eklenecek flow'lar:**

| Flow | Dosya | Öncelik |
|---|---|---|
| Google OAuth login | `e2e/auth/google-oauth.spec.ts` | Yüksek |
| Invite accept | `e2e/auth/invite-accept.spec.ts` | Yüksek |
| Forgot → Reset password | `e2e/auth/forgot-password.spec.ts` + `reset-password.spec.ts` | Orta |
| Setup wizard full flow | `e2e/admin/setup-wizard.spec.ts` | Yüksek |
| Organizations CRUD | `e2e/admin/organizations-crud.spec.ts` | Yüksek |
| Jurors CRUD | `e2e/admin/jurors-crud.spec.ts` | Yüksek |
| Periods CRUD + freeze | `e2e/admin/periods-crud.spec.ts` | Yüksek |
| Entry-token 24h lifecycle | `e2e/admin/entry-token-lifecycle.spec.ts` | Yüksek |
| Audit log view/filter | `e2e/admin/audit-log-view.spec.ts` | Orta |
| PIN lifecycle | `e2e/jury/pin-lifecycle.spec.ts` | Orta |
| Demo auto-login | `e2e/demo/auto-login.spec.ts` | Yüksek |
| Demo isolation | `e2e/demo/isolation.spec.ts` | Yüksek |

**Page Object pattern:**

`e2e/helpers/LoginPage.ts`:

```ts
import { Page } from "@playwright/test";

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async loginWithEmail(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}
```

---

## Faz 7 — Coverage + CI

**Amaç:** Coverage eşiklerini set et, CI'da enforce et.

**`vitest.config.js` thresholds:**

```js
coverage: {
  ...,
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

**`.github/workflows/test.yml`:**

```yaml
- run: npm run test:coverage
- run: npm run e2e
- run: pg_prove sql/tests/**/*.sql
```

**PR template'e diff coverage kontrolü** ekle (Codecov veya benzeri).

---

## Verification

**Her oturum sonu checklist:**

- [ ] `npm test -- --run` → tüm yeni testler pass
- [ ] `npm run test:coverage` → coverage raporu üretildi
- [ ] `npm run build` → build kırılmadı
- [ ] `npm run check:no-native-select && npm run check:no-nested-panels` → temiz
- [ ] Git log: her task için ayrı commit, net mesajlar
- [ ] Plan dosyasındaki checkbox'lar işaretli

**Faz 4 sonrası ek:**

- [ ] `pg_prove sql/tests/**/*.sql` → tüm RLS + RPC testleri pass
- [ ] Supabase MCP `apply_migration` ile fresh DB'de 000→009 apply → 0 hata

**Faz 6 sonrası ek:**

- [ ] `npm run e2e` → 25+ spec pass, flaky yok
- [ ] Playwright HTML raporu `test-results/playwright-report/`'da

**Faz 7 sonrası final:**

- [ ] Coverage global %65+, kritik modüller %80+
- [ ] CI pipeline yeşil
- [ ] PR template'de coverage diff görünür

---

## Oturumlar Arası Handoff

**Her oturumun sonunda:**

1. Bu plan dosyasındaki ilgili Faz'ın checkbox'larını işaretle.
2. Aşağıdaki "Progress Log" bölümüne bir satır ekle.
3. Sıradaki oturumun açılışında:
   - Bu plan dosyasını oku (`/Users/huguryildiz/.claude/plans/glittery-strolling-pretzel.md`).
   - `docs/superpowers/plans/keeper-list.md`'yi oku.
   - Son "Progress Log" satırına bak, kaldığın yerden devam et.
   - `git log --oneline -20` ile son commit'leri gözden geçir.

---

## Progress Log

| Tarih | Oturum | Tamamlanan | Kalan context |
|---|---|---|---|
| 2026-04-22 | 1 — plan hazırlandı | Plan dosyası yazıldı | %34 → ~%30 |
| | | | |

---

## Riskler & Notlar

1. **Codex concurrent edit riski** (memory: project_codex_concurrent): Bu proje main branch'te Codex tarafından da düzenleniyor. Her oturum başında `git pull && git log --oneline -20` çalıştır, çakışan dosyaları kontrol et.

2. **Migration + test eşzamanlılığı** (memory: feedback_apply_migration_immediately): pgTAP extension eklemek için `001_extensions.sql` güncellenirse hem vera-prod hem vera-demo'ya aynı anda deploy edilmeli (Supabase MCP ile).

3. **Demo seed manuel uygulanır** (memory: migration policy): `sql/seeds/demo_seed.sql`'e test-özgü veri ekleme; ayrı `sql/tests/fixtures/*.sql` kullan.

4. **Keeper listesi tek sefer seçilir:** Faz 0'dan sonra dönüp başka testi keeper yapmak zordur (archive git history'de kalır ama bulmak zahmetli). Faz 0 sonunda emin ol.

5. **Coverage thresholds baştan 0:** Faz 7'ye kadar thresholds 0 kalır ki her PR'da "coverage düştü" hatası almayasın. Final'de hedeflere çek.

6. **Test yazım sırası önemli:** Shared → Auth → Jury → Admin → DB → Edge → E2E. Bu sıra **bağımlılık grafiğine** göre; tersine gitme — mock'lamak zorunda kalırsın.

7. **Tek bir `.test.js` dosyası 200 satırı geçmesin:** Geçerse alt-gruplara böl (ör. `useJuryState.identity.test.js`, `useJuryState.writeGroup.test.js`).

---

## Dışarıda Bırakılanlar (YAGNI)

Bu plan **şunları kapsamaz** (ileri faz):
- Performance/load testleri (perf/k6) — Faz 7+ opsiyonel
- Visual regression (Playwright screenshot) — ileride
- Mutation testing (Stryker) — gereksiz karmaşıklık
- Contract testing (Pact) — tek consumer var, gerek yok
- A11y automation (axe-core) tam entegrasyonu — mevcut `a11y.test.jsx` pattern'i genişletilecek, ayrı framework yok
