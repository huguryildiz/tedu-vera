# P3-Deno — Real Edge Function Coverage (Implementation Report)

**Status:** Completed (2026-04-24)
**Branch:** `test/c4-scoring-math` (no commit per user policy)
**Scope:** 4 kritik Supabase Edge Function için gerçek Deno unit test kapsamı

---

## 1. Ne kuruldu

### 1.1 Runner + script

- `package.json` içine eklendi:

  ```json
  "test:edge": "cd supabase/functions && deno test --allow-net --allow-env --allow-read --import-map=_test/import_map.json"
  ```

- `supabase/functions/deno.json` — önceden vardı, dokunulmadı.
- `supabase/functions/_test/` altyapısı da P3 öncesi mevcuttu:
  - `harness.ts` — `captureHandler(modulePath)`: `Deno.serve`'i geçici olarak yakalar,
    modülü cache-bust (`?cb=N`) ile import eder, handler referansını döndürür.
  - `mock-supabase.ts` — `import_map.json` aracılığıyla
    `https://esm.sh/@supabase/supabase-js@2` → local mock. `createClient`,
    `auth.getUser`, `auth.admin.generateLink`, `from().select().eq().maybeSingle()`
    zinciri + awaitable thenable list / single path.
  - `import_map.json` — alias tek satır.

### 1.2 Harness ve mock genişletmeleri (test tarafı, kaynağa dokunulmadı)

**`_test/mock-supabase.ts`:**

- Yeni metodlar: `gte`, `lte`, `gt`, `neq`, `like`, `ilike`, `not`, `or`, `range`.
- `TableMock.selectList` eklendi — `await client.from('t').select().eq(...)`
  liste döndüren PostgREST çağrısı için explicit mock (öncesinde yalnızca
  `selectSingle` vardı, liste path'i default `[]`'e kaçarak yanlış sinyal
  veriyordu).
- `auth.admin.getUserById(userId)` stub'ı + `MockConfig.adminGetUserById` map'i
  (per-user-id response).

**`_test/harness.ts`:**

- `stubFetch(handler)` eklendi — `globalThis.fetch` replace + restore fn.
  `request-pin-reset` Resend entegrasyonu ve `audit-log-sink` sink forward
  doğrulaması için gerekli.

Kaynak dosyalar (`supabase/functions/*/index.ts`) değiştirilmedi.

### 1.3 Test dosyaları

| Function | Dosya | Test sayısı | QA ID prefix |
|----------|-------|-------------|--------------|
| `audit-anomaly-sweep` | `audit-anomaly-sweep/index.test.ts` | 11 | `edge.real.audit.*` |
| `request-pin-reset` | `request-pin-reset/index.test.ts` | 10 | `edge.real.pin.*` |
| `log-export-event` | `log-export-event/index.test.ts` | 11 | `edge.real.log.*` |
| `audit-log-sink` | `audit-log-sink/index.test.ts` | 10 | `edge.real.sink.*` |
| **Toplam** | | **42** | |

Planın 20-test hedefini iki katına çıkardı.

### 1.4 Function seçimi (`rpc-proxy` → `audit-log-sink` ikamesi)

Plan `rpc-proxy/index.ts` için test istiyordu fakat bu dosya repoda **mevcut
değil**. CLAUDE.md hâlâ `USE_PROXY = !import.meta.env.DEV` ve
`supabase/functions/rpc-proxy/index.ts`'den bahsediyor ama function
implementasyonu yok (git history dâhil). Plana sadık kalıp deploy edilmemiş bir
endpoint için test yazmak yerine en yakın security-sensitive analog olan
`audit-log-sink` seçildi:

- Proxy/forwarder davranışı (inbound webhook → outbound sink).
- Shared-secret gate (HMAC).
- Whitelist (yalnızca `INSERT` + `audit_logs`).
- Fail-open side: non-2xx'te bile 200 döndürmek zorunda, yoksa Supabase webhook
  retry storm'u.

Bu trade-off README "Known Gaps"'te belgelendi.

---

## 2. Nasıl çalıştırılır

```bash
npm run test:edge          # Deno runner, 82 tests (40 pre-existing + 42 new)
npm test -- --run          # Vitest suite (regression guard)
```

Lokal requirement: `deno` (>= 2.x) binary PATH'te. CI entegrasyonu P4'e kaldı —
lokal çalıştırma blocker değil.

### Örnek runtime

```text
ok | 82 passed | 0 failed (314ms)
```

---

## 3. Test edilen invariantlar (örnek seçim)

### `audit-anomaly-sweep`

- Cron-secret constant-time match: missing / wrong secret → 401.
- `_audit_verify_chain_internal` RPC error → `chain_ok=false, chain_error`
  populated (fail-closed reporting).
- Broken chain → `security.chain.broken` audit row, `severity=critical,
  actor_type=system`.
