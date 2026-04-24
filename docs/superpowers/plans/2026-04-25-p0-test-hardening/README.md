# P0 Test Hardening Sprint — 2026-04-25

**Tarih:** 2026-04-25 (Cumartesi gece başlangıcı)
**Status:** Planlandı, iki-gece stratejisiyle yürütülecek
**Ön koşul:** Audit raporu tamamlandı — `docs/qa/vera-test-audit-report.md`

**Kaynak:** `docs/qa/vera-test-audit-report.md` §9 P0 maddeleri

---

## Motivasyon

Audit raporunun ana bulgusu: VERA test kültürü olgun ama **gate zayıf**.

- `.github/workflows/ci.yml` `if: false` ile devre dışı → 938 unit test PR'larda hiç koşmuyor
- 16 edge function'ın auth-failure shape'i pinli değil
- 45 DB RPC'sinden sadece 9'unun pgTAP sözleşmesi var
- `CLAUDE.md` "test from zero" kuralının CI enforcement'ı yok
- 3 kritik hook orchestrator test'i mock-tautology

Bu sprint o gate'i inşa ediyor. 5 parça, 2 gece.

---

## Scope — Tam kapsam (5 parça)

| # | Parça | Audit ref | Gece | Tahmini süre |
|---|---|---|---|---|
| A | CI'da unit testleri aç + test:edge job ekle | P0 #1 | Cumartesi | ~30 dk |
| B | 13 edge function için auth-shape pinning | P0 #3 | Cumartesi | ~3-4 saat |
| C | 9 kritik RPC için pgTAP sözleşme testleri | P0 #4 | Cumartesi | ~2-3 saat |
| D | Fonksiyonel migration CI workflow | P0 #2 | Pazartesi | ~1-2 saat |
| E | 3 hook orchestrator hardening (partial-failure fake) | P0 #5 | Pazartesi | ~3-4 saat |

**Toplam:** 10-14 saat, iki gece arasında bölünmüş.

### İki gece mantığı

Şu an Opus 4.7 kotası %50. Pazar 20:00'de weekly reset. Bu yüzden:

- **Cumartesi gece:** A + B + C (kota sığar, mekanik iş, bitmese bile yarın reset var)
- **Pazartesi gece:** D + E (tam kota Opus, hook rewrite gibi subtle-reasoning gerektiren iş için)

---

## Karar özeti (kullanıcı onayı alındı)

| Karar | Seçim | Not |
|---|---|---|
| Kapsam | **Tam (A+B+C+D+E)** | İki geceye yayıldı |
| Dirty 4 dosya | **Dahil et** | Ayrı `chore:` commit olarak branch'e alınır |
| Başlama | **Doğrudan** | Plan yazılınca onay beklemeden execute |
| pgTAP doğrulama | **Sadece vera-demo** | Prod'a dokunulmaz, schema parity policy yeterli |
| PR stratejisi | **Aç, merge etme** | Sabah kullanıcı CI yeşilini görür, kendi merge eder |
| Ana model | **Opus 4.7** (ana oturum) | Koordinasyon + review |
| Subagent model | **Sonnet 4.6** (impl) + **Opus** (review pass) | Kota optimizasyonu |

---

## Branch & commit stratejisi

