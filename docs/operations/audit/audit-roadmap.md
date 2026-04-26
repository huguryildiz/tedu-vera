# VERA Audit Log Improvement Roadmap

Bu rapor, VERA'nın mevcut audit logging yapısını kurumsal seviyeye (Premium SaaS) taşımak ve tespit edilen mimari zayıf noktaları gidermek için gereken 5 kritik adımı özetler.

---

## 1. Selective JSONB Diffing (Depolama Optimizasyonu)

> [!WARNING]
> Mevcut trigger yapısı (`057_audit_trigger_hardening.sql`), her `UPDATE` işleminde satırın hem eski hem de yeni halini tam JSON dump olarak kaydeder. Bu, veritabanının logaritmik olarak şişmesine neden olur.

- **Sorun:** 100 kolonluk bir tabloda tek bir kolon değişse bile 200 kolonluk JSON verisi loglanır.
- **Çözüm:** `trigger_audit_log` fonksiyonuna bir `jsonb_diff` helper eklenerek sadece **değişen (delta)** alanların kaydedilmesi.
- **Etki:** Depolama maliyetlerinde %80-%95 tasarruf ve UI'da daha okunabilir "Değişiklik Geçmişi".

## 2. Foreign Key & Deletion Hardening (Operasyonel Esneklik)

> [!CAUTION]
> `audit_logs.user_id` alanı `profiles` tablosuna katı bir Foreign Key ile bağlıdır. Bu, audited bir işlemi olan adminin hesabının silinmesini engeller (Circular Dependency).

- **Sorun:** Bir admini sistemden silmek istediğinizde "audit_logs tablosunda referansı var" hatası alınır. Logu silemezsiniz (append-only), admini de silemezsiniz. Sistem kilitlenir.
- **Çözüm:** `user_id` alanını `ON DELETE SET NULL` yapmak veya admin verisini tamamen snapshot (metadata) üzerinden takip edip Foreign Key bağımlılığını kaldırmak.
- **Etki:** Sorunsuz kullanıcı yönetimi ve regülasyonlara uygun (Right to be Forgotten) hesap silme süreçleri.

## 3. Proxy & IP Trust Integrity (Güvenlik Doğrulaması)

> [!IMPORTANT]
> Mevcut IP yakalama mantığı (`_audit_write`), `X-Forwarded-For` header'ındaki ilk değere körü körüne güvenir.

- **Sorun:** Kötü niyetli bir kullanıcı, HTTP header'ını manipüle ederek logda kendini farklı bir IP'den (örneğin localhost) geliyormuş gibi gösterebilir (IP Spoofing).
- **Çözüm:** Sistemin önündeki trusted proxy (Supabase Edge, Cloudflare vb.) listesinin doğrulanması ve header zincirinin güvenli bir şekilde çözümlenmesi.
- **Etki:** Logların adli bilişim (forensics) açısından "inkar edilemez" (non-repudiation) hale gelmesi.

## 4. External Root Anchoring (Tamper Evidence Güçlendirme)

- **Sorun:** Mevcut hash chain veritabanı içinde yaşar. Veritabanına sızan bir saldırgan, tüm zinciri kendi manipülasyonuna göre yeniden hesaplayıp (re-key) "Chain OK" sonucu üretebilir.
- **Çözüm:** Her saat başı veya her N satırda bir, zincirin son halkasının (root hash) imzalanarak harici bir sisteme (Axiom, AWS CloudWatch veya harici bir webhook) gönderilmesi.
- **Etki:** Veritabanı admininin bile logları fark edilmeden değiştiremeyeceği gerçek bir "immutable ledger" yapısı.

## 5. Reliable Sinking & Failure Recovery (Sistem Güvenirliği)

- **Sorun:** `audit-log-sink` Edge Function'ı şu an "fire and forget" mantığında çalışır. Axiom veya harici sink hata verirse, log harici kopyaya hiç gitmez ve bir daha retry edilmez.
- **Çözüm:** Başarısız olan sink denemelerini `audit_logs` üzerinde bir flag (örn. `synced_to_ext: false`) ile işaretleyip, periyodik bir job ile senkronizasyonu tamamlayan bir sistemin kurulması.
- **Etki:** "No silent drops" (hiçbir kayıt sessizce kaybolmaz) sözünün hem DB hem de offsite yedekler için garanti altına alınması.
