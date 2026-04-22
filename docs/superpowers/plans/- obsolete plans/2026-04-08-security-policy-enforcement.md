# Security Policy Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every toggle in the Security Policy drawer to real system behavior — DB reads in RPCs, conditional UI in auth screens, and policy-driven CC in Edge Functions.

**Architecture:** A `SecurityPolicyContext` lives in `src/auth/` and is populated by `AuthProvider` on mount via `getSecurityPolicy()`. All consumers call `useSecurityPolicy()`. The DB migration adds dynamic reads to two RPCs and renames the CC field. Edge Functions are updated last.

**Tech Stack:** React context, Supabase PostgreSQL RPCs, Deno Edge Functions, Resend API.

---

## File Map

| File | Change |
|---|---|
| `sql/migrations/007_security_policy_enforcement.sql` | **Create**: update JSONB default, rename `ccSuperAdminOnPinReset`→`ccOnPinReset`, add `ccOnScoreEdit`, patch two RPCs |
| `src/auth/SecurityPolicyContext.jsx` | **Create**: DEFAULT_POLICY, context, `useSecurityPolicy`, `useUpdatePolicy` |
| `src/auth/AuthProvider.jsx` | **Modify**: fetch policy on mount, enforce `emailPassword`/`googleOAuth` in sign-in methods, wrap children in `SecurityPolicyContext.Provider` |
| `src/admin/pages/SettingsPage.jsx` | **Modify**: call `updatePolicy` after save so context is live |
| `src/auth/screens/LoginScreen.jsx` | **Modify**: conditional Google button, email/password form, remember-me checkbox |
| `src/auth/screens/RegisterScreen.jsx` | **Modify**: dynamic password validation from policy |
| `src/auth/screens/ResetPasswordScreen.jsx` | **Modify**: replace hardcoded `isStrongPassword` with policy-driven version |
| `src/admin/drawers/SecurityPolicyDrawer.jsx` | **Modify**: remove `allowMultiDevice`, rename `ccSuperAdminOnPinReset`→`ccOnPinReset`, add `ccOnScoreEdit` toggle |
| `supabase/functions/request-pin-reset/index.ts` | **Modify**: rename `ccSuperAdminOnPinReset`→`ccOnPinReset` |
| `supabase/functions/request-score-edit/index.ts` | **Modify**: add `shouldCcSuperAdmin()` reading `ccOnScoreEdit`, conditionally gate CC |

---

## Task 1: DB Migration

**Files:**

