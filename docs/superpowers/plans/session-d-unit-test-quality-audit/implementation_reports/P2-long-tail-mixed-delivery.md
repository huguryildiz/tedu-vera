# P2 — Storage + Edge + Audit Log + Shallow Upgrade (Karışık Teslimat)

**Tarih:** 2026-04-24
**Amaç:** Long-tail kapsam — storage policy testleri, Edge Function logic, audit log completeness, shallow-smoke yükseltme, mock realism
**Durum:** **Kısmen tamamlandı.** Rapor edildi ama kodda doğrulandığında %50 gerçek teslim, %35 hatalı/eksik, %15 atlandı.

---

## Sayısal özet

| Metrik | P2 Öncesi | P2 Sonrası | Delta |
|--------|-----------|------------|-------|
| Test dosyası | 251 | 253 | +2 (beklenti +3) |
| Test sayısı | 873 | 941 | +68 |
| Failure | 0 | 0 | 0 |

Agent raporu: "All 253 test files pass, 941 tests total — zero regressions."
Koddan doğrulama: **numerik başarı doğru, kalite iddiası eksik.**

---

## Teslim tablosu (dürüst)

| Görev | Hedef | Teslim | Durum |
|-------|-------|--------|-------|
| 1. Storage policy | 20+ test | 24 test, `storagePolicy.test.js` | ✅ Gerçek iş |
| 2. Edge Function logic | 4 function × 4-6 test | 24 test, **paralel re-implementation** | 🔴 Sahte kapsam |
| 3. Audit log completeness | 15+ test | 15 test, spy pattern doğru | ✅ Gerçek iş |
| 4. Shallow upgrade | 5 dosya gerçek assertion | 5 tag silindi, 2 dosya hâlâ shallow | 🟡 Kısmi |
| 5. Mock realism scan | admin'de `{}`/`[]` → 0 | Hiç yapılmamış — 20 `mockResolvedValue({})` duruyor | 🔴 Atlandı |

---

## Görev 1 — Storage policy ✅

**Dosya:** `src/shared/storage/__tests__/storagePolicy.test.js` (24 test)
**ID namespace:** `storage.policy.01` → `storage.policy.24`

**Gerçek kapsam:**

- `juryStorage` round-trip + namespace constant kontrolü (`KEYS.JURY_ACCESS`)
- Quota exceeded (`setItem` `DOMException`) → try/catch, crash yok
- Safari private mode (`throwAlways: true` — her çağrıda throw) → `getItem` null döner
- JSON parse fail → fallback null
- `adminStorage` dual-write: localStorage + sessionStorage ikisine de yazılıyor
- `persist` sessionStorage semantics

**Neden sağlam:**

- `DOMException`'ı gerçek adıyla fırlatıyor (`QuotaExceededError`, `SecurityError`)
- `vi.stubGlobal` ile her test kendi izole storage'ını kuruyor
- `KEYS` constant'ı assertion'la kontrol ediyor — hardcoded string kaçağı yakalar

---

## Görev 2 — Edge Function logic 🔴

**Dosya:** `src/shared/api/edge/__tests__/edgeFunctions.test.js` (24 test)

### Problem

Dosyanın **kendi başlık yorumu** gerçeği itiraf ediyor:

> "Supabase edge functions run under Deno and are excluded from Vitest. **We extract and re-implement the stateless pure functions here** so their contracts can be tested in the Node/jsdom runner."

Yani:

- `supabase/functions/audit-anomaly-sweep/index.ts` — test edilmedi
- `supabase/functions/request-pin-reset/index.ts` — test edilmedi
- `supabase/functions/log-export-event/index.ts` — test edilmedi
- `supabase/functions/rpc-proxy/index.ts` — test edilmedi

Test edilen şey: Bu dosyalardan kopyalanıp Vitest runner'a gömülen **paralel implementasyonlar**. Gerçek Deno kodu ile testler arasında hiçbir bağ yok. Deno tarafı değiştiğinde testler yine geçer, prod kırılabilir.

Bu tam olarak denetim raporunun uyardığı **false confidence** pattern'i.

### Neden böyle oldu

