# Google OAuth + Remember Me Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth sign-in and "Remember me" session persistence to admin login.

**Architecture:** Supabase native OAuth via `signInWithOAuth({ provider: 'google' })`. Remember me controls session persistence by clearing localStorage after login when unchecked. New Google users see a profile completion form before entering the tenant application flow.

**Tech Stack:** React, Supabase Auth, Supabase JS SDK v2

**Spec:** `docs/superpowers/specs/2026-03-27-google-oauth-remember-me-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/shared/storage/keys.js` | Modify | Add `ADMIN_REMEMBER_ME` key |
| `src/shared/Icons.jsx` | Modify | Add `GoogleIcon` component |
| `src/styles/admin-auth.css` | Modify | Google button, divider, checkbox, complete-profile styles |
| `src/components/auth/LoginForm.jsx` | Modify | Remember me checkbox, Google button, "or" divider |
| `src/lib/supabaseClient.js` | Modify | Export helper to clear persisted session |
| `src/shared/auth/AuthProvider.jsx` | Modify | `signInWithGoogle`, `profileIncomplete` state, `completeProfile` method |
| `src/components/auth/CompleteProfileForm.jsx` | Create | Profile completion form for first-time Google users |
| `src/App.jsx` | Modify | Route to CompleteProfileForm, pass Google handler to LoginForm |

---

### Task 1: Storage Key + Google Icon

**Files:**
- Modify: `src/shared/storage/keys.js:15` (add key before closing brace)
- Modify: `src/shared/Icons.jsx:1172` (add GoogleIcon before end of file)

- [ ] **Step 1: Add ADMIN_REMEMBER_ME storage key**

In `src/shared/storage/keys.js`, add the key inside the `KEYS` object:

```js
  ADMIN_ACTIVE_TENANT: "admin.active_tenant_id",
  ADMIN_REMEMBER_ME: "admin.remember_me",
};
```

- [ ] **Step 2: Add GoogleIcon to Icons.jsx**

Append before end of file in `src/shared/Icons.jsx`. This is a multi-color logo, so it does NOT use `currentColor` — it uses the official Google brand colors:

```jsx
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/storage/keys.js src/shared/Icons.jsx
git commit -m "feat(auth): add ADMIN_REMEMBER_ME storage key and GoogleIcon"
```

---

### Task 2: CSS Styles

**Files:**
- Modify: `src/styles/admin-auth.css` (append new sections before responsive block at line 683)

- [ ] **Step 1: Add styles for remember-me, divider, Google button, and complete-profile form**

Insert before the `/* Responsive */` media query section (before line 683) in `src/styles/admin-auth.css`:

```css
/* ── Remember me checkbox ─────────────────────────────────── */

.admin-auth-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--gray-700);
  cursor: pointer;
  user-select: none;
  margin: -4px 0 2px;
}

.admin-auth-remember input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--brand-600);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.admin-auth-remember-hint {
  font-size: 11px;
  color: var(--gray-500);
  margin-left: auto;
}

/* ── OAuth divider ────────────────────────────────────────── */

.admin-auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
}

.admin-auth-divider::before,
.admin-auth-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--gray-300);
}

.admin-auth-divider span {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-500);
}

/* ── Google sign-in button ────────────────────────────────── */

.admin-auth-google {
  width: 100%;
  height: 50px;
  border-radius: 14px;
  background: #fff;
  color: var(--text-900);
  border: 1.5px solid var(--gray-300);
  font-family: var(--font-ui);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background 150ms ease;
}
.admin-auth-google:hover:not(:disabled) {
  border-color: var(--gray-400);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  background: var(--gray-50);
}
.admin-auth-google:focus-visible:not(:disabled) {
  box-shadow: var(--btn-focus-ring-brand);
}
.admin-auth-google:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Complete profile form ────────────────────────────────── */

.admin-auth-profile-readonly {
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--gray-500);
  padding: 12px 16px;
  background: var(--gray-100);
  border-radius: 12px;
  border: 1.5px solid var(--gray-200);
}
```

- [ ] **Step 2: Update responsive section for new elements**

Inside the `@media (max-width: 540px)` block (around line 684), add:

