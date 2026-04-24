# Session C — E2E Depth & Data Integrity

**Parallel / takip eden:** Session B — E2E Test Coverage (`../session-b-e2e-test-coverage/`) closed 2026-04-24, 77/78 passing.

---

## Context

**Neden bu plan?**

Session B (B1–B8, 2026-04-24) E2E test yeniden yazımını tamamladı: **77/78 passing, 0 flake, ~95% critical journey coverage**. Kâğıt üzerinde başarı. Ancak 2026-04-24 tarihli dürüst bir suite analizi şunu ortaya çıkardı:

- **29 spec'in 27'si pure UI smoke**: "buton görünüyor mu, drawer açıldı mı, tablo render oldu mu". Backend state sorgulayan sadece 2 dosya var — `tenant-isolation.spec.ts` (RLS) ve `invite-accept.spec.ts` (DB user creation).
- **Scoring autosave** yazılan skorların `rubric_scores` tablosuna gerçekten yazıldığını **hiç doğrulamıyor** — `evaluate.spec.ts` skor gir, save status görün, devam. Autosave hiç tetiklenmese de test yeşil.
- **Rankings export** CSV/XLSX'i indirip içeriği **parse etmiyor** — sadece panelin açıldığını kontrol ediyor.
- **PIN blocking lifecycle** (3-fail → lock → unlock) ve **criteria weight → ranking** hesaplamasının doğruluğu test edilmiyor.
- **Tenant isolation** sadece 3 tabloda doğrulandı (memberships, periods, jurors); `criteria`, `outcomes`, `period_criteria`, `rubric_scores`, `projects`, `entry_tokens`, `audit_log`, `juror_period_auth` RLS'e göre kontrol dışı.
- **Google OAuth callback** abort ediliyor; primary admin login path'i gerçekte test edilmiyor.

Session B coverage checklist'i "✅" ile dolu görünse de bu işaretlerin çoğu **"sayfa render oldu"** anlamına geliyor, **"feature doğru çalışıyor"** anlamına değil. Evaluation günü (production critical path) bu suite'e güvenilerek çıkılamaz.

**Session C'nin amacı:** Test **sayısını** artırmak değil, mevcut smoke testlerin **derinliğini** artırmak ve eksik critical path'leri gerçek data integrity ile kapatmak. Hedef:

