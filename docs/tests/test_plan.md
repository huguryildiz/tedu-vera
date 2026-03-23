# TEDU VERA — Test Stratejisi Planı

## Test Katmanları

### Katman 1 — Unit / Logic
> Hızlı, deterministik. Her push'ta çalışmalı.

- **Pure fonksiyonlar:** `criteriaHelpers`, `scoreHelpers`, `validators`
- **Hook testleri:** `useJuryState`, `useScoreGridData`
- **Utility testleri:** `withRetry`, `api.env`

---

### Katman 2 — Component / Smoke
> Render güvencesi. Bileşenin ayakta kalıp kalmadığını doğrular.

- Her bileşenin `null` / boş prop ile render etmesi
- Kritik UI akışları: `loading`, `error`, `empty state`

---

### Katman 3 — Integration
> Supabase client mock'lanmış ama gerçek sorgu formatında.

- Henüz eksik — öncelik verilebilir
- Hedef: gerçek bağımlılıkla uçtan uca veri akışı

---

### Katman 4 — E2E
> Yavaş, güvenilirlik gerektirir. Sadece kritik user journey'ler.

- Login akışı
- Jüri değerlendirme akışı
- Export işlemi
- Mevcut 6 Playwright spec bu katman için yeterli başlangıç

---

## CI Pipeline Durumu

| Job | Tetikleyici | Durum |
|-----|-------------|-------|
| `test` (Vitest) | Her push / PR | ✅ Aktif |
| `e2e` (Playwright) | `test` başarılı olursa | ✅ Aktif |
| Allure raporu | Her zaman (`always()`) | ✅ Aktif |
| Excel raporu | Her zaman (`always()`) | ✅ Aktif |

---

## Kısa Vadeli İyileştirmeler

- [ ] `src/test/` altındaki duplike test dosyalarını ilgili modüllere taşı
- [ ] CI'a `--coverage` ekle, README'e badge yansıt
- [ ] `e2e: if: true` satırını `ci.yml`'den sil
- [ ] Branch protection'da `e2e` job'ı required status check yap
- [ ] Yeni `GroupSettings` değişikliklerine karşılık component testi ekle
