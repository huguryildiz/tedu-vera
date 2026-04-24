# P3-Deno — Real Edge Function Coverage Plan

**Status:** Planned, not started
**Model:** Opus önerilir (Sonnet ile de açılabilir, her görev sonunda durup çıktı doğrulatılmalı)
**Süre:** 2-3 window
**Öncelik:** P2-Fix sonrası — sahte edge coverage dürüstçe etiketlendikten sonra gerçek kapsamı kurmak

---

## Arka plan

Session D denetimi 21 Supabase Edge Function'ın 17'sinin hiç unit test'i olmadığını tespit etti. P2'de "edge function logic testleri" yazıldı ama agent Deno kodunu Vitest'e kopyaladı — gerçek Deno dosyaları test edilmiyor. Bu false confidence yaratıyor (tests pass, prod breaks).

P3-Deno'nun amacı: Gerçek Deno test runner kurmak ve 4 kritik function'ın actual `index.ts` dosyasını test etmek.

**Önemli:** Sahte `src/shared/api/edge/__tests__/edgeFunctions.test.js` dosyası silinmez. Paralel implementasyon contract spec olarak faydalı — P2-Fix'te WARNING yorumu eklendi, `edge.contract.*` namespace'ine alındı. P3'te AYRI bir test tabakası kuruluyor (`edge.real.*`).

---

## Kapsam

### 1. Deno runner altyapısı

```
supabase/functions/
├── _tests/
│   ├── deno.json              # Deno config + import map
│   ├── _harness/
│   │   ├── supabase-mock.ts   # createClient + auth mock
│   │   ├── fetch-mock.ts      # Deno.fetch stub
│   │   └── env.ts             # Deno.env stub
│   ├── audit-anomaly-sweep.test.ts
│   ├── request-pin-reset.test.ts
│   ├── log-export-event.test.ts
│   └── rpc-proxy.test.ts
```

- `npm run test:edge` script'i → `deno test supabase/functions/_tests/ --allow-net --allow-env --allow-read`
- CI'ya `test:edge` adımı (opsiyonel — önce lokal çalıştırılabilir)

### 2. Test harness katmanı

- `supabase-mock.ts` — `createClient` mock'u, `auth.getUser()` stub'ı, `from().select().eq()` zinciri
- `fetch-mock.ts` — `globalThis.fetch` stub'ı
- `env.ts` — `Deno.env.get/set/delete` stub'ı (`SERVICE_ROLE_KEY`, `SUPABASE_URL`)

### 3. 4 kritik function için gerçek test

| Function | LOC | Min test | Odak |
|----------|-----|----------|------|
| `audit-anomaly-sweep/index.ts` | 318 | 6 | severity escalation, threshold, rate limit, PII redaction |
| `request-pin-reset/index.ts` | 347 | 6 | rate limit, RLS, mail failure, format validation |
| `log-export-event/index.ts` | — | 4 | audit record oluşuyor mu, transaction semantic |
| `rpc-proxy/index.ts` | — | 4 | whitelist, auth, error propagation |

**Toplam:** ~20 gerçek Deno test

### 4. Sahte `edgeFunctions.test.js`'in statüsü

- Silinmez (paralel implementasyon contract spec olarak faydalı)
- P2-Fix'te eklenen WARNING ve `edge.contract.*` namespace'i kalır
- Gerçek testler ayrı namespace'te: `edge.real.audit.*`, `edge.real.pin.*`, `edge.real.log.*`, `edge.real.proxy.*`

### 5. Kalan 17 function

P3 sonrası hâlâ kapsam dışında. Long-tail olarak belirlenir, P4'te veya ad-hoc olarak ele alınır.

---

## Bitiş kriteri

