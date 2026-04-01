# PostgREST Migration — Session Summary

**Date:** 2026-04-01
**Branch:** `feature/db-rest-migration` → merged to `main`
**Commits:** `b33d3c8`, `94dd654`

---

## Ne Yapıldı

### 1. SQL Migrations: 23 → 4

Eski 23 incremental migration dosyası (RPC tabanlı, `tenant`/`semester` adlandırmalı) silindi.
Yerlerine 4 konsolide dosya yazıldı:

| Dosya | İçerik |
|---|---|
| `sql/migrations/001_schema.sql` | 14 tablo, index, constraint |
| `sql/migrations/002_rls_policies.sql` | Multi-tenant RLS politikaları |
| `sql/migrations/003_jury_rpcs.sql` | 4 kalan RPC (jury auth, token, score upsert, approve) |
| `sql/migrations/004_triggers.sql` | `updated_at` + audit log trigger'ları |
| `sql/seeds/001_seed.sql` | Demo verisi: org, period, juror, project, score |

### 2. API Katmanı: RPC → PostgREST

`supabase.rpc()` çağrıları kaldırıldı, `supabase.from().select/insert/update/delete` ile değiştirildi.

**Silinen dosyalar:**

- `src/shared/api/transport.js` (RPC proxy dispatch)
- `src/shared/api/adminApi.js` (40+ RPC wrapper)
- `src/shared/api/semesterApi.js`
- `supabase/functions/rpc-proxy/index.ts` (Edge Function)

**Yeniden yazılan dosyalar** (`src/shared/api/admin/`):
`auth.js`, `profiles.js`, `organizations.js`, `periods.js`, `scores.js`,
`projects.js`, `jurors.js`, `tokens.js`, `export.js`, `audit.js`, `index.js`

**Yeni dosyalar:**

- `src/shared/api/admin/frameworks.js` — per-period accreditation framework desteği
- `src/shared/api/admin/organizations.js` — `tenants.js` yerine PostgREST tabanlı
- `src/shared/api/admin/periods.js` — `semesters.js` yerine

### 3. İsimlendirme Değişiklikleri

| Eski | Yeni | Kapsam |
|---|---|---|
| `semester` | `period` | UI, hooks, storage keys, component adları |
| `tenant` | `organization` | API modülleri, hook adları, UI |
| `juror_inst` | `affiliation` | Jury flow, storage, test fixture'ları |
| `SemesterStep.jsx` | `PeriodStep.jsx` | Jury step component |
| `TrendSemesterSelect.jsx` | `TrendPeriodSelect.jsx` | Analytics |
| `useManageSemesters.js` | `useManagePeriods.js` | Admin hook |
| `semesterFormat.js` | `periodFormat.js` | Utility |
| `semesterSort.js` | `periodSort.js` | Utility |
| `currentSemesterId` prop | `currentPeriodId` prop | ManageProjectsPanel |

### 4. Testler: 427/427 Geçiyor

Tüm 53 test dosyası güncellendi. Düzeltilen hatalar:

- `tenantsApi.mapping.test.js` — `transport.js` silindiği için tamamen yeniden yazıldı; `organizations.js` + PostgREST mock pattern kullanıyor
- `ManageProjectsPanel.test.jsx` — `currentSemesterId` → `currentPeriodId` prop adı düzeltmesi
- `qa-catalog.json` — 4 yeni SQL idempotency test ID'si eklendi

---

## Kalan İş (E2E)

Dokümante edildi, henüz yapılmadı:

1. Admin login E2E — `window.prompt` yerine Supabase Auth email/password
2. Jury entry E2E — `jury_gate` (entry token) adımı önce geliyor
3. E2E Supabase instance'a yeni migration'ları apply et
4. CI secrets ekle: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
5. Tenant isolation E2E testleri

---

## DB'de Henüz Yapılmayan

Yeni migration dosyaları yazıldı ama production/staging Supabase instance'a **henüz apply edilmedi**.
`001_schema.sql` → `004_triggers.sql` sırayla çalıştırılacak (fresh DB için).
