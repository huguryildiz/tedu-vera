# Session E — E2E Depth Phase 2 (P1 Gap Closure)

**Önceki:** Session C — E2E Depth & Data Integrity (`../session-c-e2e-depth-integrity/`) kapandı 2026-04-24.
**Paralel:** Session D — Unit Test Quality Audit (`../session-d-unit-test-quality-audit/`) devam ediyor, çakışma yok.

---

## Context

Session C **P0 seviyesini** (scoring autosave, PIN lifecycle, RLS/RBAC, closed-period guard) ~%85 kapsama çekti. Ama P1 seviyesi (degrade eder ama durdurmaz) hâlâ zayıf — severity-weighted honest coverage ~%51.

Kod denetimiyle doğrulanan P1 boşlukları (2026-04-25):

| Konu | Spec var mı | İçinde ne var | Eksik |
|---|---|---|---|
| **Outcome attainment (MÜDEK/ABET)** | ✅ `outcomes.spec.ts` | Drawer açılır + fill + save | ❌ Weighted calculation (`scores.js:309-317`) hiç test edilmiyor — VERA'nın en kritik hesabı |
| Audit log content | ✅ `audit-log.spec.ts` | KPI + tab + search + filter | Admin action → `audit_logs` satırı yazıldı mı — yok |
| Analytics data accuracy | ✅ `analytics.spec.ts` | Chart container görünür | Chart içindeki sayılar doğru mu — yok |
| Heatmap cell states | ✅ `heatmap.spec.ts` | Grid görünür | Hücre renk + değer doğru mu — yok |
| Export row integrity | ✅ `rankings-export.spec.ts` | Header + 1 project total_score | Her row her sütun doğru mu — yok |
| Forgot password | ✅ `forgot-password.spec.ts` | Form + success banner | Reset link takibi + yeni şifre + login — yok |
| Period lifecycle | ✅ `periods.spec.ts` | CRUD + Published→Closed | draft→published transition + scored period close — yok |
| Edit-mode after submit | ❌ hiç yok | — | Spec bile yok |
| Juror session refresh | ✅ `resume.spec.ts` | "Welcome Back" text | `page.reload()` sonrası state — yok |
| Gerçek Google OAuth | ✅ `google-oauth.spec.ts` | Session injection simulation | Gerçek callback + PKCE — yok (Session F adayı, bu plan dışı) |

**Hedef:** Severity-weighted honest coverage **%51 → %75**. P1 kapsamı %25 → %65. "Bir P1 bug çıkarsa yakalar mı?" oranı 3× artar.

**Çıpa metrikleri:**
- DB/API-validating test: 22 → ~40
- L2/L3 (data integrity / deliberately-break) spec oranı: ~%40 → ~%65
- Outcome attainment: 0 test → en az 4 test
- Audit log: 0 content test → 5+ action-to-entry test

---

## Tasarım ilkeleri (Session C'den miras, değişmiyor)

1. **data-testid contract** — yeni selector sadece testid
2. **POM pattern** — mevcut POM'lara method ekle, yeni domain için yeni POM
3. **Deliberately-break her yeni test için zorunlu** — testi kasıtlı kır, FAIL olduğunu kanıtla
4. **`--workers=1` flake check** (F1) — her sprint raporunda kanıt
5. **Cleanup-in-test** — fixture yaratan her spec kendi çöpünü siler
6. **seed-ids.ts tek nokta** — yeni UUID hardcoding yok, dosyaya ekle
7. **`session_token_hash: null`** — juror_period_auth reset payload'unda zorunlu (F1)
8. **Kasıtlı-kırma doğrulaması** — yeni data integrity testi yazıldıktan sonra ilgili DB/RPC'yi mock'la/boz → test FAIL olmalı; olmazsa test fake

---

## Sprint planı (5 sprint, ~15 yeni test)

Sırlama **ROI-önce**: en yüksek severity × en düşük effort başta.

### E1 — Outcome attainment math correctness (P1-kritik) 🥇