1. `supabase/functions/_tests/deno.json` + `_harness/` + `package.json` script hazır, `npm run test:edge` çalışıyor
2. 4 gerçek test dosyası — toplam minimum 20 test, `deno task test` 0 failure
3. `qa-catalog.json` güncel (`edge.real.*` ID'leri)
4. README "Known Gaps" güncel — 4/21 gerçek kapsam, 17 long-tail
5. `implementation_reports/P3-deno-edge-coverage.md` yazıldı
6. `npm test -- --run` — Vitest tarafında regression yok

---

## Execution Prompt

Aşağıdaki promptu yeni bir Claude Code session'ına verebilirsin.

````markdown
# VERA — Session D / P3-Deno: Real Edge Function Coverage

## Model
Opus önerilir. Deno + TypeScript + Supabase service role + auth-check-membership
akışı çok katmanlı. Sonnet ile açılırsa her görev sonunda durup çıktı doğrulat.

## Bağlam

Session D denetimi 21 Supabase Edge Function'ın 17'sinin hiç unit test'i
olmadığını tespit etti. P2'de "edge function logic testleri" yazıldı ama agent
kodu Vitest'e kopyaladı — gerçek Deno dosyaları test edilmiyor. Bu false
confidence yaratıyor (tests pass, prod breaks).

P3'ün amacı: Gerçek Deno test runner kurmak ve 4 kritik function'ın actual
index.ts dosyasını test etmek.

**ÖNEMLİ:** Sahte `src/shared/api/edge/__tests__/edgeFunctions.test.js` dosyasını
SİLME. Paralel implementasyon contract spec olarak faydalı — P2-Fix'te WARNING
yorumu eklendi. P3'te AYRI bir test tabakası kuruyorsun.

Denetim: `docs/superpowers/plans/session-d-unit-test-quality-audit/README.md`
P2 raporu: `docs/superpowers/plans/session-d-unit-test-quality-audit/implementation_reports/P2-long-tail-mixed-delivery.md`
P3 planı: `docs/superpowers/plans/session-d-unit-test-quality-audit/P3-deno-edge-coverage-plan.md`

---

## Görev 1 — Deno runner setup

**Dizin yapısı:**

```
supabase/functions/
├── _tests/
│   ├── deno.json              # Deno config + import map
│   ├── _harness/
│   │   ├── supabase-mock.ts   # createClient + auth mock
│   │   ├── fetch-mock.ts      # Deno.fetch stub
│   │   └── env.ts             # Deno.env stub
│   ├── audit-anomaly-sweep.test.ts
│   ├── request-pin-reset.test.ts
│   ├── log-export-event.test.ts
│   └── rpc-proxy.test.ts
```

**`deno.json` içeriği:**

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.58.0",
    "std/": "https://deno.land/std@0.224.0/"
  },
  "tasks": {
    "test": "deno test --allow-net --allow-env --allow-read _tests/"
  }
}
```

**`package.json`'a script ekle:**

```json
"test:edge": "cd supabase/functions && deno task test"
```

**Doğrulama:** `npm run test:edge` çağrısı `deno test` tetiklemeli. Henüz test yok,
"No tests found" beklenir — setup doğru.

---

## Görev 2 — Test harness

### `_harness/supabase-mock.ts`

Supabase `createClient`'ı mock'layan helper. Gerçek index.ts'lerin kullandığı
pattern:

```ts
// supabase/functions/*/index.ts genelinde:
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const { data: { user } } = await supabase.auth.getUser(token);
```

**Yazılacak:**

```ts
export function makeMockSupabase({ user = null, authError = null, tables = {} } = {}) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: authError }),
    },
    from: (tableName: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: any) => ({
          single: async () => tables[tableName]?.single ?? { data: null, error: null },
          maybeSingle: async () => tables[tableName]?.maybeSingle ?? { data: null, error: null },
          order: () => ({
            limit: async () => tables[tableName]?.list ?? { data: [], error: null },
          }),
          // ... diğer Supabase zincirleri gerektiğinde eklenir
        }),
      }),
      insert: async (row: any) => tables[tableName]?.insert ?? { data: [row], error: null },
      update: async () => tables[tableName]?.update ?? { data: null, error: null },
    }),
    rpc: async (name: string, args: any) => tables.__rpc?.[name] ?? { data: null, error: null },
  };
}
```

### `_harness/fetch-mock.ts`

```ts
export function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => { globalThis.fetch = original; };
}
```

### `_harness/env.ts`

```ts
export function stubEnv(vars: Record<string, string>) {
  const original = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    original.set(k, Deno.env.get(k));
    Deno.env.set(k, v);
  }
  return () => {
    for (const [k, v] of original) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
}
```

---

## Görev 3 — audit-anomaly-sweep gerçek testi

**Önce oku:** `supabase/functions/audit-anomaly-sweep/index.ts` (318 satır, tam)

Anla: Auth check → membership → service role query → anomaly detection → insert.

**Yaz:** `supabase/functions/_tests/audit-anomaly-sweep.test.ts`

Deno test API:

```ts
import { assertEquals, assertRejects } from "std/assert/mod.ts";
import { makeMockSupabase } from "./_harness/supabase-mock.ts";
import { stubEnv } from "./_harness/env.ts";
import { stubFetch } from "./_harness/fetch-mock.ts";