**Branch:** `qa/p0-autonomous-session` (main'den)

**Commit haritası (Cumartesi):**

1. `chore: include in-progress edits from prior session` — dirty 4 dosya
2. `ci: re-enable unit tests + add edge test job` — Parça A
3. `test(edge): pin auth-failure shapes for 13 edge functions` — Parça B
4. `test(pgtap): pin RPC contracts for 9 critical functions` — Parça C

**Commit haritası (Pazartesi):**

5. `ci: add functional migration workflow with pg_prove` — Parça D
6. `test(hooks): harden 3 orchestrators with partial-failure fakes` — Parça E

**Push:** Parça C biter bitmez (Cumartesi gece sonu) branch `origin`'e push, PR açılır. Pazartesi parçaları aynı branch'e yeni commit olarak eklenir, PR günceller.

**PR açıklaması:** Her commit'in audit raporuna referansı verilir. Kullanıcının sabah hızlı review'ü için her commit ayrı/atomik.

---

## Execution modeli

### Cumartesi gece

```text
00:00  Parça A — CI fix (doğrudan ben, ~30 dk)
       └─ verify: npm test + npm run test:edge lokalde
       └─ Opus review subagent (5 dk, sanity check)
       └─ commit

00:35  Parça B — edge auth-shape pinning
       ├─ 3 Sonnet subagent PARALEL dispatch:
       │   ├─ B1 (admin group, 4 fn)
       │   ├─ B2 (audit/cron group, 4 fn)
       │   └─ B3 (email/jury group, 5 fn)
       ├─ Sonuçlar döndüğünde sentez + entegrasyon (benim üzerimde)
       ├─ verify: deno test --filter her fn + npm run test:edge tümü
       ├─ Opus review subagent (10 dk)
       └─ commit

03:35  Parça C — pgTAP RPC contract pinning
       ├─ Ben doğrudan yazarım (9 dosya)
       ├─ Her dosya için Supabase MCP execute_sql (vera-demo, BEGIN/ROLLBACK)
       ├─ verify: SELECT * FROM finish() tüm testlerde geçti
       ├─ Opus review subagent (5 dk)
       └─ commit

06:00  Final entegrasyon
       ├─ npm test -- --run (full suite yeşil)
       ├─ npm run build (prod build geçer)
       ├─ npm run test:edge (tüm edge tests yeşil)
       ├─ git push -u origin qa/p0-autonomous-session
       ├─ gh pr create (draft değil, review-ready)
       └─ implementation_reports/SESSION-REPORT.md (Cumartesi bölümü)
```

### Pazartesi gece (reset sonrası)

```text
Pazartesi 20:00+  Parça D — functional migration CI
                  ├─ Sonnet subagent (1-1.5 saat)
                  ├─ Workflow: Postgres container → 001..009 apply → pg_prove
                  ├─ verify: actionlint + syntax check
                  ├─ Opus review subagent
                  └─ commit

                  Parça E — hook orchestrator hardening
                  ├─ Sonnet subagent impl (2-3 saat)
                  ├─ Hook listesi: useAdminData, useJuryState, useSettingsCrud
                  ├─ Her biri için partial-failure fake RPC surface
                  ├─ verify: vitest --run ilgili dosyalar
                  ├─ Opus review subagent (ÖNEMLİ — false-confidence riski)
                  └─ commit

                  Final: push + PR güncelle + rapor tamamla
```

---

## Doğrulama kapıları (verification gates)

Her parçanın "tamam" sayılması için ŞU kontrollerden **tümü** geçmeli:

### Her parça sonunda (zorunlu)

1. **Syntax/build kontrolü** — parçaya uygun:
   - A: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
   - B: `cd supabase/functions && deno test --allow-net --allow-env --allow-read --import-map=_test/import_map.json [fn]/` tek tek
   - C: `SELECT * FROM finish()` MCP execute_sql'de hatasız
   - D: `actionlint .github/workflows/*.yml` (local'de)
   - E: `npx vitest run src/admin/hooks/__tests__/useAdminData.test.*` vb. tek tek

2. **Regression kontrolü** — parçadan önce de vardı sonra da var:
   - Full `npm test -- --run` (Parça A bittiğinde CI zaten bunu koşacak; ama ilk kez kendim çalıştırırım)
   - Parça B sonrası `npm run test:edge` tümü yeşil

3. **Code review pass** — `feature-dev:code-reviewer` subagent (Opus) son commit'e bakar:
   - "Bu test gerçekten bir şey doğruluyor mu yoksa tautoloji mi?"
   - "Mock'lar gerçek davranışı gizliyor mu?"
   - "Edge case'ler gözden kaçmış mı?"
   - Review'u `implementation_reports/parça-X-review.md` dosyasına yazarım

### Final (push'tan önce)

4. `npm test -- --run` — 938 + yeni testler hepsi yeşil
5. `npm run test:edge` — 16 fonksiyon × yeni testler hepsi yeşil
6. `npm run build` — production build geçer
7. `git log --oneline main..HEAD` — commit grafiği temiz ve mantıklı
8. `git diff main..HEAD --stat` — beklenmedik dosya değişikliği yok

---

## Dur-ve-raporla koşulları

**Şu durumlardan biri olursa dururum, branch'i olduğu gibi bırakırım, ilgili parçayı "INCOMPLETE" olarak rapora işlerim:**

| Durum | Aksiyon |
|---|---|
| Lokal test suite kırılır ve 30 dk'da root cause çözülmez | Dur, yeni commit atma, rapora yaz |
| Edge fn `index.ts` okurken bilmediğim auth pattern çıkar | Dur, sorular listesi oluştur, kalan fonksiyonlara geç |
| pgTAP testi vera-demo'da beklenenden farklı davranır | Dur, schema drift mi kod bug mı analiz et, rapora yaz |
| Supabase MCP `execute_sql` hata döner (örn. permission) | Dur, sorunu dokümante et, o testi skip, devam et |
| Parça E'de hook fake'inin yanlış yazıldığı review pass'inde çıkar | Commit'i geri al, rapora yaz, hook'u skip |
| Quota bitmek üzere uyarısı alırsam | Bulunduğum parçayı bitirmeye çalış, push, rapor yaz, dur |
| Beklenmeyen conflict / segfault / deno hang | Dur, state snapshot al, rapora yaz |

**Asla yapmayacaklarım:**

- ❌ Main'e merge
- ❌ Vera-prod DB'ye yazma
- ❌ Migration apply etmek (test sadece BEGIN/ROLLBACK)
- ❌ GitHub secrets modifikasyonu
- ❌ `--no-verify` ile pre-commit hook atlama
- ❌ Dirty dosyaların içini **yeniden yazma** (sadece olduğu gibi ayrı commit'e alacağım)

---

## Parça detayları

### Parça A — CI fix

**Hedef:** `.github/workflows/ci.yml`'yi çalışır hale getir.

**Değişiklikler:**

1. `test` job'unda `if: false` kaldır
2. `e2e` job'unu sil (duplicate; zaten `e2e.yml`'de çalışıyor)
3. Yeni `edge-tests` job ekle: Deno setup + `npm run test:edge`
4. Trigger: `workflow_dispatch` → `pull_request` + `push: [main]`
5. Coverage threshold aktif (düşerse fail)

**Çıktı dosyaları:**

- `.github/workflows/ci.yml` (düzeltilmiş)

**Doğrulama:** YAML syntax, lokal `npm test` + `npm run test:edge` yeşil.

---

### Parça B — Edge function auth-shape pinning

**Hedef:** 13 edge function'ın auth-failure shape'ini pinle (senin dirty 3 dosyana dokunmayacağım).

**Gruplar ve sonuçlar:**

| Grup | Fonksiyonlar | Sonnet subagent | Tahmini test sayısı |
|---|---|---|---|
| B1 — Admin | admin-session-touch, platform-metrics, invite-org-admin, on-auth-event | `prompts/B1-edge-auth-admin-group.md` | ~10-12 |
| B2 — Audit/Cron | audit-anomaly-sweep, audit-log-sink, log-export-event, notify-maintenance | `prompts/B2-edge-auth-audit-cron-group.md` | ~10-12 |
| B3 — Email/Jury | email-verification-send, email-verification-confirm, password-reset-email, request-pin-reset, receive-email | `prompts/B3-edge-auth-email-jury-group.md` | ~12-15 |

**Toplam:** ~30-35 yeni test

**Standart test seti (fonksiyon başına):**

1. Missing Authorization header → 401 + stable error shape
2. Malformed Authorization → 401
3. (uygulanabilirse) Insufficient role → 403
4. (uygulanabilirse) Success path → 200 + expected response shape

**Subagent kuralı:** Her subagent kendi grubunu kendi içinde sentezler, yalnızca test dosyaları (`*.test.ts`) döndürür. Source (`index.ts`) dosyalarına dokunmazlar (oku-sadece).

---

### Parça C — pgTAP RPC contract pinning

**Hedef:** 9 kritik RPC için sözleşme testleri.

**Seçilen RPC'ler:**

| # | RPC | Neden kritik |
|---|---|---|
| 1 | `rpc_jury_finalize_submission` | Jury akışının son aksiyonu; shape drift = "complete" ekranı bozulur |
| 2 | `rpc_jury_get_scores` | Her resume'da çağrılır |
| 3 | `rpc_period_freeze_snapshot` | Period kapanırken; yanlış shape = veri kaybı riski |
| 4 | `rpc_admin_save_period_criteria` | Setup wizard'ın kalbi |
| 5 | `rpc_admin_upsert_period_criterion_outcome_map` | Analytics için kritik |
| 6 | `rpc_admin_verify_audit_chain` | Audit integrity + bonus: tamper-then-detect test |
| 7 | `rpc_juror_unlock_pin` | Event day'in olmazsa olmazı |
| 8 | `rpc_admin_update_organization` | Org yönetimi |
| 9 | `rpc_admin_delete_organization` | Hard delete; shape drift = silinmeyen org |

**Çıktı dizini:** `sql/tests/rpcs/contracts/` (yeni)

**Dosya yapısı:**

```sql
BEGIN;
SELECT plan(N);

-- 1. Function exists with expected signature
SELECT has_function('public', 'rpc_admin_delete_organization', ARRAY['uuid']);
SELECT function_returns('public', 'rpc_admin_delete_organization', ARRAY['uuid'], 'jsonb');

-- 2. Unauthorized caller rejected
SELECT throws_ok(
  $$ SELECT rpc_admin_delete_organization('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'P0001', -- expected error_code
  'caller is not super admin'
);

-- 3. Happy path returns expected shape (if applicable)
-- ... (uses _helpers.sql seed_two_orgs + become_super)

SELECT * FROM finish();
ROLLBACK;
```

**Bonus:** `rpc_admin_verify_audit_chain` için tamper-then-detect testi — bir audit_log satırını değiştir, fonksiyon "broken chain" döndürsün.

**Doğrulama:** Her dosya Supabase MCP `execute_sql` ile vera-demo'da çalıştırılır, `SELECT * FROM finish()` çıktısı temiz (tüm `ok` satırları) olmalı.

**RUNNING.md güncellemesi:** Yeni `contracts/` klasörü dokümante edilir.

---

### Parça D — Functional migration CI (Pazartesi)

**Hedef:** Her PR'da migration'ların fresh bir Postgres'e apply edilip pg_prove'un geçtiğini doğrulayan CI job.

**Çıktı:** `.github/workflows/migration-ci.yml` (yeni)

**Yaklaşım:**

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s

steps:
  - checkout
  - psql: CREATE EXTENSION IF NOT EXISTS pgcrypto; pgtap;
  - psql: apply 001..009 sırasıyla
  - run: pg_prove sql/tests/**/*.sql
```

**Detaylar Pazartesi gecesi prompt'ta** — `prompts/D-functional-migration-ci.md`.

---

### Parça E — Hook orchestrator hardening (Pazartesi)

**Hedef:** 3 kritik hook orchestrator test'ini mock-tautology'den integration-like test'e dönüştür.

**Kapsam:**

| # | Hook | Mevcut test zayıflığı | Yeni yaklaşım |
|---|---|---|---|
| 1 | `src/admin/hooks/useAdminData.js` | Mock'lanmış API'ler, tek-path happy | Partial-failure fake RPC surface (getScores succeeds, getProjectSummary fails) |
| 2 | `src/jury/useJuryState.js` | 14+ API mocked, tek happy path | PIN mismatch, token expiry, auth error path'leri |
| 3 | `src/admin/hooks/useSettingsCrud.js` | (mevcutsa) benzer | Partial-failure + concurrent mutation |

**Fake RPC surface pattern:**

```js
// Test fixture: bir sahte adminApi surface
const fakeApi = createFakeApi({
  getScores: { success: true, data: [...] },
  getProjectSummary: { success: false, error: { code: 'PGRST301', ... } },
});
// Hook fakeApi ile render edilir; kullanıcı-görünür error state doğrulanır
```

**Risk:** Yanlış yazma = false confidence. **Opus review subagent'ı zorunlu** — her commit'ten önce.

**Detaylar:** `prompts/E-hook-orchestrator-hardening.md`.

---

## Subagent dispatch planı

### Cumartesi

```text
Parça A sonu:
  Agent(subagent_type="feature-dev:code-reviewer",
        prompt="Review ci.yml change; is the workflow sane?
                Any missing steps? Will it actually catch regressions?")

Parça B başı:
  3 paralel Agent dispatch (tek mesaj, 3 tool call):
    Agent(model="sonnet", subagent_type="general-purpose",
          prompt=<prompts/B1-edge-auth-admin-group.md içeriği>)
    Agent(model="sonnet", subagent_type="general-purpose",
          prompt=<prompts/B2-edge-auth-audit-cron-group.md içeriği>)
    Agent(model="sonnet", subagent_type="general-purpose",
          prompt=<prompts/B3-edge-auth-email-jury-group.md içeriği>)

Parça B sonu:
  Agent(subagent_type="feature-dev:code-reviewer", model=default Opus,
        prompt="Review the 30 new edge function tests. Any tautologies?
                Any mocks hiding real bugs?")

Parça C sonu:
  Agent(subagent_type="feature-dev:code-reviewer",
        prompt="Review the 9 pgTAP contract tests. Do they actually pin
                meaningful contracts or just assert trivially?")
```

### Pazartesi

```text
Parça D başı:
  Agent(model="sonnet", subagent_type="general-purpose",
        prompt=<prompts/D-functional-migration-ci.md içeriği>)

Parça E başı:
  Agent(model="sonnet", subagent_type="general-purpose",
        prompt=<prompts/E-hook-orchestrator-hardening.md içeriği>)

Parça E sonu (ZORUNLU):
  Agent(subagent_type="feature-dev:code-reviewer",
        prompt="Review hook orchestrator test rewrites.
                Do they catch what the old mocks hid?
                Or do they create new tautologies?
                Be harsh — false confidence is worse than no test.")
```

---

## Sabah kullanıcısı için action items

Sabah uyandığında beklediğin paket:

1. **Branch:** `qa/p0-autonomous-session` (lokal + origin)
2. **PR:** Açık, Cumartesi bölümü hazır (A+B+C). Pazartesi parçaları gelince aynı PR'a eklenir.
3. **Raporlar:**
   - `docs/superpowers/plans/2026-04-25-p0-test-hardening/implementation_reports/SESSION-REPORT.md` — ana rapor
   - `parca-A-review.md`, `parca-B-review.md`, `parca-C-review.md` — code review çıktıları
4. **CI durumu:**
   - Yeşilse → PR merge-ready, sen sabah "Merge" butonuna basarsın
   - Kırmızıysa → Pazartesi ilk iş düzeltme, rapor detayını okursun

Sabah checklist:

```text
[ ] PR'ı GitHub'da aç
[ ] CI run'larını kontrol et (ci.yml + e2e.yml)
[ ] SESSION-REPORT.md'yi oku (ne yapıldı, neyi atladım, neden)
[ ] parca-*-review.md'leri oku (subagent review bulguları)
[ ] CI yeşilse → Merge
[ ] CI kırmızıysa → bana anlat, düzeltirim (Pazartesi kota dolunca)
```

---

## Referanslar

- **Audit raporu (motivasyon):** `docs/qa/vera-test-audit-report.md`
- **Mevcut pgTAP pattern:** `sql/tests/RUNNING.md`, `sql/tests/_helpers.sql`
- **Edge function test harness:** `supabase/functions/_test/harness.ts`, `mock-supabase.ts`
- **CI referans:** `.github/workflows/e2e.yml` (aktif, işleyen örnek)
- **Proje kuralları:** `CLAUDE.md`

---

**Plan sonu.** Yürütme `implementation_reports/SESSION-REPORT.md`'de loglanır.
