# React Router v6 Migration — Tamamlanan İşler

**Tarih:** 2026-04-08
**Branch:** main (değişiklikler commit edilmedi)
**Build durumu:** ✅ `npm run build` başarılı, 0 hata
**Test durumu:** 66 pre-existing failure, sıfır regresyon

---

## Yapılanlar

### Önceden Tamamlanmış (oturum başında mevcut)

Aşağıdaki dosyalar bu oturum öncesinde oluşturulmuştu:

| Dosya | Durum |
|---|---|
| `package.json` | `react-router-dom@^6.28.0` eklendi |
| `src/router.jsx` | Tüm route tanımları — `createBrowserRouter` |
| `src/main.jsx` | `<RouterProvider router={router} />` ile rewire |
| `src/layouts/RootLayout.jsx` | ThemeProvider + AuthProvider + ErrorBoundary + Outlet |
| `src/layouts/AdminRouteLayout.jsx` | Auth gate + sidebar + header + Outlet; `useAdminNav` tabanlı |
| `src/layouts/DemoLayout.jsx` | `/demo/*` altında `setEnvironment("demo")` çağırır |
| `src/guards/AuthGuard.jsx` | Auth olmadan `/admin/*`'a erişimi engeller |
| `src/guards/JuryGuard.jsx` | Session olmadan `/jury/*`'a erişimi engeller; `/eval`'e yönlendirir |
| `src/admin/hooks/useAdminNav.js` | `useAdminTabs` yerine geçer; `useLocation` + `useNavigate` tabanlı |
| `src/LegacyRedirects.jsx` | Eski `?tab=`, `?eval=`, `?admin`, `?explore` URL'lerini yeni path'lere yönlendirir |
| `src/shared/lib/environment.js` | Demo detection: `?explore` kaldırıldı → `/demo` pathname kontrolü |

---

### Bu Oturumda Tamamlanan

#### AdminSidebar.jsx

**Dosya:** `src/admin/layout/AdminSidebar.jsx`

- `isActive(itemKey, adminTab, scoresView)` helper fonksiyonu kaldırıldı
- Prop signature değişti: `{ adminTab, scoresView, setAdminTab, switchScoresView, mobileOpen, onClose }` → `{ currentPage, basePath, mobileOpen, onClose }`
- `import { useNavigate } from "react-router-dom"` eklendi
- `navTo(tab)` ve `navToScores(view)` → tek `navTo(page)` fonksiyonu: `navigate(\`${basePath}/${page}\`)`
- Tüm nav butonlarında aktif state: `isActive(...)` → `currentPage === "key"` kontrolü
- Key mapping: `"grid"` → `"heatmap"`, `"details"` → `"reviews"`, `"pin-lock"` → `"pin-blocking"`

#### AdminHeader.jsx

**Dosya:** `src/admin/layout/AdminHeader.jsx`

- `TAB_LABELS` ve `SCORES_VIEW_LABELS` sözlükleri kaldırıldı
- Prop signature: `{ adminTab, scoresView, ... }` → `{ currentPage, ... }`
- `pageLabel` hesabı: `PAGE_LABELS[currentPage] || "Overview"` (tek sözlük)

#### LandingPage.jsx

**Dosya:** `src/landing/LandingPage.jsx`

- `import { useNavigate } from "react-router-dom"` eklendi
- Prop signature: `({ onStartJury, onAdmin, onSignIn })` → `()`
- `onSignIn()` → `navigate("/login")`
- `onAdmin()` → `navigate("/login")`
- `onStartJury()` → `navigate(demoToken ? \`/eval?t=${demoToken}&env=demo\` : "/eval")`
- `VITE_DEMO_ENTRY_TOKEN` env var'dan token okunuyor

#### JuryGatePage.jsx

**Dosya:** `src/jury/JuryGatePage.jsx`

- `import { useNavigate, useSearchParams } from "react-router-dom"` eklendi
- Prop signature: `({ token, onGranted, onBack })` → `()`
- Token URL'den: `searchParams.get("t")`
- Başarıda: `window.history.replaceState(...); onGranted()` → `navigate("/jury/identity", { replace: true })`
- Geri butonu: `onBack()` → `navigate("/", { replace: true })`

#### AuthProvider.jsx

**Dosya:** `src/auth/AuthProvider.jsx` (satır 328)

- Google OAuth redirect: `${window.location.origin}?admin` → `${window.location.origin}/login`

#### JuryFlow.jsx

**Dosya:** `src/jury/JuryFlow.jsx`

- `import { useNavigate, useLocation } from "react-router-dom"` eklendi
- `STEP_TO_PATH` mapping eklendi:

  ```js
  identity      → "identity"
  period/semester → "period"
  pin           → "pin"
  pin_reveal    → "pin-reveal"
  locked        → "locked"
  progress_check → "progress"
  eval          → "evaluate"
  done          → "complete"
  ```

- `useEffect` ile step → URL sync: `state.step` değişince `navigate("/jury/{seg}", { replace: true })`
- `onBack` prop kaldırıldı → component içinde `const onBack = () => navigate("/", { replace: true })`

#### Dead Code Silindi

- `src/admin/hooks/useAdminTabs.js` — **silindi**
- `src/admin/hooks/useResultsViewState.js` — **silindi**

---

## Kalan İşler

### E2E Testleri (henüz güncellenmedi)

Tüm e2e testleri URL pattern'lerini eski sisteme göre kullanıyor:

| Test dosyası | Gereken değişiklik |
|---|---|
| `e2e/admin-login.spec.ts` | `page.goto("/login")` |
| `e2e/admin-export.spec.ts` | `page.goto("/login")` → navigate |
| `e2e/admin-import.spec.ts` | `page.goto("/login")` → navigate |
| `e2e/admin-results.spec.ts` | `page.goto("/login")` → navigate |
| `e2e/jury-flow.spec.ts` | `page.goto("/eval?t=TOKEN")` |
| `e2e/jury-lock.spec.ts` | `page.goto("/eval?t=TOKEN")` |
| `e2e/tenant-isolation.spec.ts` | URL pattern'leri güncellenmeli |

### Manuel Adım (kullanıcı yapmalı)

- **Supabase Dashboard** → Authentication → URL Configuration → Redirect URLs:
  - Eski: `https://your-app.vercel.app?admin`
  - Yeni: `https://your-app.vercel.app/login`
  - Demo için de geçerli: `https://demo.your-app.vercel.app/login`

### App.jsx (geri dönük uyumluluk)

`src/App.jsx` hâlâ eski routing sistemini içeriyor ama artık production'da kullanılmıyor (sadece `src/shared/__tests__/App.storage.test.jsx` içinde, tam mock ile). İleride test de güncellenirse silinebilir.

---

## Dosya Durumu Özeti

```text
YENİ DOSYALAR:
  src/router.jsx
  src/layouts/RootLayout.jsx
  src/layouts/AdminRouteLayout.jsx
  src/layouts/DemoLayout.jsx
  src/guards/AuthGuard.jsx
  src/guards/JuryGuard.jsx
  src/admin/hooks/useAdminNav.js
  src/LegacyRedirects.jsx

DEĞİŞTİRİLEN DOSYALAR:
  src/main.jsx
  src/shared/lib/environment.js
  src/admin/layout/AdminSidebar.jsx
  src/admin/layout/AdminHeader.jsx
  src/landing/LandingPage.jsx
  src/jury/JuryGatePage.jsx
  src/jury/JuryFlow.jsx
  src/auth/AuthProvider.jsx

SİLİNEN DOSYALAR:
  src/admin/hooks/useAdminTabs.js
  src/admin/hooks/useResultsViewState.js
```