- Create: `sql/migrations/007_security_policy_enforcement.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- sql/migrations/007_security_policy_enforcement.sql
-- Security policy enforcement: update JSONB default, rename CC field,
-- add ccOnScoreEdit, patch rpc_jury_verify_pin and rpc_admin_generate_entry_token.

-- 1. Update the default JSONB in security_policy to match the new schema.
--    Existing rows are merged so old keys survive; new keys get defaults.
UPDATE security_policy
SET policy = '{
  "googleOAuth": true,
  "emailPassword": true,
  "rememberMe": true,
  "minPasswordLength": 8,
  "maxLoginAttempts": 5,
  "requireSpecialChars": true,
  "tokenTtl": "24h",
  "ccOnPinReset": true,
  "ccOnScoreEdit": false
}'::JSONB || policy
WHERE id = 1
  AND policy IS NOT NULL;

-- Rename ccSuperAdminOnPinReset -> ccOnPinReset in existing row (preserve old value).
UPDATE security_policy
SET policy = (policy - 'ccSuperAdminOnPinReset')
          || jsonb_build_object(
               'ccOnPinReset',
               COALESCE(
                 (policy->>'ccSuperAdminOnPinReset')::BOOLEAN,
                 true
               )
             )
WHERE id = 1
  AND policy ? 'ccSuperAdminOnPinReset';

-- Remove allowMultiDevice from existing row (no longer a policy field).
UPDATE security_policy
SET policy = policy - 'allowMultiDevice'
WHERE id = 1
  AND policy ? 'allowMultiDevice';

-- 2. Patch rpc_jury_verify_pin: read maxLoginAttempts from security_policy.
CREATE OR REPLACE FUNCTION public.rpc_jury_verify_pin(
  p_period_id   UUID,
  p_juror_name  TEXT,
  p_affiliation TEXT,
  p_pin         TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_juror_id        UUID;
  v_auth_row        juror_period_auth%ROWTYPE;
  v_session_token   TEXT;
  v_now             TIMESTAMPTZ := now();
  v_max_attempts    INT;
  v_new_failed      INT;
BEGIN
  -- Read maxLoginAttempts from security_policy; fall back to 5.
  SELECT COALESCE((policy->>'maxLoginAttempts')::INT, 5)
  INTO v_max_attempts
  FROM security_policy
  WHERE id = 1;

  IF NOT FOUND THEN
    v_max_attempts := 5;
  END IF;

  SELECT id INTO v_juror_id
  FROM jurors
  WHERE lower(trim(juror_name)) = lower(trim(p_juror_name))
    AND lower(trim(affiliation)) = lower(trim(p_affiliation));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_not_found')::JSON;
  END IF;

  SELECT * INTO v_auth_row
  FROM juror_period_auth
  WHERE juror_id = v_juror_id AND period_id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'auth_not_found')::JSON;
  END IF;

  IF v_auth_row.is_blocked THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'juror_blocked')::JSON;
  END IF;

  IF v_auth_row.locked_until IS NOT NULL AND v_auth_row.locked_until > v_now THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'pin_locked',
      'locked_until', v_auth_row.locked_until)::JSON;
  END IF;

  -- Verify bcrypt PIN
  IF v_auth_row.pin_hash = crypt(p_pin, v_auth_row.pin_hash) THEN
    v_session_token := encode(gen_random_bytes(32), 'hex');

    UPDATE juror_period_auth
    SET session_token_hash = encode(digest(v_session_token, 'sha256'), 'hex'),
        session_expires_at = v_now + interval '12 hours',
        failed_attempts    = 0,
        locked_until       = NULL,
        locked_at          = NULL,
        last_seen_at       = v_now
    WHERE juror_id = v_juror_id AND period_id = p_period_id;

    RETURN jsonb_build_object(
      'ok',            true,
      'juror_id',      v_juror_id,
      'session_token', v_session_token
    )::JSON;
  ELSE
    v_new_failed := v_auth_row.failed_attempts + 1;

    UPDATE juror_period_auth
    SET failed_attempts = v_new_failed,
        locked_until    = CASE WHEN v_new_failed >= v_max_attempts
                               THEN v_now + interval '30 minutes' ELSE NULL END,
        locked_at       = CASE WHEN v_new_failed >= v_max_attempts
                               THEN v_now ELSE locked_at END
    WHERE juror_id = v_juror_id AND period_id = p_period_id;

    IF v_new_failed >= v_max_attempts THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'pin_locked',
        'failed_attempts', v_new_failed,
        'locked_until', v_now + interval '30 minutes'
      )::JSON;
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_pin',
      'failed_attempts', v_new_failed
    )::JSON;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_jury_verify_pin(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 3. Patch rpc_admin_generate_entry_token: read tokenTtl from security_policy.
CREATE OR REPLACE FUNCTION public.rpc_admin_generate_entry_token(p_period_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_token      TEXT;
  v_token_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_org_id     UUID;
  v_ttl_str    TEXT;
  v_ttl        INTERVAL;
BEGIN
  SELECT organization_id INTO v_org_id FROM periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found';
  END IF;

  IF NOT (
    current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = auth.uid() AND organization_id = v_org_id
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Read tokenTtl from security_policy; fall back to '24h'.
  SELECT COALESCE(policy->>'tokenTtl', '24h')
  INTO v_ttl_str
  FROM security_policy
  WHERE id = 1;

  v_ttl := CASE v_ttl_str
    WHEN '12h' THEN INTERVAL '12 hours'
    WHEN '48h' THEN INTERVAL '48 hours'
    WHEN '7d'  THEN INTERVAL '7 days'
    ELSE            INTERVAL '24 hours'
  END;

  v_token      := gen_random_uuid()::TEXT;
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + v_ttl;

  INSERT INTO entry_tokens (period_id, token_hash, token_plain, expires_at)
  VALUES (p_period_id, v_token_hash, v_token, v_expires_at);

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_generate_entry_token(UUID) TO authenticated;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the SQL above.

Expected: Migration applies without error. Verify with `mcp__claude_ai_Supabase__execute_sql`:

```sql
SELECT policy FROM security_policy WHERE id = 1;
```

Expected output: JSONB with keys `ccOnPinReset`, `ccOnScoreEdit`, no `allowMultiDevice`, no `ccSuperAdminOnPinReset`.

- [ ] **Step 3: Commit**

```bash
git add sql/migrations/007_security_policy_enforcement.sql
git commit -m "feat(db): enforce security policy in RPCs, rename ccOnPinReset, add ccOnScoreEdit"
```

---

## Task 2: SecurityPolicyContext

**Files:**

- Create: `src/auth/SecurityPolicyContext.jsx`

- [ ] **Step 1: Create the context file**

```jsx
// src/auth/SecurityPolicyContext.jsx
// Security policy context. AuthProvider populates this on mount.
// Consumers use useSecurityPolicy() to read the live policy.
// useUpdatePolicy() lets SettingsPage push saves back into context immediately.