// index.ts serve handler'ı export ediyorsa import et.
// Etmiyorsa Request objesi oluşturup handler'ı invoke et.

Deno.test("audit-anomaly-sweep: auth check fails → 401", async () => {
  const restoreEnv = stubEnv({ SUPABASE_URL: "...", SUPABASE_SERVICE_ROLE_KEY: "..." });
  // mock auth.getUser → null user
  // invoke handler
  // assert response.status === 401
  restoreEnv();
});
```

**Test case'ler (minimum 6):**

- Auth missing/invalid → 401
- Non-admin membership → 403
- N failed login sweep'te severity hesaplama doğru
- IP-multi-org rule: 1 IP, 3 org → anomaly detected
- PIN flood rule: threshold aşımı
- PII redaction: response'ta email/ip raw string yok

ID namespace: `edge.real.audit.01` → `edge.real.audit.06`

---

## Görev 4 — request-pin-reset gerçek testi

**Önce oku:** `supabase/functions/request-pin-reset/index.ts`

**Yaz:** `supabase/functions/_tests/request-pin-reset.test.ts`

Minimum 6 test:
- Auth check → 401
- Rate limit: aynı email 3. istek → reject
- Invalid email format → 400
- RLS: başka org user → 403
- Mail send fail (fetch mock) → rollback mı sessiz mi (mevcut davranışı belgele)
- Success path → 200 + response shape

ID namespace: `edge.real.pin.*`

---

## Görev 5 — log-export-event gerçek testi

**Önce oku:** `supabase/functions/log-export-event/index.ts`

**Yaz:** `supabase/functions/_tests/log-export-event.test.ts`

Minimum 4 test:
- Auth check → 401
- Valid payload → audit row inserted
- Missing required field → 400
- DB error → 500 propagation

ID namespace: `edge.real.log.*`

---

## Görev 6 — rpc-proxy gerçek testi

**Önce oku:** `supabase/functions/rpc-proxy/index.ts`

**Yaz:** `supabase/functions/_tests/rpc-proxy.test.ts`

Minimum 4 test:
- Auth check → 401
- Whitelisted RPC → proxy OK
- Non-whitelisted RPC → 403
- RPC error → propagation

ID namespace: `edge.real.proxy.*`

---

## Görev 7 — QA catalog + dokümantasyon

1. `src/test/qa-catalog.json`'a yeni ID'ler ekle: `edge.real.audit.*`,
   `edge.real.pin.*`, `edge.real.log.*`, `edge.real.proxy.*`
2. README'nin "Known Gaps" bölümünü güncelle — 4 function artık gerçek kapsamda,
   kalan 17 function "long tail" olarak belirt
3. `implementation_reports/P3-deno-edge-coverage.md` yaz — ne kuruldu, ne test
   edildi, runner nasıl çalışıyor, kalan 17 function listesi

---

## Kurallar

- Kaynak `supabase/functions/*/index.ts` dosyalarını DEĞİŞTİRME — sadece test yaz
- Sahte `src/shared/api/edge/__tests__/edgeFunctions.test.js`'i SİLME
- Her test sonrası `deno task test` (ve Vitest için `npm test -- --run`) çalıştır,
  her ikisinde 0 failure
- ID çakışması olmasın: Vitest tarafındaki ID'ler `edge.contract.*`, Deno
  tarafındakiler `edge.real.*`
- Commit etme

## Bitiş kriteri

1. `supabase/functions/_tests/deno.json` + `_harness/` + `package.json` script
   hazır, `npm run test:edge` çalışıyor
2. 4 gerçek test dosyası — toplam minimum 20 test, `deno task test` 0 failure
3. `qa-catalog.json` güncel
4. README "Known Gaps" güncel — 4/21 gerçek kapsam
5. P3 implementation report yazıldı
6. `npm test -- --run` — Vitest tarafında regression yok

Başla: önce `supabase/functions/audit-anomaly-sweep/index.ts`'i oku, sonra
Görev 1'den başla.
````
