# Session 18 — B2: Auth Tests

**Date:** 2026-04-23
**Model:** Sonnet 4.6 (~200k context)
**Scope:** S18 — Fix shared auth tests (AuthProvider, useAuth) + write 9 auth feature test files (3 tests each)

---

## Summary

Faz B2 tamamlandı. `src/auth/shared/` 3 dosya ve `src/auth/features/` 9 feature için 37 yeni test yazıldı. Baseline 139 testten 176'ya çıktı (37 yeni test, 12 dosya). **176/176 test yeşil. 52 dosya, 0 failure.**

---

## Kapsam

### auth/shared — 3 test dosyası

| Dosya | Test sayısı | IDs |
|---|---|---|
| `AuthGuard.test.jsx` | 3 | auth.guard.render · auth.guard.redirect · auth.guard.pass |
| `AuthProvider.test.jsx` | 5 | auth.provider.01–05 |
| `useAuth.test.jsx` | 2 | auth.useAuth.01–02 |

**Toplam: 10 test**

### auth/features — 9 test dosyası (3 test per feature)

| Dosya | Test sayısı | IDs |
|---|---|---|
| `login/__tests__/LoginScreen.test.jsx` | 3 | auth.login.render · auth.login.happy · auth.login.error |
| `register/__tests__/RegisterScreen.test.jsx` | 3 | auth.register.render · auth.register.happy · auth.register.error |
| `forgot-password/__tests__/ForgotPasswordScreen.test.jsx` | 3 | auth.forgot.render · auth.forgot.happy · auth.forgot.error |
| `reset-password/__tests__/ResetPasswordScreen.test.jsx` | 3 | auth.reset.render · auth.reset.happy · auth.reset.error |
| `complete-profile/__tests__/CompleteProfileScreen.test.jsx` | 3 | auth.complete.render · auth.complete.happy · auth.complete.error |
| `verify-email/__tests__/VerifyEmailScreen.test.jsx` | 3 | auth.verify.render · auth.verify.happy · auth.verify.error |
| `pending-review/__tests__/PendingReviewScreen.test.jsx` | 3 | auth.pending.render · auth.pending.happy · auth.pending.error |
| `grace-lock/__tests__/GraceLockScreen.test.jsx` | 3 | auth.grace.render · auth.grace.happy · auth.grace.error |
| `invite/__tests__/InviteAcceptScreen.test.jsx` | 3 | auth.invite.render · auth.invite.happy · auth.invite.error |

**Toplam: 27 test**

---

## Teknik Çözümler

### vi.hoisted() zorunlu kullanım

`vi.mock()` çağrıları Vitest tarafından dosyanın başına hoisted edilir — `const` bildirimleri henüz çalışmamıştır. Bu nedenle mock fonksiyonlarını `vi.mock()` factory içinde referans etmek `Cannot access 'X' before initialization` hatasına yol açar.

Çözüm: Tüm mock fonksiyonları `vi.hoisted()` bloğu içinde tanımlanır:

```js
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock("@/shared/api", () => ({ fn: mockFn }));
```

Bu pattern auth feature testlerinin tamamında uygulandı.

### AuthProvider — tam yeniden yazım

Orijinal `AuthProvider.test.jsx` iki sorunu vardı:
1. Mock değişkenler `vi.hoisted()` olmadan tanımlandığı için temporal dead zone hatası
2. `beforeEach` içinde `require()` çağrısı kullanıyordu (hoisted mock'larla kırılgan)

Çözüm: Tüm mock'lar `vi.hoisted()` ile tanımlandı, `beforeEach` doğrudan hoisted değişkenleri kullandı. Supabase auth mock'u full chain: `getSession`, `onAuthStateChange`, `signInWithPassword`, `signInWithOAuth`, `signOut`, `updateUser`.

### SecurityPolicyContext — LoginScreen için

`LoginScreen`, `useSecurityPolicy()` hook'u ile `emailPassword`, `googleOAuth`, `rememberMe` flag'lerini alır. Form sadece `emailPassword: true` olduğunda render edilir. Mock:

```js
vi.mock("@/auth/shared/SecurityPolicyContext", () => ({
  useSecurityPolicy: () => ({ emailPassword: true, googleOAuth: false, rememberMe: false }),
}));
```

### ResetPasswordScreen — URL state

`ResetPasswordScreen`, `window.location.search` veya `window.location.hash` üzerinden `type=recovery` parametresini bir `useRef` ile bir kez okur (`hasRecoveryToken.current`). MemoryRouter URL'i etkilemez; `window.history.pushState` ile test öncesi set edilmeli:

```js
beforeEach(() => { window.history.pushState({}, "", "?type=recovery"); });
afterEach(() => { window.history.pushState({}, "", "/"); });
```

### VerifyEmailScreen — MemoryRouter + Routes

`VerifyEmailScreen` query param `?token=` okumak için `useSearchParams` kullanır. `MemoryRouter` + `initialEntries` + `Routes/Route` kombinasyonu gerekir:

```jsx
<MemoryRouter initialEntries={[`/verify-email?token=valid-token`]}>
  <Routes>
    <Route path="/verify-email" element={<VerifyEmailScreen />} />
  </Routes>
</MemoryRouter>
```

### Error normalization

Feature screen'lerin çoğu ham hata mesajlarını kullanıcı dostu metne dönüştüren `normalize()` fonksiyonu içerir. Test assertion'ları normalize edilmiş çıktıya göre yazıldı:

- LoginScreen: `"Invalid login credentials"` → `/Invalid email or password/i`
- RegisterScreen: `"org_name_taken"` → `/organization with that name already exists/i`
- VerifyEmailScreen: `"expired"` içeren herhangi bir hata → `/verification link has expired/i`

### InviteAcceptScreen — tam Supabase mock chain

`InviteAcceptScreen` doğrudan `supabase` client'ı kullanır (birden fazla RPC + from chain). Mock `@/shared/api` modülü `supabase` objesini tam hiyerarşiyle export etmeli:

```js
vi.mock("@/shared/api", () => ({
  supabase: {
    auth: { getSession, onAuthStateChange, updateUser },
    from: mockFrom,  // select().eq().in().limit().maybeSingle() chain
    rpc: mockRpc,
  },
}));
```

### CompleteProfileScreen — prop-driven, mock yok

`CompleteProfileScreen` tüm bağımlılıklarını (`user`, `onComplete`, `onSignOut`) prop olarak alır — AuthContext veya API mock'u gereksiz. En temiz test pattern'i bu feature'da uygulandı.

### @testing-library/user-event yok

`@testing-library/user-event` bu projede yüklü değil. Tüm kullanıcı etkileşimleri `fireEvent` ile simüle edildi (`fireEvent.change`, `fireEvent.click`, `fireEvent.submit`).

---

## Sonuç

```
Test Files  52 passed (52)
     Tests  176 passed (176)
  Duration  3.79s
```

Auth katmanının tüm test kapsamı tamamlandı: shared (AuthProvider, AuthGuard, useAuth) + 9 feature (login, register, forgot-password, reset-password, complete-profile, verify-email, pending-review, grace-lock, invite). Bir sonraki adım: S19 — jury tests (useJuryState step machine + 9 step component + writeGroup + lock + autosave).
