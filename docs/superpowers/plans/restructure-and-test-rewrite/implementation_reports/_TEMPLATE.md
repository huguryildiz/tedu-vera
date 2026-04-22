# Session N Implementation Summary — [Konu]

**Date:** YYYY-MM-DD
**Status:** Done / In Progress / Blocked
**Build:** ✅ `npm run build` pass (Xs) | ✅ `npm test -- --run` (X pass / X fail) | ❌ blocker var
**Context kullanımı:** ~%XX (Sonnet High ~200k)
**Süre:** X saat

---

## Yapılanlar

- ✅ [Tamamlanan madde 1]
- ✅ [Tamamlanan madde 2]
- ⏸️ [Yarım kalan — gerekçe]
- ❌ [Planlanmıştı ama yapılamadı — gerekçe]

## Oluşturulan Dosyalar

| Dosya | Açıklama |
| ----- | -------- |
| `src/path/to/NewFile.jsx` | [Ne iş yapar] |

## Güncellenen Dosyalar

| Dosya | Değişiklik |
| ----- | ---------- |
| `src/path/to/ExistingFile.jsx` | [Kısa değişiklik özeti] |

## Taşınan Dosyalar (git mv)

| Eski yol | Yeni yol |
| --- | --- |
| `src/admin/pages/X.jsx` | `src/admin/features/x/X.jsx` |

## Silinen Dosyalar

- `src/path/to/deleted.jsx` — [Neden silindi]

---

## Mimari / Logic Notları

[Bu oturumda aldığın kararlar, keşfettiğin bağımlılıklar, cross-feature durumlar, beklenmedik cross-dep'ler, yeniden yapılandırma sırasında tespit edilen kod smell'ler vb. — sonraki oturumun bilmesi gereken her şey.]

## Doğrulama

- [ ] `npm run build` — Exit code 0, X modules bundled
- [ ] `npm run dev` — dev server ayağa kalktı, ilgili sayfa görsel olarak OK
- [ ] `npm test -- --run` — X pass / X fail (baseline karşılaştırması)
- [ ] `grep -rn "eski/yol" src/` — 0 sonuç (import kaçağı yok)
- [ ] `npm run check:no-native-select && npm run check:no-nested-panels` — temiz
- [ ] Görsel smoke: [hangi sayfalar açıldı, kontrol edildi]

## Bilinen Sorunlar / Sonraki Oturuma Devir

- [Varsa açık kalan konular, sonraki oturumun dikkat etmesi gereken yerler]
- [Commit mesajları listesi]

## Git Commit'leri

```
<sha> refactor(admin): move X feature + co-locate CSS
<sha> refactor(admin): move Y feature + co-locate CSS
```

## Parity Tracker Güncellemesi

README'deki "Restructure & Test Tracker" tablosunda bu oturumda değişen satırlar:

| Satır | Eski durum | Yeni durum |
|---|---|---|
| admin/organizations | ⬜ Source, ⬜ CSS, ⬜ Tests | ✅ Source, ✅ CSS, ⬜ Tests |
| admin/jurors | ⬜ Source, ⬜ CSS, ⬜ Tests | ✅ Source, ✅ CSS, ⬜ Tests |

Toplam ilerleme: X / 35 feature taşındı · X / 35 CSS co-located · X / 40 test edildi · X / 11 altyapı.

**README.md'deki tracker tablosu güncellendi mi?** ✅ / ❌

## Sonraki Adım

**Session N+1 — [Konu]**

Plan referansı: `README.md` Faz X.Y
Hedef: [Bir sonraki oturumun kısa özeti]
Dikkat: [Bilinen riskler/karmaşıklıklar]