**Problem:** VERA'nın asıl vaadi sadece ranking değil — MÜDEK/ABET **outcome attainment** raporu. Admin "ÖÇ-1 için weight=0.6 × Design criterion ve weight=0.4 × Technical criterion" gibi mapping kuruyor. Sistem her juror'un skorlarını alıp `(raw/max) × 100 × weight` formülüyle outcome attainment % hesaplıyor ([scores.js:309-317](src/shared/api/admin/scores.js#L309-L317)). **Bu formül hiç test edilmiyor.** Yanlış attainment = yanlış akreditasyon raporu = kurumsal risk.

**Hedef:** Bilinen criterion weight + outcome mapping + juror skoru ile, sistem attainment %'sini matematiksel olarak doğru hesaplayan mı?

**Değişecek dosyalar:**
- `e2e/admin/outcome-attainment.spec.ts` (yeni)
- `e2e/helpers/outcomeFixture.ts` (yeni) — period + 2 criteria + 2 outcomes + criterion-outcome mapping + 1 juror skor setup/teardown

**Yeni testler (4):**

1. **Tek outcome, tek criterion, bilinen attainment**
   - ÖÇ-A → Criterion-1 (weight 1.0, max 10); skor=8
   - Expected attainment: (8/10) × 100 × 1.0 = 80%
   - Assert: analytics/heatmap veya RPC yanıtında 80 görünür

2. **Tek outcome, iki criterion, weighted**
   - ÖÇ-A → Criterion-1 (weight 0.3), Criterion-2 (weight 0.7); skorlar 10, 5
   - Expected: (10·30 + 5·70) / (30+70) = 55
   - Assert: 55 görünür

3. **İki outcome aynı criterion'ı paylaşıyor**
   - Criterion-1 hem ÖÇ-A hem ÖÇ-B'ye bağlı farklı weight'lerde
   - Her outcome için bağımsız attainment hesabı doğru mu

4. **Deliberately-break:** Bir criterion'ı mapping'den çıkar → attainment değişmeli; değişmezse hesap yanlış

**Exit:** 4 test green; outcome attainment math artık matematiksel korunuyor.

---

### E2 — Audit log content verification

**Problem:** Audit log'un **UI filtreleri** test edilmiş ama **admin action → audit_logs entry** yazımı doğrulanmamış. Auth olayları / kritik CRUD olayları audit'e yazılmıyorsa kimse fark etmez.

**Değişecek dosyalar:**
- `e2e/admin/audit-log.spec.ts` — 5 yeni test ekle
- `e2e/helpers/supabaseAdmin.ts` — `readAuditLogs(orgId, eventType, since)` helper

**Yeni testler (5 aksiyon × 1 doğrulama):**

1. Period create → `audit_logs` satırı yazıldı, `event_type='period.created'`
2. Juror delete → `event_type='juror.deleted'` + doğru juror_id
3. Entry token generate → `event_type='entry_token.created'`
4. Failed login → `event_type='login.failed'`
5. Tenant-admin approval → `event_type='org.application.approved'`

Her test: adminClient action → readAuditLogs ile son N entry çek → beklenen event_type ve meta.field'lar assert.

**Deliberately-break:** `_audit_write` fonksiyonunu mock'la no-op yap → testler FAIL olmalı.

**Exit:** 5 audit assertion, compliance audit trail için real koruma.

---

### E3 — Analytics + Heatmap data accuracy

**Problem:** Analytics chart container ve heatmap grid div'i var mı diye bakılıyor; içindeki sayılar / renkler doğru mu kontrol edilmiyor.

**Değişecek dosyalar:**
- `e2e/admin/analytics.spec.ts` — 2 yeni test
- `e2e/admin/heatmap.spec.ts` — 2 yeni test
- `e2e/helpers/scoringFixture.ts` (C4'ten miras) — reuse + extend

**Yeni testler:**

**Analytics (2):**
1. Bilinen skor dağılımıyla (3 submitted, 1 in_progress, 1 draft) page render → "Submitted: 3", "In progress: 1", "Draft: 1" görünür
2. KPI: average score seed'li fixture'la hesaplanan ortalamaya eşit

**Heatmap (2):**
3. 2×2 matris (2 juror × 2 project) seed; her hücrenin class'ı doğru (`scored`, `partial`, `empty`)
4. Hücreye tıklanınca ilgili juror-project skor detayı görünür (mevcutsa)

**Deliberately-break:** Fixture skorlarını değiştir → chart/heatmap yansımalı; yansımazsa feed bozuk.

**Exit:** Analytics ve Heatmap artık data-accurate.

---

### E4 — Export row integrity + period lifecycle completion

**Problem:**
- Export: sadece header + 1 total_score kontrol ediliyor; **diğer projelerin skorları, rank sırası, ara sütunlar** asserted değil.
- Period lifecycle: `draft → published` transition test edilmemiş (sadece `published → closed` kısmi testli, skip guard'lı).

**Değişecek dosyalar:**
- `e2e/admin/rankings-export.spec.ts` — 2 yeni test
- `e2e/admin/periods.spec.ts` — 2 yeni test

**Yeni testler:**

**Export (2):**
1. **Row-level integrity:** Tüm projelerin export'taki `total_score` değeri DB `score_sheets`'ten hesaplanan sum'a eşit; rank sütunu 1..N sırada; project_title doğru map'lendi
2. **PDF export render** (eğer PDF butonu varsa): dosya indirilir, non-empty, 1. sayfada "Rankings" başlığı

**Period lifecycle (2):**
3. **draft → published transition:** Draft period yarat → publish butonu tıkla → status="Published"; DB'de `is_locked=true`
4. **Scored period close:** Scores olan period'u kapat → UI ve DB `closed_at` set edilir; kapanış sonrası juror skor yazmaya çalışırsa (C'nin dünkü fix'i) reddediliyor

**Deliberately-break:** Export download'da bir row'un total_score'unu DB'de elle bozuk yap → test FAIL olmalı.

**Exit:** Export row integrity + period full lifecycle.

---

### E5 — Auth flow deepening (forgot-password + session refresh + edit-mode)

**Problem:**
- Forgot-password: formun submit olduğu test ediliyor; e-mail link takibi yok
- Session refresh: sadece "Welcome Back" text kontrol; `page.reload()` sonrası state korunması yok
- Edit-mode after submit: hiç yok

**Değişecek dosyalar:**
- `e2e/auth/forgot-password.spec.ts` — 1 yeni test
- `e2e/jury/resume.spec.ts` — 2 yeni test
- `e2e/jury/edit-mode.spec.ts` (yeni) — 2 test
- `e2e/helpers/supabaseAdmin.ts` — mevcut `generateRecoveryLink` reuse

**Yeni testler (5):**

**Forgot-password (1):**
1. Recovery link flow: `generateRecoveryLink(email)` → `/reset-password?token_hash=...` sayfasına git → yeni şifre gir → login ekranına dön → yeni şifreyle login başarılı

**Session refresh (2):**
2. Progress step'teyken `page.reload()` → yine progress step'te açılır; juror kimliği korunuyor
3. Eval step'teyken skor gir (DB'ye yazıldığını doğrula) → `page.reload()` → skor input'ta hâlâ görünüyor (persisted state)

**Edit-mode after submit (2):**
4. Juror final submit yap → admin `rpc_juror_toggle_edit_mode` çağır → juror yeni session'da skor değiştirebilir (eski skor DB'de güncellenmeli)
5. Edit window expire süresi geçince (manuel `edit_expires_at = past` set) juror skor yazmaya kalkarsa `error_code='edit_window_expired'`

**Deliberately-break:** Her yeni test için — recovery token invalid yap, reload state'ini yanlış namespace'e bas, edit_enabled=false ama zorla skor yaz vb.

**Exit:** Auth-jury-flow tüm edge case'leri kapsanıyor.

---

## Kritik dosyalar (değiştirilecek / yeni)

**Yeni:**
- `e2e/admin/outcome-attainment.spec.ts` — E1
- `e2e/helpers/outcomeFixture.ts` — E1
- `e2e/jury/edit-mode.spec.ts` — E5

**Genişletilecek:**
- `e2e/admin/audit-log.spec.ts` — E2
- `e2e/admin/analytics.spec.ts` — E3
- `e2e/admin/heatmap.spec.ts` — E3
- `e2e/admin/rankings-export.spec.ts` — E4
- `e2e/admin/periods.spec.ts` — E4
- `e2e/auth/forgot-password.spec.ts` — E5
- `e2e/jury/resume.spec.ts` — E5
- `e2e/helpers/supabaseAdmin.ts` — E2 + E5 helpers
- `e2e/helpers/scoringFixture.ts` — E3 reuse

**Dokunulmayacak:**
- `e2e/legacy/` (arşiv)
- `playwright.config.ts` (stabil)
- Component dosyaları — testid eksikse sadece ekleme

---

## Paralel pencere dağılımı (model önerisi)

**Dalga 1 (3 pencere paralel):**
- Window A → E1 (Opus) — En kritik + en fazla araştırma
- Window B → E2 (Sonnet) — Pattern net, mekanik
- Window C → E4 (Sonnet) — Export + period, rutin

**Dalga 2 (2 pencere paralel):**
- Window A → E3 (Opus) — Fixture complexity + chart assertions
- Window B → E5 (Sonnet) — 5 test ama farklı alanlar, pattern hazır

**Çakışma noktaları:**
- `supabaseAdmin.ts` — E2 (readAuditLogs) + E5 (recovery reuse) çakışabilir; E2 Dalga 1, E5 Dalga 2 → conflict yok
- `scoringFixture.ts` — E3 reuse ediyor; E4 periods CRUD bağımsız → conflict yok

**Toplam süre tahmini:** Dalga 1 ~2 saat + Dalga 2 ~1.5 saat = **~4 saat paralel takvim süresi**. Sıralı olsaydı ~8-10 saat.

---

## Hedef metrikler (exit — E5 sonrası)

| Metrik | Şu an | E5 sonrası |
|---|---|---|
| Passing spec | 98 | ~113 |
| DB-validating test | ~22 | ~37-40 |
| Severity-weighted coverage | %51 | %75 |
| P1 coverage | %25 | %65 |
| Outcome attainment kapsamı | %0 | %80 |
| Flake rate (repeat-each=3 --workers=1) | 0 | 0 |

**Hedeflenmeyen (Session F veya sonraki):**
- Gerçek Google OAuth full callback (PKCE + state)
- Mobile layout testi (viewport-based)
- Dark mode visual regression
- Landing page dinamik içerik
- Visual regression (screenshot diff)

---

## Tracking

- Sprint raporları: `implementation_reports/E<N>-<slug>.md` — format Session C'den miras
- Flake log: `flake-log.md` — yeni observations
- Pass-rate history: README'ye her sprint sonu append

### Pass-rate history (doldurulacak)

| Snapshot | Passing | Skip | Flake | DB-validating | Severity coverage |
|---|---|---|---|---|---|
| E0 (Session C sonu) | 98 | 1 | 0 | 22 | %51 |
| E1 target | 102 | 1 | 0 | 26 | %58 |
| E2 target | 107 | 1 | 0 | 31 | %64 |
| E3 target | 111 | 1 | 0 | 34 | %69 |
| E4 target | 115 | 1 | 0 | 37 | %72 |
| E5 target | 120 | 1 | 0 | 40 | **%75** |

---

## Verification (plan uygulandıktan sonra)

**Sprint bazında:**
1. `npm run e2e` — full suite green (önceki + yeni testler)
2. `npm run e2e -- --grep "<sprint-slug>" --repeat-each=3 --workers=1` — 0 flake (F1 kuralı)
3. Deliberately-break kanıtı — ilgili RPC/policy/helper'ı boz → test FAIL olmalı

**Suite-wide (E5 sonrası):**
1. `npm run e2e -- --repeat-each=3 --workers=1` → ≥113 passing, 1 skip, 0 flake
2. Data integrity audit: `grep -r "adminClient\." e2e/ | wc -l` → ≥60 unique kullanım
3. Regression smoke: 3 bilinen production senaryosu kasıtlı bozuk → 3 ayrı test FAIL
   - (a) Outcome attainment weight formülü değişsin → E1 FAIL
   - (b) `_audit_write` no-op olsun → E2 FAIL
   - (c) Analytics KPI'yi yanlış aggregate et → E3 FAIL

---

## Risk ve trade-off

1. **Outcome attainment fixture karmaşası (E1)** — Criterion + outcome + criterion_outcome_maps + juror skor + period publish + RPC call. Çok layer. **Azaltım:** `outcomeFixture.ts` tek sorumluluklu, teardown'u önce items sonra parent.
2. **Audit log event naming drift (E2)** — `period.created` vs `period.create` — gerçek event name'leri kod'dan oku (`supabase/functions` veya `rpc_*`'lar), varsayma.
3. **Analytics fixture eşzamanlılık (E3)** — scoringFixture paylaşılırsa E3 testleri C4 scoring-correctness ile çakışabilir (aynı anda aynı fixture). **Azaltım:** Her spec kendi period/juror'ını yaratsın (unique suffix).
4. **Edit-mode RPC isim keşfi (E5)** — `rpc_juror_toggle_edit_mode` doğru mu, imzası ne? `src/shared/api/admin/` altında oku.
5. **Yanlış pozitif "test geçiyor" riski** — Session C'deki tek nokta bu plandaki her sprint için de geçerli. Deliberately-break **zorunlu**, skip edilemez.