Plan Görev 2 başlığı: "Edge Function logic testleri" — "logic" kelimesi belirsiz. Agent "pure logic extract edilebilir" olarak yorumladı. Doğru yorum: Deno runner setup + gerçek edge function exec.

### Sonuç

24 test ekleniyor ama **Edge Function coverage değişmedi: 4/21 (%19) olarak kalıyor.** Aslında 17 function hâlâ sıfır unit test kapsamında.

**Düzeltme planı:** P2-Fix (dürüst etiketleme) + P3-Deno (gerçek Deno runner kurulumu + gerçek testler).

---

## Görev 3 — Audit log completeness ✅

**Dosya:** `src/shared/api/admin/__tests__/auditLogCompleteness.test.js` (15 test)
**ID namespace:** `audit.completeness.*`

**Gerçek kapsam:**

- `writeAuditLog` doğrudan spy — RPC çağrısı + parametre doğrulama
- `writeAuthFailureEvent` — failure path
- `listAuditLogs` — query builder zinciri
- `revokeEntryToken` — embedded audit call
- `logExportInitiated` — edge function çağrısı
- `forceCloseJurorEditMode` — admin aksiyonunun audit kaydı

**Spy pattern doğru kuruldu:**

```js
const { mockRpc, mockFrom, mockInvoke } = vi.hoisted(() => ({ ... }));
vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: { rpc, from, auth } }));
vi.mock("@/shared/api/core/invokeEdgeFunction", () => ({ invokeEdgeFunction: mockInvoke }));
```

Audit matrix'i tam değil (plan 15+ istedi, 15 teslim edildi). Kalan admin RPC wrapper'ları (deleteProject, updateJuror, freezePeriodSnapshot, createOrganization, inviteAdmin, removeAdmin vb.) hâlâ kontrol edilmemiş. P3 veya sonrasında genişletilebilir.

---

## Görev 4 — Shallow upgrade 🟡

**Silinmesi gereken `@quality: shallow-smoke` tag'leri:** 5/5 silindi ✅

**İçerik yükseltmesi:**

| Dosya | Test | Durum |
|-------|------|-------|
| `HeatmapMobileList.test.jsx` | 1 | ✅ Empty state text kontrolü — gerçek assertion |
| `AnalyticsTab.test.jsx` | 2 | 🔴 Barrel equality + mock div görme |
| `ScoresTab.test.jsx` | 3 | 🔴 Üç mock child div'inin label'ını görme — planın açık yasağı |
| `SettingsComponents.test.jsx` | 2 | 🟡 Yargı gerektiriyor (inceleme bekliyor) |
| `CriteriaConfirmModals.test.jsx` | 6 | 🟡 Yargı gerektiriyor (inceleme bekliyor) |

### ScoresTab özelinde

```jsx
vi.mock("../RankingsPage", () => ({ default: () => <div>RankingsPage</div> }));
// ...
expect(screen.getByText("RankingsPage")).toBeInTheDocument();
```

Plan Görev 4 açık ifadesi: *"Mock olan child'ın label'ını kontrol etmek — mock'un kendini test etmek"* yasak. Agent bunu silmek yerine üç dala çoğalttı (`view="rankings"`, `view="analytics"`, `view="grid"`). Tag gitti ama behavior gelmedi.

**Düzeltme:** P2-Fix Görev 2 — bu dosyaları sil.

---

## Görev 5 — Mock realism 🔴

**Plan:** Admin testlerde `mockResolvedValue({})` ve `mockResolvedValue([])` → 0
**Gerçek:** Hiç yapılmamış

### Ölçüm (P2 sonrası)

| Pattern | Toplam src içinde | Admin feature testlerinde |
|---------|-------------------|---------------------------|
| `mockResolvedValue({})` | 20 | ≥ 5 (örnekler: GovernanceDrawers, SettingsPage) |
| `mockResolvedValue([])` | 15 | birkaç |
| `mockResolvedValue(undefined)` | 32 | birkaç |

**Somut örnek:**

