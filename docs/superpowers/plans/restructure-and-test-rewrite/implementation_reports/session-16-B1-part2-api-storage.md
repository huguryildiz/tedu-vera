# Session 16 — B1 Part 2: shared/api + shared/storage Tests

**Date:** 2026-04-23
**Model:** Sonnet 4.6 (~200k context)
**Scope:** S16 — Write tests for all `src/shared/api/` and `src/shared/storage/` modules

---

## Summary

Faz B1 Part 2 tamamlandı. `shared/api/` ve `shared/storage/` katmanlarının tamamı test kapsamına alındı. 45 yeni qa-catalog entry eklendi, 15 test dosyası yazıldı. **71/71 test yeşil, 0 failure.**

---

## Kapsam

### shared/api — 12 test dosyası

| Dosya | Test sayısı | IDs |
|---|---|---|
| `__tests__/fieldMapping.test.js` | 11 | api.fieldMapping.01–11 |
| `__tests__/retry.test.js` | 4 | api.retry.01–04 |
| `__tests__/juryApi.test.js` | 4 | api.juryApi.01–04 |
| `__tests__/invokeEdgeFunction.test.js` | 3 | api.invokeEdgeFunction.01–03 |
| `__tests__/admin/auth.test.js` | 3 | api.admin.auth.01–03 |
| `__tests__/admin/profiles.test.js` | 2 | api.admin.profiles.01–02 |
| `__tests__/admin/jurors.test.js` | 3 | api.admin.jurors.01–03 |
| `__tests__/admin/periods.test.js` | 2 | api.admin.periods.01–02 |
| `__tests__/admin/scores.test.js` | 3 | api.admin.scores.01–03 |
| `__tests__/admin/tokens.test.js` | 2 | api.admin.tokens.01–02 |
| `__tests__/admin/export.test.js` | 1 | api.admin.export.01 |
| `__tests__/admin/audit.test.js` | 2 | api.admin.audit.01–02 |

### shared/storage — 3 test dosyası

| Dosya | Test sayısı | IDs |
|---|---|---|
| `__tests__/keys.test.js` | 2 | storage.keys.01–02 |
| `__tests__/juryStorage.test.js` | 6 | storage.juryStorage.01–06 |
| `__tests__/adminStorage.test.js` | 3 | storage.adminStorage.01–03 |

**Toplam: 51 yeni test (15 + 20 önceki S15 = 71 toplam)**

---

## Teknik Kararlar

### Mock Yapısı

Tüm api testleri `vi.hoisted()` + `vi.mock("@/shared/lib/supabaseClient")` pattern'ini kullanıyor:

```js
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { rpc: mockRpc, from: mockFrom, auth: { ... } },
}));
```

`vi.mock` hoisting'den önce module-scope değişkenler tanımsız olduğu için `vi.hoisted()` zorunlu.

### PostgREST Zincir Mock'ları

`.from().select().eq().order().single()` gibi zincirleri manuel kuruyoruz:

```js
mockFrom.mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    }),
  }),
});
```

Son metod (`single`, `maybeSingle`, `order`) Promise resolve ediyor; araya gelenler `mockReturnValue` ile sync.

### invokeEdgeFunction — fetch spy

`vi.spyOn(global, "fetch")` kullanıldı. Mock nesnesinde `supabase.supabaseUrl` ve `supabase.supabaseKey` explicit olarak yer almalı (Proxy'den çekiliyor).

### withRetry — delayMs: 0

Gerçek backoff gecikmelerini ortadan kaldırmak için tüm retry testlerinde `delayMs: 0` geçildi. `AbortError` ve business error durumları tek deneme sonrası throw edildi doğrulandı.

### Storage testleri — jsdom

Vitest config `environment: 'jsdom'` olduğu için `localStorage` / `sessionStorage` jsdom mock olarak mevcut. `beforeEach(() => { localStorage.clear(); sessionStorage.clear(); })` ile izolasyon sağlandı.

### adminStorage — persist.js re-export

`adminStorage.js`, `@/admin/utils/persist` re-export ediyor. `persist.js` yalnızca `@/shared/storage/keys` import ettiğinden jsdom testlerde sorunsuz çalıştı — dış mock gerektirmiyor.

---

## Test Coverage — Seçilen Senaryolar

| Modül | Happy path | Error path | Edge case |
|---|---|---|---|
| fieldMapping | ✅ db→ui, ui→db dönüşüm | ✅ null/undefined passthrough | ✅ round-trip eşitlik, formatMembers null/string/array |
| retry | ✅ ilk denemede başarı | ✅ TypeError → retry 3 kez | ✅ AbortError → propagate immediately; business error → no retry |
| juryApi | ✅ authenticateJuror trim + correct params | ✅ rpc error throw | ✅ session_expired → juror_session_expired mapping |
| invokeEdgeFunction | ✅ 200 response | ✅ 500 error | ✅ 401 → refresh + retry (2 fetch call) |
| admin/auth | ✅ checkEmailAvailable rpc call | ✅ listOrganizationsPublic throws on db error | ✅ getSession returns null when no user |
| admin/profiles | — | ✅ upsertProfile throws "Not authenticated" | ✅ getProfile returns null (no throw) when no user |
| admin/jurors | — | ✅ updateJuror throws "id required" | ✅ resetJurorPin throws on missing args; setJurorEditMode correct rpc params |
| admin/periods | ✅ createPeriod returns inserted row | ✅ updatePeriod throws "id required" | — |
| admin/scores | ✅ getDeleteCounts period counts | — | ✅ getPeriodMaxScore(null)→null; deleteEntity unknown type throws |
| admin/tokens | ✅ revokeEntryToken returns {success,active_juror_count,revoked_count} | — | ✅ expired token → getActiveEntryTokenPlain returns null |
| admin/export | — | ✅ invalid action prefix throws | — |
| admin/audit | ✅ writeAuditLog calls rpc with correct params | ✅ writeAuthFailureEvent never throws (console.warn) | — |
| storage/keys | ✅ all values are strings | — | ✅ all values unique |
| storage/juryStorage | ✅ setJuryAccess dual-write | ✅ getJuryAccess sessionStorage priority | ✅ grant without period_id skipped; clearJurySession → getJurySession null |
| storage/adminStorage | ✅ setRawToken dual-write + getRawToken + clearRawToken | — | ✅ setCriteriaScratch sessionStorage only; setActiveOrganizationId null removes |

---

## Sonuç

```
Test Files  21 passed (21)
     Tests  71 passed (71)
  Duration  2.64s
```

Shared katman (lib + api + storage) test kapsamı tamamlandı. Sonraki oturum: B1 part 3 — `shared/ui` ve `shared/hooks` testleri.
