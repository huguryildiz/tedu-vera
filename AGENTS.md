# AGENTS

Bu repo TED University EE 491/492 Senior Project Jury Portal arayuzudur. Vite + React ile calisir ve backend iletisimi Supabase RPC uzerinden yapilir.

**Kurulum**
- Bagimliliklar eksikse `npm install`.
- Gelistirme sunucusu: `npm run dev`.
- Production build: `npm run build`.
- Build onizleme: `npm run preview`.

**Ortam Degiskenleri**
- `.env.local` icine `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` gerekir. Ayrinti ve aciklama `src/config.js` icinde.

**Onemli Dosyalar**
- Uygulama girisi `src/main.jsx` ve ana ekran `src/App.jsx`.
- Admin paneli `src/AdminPanel.jsx` ve ilgili bileenler `src/admin/`.
- Juri akisi `src/jury/`.
- RPC istemcisi ve alan eslestirmeleri `src/shared/api.js`.
- Degerlendirme kriterleri ve MUDek ayarlari `src/config.js` (tek kaynak).
- Stil dosyalari `src/styles/`.
- Supabase SQL/RPC scriptleri `sql/`.
- Google Apps Script yardimci kodu `google-apps-script.js`.

**Backend Notlari**
- UI kriter id'leri `src/config.js` ile belirlenir.
- DB alan adlari ile eslestirme `src/shared/api.js` icinde yapilir (design -> written, delivery -> oral).
- `sql/` icindeki dosyalar Supabase SQL Editor uzerinden sirayla uygulanmak icin hazirlanmistir.

**Dikkat**
- `dist/` ve `node_modules/` dosyalarini elle duzenleme.
- Kriter degisiklikleri icin yalnizca `src/config.js` kullan.