- Sweep-written rows never carry `user_id`, `ip_address`, `user_agent`
  (integrity invariant).
- Response shape stabilitesi (dashboard contract).

### `request-pin-reset`

- Unknown period → 404 (no email leak).
- Membership-based admin resolve → fallback to `organizations.contact_email`
  when no org_admin seats exist.
- Audit row shape: `action=security.pin_reset.requested, actor_type=juror,
  severity=medium, resource_type=juror_period_auth`.
- Resend integration happy path + non-2xx swallow (documents current "request
  accepted even if email bounced" UX contract).

### `log-export-event`

- Tenant isolation: caller without target-org membership → 403.
- Membership query error → 403 (fail-closed, not 500).
- Super admin (`organization_id=null` membership) can log for any org.
- **Fail-closed audit guarantee:** audit insert failure → 500 so the client
  aborts the export download ("no file without a log").

### `audit-log-sink`

- Shared-secret mismatch → 200 `ok:false` (never non-2xx, or Supabase webhook
  retries forever).
- Non-INSERT event or wrong table → skipped, zero outbound fetch.
- Axiom-compatible array wrapping on forward payload.
- Sink 5xx or fetch exception → 200 with `ok:false` body (retry-loop
  prevention).

---

## 4. Vitest regression guard

`npm test -- --run` ile Vitest suite çalıştırıldı — Deno tarafı değişiklikleri
Vitest import ağacını etkilemiyor. `edge.contract.*` namespace'i `src/shared/
api/edge/__tests__/edgeFunctions.test.js` içinde korundu (P2-Fix warning
yorumu dahil); planın "silme" yasağına uyuldu.

---

## 5. Known Gaps (P3-Deno sonrası)

- **13/21 edge function hâlâ zero real-coverage.** Liste README "Known Gaps"
  bölümünde (long-tail sprint'i için rezerve). Özellikle `send-export-report`,
  `send-entry-token-email`, `notify-juror`, `request-score-edit` orta vadede
  öncelikli.
- **`edge.contract.*` paralel spec'i hâlâ çalışıyor.** Silinmedi (plan
  emriyle); kontrat dokümantasyonu olarak faydalı. Uzun vadede
  `edge.real.*` coverage genişledikçe `edge.contract.*` aşamalı olarak
  kaldırılabilir.
- **CI entegrasyonu yok.** `test:edge` lokal-only. P4'te GH Actions veya
  benzeri koşucuya eklenmeli.
- **`rpc-proxy` planda listelendi ama repoda yok.** CLAUDE.md'deki referans
  ya güncellenmeli ya da function deploy edilmeli. `audit-log-sink` ikamesi
  geçici değil — security-proxy davranışı zaten kritik.

---

## 6. Değişen dosya listesi

**Yeni:**

- `supabase/functions/audit-anomaly-sweep/index.test.ts` (+ ~230 LOC)
- `supabase/functions/request-pin-reset/index.test.ts` (+ ~270 LOC)
- `supabase/functions/log-export-event/index.test.ts` (+ ~235 LOC)
- `supabase/functions/audit-log-sink/index.test.ts` (+ ~250 LOC)
- `docs/superpowers/plans/session-d-unit-test-quality-audit/implementation_reports/P3-deno-edge-coverage.md` (bu dosya)

**Değiştirildi:**

- `package.json` — `test:edge` script eklendi (1 satır).
- `supabase/functions/_test/mock-supabase.ts` — filter operator metotları +
  `selectList` + `adminGetUserById` stub (~40 satır).
- `supabase/functions/_test/harness.ts` — `stubFetch` helper (~15 satır).
- `src/test/qa-catalog.json` — 42 `edge.real.*` entry (1019 → 1061).
- `docs/superpowers/plans/session-d-unit-test-quality-audit/README.md` —
  Known Gaps + özet tablo güncellendi.

**Değiştirilmedi (plan emri):**

- Tüm `supabase/functions/*/index.ts` kaynak dosyaları.
- `src/shared/api/edge/__tests__/edgeFunctions.test.js`.

---

## 7. Bitiş kriterleri doğrulaması

| Kriter | Durum |
|--------|-------|
| `_tests/deno.json` + `_harness/` + `package.json` script | ✅ (pre-existing, script eklendi) |
| `npm run test:edge` çalışıyor, 0 failure | ✅ 82 passed |
| 4 gerçek test dosyası, ≥ 20 test | ✅ 4 dosya, 42 test |
| `qa-catalog.json` güncel | ✅ 42 `edge.real.*` entry |
| README "Known Gaps" güncel | ✅ 8/21 real coverage |
| Implementation report yazıldı | ✅ (bu dosya) |
| Vitest regression yok | ✅ (Deno tarafı Vitest import ağacını etkilemiyor) |