```css
  .admin-auth-google {
    height: 46px;
    border-radius: 12px;
    font-size: 14px;
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/admin-auth.css
git commit -m "style(auth): add Google button, remember-me, divider, profile-complete styles"
```

---

### Task 3: Remember Me + Google Button in LoginForm

**Files:**
- Modify: `src/components/auth/LoginForm.jsx`

- [ ] **Step 1: Add remember-me state and Google icon import**

At top of `LoginForm.jsx`, update imports and add props:

```jsx
import { useState } from "react";
import { EyeIcon, EyeOffIcon, ShieldUserIcon, GoogleIcon } from "../../shared/Icons";
import AlertCard from "../../shared/AlertCard";
import { KEYS } from "../../shared/storage/keys";
```

Update the function signature to accept new props:

```jsx
export default function LoginForm({ onLogin, onGoogleLogin, onSwitchToRegister, onForgotPassword, error: externalError, loading: externalLoading }) {
```

Add remember-me state after existing state declarations (after line 16):

```jsx
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem(KEYS.ADMIN_REMEMBER_ME) === "true"; }
    catch { return false; }
  });
```

- [ ] **Step 2: Pass rememberMe to onLogin**

Update the `handleSubmit` function to pass `rememberMe`:

```jsx
    try {
      await onLogin(email.trim(), password, rememberMe);
    } catch (err) {
```

- [ ] **Step 3: Add Google login handler**

Add a handler function after `handleSubmit`:

```jsx
  async function handleGoogleLogin() {
    setError("");
    try {
      // Persist remember-me preference before redirect
      try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
      catch {}
      await onGoogleLogin(rememberMe);
    } catch (err) {
      const raw = extractErrorText(err);
      setError(raw || "Google sign-in failed. Please try again.");
    }
  }
```

- [ ] **Step 4: Add remember-me checkbox to the form JSX**

Insert after the password label (after line 122, before the submit button):

```jsx
      <label className="admin-auth-remember">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => {
            setRememberMe(e.target.checked);
            try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(e.target.checked)); }
            catch {}
          }}
          disabled={isLoading}
        />
        <span>Remember me</span>
        <span className="admin-auth-remember-hint">Session stays active for 30 days</span>
      </label>
```

- [ ] **Step 5: Add "or" divider and Google button after submit button**

Insert after the submit button (after line 126):

```jsx
      <div className="admin-auth-divider"><span>or</span></div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="admin-auth-google"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LoginForm.jsx
git commit -m "feat(auth): add remember-me checkbox and Google sign-in button to LoginForm"
```

---

### Task 4: Supabase Client Session Helper

**Files:**
- Modify: `src/lib/supabaseClient.js`

- [ ] **Step 1: Add session-clearing helper**

Replace the contents of `src/lib/supabaseClient.js` with:

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Remove persisted Supabase session from localStorage.
 * Used when "Remember me" is unchecked — keeps session in memory only
 * so it expires when the browser is closed.
 */
