# VERA: RPC → REST Mimari Geçiş Analizi

## 1. Executive Summary

**Kısa cevap: Tam REST geçişi şu an için gereksiz ve riskli. Hybrid model (Option B) doğru strateji — ama acil değil.**

VERA'nın mevcut mimarisi sandığından çok daha iyi yapılandırılmış. Repo'yu derinlemesine inceledikten sonra bulgularım:

- **12 gerçek RPC** (stored procedure), **78+ PostgREST sorgusu** zaten REST-like çalışıyor
- Frontend'de **temiz API boundary** var: 59 public export, tek bir `src/shared/api/` katmanı
- Direct Supabase çağrısı yapan sadece **4 dosya** var (3'ü unavoidable: auth + realtime)
- Admin CRUD operasyonlarının **%85+'ı zaten PostgREST** (REST-over-Postgres) kullanıyor
- Gerçek RPC'ler (stored procedures) **güvenlik-kritik**: PIN auth, session validation, score upsert, snapshot freeze

**Projenin asıl sorunu RPC vs REST değil.** Asıl sorun: DB migration yönetimi, vendor lock-in awareness, ve gelecekteki public API ihtiyacı. Bunlar RPC'yi REST'e çevirmekle değil, API katmanı olgunlaştırmayla çözülür.

---

## 2. Current Architecture Findings

### 2.1 Veri Erişim Katmanı

```
React Component → Domain Hook → API Layer → Supabase Client → PostgreSQL
                                    │
                                    ├── PostgREST (78+ queries) — REST-like
                                    ├── RPC (12 stored procs) — DB functions  
                                    ├── Edge Functions (4) — serverless
                                    └── Realtime (2 hooks) — WebSocket
```

**API katmanı iyi ayrıştırılmış:**
- `src/shared/api/admin/` — 11 modül, ~1070 LOC
- `src/shared/api/juryApi.js` — 233 LOC
- `src/shared/api/fieldMapping.js` — 59 LOC
- `src/shared/api/core/` — client + retry

### 2.2 Güçlü Yanlar

1. **Clean API boundary**: Hiçbir component doğrudan Supabase çağırmıyor (4 exception, 3'ü unavoidable)
2. **Domain separation**: Jury, admin, auth net ayrılmış
3. **PostgREST zaten REST**: Admin CRUD'un büyük çoğunluğu `supabase.from('table').select/insert/update/delete` — bu zaten REST API
4. **Field mapping centralized**: DB↔UI dönüşümü tek dosyada
5. **Retry mechanism**: Network hatalarına karşı exponential backoff
6. **RLS (Row Level Security)**: 21 tabloda tenant isolation DB seviyesinde

### 2.3 En Büyük Mimari Sıkıntılar

1. **DB'de yaşayan business logic**: 3010 satır SQL migration, scoring/auth logic PostgreSQL functions içinde
2. **Test edilebilirlik**: DB functions unit test edilemiyor (integration test gerekli)
3. **Migration yönetimi**: 12 migration dosyası, sıralı uygulama zorunlu, rollback zor
4. **Vendor coupling**: Auth (Supabase Auth), Realtime (Supabase Channels), Storage hepsi Supabase'e bağlı
5. **Observability gap**: RPC'lerin içinde ne olduğu dışarıdan görünmüyor (no structured logging)

### 2.4 RPC Gerçekten Problem mi?

**Hayır, çoğunlukla değil.** İşte neden:

| Metrik | Değer | Yorum |
|--------|-------|-------|
| Toplam RPC | 12 | Yönetilebilir sayı |
| Karmaşık RPC (tier 3-4) | 3 | rpc_jury_verify_pin, rpc_jury_upsert_score, rpc_period_freeze_snapshot |
| Basit RPC (tier 1-2) | 9 | Çoğu tek UPDATE/INSERT |
| PostgREST sorgu | 78+ | Zaten REST-like |
| API boundary violation | 1 | Sadece useProfileEdit.js (15 dk fix) |

**12 RPC'nin 9'u basit**, REST endpoint'e çevirmek kolay ama kazanç minimal. **3 karmaşık RPC** (score upsert, PIN verify, snapshot freeze) DB'de kalması gereken transactional logic içeriyor.

---

## 3. RPC vs REST — Bu Repo Özelinde Karşılaştırma

### 3.1 Akış Bazında Analiz

| Akış | Mevcut | REST'e Uygun mu? | Neden? |
|------|--------|-------------------|--------|
| **Admin CRUD** (period/project/juror) | PostgREST ✓ | Zaten REST-like | `supabase.from().insert/update/delete` REST'in ta kendisi |
| **Jury scoring** | RPC (tier 4) | ✗ Kalmalı | Atomic multi-table upsert, session validation, completion derivation |
| **Jury PIN auth** | RPC (tier 3) | ✗ Kalmalı | Bcrypt comparison, lockout logic, session token generation |
| **Entry token validation** | RPC (tier 2) | △ Olabilir ama gereksiz | SHA-256 hash + expiry check — basit ama güvenlik-kritik |
| **Period freeze/snapshot** | RPC (tier 3) | ✗ Kalmalı | Atomic 3-table copy, idempotency check |
| **Analytics/reporting** | PostgREST + client aggregation | ✓ REST uygun | Zaten read-only queries |
| **Export** | PostgREST (5 parallel) | ✓ REST uygun | Paralel fetch, client-side assembly |
| **Audit log** | PostgREST | ✓ REST uygun | Simple filtered query |
| **Auth flows** | Supabase Auth SDK | ✗ Ayrı concern | OAuth, JWT refresh, session — SDK-bound |
| **Realtime** | Supabase Channels | ✗ WebSocket | REST ile çözülemez |
| **Criteria/outcome mapping** | PostgREST | ✓ REST uygun | Standard CRUD |
| **Org management** | PostgREST | ✓ REST uygun | Standard CRUD |
| **Token generate/revoke** | PostgREST + RPC mix | △ Kısmen | Generate: basit INSERT; Revoke: status update |

### 3.2 Kritik Bulgu

**Admin tarafının %85+'ı zaten PostgREST (REST-over-Postgres) kullanıyor.** "RPC-heavy" algısı yanıltıcı — gerçek RPC sayısı sadece 12, ve bunların çoğu jury auth/scoring için.

REST'e "geçiş" dediğimizde aslında şunu kastediyoruz:
1. PostgREST → Custom REST API (Express/Hono/Fastify middleware)
2. RPC → REST endpoint + service layer logic

İlki genellikle **overhead ekler, fayda eklemez** (Supabase PostgREST zaten optimize). İkisi arasındaki fark: custom middleware'de logging, validation, rate limiting ekleyebilirsin — ama bunlar Supabase Edge Functions ile de yapılabilir.

---

## 4. Ne REST Olmalı, Ne Olmamalı?

### ✅ REST'e Kesin Taşınmalı — Yok

Şu an "kesin taşınmalı" diye bir alan yok. Çünkü:
- Admin CRUD **zaten PostgREST** (REST-like)
- Jury RPCs **DB'de kalmalı** (security)
- Auth **SDK-bound** (Supabase Auth)

### 🟡 REST Olabilir Ama Şart Değil

| Alan | Mevcut | REST Olursa | Kazanç | Risk |
|------|--------|-------------|--------|------|
| Admin CRUD | PostgREST | Custom REST API | Logging, validation middleware | Duplicated effort, maintenance overhead |
| Export | 5 parallel PostgREST | Single REST endpoint | Server-side assembly, streaming | Edge Function ile de yapılabilir |
| Analytics aggregation | Client-side aggregation | Server-side aggregation | Daha az data transfer | Complexity artışı |
| Audit log query | PostgREST with filters | REST with pagination | Standart pagination headers | Minimal fark |

### 🔴 RPC / DB Function Olarak Kalmalı

| Fonksiyon | Neden? |
|-----------|--------|
| `rpc_jury_upsert_score` | Atomic multi-table write, session validation, completion detection |
| `rpc_jury_verify_pin` | Bcrypt comparison, lockout enforcement, session token issue |
| `rpc_jury_authenticate` | Juror lookup/create, PIN generation, lockout check |
| `rpc_period_freeze_snapshot` | Atomic 3-table copy (criteria + outcomes + maps) |
| `rpc_jury_finalize_submission` | Final timestamp write with session validation |
| RLS policies (21 table) | Tenant isolation at DB level — defense in depth |
| Audit triggers | Automatic, cannot be forgotten by application code |

### 🔵 Supabase Native Olarak Kalmalı

| Capability | Neden? |
|------------|--------|
| Supabase Auth | OAuth, JWT, session management — replacing is weeks of work |
| Realtime subscriptions | WebSocket push, postgres_changes — no REST equivalent |
| Edge Functions | approve-admin-application, password-reset — already serverless REST |
| RLS | Defense-in-depth, even if API layer validates — keep as safety net |

---

## 5. Üç Mimari Seçenek

### Option A — Keep RPC-Heavy, Improve Boundaries

**Ne yapılır:**
- Mevcut yapı korunur
- API katmanı temizlenir (1 boundary violation fix)
- Realtime abstraction eklenir
- Error handling standardize edilir
- Logging/observability Edge Function middleware ile eklenir

**Kazanç:**
- Sıfır risk, sıfır breaking change
- 1-2 hafta iş
- Mevcut tüm testler çalışmaya devam eder

**Kayıp:**
- Vendor lock-in azalmaz
- Public API hala yok
- DB logic test edilebilirliği değişmez

**Zorluk:** 15/100  
**Risk:** 5/100  
**Bu proje için uygunluk:** ⭐⭐⭐⭐ (8/10)

---

### Option B — Hybrid Architecture (ÖNERİLEN)

**Ne yapılır:**
- **Thin API Gateway** eklenir (Supabase Edge Functions veya ayrı backend)
- Admin CRUD operasyonları gateway üzerinden akar (validation, logging, rate limiting)
- Jury security RPCs (PIN, scoring, snapshot) DB'de kalır
- Auth Supabase Auth'da kalır
- Public API endpointleri gateway üzerinden expose edilir (gelecek ihtiyaç)
- Realtime Supabase Channels'da kalır

**Mimari:**
```
Frontend → API Gateway (Edge Functions / Hono) → Supabase
                │                                    │
                ├── Admin REST endpoints ────────────→ PostgREST
                ├── Jury endpoints ──────────────────→ RPC (DB functions)
                ├── Auth ────────────────────────────→ Supabase Auth
                └── Public API (future) ─────────────→ Gateway
```

**Kazanç:**
- Structured logging & observability
- Request validation at gateway level
- Rate limiting capability
- Public API ready
- Vendor abstraction başlar (gateway arkasında provider değişebilir)
- DB logic güvenli kalır

**Kayıp:**
- Ek complexity (gateway layer)
- Deploy pipeline değişir
- Latency minimal artabilir (extra hop)

**Zorluk:** 45/100  
**Risk:** 25/100  
**Bu proje için uygunluk:** ⭐⭐⭐⭐⭐ (9/10)

---

### Option C — REST-First Architecture

**Ne yapılır:**
- Custom backend (Express/Fastify/Hono)
- Tüm DB logic application layer'a taşınır
- Supabase sadece database olarak kullanılır (PostgREST bypass edilir)
- Auth custom JWT implementation'a geçer
- Scoring logic application layer'da

**Kazanç:**
- Tam vendor independence
- Full testability (unit test everything)
- Standard REST API (OpenAPI spec)
- Backend logic tamamen kontrol altında

**Kayıp:**
- **3-4 ay rewrite** (minimum)
- Supabase Auth, Realtime, RLS avantajları kaybedilir
- Security regression riski yüksek (DB-level → app-level)
- Tüm testler yeniden yazılır
- Mevcut çalışan ürün riske girer
- RLS'in sağladığı defense-in-depth kaybolur
- Realtime custom WebSocket implementation gerekir

**Zorluk:** 85/100  
**Risk:** 70/100  
**Bu proje için uygunluk:** ⭐⭐ (3/10)

---

## 6. Migration Difficulty Assessment

### Toplam Zorluk: 45/100 (Option B için)

### En Riskli Alanlar

| Alan | Risk | Neden |
|------|------|-------|
| Jury scoring flow | 🔴 Yüksek | Session validation + atomic writes + completion detection — bir hata veri kaybı |
| Auth/session management | 🔴 Yüksek | JWT refresh, OAuth, remember-me — hatada kullanıcılar sisteme giremez |
| Tenant isolation | 🟡 Orta | RLS + gateway validation — gap olursa cross-tenant data leak |
| Admin CRUD | 🟢 Düşük | Basit PostgREST → gateway proxy |
| Analytics | 🟢 Düşük | Read-only, stateless |

### En Çok Coupling Olan Dosyalar

1. `src/shared/api/core/client.js` — Tüm API buna bağlı
2. `src/auth/AuthProvider.jsx` — 9 direct Supabase call, tüm auth buna bağlı
3. `src/shared/api/juryApi.js` — Jury flow'un tamamı
4. `src/shared/api/admin/scores.js` — Analytics + grid data
5. `src/jury/hooks/useJuryAutosave.js` — Score write critical path

### Test Coverage

- Admin tests: `src/admin/__tests__/` — mevcut ama coverage bilinmiyor
- Jury tests: `src/jury/__tests__/` — useJuryState sub-hooks test edilmiş
- Shared tests: `src/shared/__tests__/` — ErrorBoundary, withRetry, API
- E2E: Playwright var ama scope bilinmiyor
- **DB function testleri: YOK** — en büyük gap

### Hangi Katman Önce Ayrıştırılmalı

1. **API Gateway katmanı** (Edge Functions genişletme)
2. **Admin CRUD proxy** (en düşük risk)
3. **Observability** (logging middleware)
4. **Jury endpoints** (en son, en dikkatli)

---

## 7. Önerilen Aşamalı Plan (Option B)

### Phase 0: Prerequisites (1 hafta)

**Ne yapılır:**
- [ ] Mevcut API inventory documentation (bu analiz ✓)
- [ ] API boundary violation fix (useProfileEdit.js — 15 dk)
- [ ] Realtime abstraction (`src/shared/api/core/realtime.js`)
- [ ] Error handling standardization (error codes catalog)
- [ ] Mevcut test coverage ölçümü

**Etkilenen dosyalar:** `useProfileEdit.js`, yeni `realtime.js`
**Değişmeyen:** Tüm business logic, tüm RPC'ler

### Phase 1: API Gateway Foundation (2 hafta)

**Ne yapılır:**
- [ ] Supabase Edge Function olarak thin gateway (`supabase/functions/api-gateway/`)
- [ ] Request logging middleware (structured JSON logs)
- [ ] Rate limiting (per-tenant, per-endpoint)
- [ ] Health check endpoint
- [ ] Admin CRUD'un 1-2 basit endpoint'ini gateway üzerinden route et (pilot)

**Etkilenen dosyalar:** Yeni Edge Function, `src/shared/api/core/client.js` (gateway URL eklenir)
**Değişmeyen:** Tüm mevcut API calls, tüm RPC'ler, frontend hooks
**Kabul kriteri:** Pilot endpoint'ler mevcut PostgREST ile aynı sonuç döner, logs görünür

### Phase 2: Easy Wins — Admin CRUD Migration (2-3 hafta)

**Ne yapılır:**
- [ ] Period CRUD → gateway
- [ ] Project CRUD → gateway
- [ ] Organization CRUD → gateway
- [ ] Framework/outcome CRUD → gateway
- [ ] Profile operations → gateway
- [ ] Input validation (Zod) gateway'de

**Etkilenen dosyalar:** `src/shared/api/admin/periods.js`, `projects.js`, `organizations.js`, `frameworks.js`, `profiles.js`
**Değişmeyen:** Jury RPCs, Auth, Realtime, scoring
**Kabul kriteri:** Tüm admin CRUD gateway'den geçer, mevcut testler geçer, logging aktif

### Phase 3: Medium Complexity (2-3 hafta)

**Ne yapılır:**
- [ ] Scores/analytics query endpoints → gateway (server-side aggregation option)
- [ ] Export endpoint → gateway (streaming response option)
- [ ] Audit log → gateway (standardized pagination)
- [ ] Entry token generate/revoke → gateway (ama DB logic kalır)
- [ ] Public API v1 tanımı (OpenAPI spec)

**Etkilenen dosyalar:** `src/shared/api/admin/scores.js`, `export.js`, `audit.js`, `tokens.js`
**Değişmeyen:** Jury scoring RPCs, auth, realtime
**Kabul kriteri:** Analytics response aynı, export çalışır, OpenAPI spec draft hazır

### Phase 4: Hard / Keep-As-Is (ongoing)

**Dokunma:**
- `rpc_jury_upsert_score` — DB'de kalsın
- `rpc_jury_verify_pin` — DB'de kalsın
- `rpc_jury_authenticate` — DB'de kalsın
- `rpc_period_freeze_snapshot` — DB'de kalsın
- `rpc_jury_finalize_submission` — DB'de kalsın
- Supabase Auth — değiştirme
- Supabase Realtime — değiştirme
- RLS policies — kaldırma

**Yapılabilecek:**
- [ ] Jury endpoint'leri gateway üzerinden proxy et (logging için, logic değişmeden)
- [ ] Gateway'de jury-specific rate limiting

### Phase 5: Stabilization (1-2 hafta)

- [ ] Full regression testing
- [ ] Performance benchmarks (gateway overhead ölçümü)
- [ ] Documentation update
- [ ] Monitoring/alerting setup
- [ ] Public API beta (eğer ihtiyaç varsa)

---

## 8. Final Recommendation

### Şu an REST'e geçmeli miyiz?

**Tam REST geçişi: HAYIR.**  
**Hybrid gateway model: EVET, ama acil değil.**

### Neden tam REST değil?

1. **Mevcut yapı zaten %85+ REST-like** (PostgREST)
2. **12 RPC'nin 3'ü güvenlik-kritik** ve DB'de kalması gerekiyor
3. **3-4 aylık rewrite** ROI'si çok düşük — bu sürede 10 yeni özellik yapılabilir
4. **Supabase Auth + Realtime + RLS** ücretsiz kazanımlar — replace etmek sadece maliyet
5. **Proje ölçeği** bunu haklı çıkarmıyor — 12 RPC, 78 query, 4 Edge Function

### Neden hybrid model?

1. **Observability**: Gateway'de structured logging en büyük kazanım
2. **Validation**: Server-side input validation (Zod) güvenlik artışı sağlar
3. **Rate limiting**: Multi-tenant'ta tenant-level rate limiting kritik
4. **Public API readiness**: Gelecekte dış entegrasyon ihtiyacı olacak
5. **Vendor abstraction**: Gateway arkasında provider değişimi mümkün hale gelir

### 6-12 Aylık Perspektif

| Ay | Öncelik | Neden |
|----|---------|-------|
| 0-2 | Phase 0-1: Gateway foundation | Observability ve rate limiting hemen değer katar |
| 2-4 | Phase 2: Admin CRUD migration | Düşük riskli, validation kazanımı |
| 4-6 | Phase 3: Analytics + export | Server-side optimization fırsatı |
| 6-12 | Public API v1 | Dış entegrasyon hazırlığı |
| ∞ | Jury RPCs DB'de kalır | Hiç taşımamak doğru karar |

### Son söz

Bu projenin "RPC problemi" yok. **Observability ve API gateway problemi var.** Bunu çözmek için mevcut yapıyı yıkıp yeniden yazmaya gerek yok — üzerine ince bir gateway katmanı eklemek yeterli. Jury security logic'ini DB'den çıkarmak net bir anti-pattern olur. Admin CRUD zaten REST — sadece bir gateway arkasına alınması gerekiyor.

**Önerilen model: Option B (Hybrid) — %85 mevcut yapı korunur, gateway eklenir, jury RPCs dokunulmaz.**
