# P1 — Kritik Akış Regression Koruması

**Tarih:** 2026-04-24
**Amaç:** Prod'da kritik akış (jüri autosave, token lifecycle, period snapshot, Edge Function auth, AuthProvider recovery, export) bozulduğunda unit testin yakalaması

---

## Sonuç

| Metrik | P1 Öncesi | P1 Sonrası |
|--------|-----------|------------|
| Test dosyası | 245 | 251 |
| Test sayısı | 802 | 873 |
| Failure | 0 | 0 |

**Net delta:** +71 test, +6 dosya

---

## Teslim edilenler

### 1. `useJuryAutosave` error propagation — `src/jury/shared/__tests__/useJuryState.errorPropagation.test.js`

**12 test.** ID namespace: `jury.state.error.01` → `jury.state.error.12`

Dosya `useJuryState`'i değil, `useJuryAutosave`'i test ediyor (adaptasyon — aşağıda açıklanıyor).

| # | Senaryo | Doğrulama |
|---|---------|-----------|
| 01 | P0401 `juror_session_expired` | `sessionExpired: true`, `setEditLockActive(true)` |
| 02 | `period_locked` error | `setEditLockActive(true)`, `sessionExpired` **false** (sızma yok) |
| 03 | `final_submit_required` error | `true` döner (skip, error değil) |
| 04 | Network failure | `false` döner, `saveStatus: "error"` |
| 05 | `editLockActive` true iken write | RPC çağrılmıyor |
| 06 | Boş `jurorSessionToken` | RPC çağrılmıyor |
| 07 | Identical snapshot dedup | `mockUpsertScore` 1 kez |
| 08 | Concurrent `writeGroup` (in-flight) | 2. çağrı `true` döner, RPC 1 kez |
| 09 | `visibilitychange` hidden + step=eval | Autosave tetikleniyor |
| 10 | `visibilitychange` hidden + step=pin | **Tetiklenmiyor** (sadece eval'da) |
| 11 | Background save fail + visible return | `saveStatus: "error"` re-surface |
| 12 | P0401 `juror_session_invalid` | Aynı behaviour — her P0401 variant'ında aynı |

### 2. Entry token tests — `src/shared/api/admin/__tests__/tokens.test.js`

**15 test.** ID namespace: `tokens.race.01` → `tokens.race.15`

Public API: `getActiveEntryToken`, `getActiveEntryTokenPlain`, `getEntryTokenHistory`. Private helper'lar (`isTokenUnexpired`, `makeTokenPrefix`, `normalizeSessionCount`) dolaylı test.

**Ana kapsam:**

- Null/undefined expiry handling (`null` expiry → active)
- Future ISO date → active; past ISO date → expired
- NaN / invalid ISO string → expired (crash değil)
- Active token var + yok senaryoları
- History sıralama ve audit join
- Revoked token filtrelemesi

### 3. Period snapshot tests — `src/shared/api/admin/__tests__/periodSnapshot.test.js`

**10 test.** ID namespace: `period.snapshot.01` → `period.snapshot.10`

`freezePeriodSnapshot` export olarak mevcut değil — `setEvalLock` freeze mekanizmasının kendisi. Adaptasyon: `setEvalLock`, `publishPeriod`, `closePeriod` test edildi.

**Ana kapsam:**

- `setEvalLock(true)` → RPC doğru parametre ile
- `setEvalLock("yes")` → boolean coercion (`!!`)
- Permission denied (42501) → throw
- Double `setEvalLock(true)` → idempotent (iki RPC çağrısı, crash yok)
- `publishPeriod` + `closePeriod` success/error path'leri

### 4. `invokeEdgeFunction` tests — `src/shared/api/core/__tests__/invokeEdgeFunction.test.js`

**12 test.** ID namespace: `edge.kong.01` → `edge.kong.12`

| # | Senaryo | Doğrulama |
|---|---------|-----------|
| 01 | Success 200 | `{ data, error: null }` |
| 02 | 401 → refresh → retry success | `refreshSession` 1x, `fetch` 2x |
| 03 | 401 → refresh → 401 yine | `data: null`, error `/session expired/i`, fetch 2x, throw yok |
| 04 | `fetch` throws (network) | Reject propagate |
| 05 | JSON parse fail | `error.message: "Invalid JSON response from Edge Function"` |
| 06 | No session → no `Authorization` header | Header yok |
| 07 | Expiring session (< 30s) | Pre-refresh, yeni token header'a yazılıyor |
| 08 | 500 Internal Server Error | Response text error message olarak kullanılır |
| 09 | Always POST | `method === "POST"` |
| 10 | URL construction | `https://.../functions/v1/my-function` |
| 11 | Custom headers merge | `X-Custom-Header` + standart header'lar |
| 12 | Body JSON serialize | `JSON.stringify(payload)` |

**Not (Kong ayrımı):** Plan "execution_time_ms ≈ 0 Kong vs function-internal 401 ayrımı test edilsin" istiyordu. `invokeEdgeFunction.js` bu ayrımı yapmıyor — her 401'de refresh+retry. CLAUDE.md'deki `execution_time_ms` ipucu client-side branching için değil, log diagnosis için. Bu yüzden test, refresh-retry mekanizmasını doğrulamaya odaklandı.

### 5. AuthProvider recovery — `src/auth/shared/__tests__/authRecovery.test.jsx`

**12 test.** ID namespace: `auth.recovery.01` → `auth.recovery.12`

**Ana kapsam:**

- `isRecoverableAuthLockError` true/false dalları (lock string var mı yok mu)
- Null/undefined input → false
- `getSessionWithRetry` — ilk denemede başarı (retry yok)
- 1 fail + recovery → 2. denemede başarı
- 3 fail → son error fırlatılıyor
- Backoff timing (120ms × i)
- Refresh token expiry → non-recoverable
- Tenant membership pending/yok → doğru error
- `organizationId` mid-session değişimi

### 6. Export integrity — `src/shared/api/admin/__tests__/exportIntegrity.test.js`

**10 test.** ID namespace: `export.integrity.01` → `export.integrity.10`

**Ana kapsam:**

- `fullExport` success → dönüş değeri tipi
- `fullExport` DB error → propagate
- `logExportInitiated` başarılı → audit RPC çağrısı
- `logExportInitiated` fail → export abort mı / sessiz mi (mevcut davranış belgelendi)
- Atomicity: log fail + export success → state durumu assert
- Boş dataset → boş dosya (crash değil)
- Büyük dataset → truncation/pagination
- `null` periodId → graceful rejection

---

## Adaptasyonlar (plan → gerçek)

### A1. `useJuryState` → `useJuryAutosave`

**Plan:** "useJuryState error propagation: 8 sub-hook fail senaryosu"
**Gerçek:** Error propagation `useJuryAutosave`'de gerçekleşiyor — `useJuryState` orchestrator, autosave ise write/error logic'ini barındırıyor. Step guard davranışı (`editLockActive`, `sessionExpired` flag'leri) bu hook'un çıktıları.

**Değerlendirme:** Doğru adaptasyon. "Step N'de error varken N+1'e geçiş" step guard'ın davranışı değil, flag propagation'ın davranışı — doğru katmanda test edildi.

### A2. `freezePeriodSnapshot` → `setEvalLock`

**Plan:** "freezePeriodSnapshot double-call, idempotency."
**Gerçek:** `freezePeriodSnapshot` export yok. Freeze = `setEvalLock(periodId, true)`. Test buna göre yazıldı.

**Değerlendirme:** Doğru adaptasyon. Plan'daki kavramsal hedef (snapshot immutability) korundu.

### A3. Kong vs function-internal 401 ayrımı

**Plan:** "`execution_time_ms ≈ 0` mock'u ile Kong 401 vs function-internal 401 ayrımı."
**Gerçek:** `invokeEdgeFunction.js` bu ayrımı yapmıyor — her 401 aynı path (refresh + retry). Test refresh/retry davranışını doğrulamaya odaklandı.

**Değerlendirme:** Doğru bulgu. CLAUDE.md'deki `execution_time_ms` notu server-side log diagnosis için, client branching için değil. "Ayrım var ve test edilmeli" premise'i yanlıştı.

### A4. Private token helper'ları

**Plan:** "`makeTokenPrefix` collision, `normalizeSessionCount` concurrent revoke, `isTokenUnexpired` NaN ISO."
**Gerçek:** Bu helper'lar export değil — public API üzerinden dolaylı test.

**Değerlendirme:** Dolaylı test yeterli ama özellikle `makeTokenPrefix` prefix collision senaryosu doğrudan test edilemiyor. P2 veya P3'te export açılırsa doğrudan test değerli olur.

---

## Bulgular (P2 için not)

1. **Kong/function-internal 401 ayrımı yok.** `invokeEdgeFunction.js` her iki durumda da aynı davranıyor. Bu bilinçli bir tasarım olabilir (basitlik) ama diagnosability kaybı var. Eğer ileride ayrım gerekirse kod değişikliği gerekir — bu bir test boşluğu değil, kod boşluğu.

2. **`useJuryAutosave`'de `editLockActive` iki farklı sebepten set ediliyor:** session expired (P0401) ve period locked. Test `sessionExpired` flag'inin period lock'a sızmadığını doğruluyor — önemli bir ayrım korundu.

3. **Token helper'ları export kapalı.** Unit test edilebilirlik için `src/shared/api/admin/tokens.js`'de aşağıdaki export'lar açılabilir:
   - `isTokenUnexpired`
   - `makeTokenPrefix`
   - `normalizeSessionCount`

   Açılırsa 10-15 ek doğrudan test yazılabilir. Kaynak kod değişikliği gerektirir — P1 kapsamı dışındaydı.

---

## Dosyalar

**Oluşturulan:**

| Dosya | Test | ID prefix |
|-------|------|-----------|
| `src/jury/shared/__tests__/useJuryState.errorPropagation.test.js` | 12 | `jury.state.error.*` |
| `src/shared/api/admin/__tests__/tokens.test.js` | 15 | `tokens.race.*` |
| `src/shared/api/admin/__tests__/periodSnapshot.test.js` | 10 | `period.snapshot.*` |
| `src/shared/api/core/__tests__/invokeEdgeFunction.test.js` | 12 | `edge.kong.*` |
| `src/auth/shared/__tests__/authRecovery.test.jsx` | 12 | `auth.recovery.*` |
| `src/shared/api/admin/__tests__/exportIntegrity.test.js` | 10 | `export.integrity.*` |

**`qa-catalog.json`:** 71 yeni ID eklendi.

**ID collision check:** `src/shared/api/__tests__/admin/tokens.test.js` (pre-existing, `api.admin.tokens.*`) ile `src/shared/api/admin/__tests__/tokens.test.js` (P1 yeni, `tokens.race.*`) farklı namespace — çakışma yok. Aynı durum `invokeEdgeFunction` için de geçerli.

---

## Öne Çıkan Test Kaliteleri

**En değerli:**

- `jury.state.error.02` — Period lock'un sessionExpired'a sızmadığını doğrulayan ayrım testi (iki farklı lock sebebi, aynı UI davranışı ama farklı flag)
- `edge.kong.07` — Expired session pre-refresh: token yenileniyor VE yeni token header'a yazılıyor (iki ayrı assertion, regression riski yüksek)
- `jury.state.error.08` — In-flight concurrent write guard: race condition'ı gerçek Promise susupansiyonu ile test ediyor, mock timer değil

**İyileştirilebilir:**

- `tokens.race.*` dolaylı test — export açılırsa doğrudan test daha net
- `period.snapshot.*` freeze/unfreeze lifecycle E2E'ye taşındı çünkü state değişimi DB-seviyesinde

---

## Kontrol listesi

- [x] 6 yeni test dosyası, toplam 71 test
- [x] `npm test -- --run` — 0 failure
- [x] Her dosyada en az 1 "prod'da bozulursa fail olur" assertion
- [x] Mimari boşluklar yorum olarak belgelendi (Kong ayrımı yok, token helper'ları kapalı)
- [x] Factory kullanımı zorunlu (inline `{}` yok)
