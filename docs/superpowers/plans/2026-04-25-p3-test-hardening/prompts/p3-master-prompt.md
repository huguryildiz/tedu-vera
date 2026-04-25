# P3 Master Prompt — 4 Paralel Test Grubu

Sen VERA projesinin (multi-tenant jury evaluation platform) test mühendisisin.
P0+P1+P2 sprint'lerini tamamladık. P3 olarak 4 paralel grubu aynı anda başlatacaksın.
Her grubu ayrı subagent olarak çalıştır.

## Temel Kurallar

- Commit/push yapma. Değişiklikleri bitir, sonucu raporla.
- `qaTest()` kullan, bare `it()` değil. `qa-catalog.json`'a önce ID ekle.
- supabaseClient mock: `vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }))`
- MCP Supabase: `kmprsxrofnemmsryjhfj` (vera-demo project_id)

---

## GRUP D1 — RPC Contract pgTAP (en yüksek değer)

**Dosya:** `sql/tests/rpcs/contracts/`

Şu an 15 dosya var (P0-C + P1-9). 30 tane daha RPC pinlenmemiş.

Önce pinlenmemiş RPC'leri belirle:

```bash
grep -rE "CREATE OR REPLACE FUNCTION rpc_" sql/migrations/005_rpcs_jury.sql sql/migrations/006a_rpcs_admin.sql sql/migrations/006b_rpcs_admin.sql | grep -v "RETURNS TRIGGER"
```

Mevcut contract test pattern'ini (`sql/tests/rpcs/contracts/jury_authenticate.sql`) aynen takip et:

- `BEGIN; SELECT plan(N); ... ROLLBACK;` formatı
- Her RPC için ayrı dosya
- En az 8-10 assertion: wrong types, missing params, auth bypass attempt, happy path

**Hedef:** 10-15 RPC daha pinle. Önceliğe göre sırala:

1. Önce para-critical (`publish_period`, `generate_entry_token`, `delete_organization`)
2. Sonra yönetim RPCs (`list_periods`, `get_scores`, `upsert_period_criterion`)

Bitince: vera-demo'ya karşı her dosyayı `mcp__claude_ai_Supabase__execute_sql` ile doğrula.

---

## GRUP D2+D3+D4+D5 — Trigger/FK/RLS pgTAP

**Mevcut:** `sql/tests/triggers/triggers.sql` (6 assertion var, genişlet)
**Yeni dosyalar:**
- `sql/tests/triggers/updated_at.sql`
- `sql/tests/constraints/fk_cascade.sql`
- `sql/tests/rls/public_select.sql`

### D2 — `trigger_set_updated_at`

Updated_at trigger olan her tabloda (`projects`, `jurors`, `periods`, `organizations`, `memberships`, `juror_period_auth`, `score_sheets`, `score_sheet_items`, `audit_log`):

UPDATE yapıp `updated_at`'in gerçekten değiştiğini doğrula. Pattern: `sql/tests/triggers/triggers.sql`'daki mevcut testler gibi BEGIN/ROLLBACK block.

### D3 — `trigger_clear_grace_on_email_verify`

Önce trigger'ı incele:

```bash
grep -A 20 "clear_grace" sql/migrations/003_helpers_and_triggers.sql
```

Test:

```sql
UPDATE jurors SET email_verified_at = now() WHERE email_verified_at IS NULL;
```

Ardından `grace_until IS NULL` veya geçmiş olduğunu kontrol et.

### D4 — FK CASCADE

- Organization silinince `memberships`, `periods`, `jurors` da silinmeli.
- Period silinince `score_sheets`, `period_criteria` da silinmeli.
- BEGIN/ROLLBACK içinde INSERT → DELETE parent → SELECT count = 0 doğrula.

### D5 — Public RLS

`period_criteria_select_public`, `period_outcomes_select_public`, `juror_period_auth_select_public`:

vera-demo'da anon rolüyle SELECT dene:

```sql
SET ROLE anon; SELECT * FROM period_criteria LIMIT 1;
```

RLS politikası var mı ve anon'a izin veriyor mu doğrula.

---

## GRUP A1+A4+A6 — Unit Test Gap'leri

### A1 — `useAdminRealtime` subscription/cleanup/reconnect

**Dosya:** `src/admin/shared/__tests__/useAdminRealtime.test.js` (yeni)
**Hook:** `src/admin/shared/useAdminRealtime.js`

Test et:
- Subscription açılıyor mu?
- Cleanup'ta unsubscribe çağrılıyor mu?
- `orgId` değişince yeniden subscribe mi?

Mock: `supabase.channel().on().subscribe()` chain'ini.

### A4 — `getOutcomeAttainmentTrends` unit test

**Dosya:** `src/admin/features/analytics/__tests__/getOutcomeAttainmentTrends.test.js` (yeni)
**Fonksiyon:** `src/shared/api/admin/` içinde bul (`grep -r "getOutcomeAttainmentTrends" src/shared/api/`)

En az 6 test: empty input, single period, multiple periods, tied scores, all-zero, expected percentages.

### A6 — Auth session refresh

**Dosya:** `src/shared/auth/__tests__/AuthProvider.sessionRefresh.test.jsx` (yeni)

Test et:
- `onAuthStateChange` TOKEN_REFRESHED event → state güncelleniyor mu?
- `onAuthStateChange` SIGNED_OUT → clearState çağrılıyor mu?
- remember-me flag localStorage'a kaydediliyor mu?

Mock: `supabase.auth.onAuthStateChange`, `supabase.auth.getSession`

---

## GRUP B1+B3 — E2E Gap'leri

### B1 — Juror batch import

**Dosya:** `e2e/admin/juror-batch-import.spec.ts` (yeni)

Flow:
1. Admin CSV upload (veya API üzerinden batch insert)
2. `jurors` tablosunda doğru sayıda satır var mı?

Fixture: `adminClient` ile organizasyona bağlı bir period oluştur, CSV formatında 3 juror insert et.

Doğrulama: DB'de 3 juror satırı, her birinin `organization_id` doğru.

### B3 — Realtime admin update

**Dosya:** `e2e/admin/realtime-score-update.spec.ts` (yeni)

Flow:
1. İki browser context aç. Context A admin panelde.
2. Context B (juror) bir skor yazar (veya `adminClient.from('score_sheet_items').insert(...)` ile direkt tetikle).
3. Context A'da yeni skor Realtime kanalı üzerinden gelip gelmediğini doğrula.

Timeout: 15000ms

---

## Rapor

Her grup bitince kısa bir rapor yaz:

- Kaç test eklendi
- vera-demo'da kaç assertion geçti (D grubu için)
- Varsa başarısız olan şeylerin listesi

---

## Bekleyen İlişkili İşler (memory'den)

- **Taxonomy orphan tarama** (audit log) — `project_audit_remaining_work.md`'da bekliyor
- **buildAuditParams filter validation** — A9 ile aynı kapsamda

Bu ikisi audit log sisteminin son %5'i. P3 sırasında zaman kalırsa eklenebilir, kalmazsa P4'e bırakılır.