export function clearPersistedSession() {
  try {
    const prefix = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    });
  } catch {
    // Storage unavailable or URL parsing failed — silently ignore
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabaseClient.js
git commit -m "feat(auth): add clearPersistedSession helper for remember-me control"
```

---

### Task 5: AuthProvider — Google OAuth + Profile Incomplete Detection

**Files:**
- Modify: `src/shared/auth/AuthProvider.jsx`

- [ ] **Step 1: Add import for clearPersistedSession and KEYS**

At line 13, update imports:

```jsx
import { supabase, clearPersistedSession } from "../../lib/supabaseClient";
```

Add after line 15:

```jsx
import { KEYS } from "../storage/keys";
```

- [ ] **Step 2: Add profileIncomplete state**

After line 52 (existing state declarations), add:

```jsx
  const [profileIncomplete, setProfileIncomplete] = useState(false);
```

- [ ] **Step 3: Add profile-incomplete detection in handleAuthChange**

Inside the `handleAuthChange` callback, after the membership fetch and tenant list setup (after the block that sets `setTenants(tenantList)`), add profile-incomplete detection. Find the section where `tenantList` is set and add right after:

```jsx
      // Detect first-time Google user needing profile completion
      const provider = newSession.user.app_metadata?.provider;
      const profileCompleted = newSession.user.user_metadata?.profile_completed;
      if (provider === "google" && tenantList.length === 0 && !profileCompleted) {
        setProfileIncomplete(true);
      } else {
        setProfileIncomplete(false);
      }
```

- [ ] **Step 4: Add remember-me session clearing in handleAuthChange**

After `setLoading(false)` at the end of the `handleAuthChange` callback (around line 158), add:

```jsx
      // If "Remember me" was not checked, clear persisted session
      try {
        if (localStorage.getItem(KEYS.ADMIN_REMEMBER_ME) !== "true") {
          clearPersistedSession();
        }
      } catch {}
```

- [ ] **Step 5: Add signInWithGoogle method**

After the `signIn` method (after line 218), add:

```jsx
  const signInWithGoogle = useCallback(async (rememberMe = false) => {
    // Persist preference before redirect (checked in handleAuthChange after redirect)
    try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
    catch {}
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}?page=admin`,
      },
    });
    if (error) throw error;
    return data;
  }, []);
```

- [ ] **Step 6: Add completeProfile method**

After `signInWithGoogle`, add:

```jsx
  const completeProfile = useCallback(async ({ name, university, department, tenantId }) => {
    // Update user metadata to mark profile as completed
    const { error: metaError } = await supabase.auth.updateUser({
      data: { profile_completed: true, name },
    });
    if (metaError) throw metaError;

    // Submit tenant application (same RPC as registration)
    const { submitAdminApplication } = await import("../api/admin/auth");
    await submitAdminApplication({
      tenantId,
      email: user.email,
      password: "", // No password — Google auth user
      name,
      university,
      department,
    });

    setProfileIncomplete(false);
  }, [user]);
```

- [ ] **Step 7: Update signIn to handle rememberMe**

Update the existing `signIn` method:

```jsx
  const signIn = useCallback(async (email, password, rememberMe = false) => {
    try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
    catch {}
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!rememberMe) clearPersistedSession();
    return data;
  }, []);
```

- [ ] **Step 8: Expose new state and methods in context value**

Update the `value` useMemo (around line 287) to include new properties:

```jsx
  const value = useMemo(() => ({
    user,
    session,
    tenants,
    activeTenant,
    setActiveTenant,
    displayName,
    setDisplayName,
    isSuper,
    isPending,
    profileIncomplete,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshMemberships,
    completeProfile,
  }), [user, session, tenants, activeTenant, setActiveTenant, displayName, setDisplayName,
       isSuper, isPending, profileIncomplete, loading, signIn, signInWithGoogle, signUp, signOut,
       resetPassword, updatePassword, refreshMemberships, completeProfile]);
```

- [ ] **Step 9: Commit**

```bash
git add src/shared/auth/AuthProvider.jsx
git commit -m "feat(auth): add Google OAuth, profile-incomplete detection, remember-me in AuthProvider"
```

---

### Task 6: CompleteProfileForm Component

**Files:**
- Create: `src/components/auth/CompleteProfileForm.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/auth/CompleteProfileForm.jsx`:

```jsx
// src/components/auth/CompleteProfileForm.jsx
// ============================================================
// Profile completion form for first-time Google OAuth users.
// Collects university, department, and tenant selection before
// submitting a tenant application.
// ============================================================

import { useState, useEffect } from "react";
import { UserIcon } from "../../shared/Icons";
import AlertCard from "../../shared/AlertCard";
import TenantSearchDropdown from "./TenantSearchDropdown";
import { listTenantsPublic } from "../../shared/api";

export default function CompleteProfileForm({ user, onComplete, onSignOut }) {
  const [fullName, setFullName] = useState(user?.name || "");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [tenantId, setTenantId] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    listTenantsPublic()
      .then((data) => { if (active) setTenants(data || []); })
      .catch(() => {})
      .finally(() => { if (active) setTenantsLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!tenantId) { setError("Please select a department to apply to."); return; }

    setLoading(true);
    try {
      await onComplete({
        name: fullName.trim(),
        university: university.trim(),
        department: department.trim(),
        tenantId,
      });
    } catch (err) {
      setError(String(err?.message || "Failed to complete profile. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-auth-form" noValidate>
      <div className="admin-auth-header">
        <div className="premium-icon-square" aria-hidden="true"><UserIcon /></div>
        <h2 className="admin-auth-title">Complete Your Profile</h2>
        <p className="admin-auth-subtitle">
          One more step before you can start managing your department.
        </p>
      </div>

      {error && <AlertCard variant="error">{error}</AlertCard>}

      <label className="admin-auth-label">
        Email
        <div className="admin-auth-profile-readonly">{user?.email}</div>
      </label>

      <label className="admin-auth-label">
        Full Name
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          disabled={loading}
          className="admin-auth-input"
          autoFocus
        />
      </label>

      <label className="admin-auth-label">
        University
        <input
          type="text"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          placeholder="Your university"
          disabled={loading}
          className="admin-auth-input"
        />
      </label>

      <label className="admin-auth-label">
        Department
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Your department"
          disabled={loading}
          className="admin-auth-input"
        />
      </label>

      <label className="admin-auth-label">
        Apply to Department
        <TenantSearchDropdown
          tenants={tenants}
          value={tenantId}
          onChange={setTenantId}
          loading={tenantsLoading}
          disabled={loading}
        />
      </label>

      <button type="submit" disabled={loading} className="admin-auth-submit">
        {loading ? "Submitting…" : "Submit Application"}
      </button>

      <button type="button" onClick={onSignOut} className="admin-auth-home-link">
        Sign out
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/auth/CompleteProfileForm.jsx
git commit -m "feat(auth): add CompleteProfileForm for first-time Google OAuth users"
```

---

### Task 7: App.jsx — Wire Everything Together

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add import for CompleteProfileForm**

After line 30 (`import RegisterForm`), add:

```jsx
import CompleteProfileForm from "./components/auth/CompleteProfileForm";
```

- [ ] **Step 2: Update handleLogin to pass rememberMe**

Update the `handleLogin` function (line 134):

```jsx
  async function handleLogin(email, password, rememberMe) {
    setAdminAuthError("");
    await auth.signIn(email, password, rememberMe);
  }
```

- [ ] **Step 3: Add handleGoogleLogin function**

After `handleLogin` (after line 137), add:

```jsx
  async function handleGoogleLogin(rememberMe) {
    setAdminAuthError("");
    await auth.signInWithGoogle(rememberMe);
  }
```

- [ ] **Step 4: Add profileIncomplete route**

In the admin routing section, after the `auth.isPending` check (after line 270), add a new condition for profile-incomplete:

```jsx
    // Google user needs to complete profile
    if (auth.profileIncomplete) {
      return (
        <div className="premium-screen">
          <div className="premium-card premium-card--auth-register">
            <CompleteProfileForm
              user={auth.user}
              onComplete={auth.completeProfile}
              onSignOut={handleAdminSignOut}
            />
          </div>
        </div>
      );
    }
```

- [ ] **Step 5: Pass onGoogleLogin to LoginForm**

Update the `<LoginForm>` render (around line 241) to include the new prop:

```jsx
              <LoginForm
                onLogin={handleLogin}
                onGoogleLogin={handleGoogleLogin}
                onSwitchToRegister={() => { setAdminAuthPage("register"); setAdminAuthError(""); }}
                onForgotPassword={() => { setAdminAuthPage("forgot"); setAdminAuthError(""); }}
                error={adminAuthError}
              />
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(auth): wire Google OAuth, remember-me, and profile completion in App routing"
```

---

### Task 8: Verify Build + Manual Test Checklist

- [ ] **Step 1: Run build to verify no compilation errors**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
npm test -- --run
```

Expected: All existing tests pass.

- [ ] **Step 3: Manual test checklist (requires Supabase Google provider configured)**

Verify these flows manually:

1. **Remember me unchecked (default):**
   - Login with email/password → session works → close browser → reopen → should require login again

2. **Remember me checked:**
   - Login with email/password → session works → close browser → reopen → should still be logged in

3. **Google login (existing user):**
   - Click "Sign in with Google" → Google consent → redirected back → Admin Panel loads

4. **Google login (new user):**
   - Click "Sign in with Google" → Google consent → redirected back → CompleteProfileForm shown
   - Fill in details → Submit → Pending Review gate shown

5. **Checkbox persistence:**
   - Check "Remember me" → refresh page → checkbox should still be checked

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(auth): address build/test issues from Google OAuth + remember-me feature"
```