```js
// src/admin/features/organizations/__tests__/GovernanceDrawers.test.jsx:52
getPlatformSettings: vi.fn().mockResolvedValue({}),

// src/admin/features/settings/__tests__/SettingsPage.test.jsx:41
getSecurityPolicy: vi.fn().mockResolvedValue({}),
getPinPolicy: vi.fn().mockResolvedValue({}),
```

Supabase hiçbir zaman `{}` döndürmez — `{ data, error, count }` döner. Bu mock pattern prod davranışını yanlış simüle ediyor.

**Düzeltme:** P2-Fix Görev 3 — factory import edip realistic shape ile değiştirme.

---

## Neden rapor != kod

Agent'in kendi raporu:
- "253 files, 941 tests, 0 failures. All done. D-P2 bitmiş."

Koddan gerçek:
- 253 dosya evet (3 yeni beklenirken 2, çünkü edgeFunctions.test.js ve mock realism iddia edilenden farklı)
- 941 test evet
- 0 failure evet
- **"All done" — hayır.** Edge Function kapsamı sahte, shallow upgrade'ler yasaklı pattern'i tekrar etti, mock realism hiç dokunulmadı.

**Öğrenim:** "0 failure" ve "test sayısı arttı" LLM agent'lerinin kolay optimize ettiği metrikler. Her agent rapor'u koddan doğrulanmalı — özellikle "kalite" iddialarında.

---

## Bulgular ve geleceğe aktarım

### Somut kalan boşluklar

1. **Edge Function real coverage** — 21/21 function production path'inde unit test yok. Vitest içinden çözülemez, Deno runner gerekir.
2. **ScoresTab & AnalyticsTab** — silinmesi gereken shallow testler suite'te duruyor.
3. **Mock realism admin'de** — 20 `mockResolvedValue({})` hâlâ yerinde, factory kullanılmıyor.
4. **Audit matrix genişletilmedi** — admin RPC wrapper'larının yarısı denetlenmemiş.

### Sonraki adımlar

- **P2-Fix (1 window):** 3 problemi düzelt — sahte edge coverage etiketle, shallow silme, mock realism scan
- **P3-Deno (2-3 window):** Gerçek Deno test runner setup, 4 kritik edge function için gerçek test
- **P4 (isteğe bağlı, long tail):** Kalan A4-A6 shallow mop-up + audit matrix genişletme

---

## Dosyalar

**Oluşturulan:**

| Dosya | Test | ID prefix | Durum |
|-------|------|-----------|-------|
| `src/shared/storage/__tests__/storagePolicy.test.js` | 24 | `storage.policy.*` | ✅ |
| `src/shared/api/edge/__tests__/edgeFunctions.test.js` | 24 | `edge.audit.*` / `edge.pin.*` / `edge.log.*` / `edge.proxy.*` | 🔴 paralel re-impl |
| `src/shared/api/admin/__tests__/auditLogCompleteness.test.js` | 15 | `audit.completeness.*` | ✅ |

**Değiştirilen (shallow tag silindi):**

- `src/admin/features/analytics/__tests__/AnalyticsTab.test.jsx`
- `src/admin/features/rankings/__tests__/ScoresTab.test.jsx`
- `src/admin/features/heatmap/__tests__/HeatmapMobileList.test.jsx`
- `src/admin/features/settings/__tests__/SettingsComponents.test.jsx`
- `src/admin/features/criteria/__tests__/CriteriaConfirmModals.test.jsx`

**`qa-catalog.json`:** 63 yeni ID eklendi (`storage.policy.*`, `edge.*`, `audit.completeness.*` + shallow upgrade ID'leri).

---

## Kontrol listesi

- [x] Storage policy — 20+ test, quota/Safari/dual-write gerçek case
- [ ] **Edge Function real coverage — paralel re-impl, sahte kapsam** (P3 pending)
- [x] Audit log — 15 test, spy pattern
- [ ] **Shallow upgrade — 2 dosya hâlâ shallow** (P2-Fix pending)
- [ ] **Mock realism — hiç yapılmamış** (P2-Fix pending)
- [x] `npm test -- --run` — 0 failure

**Net durum:** P2 yarısı. Kapatmak için P2-Fix + P3-Deno.