import { createContext, useContext } from "react";

export const DEFAULT_POLICY = {
  googleOAuth: true,
  emailPassword: true,
  rememberMe: true,
  minPasswordLength: 8,
  maxLoginAttempts: 5,
  requireSpecialChars: true,
  tokenTtl: "24h",
  ccOnPinReset: true,
  ccOnScoreEdit: false,
};
// allowMultiDevice intentionally omitted — removed from drawer and schema.

export const SecurityPolicyContext = createContext({
  policy: DEFAULT_POLICY,
  updatePolicy: () => {},
});

export const useSecurityPolicy = () => useContext(SecurityPolicyContext).policy;
export const useUpdatePolicy   = () => useContext(SecurityPolicyContext).updatePolicy;
```

- [ ] **Step 2: Verify the file is syntactically correct**

```bash
node --input-type=module < src/auth/SecurityPolicyContext.jsx 2>&1 || echo "parse only — ok if no crash"
```

Expected: no parse error (the file uses JSX so Node will error on JSX syntax, but no import errors).

- [ ] **Step 3: Commit**

```bash
git add src/auth/SecurityPolicyContext.jsx
git commit -m "feat(auth): add SecurityPolicyContext with DEFAULT_POLICY"
```

---

## Task 3: AuthProvider — fetch policy on mount, enforce toggles, wrap in context

**Files:**

- Modify: `src/auth/AuthProvider.jsx`

- [ ] **Step 1: Add imports at the top of AuthProvider.jsx**

After the existing imports (line 18, after `import { DEMO_MODE } from "@/shared/lib/demoMode";`), add:

```js
import { useState } from "react";  // already imported — no change needed
import { getSecurityPolicy } from "@/shared/api";
import { SecurityPolicyContext, DEFAULT_POLICY } from "./SecurityPolicyContext";
```

Note: `useState` is already in the existing import on line 12. Only add the two new lines.

- [ ] **Step 2: Add policy state inside AuthProvider component**

Inside `export default function AuthProvider({ children }) {`, after the existing `const [loading, setLoading] = useState(true);` line (line 70), add:

```js
const [policy, setPolicy] = useState(DEFAULT_POLICY);
```

- [ ] **Step 3: Fetch policy on mount**

Inside the `useEffect` at line 248 (the auth bootstrap effect), add a parallel policy fetch. Insert this **before** the `subscription` line:

```js
// Fetch security policy in parallel with session init (silent fallback).
getSecurityPolicy()
  .then((p) => { if (mountedRef.current && p) setPolicy(p); })
  .catch(() => {});
```

- [ ] **Step 4: Enforce auth toggles in signIn()**

Replace the `signIn` callback (lines 300–310) with:

```js
const signIn = useCallback(async (email, password, rememberMe = false, captchaToken = "") => {
  if (!policy.emailPassword) throw new Error("Email/password login is disabled.");
  try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
  catch {}
  const credentials = captchaToken
    ? { email, password, options: { captchaToken } }
    : { email, password };
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw error;
  if (!rememberMe) clearPersistedSession();
  return data;
}, [policy.emailPassword]);
```

- [ ] **Step 5: Enforce auth toggles in signInWithGoogle()**

Replace the `signInWithGoogle` callback (lines 312–324) with:

```js
const signInWithGoogle = useCallback(async (rememberMe = false) => {
  if (!policy.googleOAuth) throw new Error("Google sign-in is disabled.");
  try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
  catch {}
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}?admin`,
    },
  });
  if (error) throw error;
  return data;
}, [policy.googleOAuth]);
```

- [ ] **Step 6: Expose updatePolicy via context and wrap children**

The `value` memo at line 418 exposes context values through `AuthContext`. We need a **separate** `SecurityPolicyContext.Provider` wrapping `AuthContext.Provider`.

Replace the return statement (lines 445–449) with:

```jsx
const policyContextValue = useMemo(
  () => ({ policy, updatePolicy: setPolicy }),
  [policy]
);

return (
  <SecurityPolicyContext.Provider value={policyContextValue}>
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  </SecurityPolicyContext.Provider>
);
```

Also add `policyContextValue` deps array is self-contained — no change needed to the existing `value` memo.

- [ ] **Step 7: Update the useMemo deps for signIn and signInWithGoogle**

The `value` useMemo at line 418 includes `signIn` and `signInWithGoogle`. They now close over `policy.emailPassword` and `policy.googleOAuth`. Verify the deps array at the bottom of AuthProvider includes both callbacks. No change needed — callbacks are already listed.

- [ ] **Step 8: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: No TypeScript/ESLint errors about missing imports or undefined identifiers.

- [ ] **Step 9: Commit**

```bash
git add src/auth/AuthProvider.jsx
git commit -m "feat(auth): fetch security policy on mount, enforce auth toggles in signIn/signInWithGoogle"
```

---

## Task 4: SettingsPage — call updatePolicy after save

**Files:**

- Modify: `src/admin/pages/SettingsPage.jsx`

- [ ] **Step 1: Import useUpdatePolicy**

At the top of `SettingsPage.jsx`, add to the existing imports:

```js
import { useUpdatePolicy } from "@/auth/SecurityPolicyContext";
```

- [ ] **Step 2: Call the hook inside the component**

Inside the `SettingsPage` component function, near the top with other hook calls, add:

```js
const updatePolicy = useUpdatePolicy();
```

- [ ] **Step 3: Update handleSaveSecurityPolicy (lines 213–217)**

Replace:

```js
const handleSaveSecurityPolicy = useCallback(async (policy) => {
  await setSecurityPolicy(policy);
  setSecurityPolicyState(policy);
  _toast.success("Security policy saved");
}, [_toast]);
```

With:

```js
const handleSaveSecurityPolicy = useCallback(async (policy) => {
  await setSecurityPolicy(policy);
  setSecurityPolicyState(policy);
  updatePolicy(policy);
  _toast.success("Security policy saved");
}, [_toast, updatePolicy]);
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/SettingsPage.jsx
git commit -m "feat(settings): propagate policy save to SecurityPolicyContext immediately"
```

---

## Task 5: SecurityPolicyDrawer — remove allowMultiDevice, update CC fields

**Files:**

- Modify: `src/admin/drawers/SecurityPolicyDrawer.jsx`

- [ ] **Step 1: Update DEFAULT_POLICY in the drawer**

Replace the `DEFAULT_POLICY` constant (lines 21–31):

```js
const DEFAULT_POLICY = {
  googleOAuth: true,
  emailPassword: true,
  rememberMe: true,
  minPasswordLength: 8,
  maxLoginAttempts: 5,
  requireSpecialChars: true,
  tokenTtl: "24h",
  ccOnPinReset: true,
  ccOnScoreEdit: false,
};
```

- [ ] **Step 2: Replace the Jury Access section — remove allowMultiDevice toggle**

Remove the `ToggleRow` for "Allow Multi-Device Jury Sessions" (lines 232–238):

```jsx
{/* DELETE THIS BLOCK */}
<ToggleRow
  title="Allow Multi-Device Jury Sessions"
  desc="Let jurors use the same PIN on multiple devices simultaneously"
  checked={form.allowMultiDevice}
  onChange={(v) => set("allowMultiDevice", v)}
  disabled={saving}
/>
```

- [ ] **Step 3: Replace Notifications section**

Replace the single "CC Me on PIN Reset Requests" `ToggleRow` (lines 240–247) with two rows:

```jsx
<SectionLabel>Notifications</SectionLabel>
<ToggleRow
  title="CC Me on PIN Reset Requests"
  desc="Receive a copy when a juror requests a PIN reset"
  checked={form.ccOnPinReset}
  onChange={(v) => set("ccOnPinReset", v)}
  disabled={saving}
/>
<ToggleRow
  title="CC Me on Score Edit Requests"
  desc="Receive a copy when a juror requests score editing"
  checked={form.ccOnScoreEdit}
  onChange={(v) => set("ccOnScoreEdit", v)}
  disabled={saving}
/>
```

- [ ] **Step 4: Verify no remaining references to allowMultiDevice or ccSuperAdminOnPinReset**

```bash
grep -n "allowMultiDevice\|ccSuperAdminOnPinReset" src/admin/drawers/SecurityPolicyDrawer.jsx
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/admin/drawers/SecurityPolicyDrawer.jsx
git commit -m "feat(drawer): remove allowMultiDevice, add ccOnScoreEdit toggle, rename ccOnPinReset"
```

---

## Task 6: LoginScreen — conditional render based on policy

**Files:**

- Modify: `src/auth/screens/LoginScreen.jsx`

- [ ] **Step 1: Import useSecurityPolicy**

At the top of `LoginScreen.jsx`, add to existing imports:

```js
import { useSecurityPolicy } from "@/auth/SecurityPolicyContext";
```

- [ ] **Step 2: Read policy inside the component**

Inside `export default function LoginScreen(...)`, near the top with other hooks:

```js
const { googleOAuth, emailPassword, rememberMe: rememberMeEnabled } = useSecurityPolicy();
```

- [ ] **Step 3: Conditionally hide email/password form**

Wrap the entire `<form>` block (lines 154–231) and `<div className="login-divider">` (line 233) with a conditional:

```jsx
{emailPassword && (
  <>
    <form onSubmit={handleSubmit} noValidate>
      {/* ... existing form content unchanged ... */}
    </form>
    <div className="login-divider">or</div>
  </>
)}
```

If `emailPassword` is false, the form and divider are hidden.

- [ ] **Step 4: Conditionally hide Remember Me checkbox**

The remember-me checkbox is inside the form. When `rememberMeEnabled` is false, hide it and ensure the flag is never persisted. Wrap the `<div className="form-row">` containing the checkbox:

```jsx
{rememberMeEnabled && (
  <div className="form-row">
    <label className="form-check">
      <input
        type="checkbox"
        checked={rememberMe}
        onChange={(e) => {
          setRememberMe(e.target.checked);
          try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(e.target.checked)); } catch {}
        }}
        disabled={loading}
      />
      {" "}Remember me
    </label>
  </div>
)}
```

- [ ] **Step 5: Conditionally hide Google sign-in button**

Wrap the Google button block (lines 235–244):

```jsx
{googleOAuth && (
  <button
    type="button"
    className="btn btn-google"
    onClick={handleGoogleLogin}
    disabled={loading}
    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%" }}
  >
    {GOOGLE_ICON}
    <span>Continue with Google</span>
  </button>
)}
```

Also conditionally render the divider only when both methods are shown:

```jsx
{emailPassword && googleOAuth && (
  <div className="login-divider">or</div>
)}
```

(This replaces the simpler divider wrapping from Step 3 — refine accordingly so divider only shows when both are visible.)

- [ ] **Step 6: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add src/auth/screens/LoginScreen.jsx
git commit -m "feat(login): conditionally hide Google, email/password form, remember-me based on security policy"
```

---

## Task 7: RegisterScreen — dynamic password validation

**Files:**

- Modify: `src/auth/screens/RegisterScreen.jsx`

- [ ] **Step 1: Import useSecurityPolicy**

```js
import { useSecurityPolicy } from "@/auth/SecurityPolicyContext";
```

- [ ] **Step 2: Read policy and build a dynamic validator**

Inside the component function, after existing hook calls:

```js
const { minPasswordLength, requireSpecialChars } = useSecurityPolicy();

const isValidPassword = (v) => {
  const s = String(v || "");
  if (s.length < minPasswordLength) return false;
  if (requireSpecialChars && !/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};

const passwordPlaceholder = `Min ${minPasswordLength} chars${requireSpecialChars ? ", include a symbol" : ""}`;
```

- [ ] **Step 3: Add password validation before submit**

In `handleSubmit`, after the existing `if (password !== confirmPassword)` check and before `setLoading(true)`, add:

```js
if (!isValidPassword(password)) {
  setError(
    requireSpecialChars
      ? `Password must be at least ${minPasswordLength} characters and include a special character.`
      : `Password must be at least ${minPasswordLength} characters.`
  );
  return;
}
```

- [ ] **Step 4: Use dynamic placeholder**

In the password `<input>` (line 278), replace:

```jsx
placeholder="Min 10 chars, upper, lower, digit, symbol"
```

with:

```jsx
placeholder={passwordPlaceholder}
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/auth/screens/RegisterScreen.jsx
git commit -m "feat(register): dynamic password validation from security policy"
```

---

## Task 8: ResetPasswordScreen — dynamic password validation

**Files:**

- Modify: `src/auth/screens/ResetPasswordScreen.jsx`

- [ ] **Step 1: Import useSecurityPolicy**

```js
import { useSecurityPolicy } from "@/auth/SecurityPolicyContext";
```

- [ ] **Step 2: Replace hardcoded isStrongPassword with policy-driven check**

Remove the top-level `isStrongPassword` function (lines 8–11):

```js
// DELETE:
const isStrongPassword = (v) => {
  const s = String(v || "");
  return s.length >= 10 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
};
```

Inside the component function, add:

```js
const { minPasswordLength, requireSpecialChars } = useSecurityPolicy();

const isValidPassword = (v) => {
  const s = String(v || "");
  if (s.length < minPasswordLength) return false;
  if (requireSpecialChars && !/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};
```

- [ ] **Step 3: Update the validation call and error message in handleSubmit**

Replace (lines 39–41):

```js
if (!isStrongPassword(password)) {
  setError("Password must be at least 10 characters with uppercase, lowercase, digit, and symbol.");
  return;
}
```

With:

```js
if (!isValidPassword(password)) {
  setError(
    requireSpecialChars
      ? `Password must be at least ${minPasswordLength} characters and include a special character.`
      : `Password must be at least ${minPasswordLength} characters.`
  );
  return;
}
```

- [ ] **Step 4: Update placeholder text**

In the password `<input>` (line 88), replace:

```jsx
placeholder="Min 10 chars, upper, lower, digit, symbol"
```

with:

```jsx
placeholder={`Min ${minPasswordLength} chars${requireSpecialChars ? ", include a symbol" : ""}`}
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/auth/screens/ResetPasswordScreen.jsx
git commit -m "feat(reset-password): dynamic password validation from security policy"
```

---

## Task 9: request-pin-reset Edge Function — rename field

**Files:**

- Modify: `supabase/functions/request-pin-reset/index.ts`

- [ ] **Step 1: Rename ccSuperAdminOnPinReset → ccOnPinReset in shouldCcSuperAdmin()**

In the `shouldCcSuperAdmin` function (lines 155–168), replace:

```ts
return data?.policy?.ccSuperAdminOnPinReset !== false;
```

with:

```ts
// Support both old key (ccSuperAdminOnPinReset) and new key (ccOnPinReset) during migration.
const newVal = data?.policy?.ccOnPinReset;
const oldVal = data?.policy?.ccSuperAdminOnPinReset;
const resolved = newVal !== undefined ? newVal : oldVal;
return resolved !== false;
```

Also update the file header comment (line 4–5):

```ts
// CCs the super admin when security_policy.ccOnPinReset is true (default).
```

- [ ] **Step 2: Verify no remaining ccSuperAdminOnPinReset references**

```bash
grep -n "ccSuperAdminOnPinReset" supabase/functions/request-pin-reset/index.ts
```

Expected: no output (the transition code uses `oldVal` as variable name, which is fine).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/request-pin-reset/index.ts
git commit -m "feat(edge): rename ccSuperAdminOnPinReset to ccOnPinReset in request-pin-reset"
```

---

## Task 10: request-score-edit Edge Function — add ccOnScoreEdit CC gate

**Files:**

- Modify: `supabase/functions/request-score-edit/index.ts`

- [ ] **Step 1: Add shouldCcSuperAdmin function**

After the `resolveAdminEmails` function (after line 168) and before `buildHtml`, insert:

```ts
async function shouldCcSuperAdmin(client: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    const { data } = await client
      .from("security_policy")
      .select("policy")
      .eq("id", 1)
      .single();
    return data?.policy?.ccOnScoreEdit === true;
  } catch {
    return false; // default: do NOT CC on score edit
  }
}
```

Note: the default for `ccOnScoreEdit` is **false** (unlike PIN reset which defaults to true).

- [ ] **Step 2: Gate the CC in the main handler**

In the main handler, before the `sendViaResend` call (line 312), replace:

```ts
if (resendKey) {
  const result = await sendViaResend(resendKey, emails.to, subject, textBody, html, fromAddr, emails.cc);
```

with:

```ts
const ccEnabled = await shouldCcSuperAdmin(client);
const cc = ccEnabled ? emails.cc : [];

if (resendKey) {
  const result = await sendViaResend(resendKey, emails.to, subject, textBody, html, fromAddr, cc);
```

- [ ] **Step 3: Update the log entry to use the gated cc**

In the `console.log` call (lines 319–327), replace `cc: emails.cc` with `cc: cc`:

```ts
console.log("request-score-edit:", JSON.stringify({
  type: "score_edit_request",
  periodId: payload.periodId,
  jurorName: payload.jurorName,
  to: emails.to,
  cc: cc.length ? cc : undefined,
  sent,
  error: sendError || undefined,
}));
```

- [ ] **Step 4: Update the file header comment**

Replace line 7:

```ts
// CCs the super admin based on security_policy.ccOnScoreEdit (default false).
```

- [ ] **Step 5: Verify the function compiles (type check)**

```bash
deno check supabase/functions/request-score-edit/index.ts 2>&1 | tail -10
```

Expected: No errors (or only import resolution warnings that don't affect runtime).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/request-score-edit/index.ts
git commit -m "feat(edge): add ccOnScoreEdit policy gate to request-score-edit"
```

---

## Task 11: Deploy Edge Functions

- [ ] **Step 1: Deploy request-pin-reset**

Use `mcp__claude_ai_Supabase__deploy_edge_function` with function name `request-pin-reset`.

- [ ] **Step 2: Deploy request-score-edit**

Use `mcp__claude_ai_Supabase__deploy_edge_function` with function name `request-score-edit`.

- [ ] **Step 3: Verify deployments**

Use `mcp__claude_ai_Supabase__list_edge_functions` and confirm both functions show updated timestamps.

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Update security_policy JSONB default | Task 1 |
| Rename `ccSuperAdminOnPinReset` → `ccOnPinReset` | Task 1 (DB), Task 9 (Edge Fn) |
| Add `ccOnScoreEdit` | Task 1 (DB), Task 5 (Drawer), Task 10 (Edge Fn) |
| `rpc_jury_verify_pin` reads `maxLoginAttempts` from DB | Task 1 |
| `rpc_admin_generate_entry_token` reads `tokenTtl` from DB | Task 1 |
| `SecurityPolicyContext` with `DEFAULT_POLICY`, `useSecurityPolicy`, `useUpdatePolicy` | Task 2 |
| `AuthProvider` fetches policy on mount, silent fallback | Task 3 |
| `AuthProvider` enforces `emailPassword` / `googleOAuth` in sign-in | Task 3 |
| `SettingsPage.handleSaveSecurityPolicy` calls `updatePolicy` | Task 4 |
| `LoginScreen` conditionally hides Google button / email form / remember-me | Task 6 |
| `RegisterScreen` dynamic password validation | Task 7 |
| `ResetPasswordScreen` dynamic password validation | Task 8 |
| `SecurityPolicyDrawer` removes `allowMultiDevice`, adds `ccOnScoreEdit` | Task 5 |
| `request-pin-reset` reads `ccOnPinReset` | Task 9 |
| `request-score-edit` reads `ccOnScoreEdit`, gates CC | Task 10 |
| Remove `allowMultiDevice` from scope entirely | Task 1 (DB cleanup), Task 5 (Drawer) |
| Deploy Edge Functions | Task 11 |