- Scoring autosave → DB round-trip doğrulaması
- Export file content validation
- PIN blocking full lifecycle
- Criteria weight → ranking hesap doğruluğu
- Tenant isolation — 8 tabloya genişletme
- Admin RBAC boundary (tenant-admin cross-org erişim engeli)
- Period snapshot immutability (closed period'a yazma girişimi reddediliyor mu?)
- Google OAuth full callback (mock'lu ama gerçek session oluşumu)

Hedef rakam: **~95 passing spec**, **0 flake**, **~18 test DB state doğrulayan** (şu an ~5).

---

## Dayanak dokümanlar

- Önceki plan: `../session-b-e2e-test-coverage/README.md`
- Önceki sprint raporları: `../session-b-e2e-test-coverage/implementation_reports/`
- Flake log: `../session-b-e2e-test-coverage/flake-log.md`
- Gold-standard referanslar:
  - `e2e/security/tenant-isolation.spec.ts` — RLS via REST
  - `e2e/auth/invite-accept.spec.ts` — Admin API ile DB doğrulama + `buildInviteSession()`
  - `e2e/helpers/supabaseAdmin.ts` — `generateInviteLink`, `generateRecoveryLink`, `deleteUserByEmail`

---

## Tasarım ilkeleri (Session B'den miras + yeni)

1. **Test geçiyor ≠ feature çalışıyor.** Her yeni/güncellenen spec, ya DB state ya API response doğrulamalı. UI-only assertion artık "smoke" sayılıyor; her kritik journey en az 1 data-integrity testi ile desteklenmeli.
2. **`data-testid` contract korunacak.** Session B'nin kazanımı. Yeni selector stratejisi eklenmeyecek.
3. **POM pattern korunacak.** Mevcut POM'lara method eklenecek; yeni POM sadece yeni domain için yazılacak.
4. **Seed data hardcoded UUID'ler gözden geçirilecek.** Mümkün olan yerde `adminClient` ile setup-in-test yapılacak (invite-accept pattern). Var olan hardcoded UUID'ler `e2e/fixtures/seed-ids.ts` gibi tek dosyaya taşınacak (drift önleme).
5. **Cleanup-in-test.** Her test çalıştırdığı yazmayı temizlemeli (özellikle yeni user oluşturan testler). `e2e/helpers/supabaseAdmin.ts::deleteUserByEmail` pattern'i genişletilecek.
6. **Flake policy:** Session B'den miras — bir test 9/10 geçiyorsa **bozuktur**; retry eklenmez, root cause bulunur.
7. **Legacy arşiv dokunulmaz.** `e2e/legacy/` yerinde kalır, çalıştırılmaz.
8. **Kasıtlı-kırma doğrulaması (yeni):** Yeni data integrity testi tamamlandığında, testi doğrulayan bir **"deliberately-break"** deneme yapılır — ilgili RPC'yi mock'la throw ettir, test FAIL olmalı. Aksi halde test fake.

---

## Sprint planı (6 sprint)

Her sprint `npm run e2e` green olarak kapanır; data integrity testleri `repeat-each=3` ile 0 flake.

### C1 — Scoring autosave data integrity (P0)

**Problem:** `evaluate.spec.ts` skorları doldurur, UI save-status görür, devam eder. Autosave RPC bozulsa, writeGroup hiç çağrılmasa test yeşil geçer.

**Hedef:** Skor girişinin DB'ye gerçekten yazıldığını doğrulayan, autosave tetiklenmezse failing olan testler.

**Değişecek dosyalar:**

- `e2e/jury/evaluate.spec.ts` — mevcut "blur after score fill triggers autosave status" testi genişlet; ayrıca 2 yeni test ekle
- `e2e/helpers/supabaseAdmin.ts` — `readRubricScores(jurorId, periodId)` helper ekle (service role ile `rubric_scores` tablosu sorgusu)

**Yeni testler:**

1. `onBlur → DB'de rubric_scores kaydı var`:
   - Skor "7" gir → blur → `readRubricScores(jurorId, periodId)` ile DB sorgula
   - Assert: en az 1 satır, `score_written = 7` (veya UI'dan gelen field'e map'lenmiş değer)
2. `visibilitychange save tetikler`:
   - Skor gir, blur ETME → `page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))`
   - `readRubricScores()` → satır var
3. `deduplication: aynı blur iki kez save etmez`:
   - Skor gir, blur, blur tekrar → RPC network istek sayısı 1
   - `page.route("**/rest/v1/rpc/rpc_jury_save_scores**", ...)` ile intercept

**Testid eklenecek (varsa):** mevcut yeterli; `JuryEvalPom` zaten `jury-eval-score-*` kullanıyor.

**Exit:** 3 yeni test green (repeat-each=3); autosave DB validation var; deliberately-break doğrulaması yapıldı.

---

### C2 — Rankings & export file content validation (P0)

**Problem:** `rankings-export.spec.ts` sadece export panelinin açıldığını kontrol ediyor; CSV/XLSX indirilmiyor, parse edilmiyor.

**Hedef:** Export butonuna basılınca oluşan dosyanın format + satır sayısı + bilinen değerleri içerdiğini doğrulayan test.

**Değişecek dosyalar:**

- `e2e/admin/rankings-export.spec.ts` — 2 yeni test ekle
- `e2e/helpers/parseExport.ts` — (yeni) CSV/XLSX parse helper (`xlsx` paketi zaten deps'te)
- `e2e/fixtures/seed-ids.ts` — (yeni) bilinen project IDs, expected scores

**Yeni testler:**

1. `CSV export → file downloaded → header row + project count doğru`:
   - Export panel aç → "CSV" tıkla → `page.waitForEvent("download")` → `.path()`
   - `parseExport.ts::readCSV()` ile satırları oku
   - Assert: header'da `project_title`, `total_score`, `rank` var; satır sayısı beklenen proje sayısına eşit
2. `XLSX export → file downloaded → pre-seeded project'in score'u beklenen değer`:
   - Export → XLSX → download → parse
   - Assert: seed'lenmiş "E2E Scored Project"nin total_score'u, DB'deki `rubric_scores` sum'ına eşit

**Exit:** CSV ve XLSX export dosyaları parse ediliyor + content doğrulanıyor.

---

### C3 — PIN blocking full lifecycle (P0-P1)

**Problem:** `pin-blocking.spec.ts` unlock butonunun görünürlüğünü kontrol ediyor. Gerçek lockout cycle (3 yanlış → lock → unlock) test dışı. `lock.spec.ts` sadece locked screen render'ını kontrol ediyor.

**Hedef:** 3 başarısız PIN denemesi → `juror_period_auth.failed_attempts = 3`, `locked_until` set; admin unlock sonrası counter reset.

**Değişecek dosyalar:**

- `e2e/jury/lock.spec.ts` — mevcut test genişlet
- `e2e/admin/pin-blocking.spec.ts` — 2 yeni test ekle
- `e2e/helpers/supabaseAdmin.ts` — `readJurorAuth(jurorId, periodId)` + `resetJurorAuth(jurorId, periodId)` helper

**Yeni testler:**

1. `3 yanlış PIN → lock + DB state`:
   - Seed juror state (`failed_attempts=0`, `locked_until=null`)
   - `/jury/pin` → 3 kere yanlış PIN → locked screen
   - `readJurorAuth()` → `failed_attempts=3`, `locked_until > now()`
2. `admin unlock → DB counter reset`:
   - PIN-blocking sayfası → unlock tıkla → confirm
   - `readJurorAuth()` → `failed_attempts=0`, `locked_until=null`
3. `locked_until geçtikten sonra yeni deneme kabul edilir`:
   - Manuel olarak `locked_until = now() - interval '1 minute'` set et
   - Jury flow → doğru PIN kabul edilir

**Exit:** 3 yeni test green; lifecycle DB ile senkron.

---

### C4 — Criteria weight → ranking hesap doğruluğu (P1)

**Problem:** `criteria.spec.ts` kriter ekler, drawer'ın kapandığını kontrol eder. Kriter ağırlığının (weight) skor hesaplamasına etkisi test edilmiyor. VERA'nın temel vaadi budur — yanlış weight → yanlış ranking → yanlış mezuniyet kararı.

**Hedef:** Bilinen weight + bilinen skorlarla final ranking'in matematiksel olarak doğru hesaplandığını doğrulayan test.

**Değişecek dosyalar:**

- `e2e/admin/scoring-correctness.spec.ts` — (yeni) 2 test
- `e2e/helpers/scoringFixture.ts` — (yeni) 2 project + 2 criteria (30%/70%) + 1 juror seed/cleanup helper

**Yeni testler:**

1. `asymmetric weight → ranking expected order`:
   - Period seed: Criteria A (weight 30), Criteria B (weight 70)
   - Projects: P1 (A=10, B=3) expected = 30×10 + 70×3 = 510
   - Projects: P2 (A=3, B=10) expected = 30×3 + 70×10 = 790
   - Jury eval tamamla (headless juror flow) → `/admin/rankings`
   - Assert: P2, P1'den önce listeleniyor; total_score 790 / 510
2. `equal weight → ranking expected order`:
   - A=50, B=50; P1 (A=10,B=3) = 650, P2 (A=3,B=10) = 650 — tie handling doğrulanır

**Exit:** Scoring matematiği E2E olarak korunuyor. Weight regression bug'ı yakalanır.

---

### C5 — Tenant isolation — 8-tablo full sweep (P1)

**Problem:** `tenant-isolation.spec.ts` sadece 3 tablo (memberships, periods, jurors) için RLS doğruluyor. Geri kalan tablolar için tenant A → tenant B data leak riski kontrol dışı.

**Hedef:** Her tenant-scoped tabloda foreign-org filtrelemesinin işlediğini doğrulayan parameterize test.

**Değişecek dosyalar:**

- `e2e/security/tenant-isolation.spec.ts` — mevcut testleri genişlet
- `e2e/helpers/rlsProbe.ts` — (yeni) tek fonksiyon: `probeForeignOrgAccess(tableName, orgIdColumn, foreignOrgId, jwt)`

**Yeni testler (8 tablo × 1 test = 8 test):**

- `criteria` (`organization_id` filtrelenir)
- `outcomes`
- `period_criteria`
- `rubric_scores` (period_id üzerinden dolaylı)
- `projects`
- `entry_tokens`
- `audit_log`
- `juror_period_auth`

Her test: tenant-admin A'nın JWT'si ile tenant B'nin rows'unu sorgula → empty array veya 403.

**Exit:** 8 yeni RLS probe test green; cross-tenant leak yakalanabilir.

---

### C6 — Admin RBAC boundary + period immutability + OAuth callback (P1-P2)

**Problem:**
- Tenant-admin bir başka org'un period'unu update edebilir mi? Sadece nav restriction testi var; RPC-level enforcement test edilmiyor.
- Closed period'a skor yazılabiliyor mu? Period snapshot immutability test edilmemiş.
- Google OAuth sadece redirect URL'ini kontrol ediyor; callback abort, session oluşumu hiç doğrulanmıyor.

**Hedef:** Üç ayrı güvenlik/doğruluk kontrolü.

**Değişecek dosyalar:**

- `e2e/security/rbac-boundary.spec.ts` — (yeni)
- `e2e/security/period-immutability.spec.ts` — (yeni)
- `e2e/auth/google-oauth.spec.ts` — genişlet

**Yeni testler:**

1. `tenant-admin-A cannot update org-B period via RPC` (RBAC):
   - Tenant A JWT ile `rpc_admin_update_period` çağır (org B'nin period_id'si ile)
   - Assert: 403 veya SQL permission denied
2. `tenant-admin-A cannot delete org-B juror via RPC`:
   - Aynı pattern, `rpc_admin_delete_juror`
3. `closed period → rubric_scores insert reddedilir`:
   - Period state = "closed" set
   - Jury flow üzerinden skor yaz → RLS veya trigger reddediyor
4. `Google OAuth → session injected → admin shell`:
   - `page.route("**/auth/v1/callback**", ...)` ile mock callback token inject et
   - Admin shell render edildi mi? localStorage'da session var mı?

**Exit:** 4 yeni test green; üç farklı güvenlik/doğruluk ekseni kapsanır.

---

## Kritik dosyalar (değiştirilecek / yeni eklenecek)

**Mevcut, genişletilecek:**

- `e2e/jury/evaluate.spec.ts`
- `e2e/jury/lock.spec.ts`
- `e2e/admin/rankings-export.spec.ts`
- `e2e/admin/pin-blocking.spec.ts`
- `e2e/auth/google-oauth.spec.ts`
- `e2e/security/tenant-isolation.spec.ts`
- `e2e/helpers/supabaseAdmin.ts`

**Yeni oluşturulacak:**

- `e2e/helpers/parseExport.ts` — CSV/XLSX parser
- `e2e/helpers/scoringFixture.ts` — scoring E2E setup/cleanup
- `e2e/helpers/rlsProbe.ts` — generic RLS foreign-org probe
- `e2e/fixtures/seed-ids.ts` — hardcoded UUID'ler tek dosyada (drift önleme)
- `e2e/admin/scoring-correctness.spec.ts`
- `e2e/security/rbac-boundary.spec.ts`
- `e2e/security/period-immutability.spec.ts`

**Yeniden kullanılacak mevcut utility'ler:**

- `e2e/helpers/supabaseAdmin.ts::adminClient` (gold standard, invite-accept'den miras)
- `e2e/helpers/supabaseAdmin.ts::buildInviteSession` — localStorage injection pattern
- `e2e/poms/JuryEvalPom.ts::fillAllScores` — scoring fixture için
- `e2e/poms/BasePom.ts::byTestId` — selector contract
- `scripts/generate_demo_seed.js` — seed üretimi (değişmezse dokunulmaz; scoringFixture bağımsız seed yapar)

**Dokunulmayacak:**

- `e2e/legacy/` (arşiv)
- `playwright.config.ts` (zaten sağlam)
- `src/test/qa-catalog.json` (unit test catalog; E2E değil)
- Component/hook dosyaları — bir spec, bir component'i **değiştirmez**; sadece testid ekler. Testid eklemesi gereken component listesi sprint başında belirlenir.

---

## Tracking & raporlama

- Sprint raporları: `implementation_reports/C<N>-<slug>.md`
- Format: pass-rate delta, yeni testid'ler, yeni fixtures, data integrity kapsamı (kaç test DB doğruluyor, kaç test hâlâ sadece UI)
- Flake log: `flake-log.md` (boş olarak başlar)
- Pass-rate history tablosu bu README'ye her sprint sonunda eklenir (Session B formatında)

### Pass-rate history (doldurulacak)

| Snapshot | Passing | Failing | Skip | DB-validating | Honest coverage |
|---|---|---|---|---|---|
| C0 baseline (Session B sonu) | 77 / 78 | 0 | 1 | ~5 | 4.5/10 |
| C1 target | 80 / 81 | 0 | 1 | ~8 | 5.0/10 |
| C2 target | 82 / 83 | 0 | 1 | ~10 | 5.5/10 |
| C3 target | 85 / 86 | 0 | 1 | ~13 | 6.0/10 |
| C4 target | 87 / 88 | 0 | 1 | ~15 | 6.5/10 |
| C5 target | 95 / 96 | 0 | 1 | ~18 | 7.0/10 |
| C6 final | 99 / 100 | 0 | 1 | ~20 | 7.5/10 |

---

## Verification (plan uygulandıktan sonra nasıl doğrularız)

**Sprint-per-sprint:**

1. `npm run e2e` — full suite green (mevcut + sprint yeni testleri)
2. `npm run e2e -- --grep "<sprint-slug>" --repeat-each=3` — 0 flake
3. Her yeni data integrity testi için: testi **kasıtlı kır** (örn. autosave RPC'yi mock'la / dummy response döndür) → test failing olmalı. Geçmeye devam ediyorsa test fake — düzelt.

**Suite-wide (C6 sonrası):**

1. `npm run e2e -- --repeat-each=3` → ≥95 passing, 1 skip (lifecycle), 0 flake
2. Data integrity audit: `grep -r "adminClient\." e2e/ | wc -l` — en az 18 unique kullanım (şu an ~5)
3. Manuel regression smoke: bilinen 3 production bug'ı test ederek "yakalanıyor mu" doğrula:
   - (a) `rpc_jury_save_scores` throw etsin (mock) → `evaluate.spec` failing
   - (b) rankings RPC yanlış total döndürsün → rankings-export content test failing
   - (c) `juror_period_auth` RLS policy drop et → RLS probe failing

**CI gate:**

`.github/workflows/e2e.yml` Session B'de eklenmişti — Session C'de ek gate yok, sadece test sayısı artıyor; fail-threshold aynı kalır.

---

## Hedef metrikler (exit)

| Metrik | Şu an (B8 sonrası) | Session C exit |
|---|---|---|
| Passing spec | 77/78 | ~95/96 |
| DB state doğrulayan test | ~5 | ~20 |
| Kapsanan kritik path | %95 (shallow) | %95 (deep) |
| Flake rate (repeat-each=3) | 0 | 0 |
| Data integrity coverage (honest) | 4.5/10 | 7.5/10 |
| Regression-catching power | 3/10 | 7/10 |
| Production confidence | 4/10 | 7.5/10 |

Not: 10/10 hedeflenmiyor; suite **"gerçek regression'ları yakalayan"** seviyeye çekiliyor, **"tam deterministic"** seviyeye değil. Analytics chart data accuracy, heatmap cell state accuracy, tam Google OAuth end-to-end gibi bazı kalemler bu planın dışında (ayrı Session D adayları).

---

## Risk ve trade-off

- **Seed bağımlılığı artacak:** Scoring fixture, tenant isolation probe, RBAC boundary testleri daha fazla seed kurgusu istiyor. Azaltım: Her sprint kendi setup+cleanup'ını yapar (invite-accept pattern); seed dosyası tek nokta `seed-ids.ts` olur.
- **Testler yavaşlayacak:** DB round-trip + export download + OAuth mock ~3-5 saniye ekler her test. Tahmin: +45 saniye total CI süresi (kabul edilebilir).
- **`SUPABASE_SERVICE_ROLE_KEY` bağımlılığı:** Session B'de eklendi (GitHub secret). Session C ek secret istemez.
- **Seed drift riski:** Demo DB schema değişirse 18 data integrity testi kırılır. Azaltım: `seed-ids.ts` + her spec'in `beforeEach` setup'ı; schema değişikliği zaten migration ile gelir, migration testi suite pre-check'ine dahil edilmeli (ayrı konu).
- **Yanlış pozitif "test geçiyor" kanıksaması:** Bu planın tam amacı bunu kırmak. Her sprint verification adımında "test kasıtlı kırılma testi" zorunlu — aksi halde C-sprint'i smoke'a dönüşür.
