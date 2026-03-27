# Google OAuth + Remember Me — Design Spec

**Date:** 2026-03-27
**Scope:** Admin login only (jury flow unchanged)
**Approach:** Supabase Native Google OAuth

---

## Context

VERA is evolving toward a SaaS product serving multiple universities. Google OAuth provides frictionless login for institutions using Google Workspace, and "Remember Me" addresses the challenge of remembering passwords for a tool used infrequently (2-3 days/year per semester).

## Features

### 1. Google OAuth (Admin Login)

Google sign-in button added to the existing login form as an alternative to email/password.

#### Existing user flow

1. User clicks "Sign in with Google" on LoginForm
2. `supabase.auth.signInWithOAuth({ provider: 'google' })` triggers Google consent screen
3. Google redirects back; `onAuthStateChange` fires in AuthProvider
4. AuthProvider fetches tenant memberships via existing RPC
5. User lands in Admin Panel (or Pending Review if not yet approved)

#### New user flow (first Google login)

1. User clicks "Sign in with Google" → Google consent → Supabase auto-creates auth account
2. AuthProvider detects: authenticated user + no tenant memberships + no completed profile
3. App shows **CompleteProfileForm** instead of Admin Panel or Pending Review
4. User fills in:
   - Full name (pre-filled from Google `full_name`, editable)
   - University (text input)
   - Department (text input)
   - Tenant selection (existing `TenantSearchDropdown` component)
5. Submit creates a tenant application via existing register RPC
6. User transitions to Pending Review gate (existing flow)

#### Detection logic for "profile incomplete"

A Google-authenticated user needs profile completion when:

- `auth.user` exists (authenticated via Google)
- `tenants` array is empty (no memberships)
- User metadata (`auth.users.raw_user_meta_data`) lacks `profile_completed: true` flag

The `profile_completed` flag is set in Supabase `user_metadata` after the CompleteProfileForm is submitted. This distinguishes "new Google user who hasn't filled the form" from "existing user whose tenant application is pending review."

### 2. Remember Me

Controls whether the session persists after the browser is closed.

#### Behavior

| Checkbox state | Session persistence | Duration |
|---|---|---|
| Unchecked (default) | Memory only — session cleared on browser close | Tab/browser session |
| Checked | localStorage — session survives browser restart | 30 days (Supabase default JWT expiry) |

#### Implementation

- **Storage key:** `admin.remember_me` in localStorage — stores the checkbox preference so it's pre-filled on next visit
- **Session control:** When "Remember me" is unchecked, after successful login, remove the Supabase session from localStorage while keeping it in memory. This makes the session tab-scoped.
- **When checked:** Supabase's default behavior (localStorage persistence) is left intact
- **Applies to both** email/password and Google OAuth login methods

### 3. Login Form UI Changes

New elements added to `LoginForm.jsx` in this order:

1. Email input (existing)
2. Password input (existing)
3. **Remember me checkbox** — between password and submit button
   - Label: "Remember me"
   - Helper text: "Session stays active for 30 days"
4. Sign In button (existing)
5. **"or" divider** — horizontal line with "or" text centered
6. **Google sign-in button** — white background, Google logo, "Sign in with Google" label, matching border-radius and style language
7. Forgot password link (existing)
8. Apply for access link (existing)

## Files Changed

| File | Change |
|---|---|
| `src/lib/supabaseClient.js` | Session persistence control based on remember-me state |
| `src/components/auth/LoginForm.jsx` | Google button, "or" divider, remember me checkbox |
| `src/shared/auth/AuthProvider.jsx` | Google OAuth callback handling, profile-incomplete state detection |
| `src/components/auth/CompleteProfileForm.jsx` | New file — profile completion form for first-time Google users |
| `src/shared/Icons.jsx` | Google SVG icon (if not already present) |
| `src/styles/admin-auth.css` | Styles for Google button, divider, checkbox, complete-profile form |
| `src/shared/storage/keys.js` | `ADMIN_REMEMBER_ME` key constant |
| `src/App.jsx` | Routing condition for CompleteProfileForm display |

## Files NOT Changed

- Jury flow (`src/jury/`) — no changes
- SQL migrations / RPCs — existing register RPC is sufficient
- Supabase Edge Functions — no changes needed

## Prerequisites (Manual, Outside Code)

1. **Google Cloud Console:** Create OAuth 2.0 credentials (client ID + secret)
2. **Supabase Dashboard:** Enable Google provider, paste credentials, configure redirect URIs for each environment (dev, demo, prod)

## Testing Considerations

- Google OAuth requires a real Supabase project with Google provider enabled — not unit-testable with mocks
- Remember me can be unit-tested by verifying localStorage behavior after login
- CompleteProfileForm can be tested like existing RegisterForm (mock Supabase client, verify form submission)
- E2E tests for Google OAuth would require test Google accounts or be skipped in CI
