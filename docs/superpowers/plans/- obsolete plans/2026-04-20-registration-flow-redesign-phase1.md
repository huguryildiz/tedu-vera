# Registration Flow Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-step email-confirmation signup with a single atomic self-serve flow that lands the user directly in `/admin`, and introduce a soft email-verification banner driven by our own verification flag.

**Architecture:** Supabase "Confirm email" is turned OFF so `signUp` returns a session immediately. Client then calls `rpc_admin_create_org_and_membership` to materialize the org atomically. A new `profiles.email_verified_at` column acts as the app-level "verified" signal (decoupled from Supabase's `auth.users.email_confirmed_at`, which becomes auto-set and useless as a signal once confirmation is off). A custom verification email flow (two Edge Functions + a new `/verify-email` route) handles the actual verification. All public-directory/apply-to-any UI is removed.

**Tech Stack:** React 18 + Vite, React Router v6, Supabase (Auth + Postgres + Edge Functions / Deno), lucide-react, Vitest, Playwright.

**Notes vs spec (refinements surfaced during exploration):**

- Spec referred to `_assert_tenant_admin`; actual helper is `_assert_org_admin`. Plan uses the real name.
- Spec referred to `auth.users.email_confirmed_at` as the banner signal. With Supabase "Confirm email" OFF, that column is auto-populated and cannot represent "not verified yet." Plan introduces `profiles.email_verified_at` as the canonical app-level flag.
- `memberships.grace_ends_at` and the `_assert_org_admin` action-gating land in **Phase 2** (separate plan). Phase 1 ships the banner without locks.
- Existing `handle_invite_confirmed` trigger stays (invite flow still uses Supabase's confirmation link).

---

## File Structure

**New files:**

- `supabase/functions/email-verification-send/index.ts` — issues token + sends email
- `supabase/functions/email-verification-confirm/index.ts` — validates token + writes `email_verified_at`
- `src/auth/screens/VerifyEmailScreen.jsx` — `/verify-email?token=…` landing page
- `src/auth/components/EmailVerifyBanner.jsx` — top-of-admin banner
- `src/shared/api/admin/emailVerification.js` — client wrappers (send + confirm)

**Modified files:**

- `sql/migrations/002_tables.sql` — add `profiles.email_verified_at`, add `email_verification_tokens` table
- `sql/migrations/006_rpcs_admin.sql` — make `rpc_admin_create_org_and_membership` idempotent
- `sql/README.md` — document new column and table
- `src/auth/AuthProvider.jsx` — atomic `signUp`, expose `emailVerified`, call verification-send after signup
- `src/auth/screens/RegisterScreen.jsx` — delete public-directory path, success state, Google branch; single form
- `src/auth/screens/CompleteProfileScreen.jsx` — delete public-directory path, university/department fields
- `src/router.jsx` — register `/verify-email` route
- `src/admin/layout/AdminRouteLayout.jsx` (or wherever admin shell lives) — mount `EmailVerifyBanner`
- `src/shared/api/admin/auth.js` — extend `getSession` to surface `email_verified_at` via profile join
- `src/shared/api/index.js` — export new verification wrappers
- `src/test/qa-catalog.json` — register new test IDs
- `CLAUDE.md` — **no changes** (no new UI conventions introduced)

---

## Task 0: Supabase dashboard settings (manual prereq)

**This task is run by a human, not an agent. Verify before Task 1.**

- [ ] **Step 0.1:** Run `mcp__claude_ai_Supabase__list_projects` and note the project IDs for `vera-prod` and `vera-demo`. Record them in a scratch note for later tasks.

- [ ] **Step 0.2:** In the Supabase Dashboard (MCP cannot toggle Auth provider settings today), for **vera-prod**: Authentication → Providers → Email → **turn OFF "Confirm email"** → Save.

- [ ] **Step 0.3:** Repeat Step 0.2 for **vera-demo**.

- [ ] **Step 0.4:** Sanity check each project via `mcp__claude_ai_Supabase__execute_sql` (lookup won't confirm the setting directly but verifies connectivity to the right project):

```sql
SELECT current_database(), current_user;
```

**Rollback:** flip the setting back ON to restore the old gate. No DB consequences.

---

## Task 1: DB — `profiles.email_verified_at` column

**Files:**

- Modify: `sql/migrations/002_tables.sql` (profiles table + related triggers)

- [ ] **Step 1.1:** Open `sql/migrations/002_tables.sql`. Locate the `CREATE TABLE profiles (...)` block at line 32.

- [ ] **Step 1.2:** Add a new nullable column to the `profiles` CREATE TABLE:

```sql
CREATE TABLE profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  avatar_url         TEXT,
  email_verified_at  TIMESTAMPTZ,       -- app-level verification flag
  created_at         TIMESTAMPTZ DEFAULT now()
);
```

(Use the actual existing column list — do not drop fields you don't see in the current file. Just insert `email_verified_at TIMESTAMPTZ` before `created_at`.)

- [ ] **Step 1.3:** Right after the `CREATE TABLE profiles` block, add an index (empty when NULL, cheap to maintain):

```sql
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified_null
  ON profiles (id) WHERE email_verified_at IS NULL;
```

- [ ] **Step 1.4:** Apply the migration to both projects. Use `mcp__claude_ai_Supabase__apply_migration` with `project_id` from Task 0.1 and this exact query (forward-only ALTER + backfill for existing rows):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_email_verified_null
  ON profiles (id) WHERE email_verified_at IS NULL;

-- Backfill: anyone whose Supabase auth account is already confirmed is treated
-- as verified. This prevents the banner from showing up for the entire pre-
-- existing TEDU user base the moment Phase 1 lands.
UPDATE profiles p
   SET email_verified_at = u.email_confirmed_at
  FROM auth.users u
 WHERE p.id = u.id
   AND p.email_verified_at IS NULL
   AND u.email_confirmed_at IS NOT NULL;
```

Call it once per project:

```
apply_migration({ project_id: "<vera-prod-id>", name: "profiles_email_verified_at", query: "..." })
apply_migration({ project_id: "<vera-demo-id>", name: "profiles_email_verified_at", query: "..." })
```

- [ ] **Step 1.5:** Verify on both projects via `mcp__claude_ai_Supabase__execute_sql`:

```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'profiles' AND column_name = 'email_verified_at';
-- Expected: one row, data_type = "timestamp with time zone"

SELECT COUNT(*) AS backfilled
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE p.email_verified_at IS NOT NULL
   AND u.email_confirmed_at IS NOT NULL;
-- Expected on prod: ≥ 1 (the TEDU users). On demo: matches demo_seed count.
```

- [ ] **Step 1.6:** Commit.

```bash
git add sql/migrations/002_tables.sql
git commit -m "db(profiles): add email_verified_at column and sparse index"
```

---

## Task 2: DB — `email_verification_tokens` table

**Files:**

- Modify: `sql/migrations/002_tables.sql`

- [ ] **Step 2.1:** After the `profiles` table block in `002_tables.sql`, add the new table:

```sql
-- =============================================================================
-- EMAIL_VERIFICATION_TOKENS (custom soft-verification flow)
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens (user_id, consumed_at);
```

- [ ] **Step 2.2:** RLS: table is accessed only by service-role from Edge Functions, so keep `ENABLE ROW LEVEL SECURITY` and add no policies — all access is via SECURITY DEFINER Edge Functions. Add in `sql/migrations/004_rls.sql` if RLS statements live there, otherwise append to `002_tables.sql`:

```sql
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only service-role (Edge Functions) reads/writes this table.
```

- [ ] **Step 2.3:** GRANT block — revoke all from authenticated/anon:

```sql
REVOKE ALL ON email_verification_tokens FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 2.4:** Apply migration to both projects (same approach as Task 1.4).

- [ ] **Step 2.5:** Verify:

```sql
SELECT tablename FROM pg_tables WHERE tablename = 'email_verification_tokens';
-- Expected: 1 row.
SELECT rowsecurity FROM pg_class WHERE relname = 'email_verification_tokens';
-- Expected: t (true)
```

- [ ] **Step 2.6:** Commit.

```bash
git add sql/migrations/002_tables.sql sql/migrations/004_rls.sql
git commit -m "db: add email_verification_tokens table with RLS-on-no-policy"
```

---

## Task 3: DB — make `rpc_admin_create_org_and_membership` idempotent

**Files:**

- Modify: `sql/migrations/006_rpcs_admin.sql:553-609`

- [ ] **Step 3.1:** Locate the current function body at `sql/migrations/006_rpcs_admin.sql:553`.

- [ ] **Step 3.2:** Replace the body so it returns the existing org if the caller already has an active admin membership — instead of failing or creating a duplicate:

```sql
CREATE OR REPLACE FUNCTION public.rpc_admin_create_org_and_membership(
  p_name        TEXT,
  p_org_name    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id  UUID;
  v_code    TEXT;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated')::JSON;
  END IF;

  IF p_org_name IS NULL OR trim(p_org_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'org_name_required')::JSON;
  END IF;

  -- Idempotent short-circuit: if caller already has an active org_admin membership,
  -- return that org instead of raising or duplicating.
  SELECT organization_id INTO v_existing
    FROM public.memberships
   WHERE user_id = v_user_id
     AND role = 'org_admin'
     AND status = 'active'
     AND organization_id IS NOT NULL
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'organization_id', v_existing, 'idempotent', true)::JSON;
  END IF;

  v_code := upper(regexp_replace(left(p_org_name, 4), '[^A-Z0-9]', '', 'g'))
            || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.profiles(id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations(code, name, status)
  VALUES (v_code, trim(p_org_name), 'active')
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships(user_id, organization_id, role, status)
  VALUES (v_user_id, v_org_id, 'org_admin', 'active');

  UPDATE public.profiles SET display_name = trim(p_name) WHERE id = v_user_id;

  PERFORM public._audit_write(
    v_org_id,
    'organization.created',
    'organizations',
    v_org_id,
    'config'::audit_category,
    'high'::audit_severity,
    jsonb_build_object('org_name', p_org_name, 'created_by', v_user_id, 'flow', 'self_serve'),
    jsonb_build_object('before', null, 'after', jsonb_build_object('status', 'active', 'role', 'org_admin'))
  );

  RETURN jsonb_build_object('ok', true, 'organization_id', v_org_id, 'idempotent', false)::JSON;
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'org_name_taken')::JSON;
END;
$$;
```

- [ ] **Step 3.3:** Apply to both projects via Supabase MCP `apply_migration`.

- [ ] **Step 3.4:** Verify via `execute_sql`:

```sql
-- As a fake authenticated user who already has a membership, calling twice should both succeed with idempotent=true the second time.
-- Easier: inspect function source:
SELECT pg_get_functiondef(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.proname='rpc_admin_create_org_and_membership';
```

Expected: output contains `v_existing` and `idempotent`.

- [ ] **Step 3.5:** Commit.

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "db(rpc): make rpc_admin_create_org_and_membership idempotent"
```

---

## Task 4: Edge Function — `email-verification-send`

**Files:**

- Create: `supabase/functions/email-verification-send/index.ts`
- Create: `supabase/functions/email-verification-send/deno.json` (only if needed by convention; check `supabase/functions/password-reset-email/` as the template)

- [ ] **Step 4.1:** Read the reference implementation at `supabase/functions/password-reset-email/index.ts` to match patterns (verify_jwt, Kong config, Resend usage). Note any shared helpers under `supabase/functions/_shared/`.

- [ ] **Step 4.2:** Create `supabase/functions/email-verification-send/index.ts`:

```ts
// email-verification-send: Issues a one-time verification token for the
// authenticated caller, stores it, and sends a verification email.
//
// Auth: caller must present a Supabase JWT. We validate via auth.getUser(token)
// (Auth-v1, tolerates ES256) then use the service role for DB writes.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("VERIFICATION_FROM_EMAIL") ?? "noreply@vera.app";
const APP_URL = Deno.env.get("APP_URL") ?? "https://vera.app";

const TOKEN_TTL_HOURS = 24;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);

  const authClient = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user?.id || !userData.user.email) {
    return json({ error: "invalid_session" }, 401);
  }
  const userId = userData.user.id;
  const email = userData.user.email!;

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: profile } = await db
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.email_verified_at) {
    return json({ ok: true, alreadyVerified: true });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString();
  const { data: inserted, error: insErr } = await db
    .from("email_verification_tokens")
    .insert({ user_id: userId, email, expires_at: expiresAt })
    .select("token")
    .single();
  if (insErr || !inserted?.token) {
    return json({ error: "token_insert_failed", details: insErr?.message }, 500);
  }

  const verifyUrl = `${APP_URL}/verify-email?token=${inserted.token}`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your VERA email",
      html: `
        <p>Click the link below to verify your email and unlock all VERA admin features:</p>
        <p><a href="${verifyUrl}">Verify my email</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    }),
  });

  if (!emailRes.ok) {
    const body = await emailRes.text();
    return json({ error: "email_send_failed", details: body }, 502);
  }

  return json({ ok: true });

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 4.3:** Deploy to **both projects** using Supabase MCP:

```
mcp__claude_ai_Supabase__deploy_edge_function({ project_id: <vera-prod>, name: "email-verification-send", files: [...] })
mcp__claude_ai_Supabase__deploy_edge_function({ project_id: <vera-demo>, name: "email-verification-send", files: [...] })
```

- [ ] **Step 4.4:** Set secrets for both projects (if `RESEND_API_KEY` / `APP_URL` / `VERIFICATION_FROM_EMAIL` aren't already set from other functions): use the Supabase dashboard.

- [ ] **Step 4.5:** Smoke test: POST to the function with a valid Supabase JWT (paste an access_token from dev). Expect `{ ok: true }` and an email delivered.

- [ ] **Step 4.6:** Commit.

```bash
git add supabase/functions/email-verification-send/
git commit -m "edge(email-verification-send): issue + email signed token to authenticated caller"
```

---

## Task 5: Edge Function — `email-verification-confirm`

**Files:**

- Create: `supabase/functions/email-verification-confirm/index.ts`

- [ ] **Step 5.1:** Create `supabase/functions/email-verification-confirm/index.ts`:

```ts
// email-verification-confirm: validates a verification token and marks the
// associated profile as verified. Callable anonymously — token itself is
// the capability.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const token = body.token?.trim();
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return json({ error: "invalid_token_format" }, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: row, error: rowErr } = await db
    .from("email_verification_tokens")
    .select("token, user_id, email, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();

  if (rowErr) return json({ error: "lookup_failed" }, 500);
  if (!row) return json({ error: "token_not_found" }, 404);
  if (row.consumed_at) return json({ error: "token_already_used" }, 410);
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "token_expired" }, 410);

  const now = new Date().toISOString();

  const { error: updProfErr } = await db
    .from("profiles")
    .update({ email_verified_at: now })
    .eq("id", row.user_id);
  if (updProfErr) return json({ error: "profile_update_failed" }, 500);

  const { error: updTokErr } = await db
    .from("email_verification_tokens")
    .update({ consumed_at: now })
    .eq("token", token);
  if (updTokErr) return json({ error: "token_consume_failed" }, 500);

  return json({ ok: true });

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 5.2:** Deploy to both projects (same MCP call pattern as Task 4.3).

- [ ] **Step 5.3:** Smoke test:
  - Manually insert a test token into `email_verification_tokens` (service role SQL).
  - POST that token.
  - Expect 200 `{ ok: true }` and the profile's `email_verified_at` populated.
  - Re-POST same token — expect 410 `token_already_used`.

- [ ] **Step 5.4:** Commit.

```bash
git add supabase/functions/email-verification-confirm/
git commit -m "edge(email-verification-confirm): validate + consume token, stamp verified_at"
```

---

## Task 6: API layer — `emailVerification.js` wrappers

**Files:**

- Create: `src/shared/api/admin/emailVerification.js`
- Modify: `src/shared/api/admin/index.js`
- Modify: `src/shared/api/index.js`

- [ ] **Step 6.1:** Create `src/shared/api/admin/emailVerification.js`:

```js
// src/shared/api/admin/emailVerification.js
// Client wrappers around the two verification Edge Functions.

import { invokeEdgeFunction } from "../core/invokeEdgeFunction";

/**
 * Ask the server to (re)send a verification email to the current user.
 * Caller must be authenticated (session attached by invokeEdgeFunction).
 * @returns {Promise<{ ok: boolean, alreadyVerified?: boolean }>}
 */
export async function sendEmailVerification() {
  const { data, error } = await invokeEdgeFunction("email-verification-send", { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Confirm a verification token (anonymous — token is the capability).
 * @param {string} token
 * @returns {Promise<{ ok: true }>}
 */
export async function confirmEmailVerification(token) {
  const { data, error } = await invokeEdgeFunction("email-verification-confirm", {
    body: { token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
```

- [ ] **Step 6.2:** Export from `src/shared/api/admin/index.js`. Append:

```js
export { sendEmailVerification, confirmEmailVerification } from "./emailVerification";
```

- [ ] **Step 6.3:** Re-export from `src/shared/api/index.js` so consumers use the public surface. Append or merge:

```js
export { sendEmailVerification, confirmEmailVerification } from "./admin/emailVerification";
```

- [ ] **Step 6.4:** Commit.

```bash
git add src/shared/api/admin/emailVerification.js src/shared/api/admin/index.js src/shared/api/index.js
git commit -m "api: add sendEmailVerification + confirmEmailVerification wrappers"
```

---

## Task 7: API layer — extend `getSession` to surface verification flag

**Files:**

- Modify: `src/shared/api/admin/auth.js:10-21`

- [ ] **Step 7.1:** Replace the body of `getSession()` so it joins the caller's `profiles` row and returns the new flag on every membership element (duplication is fine; matches shape consumed by AuthProvider):

```js
export async function getSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const [membershipsRes, profileRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("*, organization:organizations(id, name, code, status, setup_completed_at)")
      .eq("user_id", user.id)
      .in("status", ["active", "invited"]),
    supabase
      .from("profiles")
      .select("email_verified_at")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (membershipsRes.error) throw membershipsRes.error;
  const emailVerifiedAt = profileRes.data?.email_verified_at ?? null;
  return (membershipsRes.data || []).map((row) => ({ ...row, email_verified_at: emailVerifiedAt }));
}
```

(If `profileRes.error` fires we still want `emailVerifiedAt = null`; no explicit throw, the join is best-effort.)

- [ ] **Step 7.2:** Commit.

```bash
git add src/shared/api/admin/auth.js
git commit -m "api(getSession): return profile.email_verified_at alongside memberships"
```

---

## Task 8: AuthProvider — atomic signUp + emailVerified context

**Files:**

- Modify: `src/auth/AuthProvider.jsx`

- [ ] **Step 8.0:** Near the other `useRef` declarations in `AuthProvider`, add a guard ref so the auth-state handler doesn't briefly mark the new user as "profile incomplete" during the short window between Supabase's `SIGNED_IN` event and the org-creation RPC resolving:

```js
const signingUpRef = useRef(false);
```

At the very top of `handleAuthChange`, right after `if (!mountedRef.current) return;`, insert:

```js
if (signingUpRef.current && newSession?.user) {
  // During our atomic signup, AuthProvider owns the bootstrap — skip the
  // default "no memberships → profileIncomplete=true" branch that would
  // otherwise flash the CompleteProfileScreen for ~200 ms.
  setSession(newSession);
  setUser({
    id: newSession.user.id,
    email: newSession.user.email,
    newEmail: newSession.user.new_email ?? null,
    name: newSession.user.user_metadata?.name || newSession.user.email,
    orgName: newSession.user.user_metadata?.orgName || "",
  });
  hasSessionRef.current = true;
  return;
}
```

- [ ] **Step 8.1:** In `src/auth/AuthProvider.jsx`, replace the `signUp` callback (currently at lines ~516-534) with the atomic version. Wrap the whole body in a try/finally that toggles `signingUpRef`:

```js
const signUp = useCallback(async (email, password, metadata = {}) => {
  signingUpRef.current = true;
  try {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = pathname.startsWith("/demo") ? "/demo" : "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: metadata.name, profile_completed: true },
        emailRedirectTo: `${origin}${base}/login`,
      },
    });
    if (error) throw error;
    if (!data?.session) throw new Error("signup_session_missing");

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "rpc_admin_create_org_and_membership",
      { p_name: metadata.name, p_org_name: metadata.orgName }
    );
    if (rpcErr) throw rpcErr;
    if (rpcData?.ok === false) {
      const err = new Error(rpcData.error_code || "org_creation_failed");
      err.code = rpcData.error_code;
      throw err;
    }

    try {
      const { sendEmailVerification } = await import("@/shared/api");
      await sendEmailVerification();
    } catch (e) {
      console.warn("verification email send failed (non-blocking):", e?.message);
    }

    const memberships = await fetchMemberships();
    if (mountedRef.current) {
      setOrganizations(
        memberships.map((m) => ({
          id: m.organization_id,
          code: m.organization?.code ?? null,
          name: m.organization?.name ?? null,
          institution: m.organization?.institution ?? null,
          setupCompletedAt: m.organization?.setup_completed_at ?? null,
          role: m.role,
        }))
      );
      setProfileIncomplete(false);
      setEmailVerifiedAt(memberships[0]?.email_verified_at ?? null);
    }
    return data;
  } finally {
    signingUpRef.current = false;
  }
}, [fetchMemberships]);
```

- [ ] **Step 8.2:** Extend AuthContext state to surface `emailVerified`. Near the other `useState` calls at the top of `AuthProvider`, add:

```js
const [emailVerifiedAt, setEmailVerifiedAt] = useState(null);
```

- [ ] **Step 8.3:** In `handleAuthChange`, after `fetchMemberships()`, extract `email_verified_at` from the first membership row (all rows carry the same value thanks to Task 7):

```js
if (memberships.length > 0) {
  setEmailVerifiedAt(memberships[0].email_verified_at ?? null);
} else {
  // Fall back to a direct profile read for zero-membership users.
  try {
    const { data: prof } = await supabase.from("profiles").select("email_verified_at").eq("id", newSession.user.id).maybeSingle();
    setEmailVerifiedAt(prof?.email_verified_at ?? null);
  } catch { setEmailVerifiedAt(null); }
}
```

- [ ] **Step 8.4:** Extend the `value` object (around the `useMemo` at ~lines 676-705) to expose:

```js
emailVerified: !!emailVerifiedAt,
emailVerifiedAt,
refreshEmailVerified: async () => {
  if (!user?.id) return;
  const { data: prof } = await supabase.from("profiles").select("email_verified_at").eq("id", user.id).maybeSingle();
  setEmailVerifiedAt(prof?.email_verified_at ?? null);
},
```

Include `emailVerifiedAt` in the `useMemo` dependency array.

- [ ] **Step 8.5:** Clear the flag in `signOut`/`signOutAll` for cleanliness:

```js
setEmailVerifiedAt(null);
```

- [ ] **Step 8.6:** Commit.

```bash
git add src/auth/AuthProvider.jsx
git commit -m "auth(provider): atomic signUp + org RPC; expose emailVerified in context"
```

---

## Task 9: Route — `/verify-email?token=…` landing page

**Files:**

- Create: `src/auth/screens/VerifyEmailScreen.jsx`
- Modify: `src/router.jsx`

- [ ] **Step 9.1:** Create `src/auth/screens/VerifyEmailScreen.jsx`:

```jsx
import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, MailWarning, Loader2 } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import { confirmEmailVerification } from "@/shared/api";
import { AuthContext } from "@/auth/AuthProvider";

export default function VerifyEmailScreen() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const [state, setState] = useState("pending"); // pending | success | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = search.get("token");
    if (!token) { setState("error"); setErrorMsg("Missing token."); return; }
    confirmEmailVerification(token)
      .then(() => {
        setState("success");
        auth?.refreshEmailVerified?.();
      })
      .catch((e) => {
        setState("error");
        setErrorMsg(normalize(e?.message));
      });
  }, [search, auth]);

  useEffect(() => {
    if (state !== "success") return;
    const id = setTimeout(() => navigate("/admin", { replace: true }), 1800);
    return () => clearTimeout(id);
  }, [state, navigate]);

  return (
    <div className="apply-screen">
      <div className="apply-wrap">
        <div className="apply-card">
          {state === "pending" && (
            <div className="apply-header">
              <div className="apply-icon-wrap"><Loader2 size={24} className="spin" /></div>
              <div className="apply-title">Verifying your email…</div>
              <div className="apply-sub">Just a moment.</div>
            </div>
          )}
          {state === "success" && (
            <div className="apply-header">
              <div className="apply-icon-wrap"><MailCheck size={24} strokeWidth={1.5} /></div>
              <div className="apply-title">Email verified</div>
              <div className="apply-sub">Redirecting you to admin…</div>
            </div>
          )}
          {state === "error" && (
            <>
              <div className="apply-header">
                <div className="apply-icon-wrap"><MailWarning size={24} strokeWidth={1.5} /></div>
                <div className="apply-title">Verification failed</div>
                <div className="apply-sub">We couldn&apos;t verify your email.</div>
              </div>
              <FbAlert variant="danger">{errorMsg}</FbAlert>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function normalize(raw) {
  const m = String(raw || "").toLowerCase();
  if (m.includes("expired")) return "This verification link has expired. Request a new one from the banner.";
  if (m.includes("already_used")) return "This link has already been used.";
  if (m.includes("not_found")) return "This link is invalid.";
  return "Could not verify your email. Please request a new link.";
}
```

- [ ] **Step 9.2:** Register the route in `src/router.jsx`. Add inside the auth-layout branch (same level as `/login`, `/register`):

```jsx
{ path: "verify-email", element: <VerifyEmailScreen /> },
```

…and mirror under `/demo/*` alongside other demo auth routes.

- [ ] **Step 9.3:** Import at the top of `src/router.jsx`:

```jsx
const VerifyEmailScreen = React.lazy(() => import("@/auth/screens/VerifyEmailScreen"));
```

- [ ] **Step 9.4:** Manually spin up `npm run dev`, navigate to `/verify-email?token=00000000-0000-0000-0000-000000000000` (invalid), verify the error state renders with the correct FbAlert.

- [ ] **Step 9.5:** Commit.

```bash
git add src/auth/screens/VerifyEmailScreen.jsx src/router.jsx
git commit -m "auth: add /verify-email landing page for token confirmation"
```

---

## Task 10: Component — `EmailVerifyBanner`

**Files:**

- Create: `src/auth/components/EmailVerifyBanner.jsx`
- Modify: the admin layout file (locate whichever file renders the admin shell — typically `src/admin/layout/AdminLayout.jsx` or `src/admin/layout/AdminRouteLayout.jsx`)

- [ ] **Step 10.1:** Read `src/admin/layout/AdminSidebar.jsx` and adjacent files in `src/admin/layout/` to identify the admin shell wrapper that wraps every admin page. Use the file that renders above the page content (usually contains `<Outlet />`).

- [ ] **Step 10.2:** Create `src/auth/components/EmailVerifyBanner.jsx`:

```jsx
import { useContext, useState } from "react";
import { MailWarning } from "lucide-react";
import { AuthContext } from "@/auth/AuthProvider";
import { sendEmailVerification } from "@/shared/api";

export default function EmailVerifyBanner() {
  const auth = useContext(AuthContext);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  if (!auth?.user || auth.emailVerified) return null;

  async function onResend() {
    setState("sending");
    setErrorMsg("");
    try {
      await sendEmailVerification();
      setState("sent");
    } catch (e) {
      setState("error");
      setErrorMsg(String(e?.message || "Failed to send. Try again."));
    }
  }

  return (
    <div className="evb-wrap" role="status" aria-live="polite">
      <MailWarning size={16} strokeWidth={2} className="evb-icon" />
      <div className="evb-body">
        Verify your email to unlock all admin actions.
      </div>
      <div className="evb-action">
        {state === "sent" ? (
          <span className="evb-sent">Link sent — check your inbox.</span>
        ) : (
          <button
            type="button"
            className="evb-btn"
            onClick={onResend}
            disabled={state === "sending"}
          >
            {state === "sending" ? "Sending…" : "Resend link"}
          </button>
        )}
        {state === "error" && <span className="evb-error">{errorMsg}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 10.3:** Add the CSS in an existing stylesheet — extend `src/styles/components.css` (or the admin-shared sheet). Find a logical spot with related components and insert:

```css
/* ── Email Verify Banner ── */
.evb-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--warning-surface, var(--surface-alt));
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
}
.evb-icon { color: var(--warning, #b45309); flex: 0 0 auto; }
.evb-body {
  flex: 1 1 auto;
  text-align: justify;
  text-justify: inter-word;
}
.evb-action { display: flex; gap: 8px; align-items: center; }
.evb-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 120ms ease;
}
.evb-btn:hover:not(:disabled) { background: var(--surface); }
.evb-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.evb-sent { color: var(--success, #059669); font-size: 12px; }
.evb-error { color: var(--danger); font-size: 12px; }
body:not(.dark-mode) .evb-wrap { color: #78350f; background: #fef3c7; }
body:not(.dark-mode) .evb-icon { color: #b45309; }
```

- [ ] **Step 10.4:** Mount the banner in the admin shell. In the layout file identified in Step 10.1, import and render it **above `<Outlet />`** but inside the `.admin-main` container:

```jsx
import EmailVerifyBanner from "@/auth/components/EmailVerifyBanner";
// ... inside the render
<EmailVerifyBanner />
<Outlet />
```

- [ ] **Step 10.5:** Manual QA: open dev server, sign up a fresh user, confirm the banner appears; click "Resend link", confirm state updates through "Sending…" → "Link sent."

- [ ] **Step 10.6:** Commit.

```bash
git add src/auth/components/EmailVerifyBanner.jsx src/styles/components.css <admin-layout-file>
git commit -m "auth(banner): add email verify banner + resend action in admin shell"
```

---

## Task 11: RegisterScreen — simplify

**Files:**

- Modify: `src/auth/screens/RegisterScreen.jsx`

- [ ] **Step 11.1:** Read the current `src/auth/screens/RegisterScreen.jsx` top to bottom so you understand the exact variables being touched.

- [ ] **Step 11.2:** Replace the file entirely with this simplified version:

```jsx
// src/auth/screens/RegisterScreen.jsx
// Single-step self-serve signup: full name, email, org, password.

import { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserPlus, Eye, EyeOff, Check, AlertCircle, Icon } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import { checkEmailAvailable } from "@/shared/api";
import { AuthContext } from "@/auth/AuthProvider";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import {
  evaluatePassword,
  getStrengthMeta,
  isStrongPassword,
  PASSWORD_POLICY_ERROR_TEXT,
  PASSWORD_POLICY_PLACEHOLDER,
  PASSWORD_REQUIREMENTS,
} from "@/shared/passwordPolicy";

function normalizeError(raw) {
  const m = String(raw || "").toLowerCase();
  if (!m) return "Could not complete registration. Please try again.";
  if (m.includes("email_already_registered") || m.includes("user already")) return "This email is already registered. Please sign in.";
  if (m.includes("email_required")) return "Your email is required.";
  if (m.includes("name_required")) return "Full name is required.";
  if (m.includes("org_name_required")) return "Organization name is required.";
  if (m.includes("org_name_taken")) return "An organization with that name already exists. Please use a different name.";
  if (m.includes("org_creation_failed")) return "We couldn't set up your organization. Retry?";
  return String(raw);
}

function PwdCheckIcon() {
  return (
    <Icon iconNode={[]} className="pwd-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

function PasswordStrengthBlock({ password }) {
  if (!password) return null;
  const { checks, score } = evaluatePassword(password);
  const { label, color, pct } = getStrengthMeta(score);
  return (
    <>
      <div className="pwd-strength">
        <div className="pwd-strength-bar">
          <div className="pwd-strength-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="pwd-strength-label" style={{ color }}>{label}</span>
      </div>
      <div className="pwd-checklist">
        {PASSWORD_REQUIREMENTS.map(({ key, label: reqLabel }) => (
          <div key={key} className={`pwd-check${checks[key] ? " pass" : ""}`}>
            <PwdCheckIcon />
            {reqLabel}
          </div>
        ))}
      </div>
    </>
  );
}

export default function RegisterScreen({ onSwitchToLogin, onReturnHome, error: externalError }) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith("/demo") ? "/demo" : "";
  const auth = useContext(AuthContext);
  const goLogin = onSwitchToLogin || (() => navigate(`${base}/login`));
  const goHome = onReturnHome || (() => navigate("/"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [emailCheck, setEmailCheck] = useState({ status: "idle", message: "" });

  const isEmailFormatValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  async function handleEmailBlur() {
    markTouched("email");
    const trimmed = email.trim();
    if (!isEmailFormatValid(trimmed)) return;
    setEmailCheck({ status: "checking", message: "" });
    try {
      const result = await checkEmailAvailable(trimmed);
      if (result?.available) setEmailCheck({ status: "available", message: "" });
      else setEmailCheck({ status: "taken", message: "This email is already registered. Please sign in." });
    } catch { setEmailCheck({ status: "idle", message: "" }); }
  }

  const validations = {
    name: fullName.trim().length > 0,
    email: isEmailFormatValid(email) && emailCheck.status !== "taken",
    org: orgName.trim().length > 0,
    password: isStrongPassword(password),
    confirm: password === confirmPassword && confirmPassword.length > 0,
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError("Full name is required.");
    if (!email.trim()) return setError("Work email is required.");
    if (!orgName.trim()) return setError("Organization name is required.");
    if (!password) return setError("Password is required.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!isStrongPassword(password)) return setError(PASSWORD_POLICY_ERROR_TEXT);
    if (emailCheck.status === "taken") return setError(emailCheck.message);

    setLoading(true);
    try {
      await auth.signUp(email.trim(), password, {
        name: fullName.trim(),
        orgName: orgName.trim(),
      });
      navigate(`${base}/admin`, { replace: true });
    } catch (err) {
      setError(normalizeError(err?.message || err?.code));
    } finally {
      setLoading(false);
    }
  }

  const displayError = (error || externalError || "").trim() ? normalizeError(error || externalError) : "";
  const submitBtnRef = useShakeOnError(displayError);

  return (
    <div className="apply-screen">
      <div className="apply-wrap">
        <div className="apply-card">
          <div className="apply-header">
            <div className="apply-icon-wrap"><UserPlus size={24} strokeWidth={1.5} /></div>
            <div className="apply-title">Create your workspace</div>
            <div className="apply-sub">Register your organization to start evaluating projects.</div>
          </div>

          <div className="apply-progress">
            {["name", "email", "org", "password", "confirm"].map((key) => (
              <div key={key} className={`apply-progress-bar${validations[key] ? " apply-progress-bar--filled" : ""}`} />
            ))}
          </div>

          {displayError && (
            <FbAlert variant="danger" style={{ marginBottom: "16px" }}>{displayError}</FbAlert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FieldText id="reg-name" label="Full Name" placeholder="Dr. Jane Doe"
              value={fullName} onChange={setFullName} onBlur={() => markTouched("name")}
              touched={touched.name} valid={validations.name}
              errorText="Full name is required." disabled={loading} />

            <FieldEmail id="reg-email" value={email}
              onChange={(v) => { setEmail(v); setEmailCheck({ status: "idle", message: "" }); }}
              onBlur={handleEmailBlur}
              touched={touched.email} valid={validations.email} checkStatus={emailCheck}
              disabled={loading} />

            <FieldText id="reg-org" label="Organization" placeholder="e.g., TED University — Electrical Engineering"
              value={orgName} onChange={setOrgName} onBlur={() => markTouched("org")}
              touched={touched.org} valid={validations.org} autoComplete="organization"
              errorText="Organization name is required." disabled={loading} />

            <FieldPassword id="reg-password" label="Password" value={password} onChange={setPassword}
              onBlur={() => markTouched("password")} touched={touched.password} valid={validations.password}
              show={showPass} setShow={setShowPass} placeholder={PASSWORD_POLICY_PLACEHOLDER} disabled={loading}>
              <PasswordStrengthBlock password={password} />
            </FieldPassword>

            <div className={`apply-field${touched.confirm && validations.confirm ? " apply-field--valid" : touched.confirm && !validations.confirm ? " apply-field--invalid" : ""}`} style={{ marginBottom: "24px" }}>
              <div className="apply-label-row">
                <label className="apply-label" htmlFor="reg-confirm" style={{ marginBottom: 0 }}>Confirm Password</label>
                {touched.confirm && validations.confirm && (
                  <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                )}
              </div>
              <div className="apply-pw-wrap">
                <input id="reg-confirm" className="apply-input"
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched("confirm")}
                  placeholder="Re-enter password" autoComplete="new-password" disabled={loading} />
                <button type="button" className="apply-pw-toggle" tabIndex={-1}
                  onClick={() => setShowConfirmPass((v) => !v)}
                  aria-label={showConfirmPass ? "Hide password" : "Show password"}>
                  {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div className="reg-pw-mismatch">Passwords do not match</div>
              )}
              {confirmPassword && password === confirmPassword && password.length > 0 && (
                <div className="reg-pw-match"><Check size={12} strokeWidth={3} />Passwords match</div>
              )}
            </div>

            <button ref={submitBtnRef} type="submit" className="apply-submit" disabled={loading}>
              {loading ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </div>

        <div className="apply-footer">
          Already have an account? <button type="button" onClick={goLogin} className="form-link">Sign in</button>
        </div>
        <div className="apply-footer" style={{ marginTop: 4 }}>
          Joining an existing organization? Ask your admin for an invite link.
        </div>
        <div className="login-footer" style={{ marginTop: 8 }}>
          <button type="button" onClick={goHome} className="form-link">&larr; Return Home</button>
        </div>
      </div>
    </div>
  );
}

/* ── Small field components kept in-file to avoid over-fragmentation. ── */
function FieldText({ id, label, placeholder, value, onChange, onBlur, touched, valid, errorText, autoComplete, disabled }) {
  return (
    <div className={`apply-field${touched && valid ? " apply-field--valid" : touched && !valid ? " apply-field--invalid" : ""}`}>
      <div className="apply-label-row">
        <label className="apply-label" htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        {touched && valid && <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>}
      </div>
      <input id={id} className="apply-input" type="text" value={value}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} />
      {touched && !valid && <div className="apply-field-error"><AlertCircle size={12} strokeWidth={2} />{errorText}</div>}
    </div>
  );
}

function FieldEmail({ id, value, onChange, onBlur, touched, valid, checkStatus, disabled }) {
  const status = checkStatus.status;
  return (
    <div className={`apply-field${touched && valid && status === "available" ? " apply-field--valid" : touched && (!valid || status === "taken") ? " apply-field--invalid" : ""}`}>
      <div className="apply-label-row">
        <label className="apply-label" htmlFor={id} style={{ marginBottom: 0 }}>Institutional Email</label>
        {touched && valid && status === "available" && (
          <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <input id={id} className="apply-input" type="email" value={value}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          placeholder="jane.doe@university.edu" autoComplete="email" disabled={disabled} />
        {status === "checking" && <span className="apply-email-checking" aria-label="Checking email…" />}
      </div>
      {touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && (
        <div className="apply-field-error"><AlertCircle size={12} strokeWidth={2} />Valid email is required.</div>
      )}
      {status === "taken" && (
        <div className="apply-field-error"><AlertCircle size={12} strokeWidth={2} />{checkStatus.message}</div>
      )}
    </div>
  );
}

function FieldPassword({ id, label, value, onChange, onBlur, touched, valid, show, setShow, placeholder, disabled, children }) {
  return (
    <div className={`apply-field${touched && valid ? " apply-field--valid" : touched && !valid ? " apply-field--invalid" : ""}`}>
      <div className="apply-label-row">
        <label className="apply-label" htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        {touched && valid && <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>}
      </div>
      <div className="apply-pw-wrap">
        <input id={id} className="apply-input" type={show ? "text" : "password"}
          value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          placeholder={placeholder} autoComplete="new-password" disabled={disabled} />
        <button type="button" className="apply-pw-toggle" tabIndex={-1}
          onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 11.3:** Delete dead imports (`Building2`, `Plus`, `Info`, `listOrganizationsPublic`, `requestToJoinOrg`, `GroupedCombobox`) — already absent in the new file.

- [ ] **Step 11.4:** Manual dev-server QA: happy path (create new workspace) → lands on `/admin` with banner visible. Email already in use → inline FbAlert + field error.

- [ ] **Step 11.5:** Commit.

```bash
git add src/auth/screens/RegisterScreen.jsx
git commit -m "auth(register): collapse to single-step self-serve signup"
```

---

## Task 12: CompleteProfileScreen — trim Google OAuth finishing step

**Files:**

- Modify: `src/auth/screens/CompleteProfileScreen.jsx`

- [ ] **Step 12.1:** Replace the body with a minimal version — no university / department fields, no join-existing toggle, no public directory:

```jsx
import { useState } from "react";
import FbAlert from "@/shared/ui/FbAlert";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import { Icon } from "lucide-react";

export default function CompleteProfileScreen({ user, onComplete, onSignOut }) {
  const [fullName, setFullName] = useState(user?.name || "");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submitBtnRef = useShakeOnError(error);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError("Full name is required.");
    if (!orgName.trim()) return setError("Organization name is required.");
    setLoading(true);
    try {
      await onComplete({ name: fullName.trim(), orgName: orgName.trim() });
    } catch (err) {
      setError(String(err?.message || "Failed to complete profile. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div style={{ width: "420px", maxWidth: "92vw" }}>
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon-wrap">
              <Icon iconNode={[]} width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </Icon>
            </div>
            <div className="login-title">Create your workspace</div>
            <div className="login-sub">One last step: name your organization.</div>
          </div>

          {error && (<FbAlert variant="danger" style={{ marginBottom: 16 }}>{error}</FbAlert>)}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={user?.email || ""} disabled readOnly
                     style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">Full Name</label>
              <input id="profile-name" className="form-input" type="text"
                     value={fullName} onChange={(e) => setFullName(e.target.value)}
                     placeholder="Your full name" autoFocus disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-org">Organization</label>
              <input id="profile-org" className="form-input" type="text"
                     value={orgName} onChange={(e) => setOrgName(e.target.value)}
                     placeholder="e.g., TED University — Electrical Engineering"
                     autoComplete="organization" disabled={loading} />
            </div>

            <button ref={submitBtnRef} type="submit" className="btn btn-primary"
                    disabled={loading} style={{ width: "100%" }}>
              {loading ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </div>

        <div className="login-footer" style={{ display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={onSignOut} className="form-link"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.2:** Update `AuthProvider.completeProfile()` signature (around line 474) — it still accepts `joinOrgId` / `institution` / `department` today. Trim to just `{ name, orgName }`:

```js
const completeProfile = useCallback(async ({ name, orgName }) => {
  const { error: metaError } = await supabase.auth.updateUser({
    data: { profile_completed: true, name },
  });
  if (metaError) throw metaError;

  const { data, error } = await supabase.rpc("rpc_admin_create_org_and_membership", {
    p_name: name,
    p_org_name: orgName,
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error_code || "org_creation_failed");

  try {
    const { sendEmailVerification } = await import("@/shared/api");
    await sendEmailVerification();
  } catch (e) { console.warn("verification send failed (non-blocking):", e?.message); }

  const memberships = await fetchMemberships();
  if (mountedRef.current) {
    setOrganizations(
      memberships.map((m) => ({
        id: m.organization_id,
        code: m.organization?.code ?? null,
        name: m.organization?.name ?? null,
        institution: m.organization?.institution ?? null,
        setupCompletedAt: m.organization?.setup_completed_at ?? null,
        role: m.role,
      }))
    );
  }

  setProfileIncomplete(false);
}, [fetchMemberships]);
```

(Google flow never creates a `requested` membership any more — join-existing is invite-only now.)

- [ ] **Step 12.3:** Manual QA via Google OAuth sign-in with a fresh Google account.

- [ ] **Step 12.4:** Commit.

```bash
git add src/auth/screens/CompleteProfileScreen.jsx src/auth/AuthProvider.jsx
git commit -m "auth(complete-profile): strip institution/department + join-existing toggle"
```

---

## Task 13: Unit tests — `qa-catalog` entries + test files

**Files:**

- Modify: `src/test/qa-catalog.json`
- Create: `src/auth/__tests__/RegisterScreen.test.jsx`
- Create: `src/auth/__tests__/EmailVerifyBanner.test.jsx`
- Create: `src/auth/__tests__/VerifyEmailScreen.test.jsx`

- [ ] **Step 13.1:** Append qa-catalog IDs. Open `src/test/qa-catalog.json` and add:

```json
{ "id": "auth.register.happy_path", "title": "Register: single-step flow lands in /admin" },
{ "id": "auth.register.email_taken", "title": "Register: taken email shows inline error" },
{ "id": "auth.register.org_idempotent_error", "title": "Register: org_creation_failed surfaces retryable error" },
{ "id": "auth.banner.hidden_when_verified", "title": "EmailVerifyBanner: hidden when emailVerified=true" },
{ "id": "auth.banner.resend_success", "title": "EmailVerifyBanner: resend flow shows 'Link sent'" },
{ "id": "auth.verify_email.success", "title": "VerifyEmailScreen: success state redirects to /admin" },
{ "id": "auth.verify_email.expired", "title": "VerifyEmailScreen: expired token shows dedicated error" }
```

(Preserve existing JSON structure; place these inside whatever array the file uses.)

- [ ] **Step 13.2:** Create `src/auth/__tests__/RegisterScreen.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "@/auth/AuthProvider";
import RegisterScreen from "@/auth/screens/RegisterScreen";
import { qaTest } from "@/test/qa";
import { vi } from "vitest";

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({
  checkEmailAvailable: vi.fn(async () => ({ available: true })),
}));

function renderWithAuth(authOverrides = {}) {
  const auth = {
    user: null,
    loading: false,
    signUp: vi.fn(async () => ({ user: { id: "u1" }, session: { access_token: "x" } })),
    ...authOverrides,
  };
  return {
    auth,
    ...render(
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <RegisterScreen />
        </AuthContext.Provider>
      </MemoryRouter>
    ),
  };
}

qaTest("auth.register.happy_path", async () => {
  const { auth } = renderWithAuth();
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Jane" } });
  fireEvent.change(screen.getByLabelText(/Institutional Email/i), { target: { value: "jane@u.edu" } });
  fireEvent.blur(screen.getByLabelText(/Institutional Email/i));
  fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: "Dept X" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng!Pass" } });
  fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "Str0ng!Pass" } });
  fireEvent.click(screen.getByRole("button", { name: /Create workspace/i }));
  await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith("jane@u.edu", "Str0ng!Pass", { name: "Jane", orgName: "Dept X" }));
});

qaTest("auth.register.org_idempotent_error", async () => {
  const { auth } = renderWithAuth({
    signUp: vi.fn(async () => { const e = new Error("org_creation_failed"); e.code = "org_creation_failed"; throw e; }),
  });
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Jane" } });
  fireEvent.change(screen.getByLabelText(/Institutional Email/i), { target: { value: "jane@u.edu" } });
  fireEvent.blur(screen.getByLabelText(/Institutional Email/i));
  fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: "Dept X" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng!Pass" } });
  fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "Str0ng!Pass" } });
  fireEvent.click(screen.getByRole("button", { name: /Create workspace/i }));
  await waitFor(() => expect(screen.getByText(/We couldn't set up your organization/i)).toBeInTheDocument());
});
```

Repeat this pattern for the "email_taken" case (mock `checkEmailAvailable` to return `{ available: false }`).

- [ ] **Step 13.3:** Create `src/auth/__tests__/EmailVerifyBanner.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthContext } from "@/auth/AuthProvider";
import EmailVerifyBanner from "@/auth/components/EmailVerifyBanner";
import { qaTest } from "@/test/qa";
import { vi } from "vitest";

const sendMock = vi.fn(async () => ({ ok: true }));
vi.mock("@/shared/api", () => ({ sendEmailVerification: (...args) => sendMock(...args) }));
vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

function renderWith(auth) {
  return render(<AuthContext.Provider value={auth}><EmailVerifyBanner /></AuthContext.Provider>);
}

qaTest("auth.banner.hidden_when_verified", () => {
  renderWith({ user: { id: "u1" }, emailVerified: true });
  expect(screen.queryByText(/Verify your email/i)).toBeNull();
});

qaTest("auth.banner.resend_success", async () => {
  renderWith({ user: { id: "u1" }, emailVerified: false });
  fireEvent.click(screen.getByRole("button", { name: /Resend link/i }));
  await waitFor(() => expect(sendMock).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Link sent/i)).toBeInTheDocument());
});
```

- [ ] **Step 13.4:** Create `src/auth/__tests__/VerifyEmailScreen.test.jsx`:

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import VerifyEmailScreen from "@/auth/screens/VerifyEmailScreen";
import { AuthContext } from "@/auth/AuthProvider";
import { qaTest } from "@/test/qa";
import { vi } from "vitest";

const confirmMock = vi.fn();
vi.mock("@/shared/api", () => ({ confirmEmailVerification: (...args) => confirmMock(...args) }));
vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

function renderAt(url) {
  return render(
    <AuthContext.Provider value={{ refreshEmailVerified: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/verify-email" element={<VerifyEmailScreen />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

qaTest("auth.verify_email.success", async () => {
  confirmMock.mockResolvedValueOnce({ ok: true });
  renderAt("/verify-email?token=00000000-0000-0000-0000-000000000000");
  await waitFor(() => expect(screen.getByText(/Email verified/i)).toBeInTheDocument());
});

qaTest("auth.verify_email.expired", async () => {
  confirmMock.mockRejectedValueOnce(new Error("token_expired"));
  renderAt("/verify-email?token=00000000-0000-0000-0000-000000000000");
  await waitFor(() => expect(screen.getByText(/expired/i)).toBeInTheDocument());
});
```

- [ ] **Step 13.5:** Run tests: `npm test -- --run`. Expected: all new tests green, no regressions.

- [ ] **Step 13.6:** Commit.

```bash
git add src/test/qa-catalog.json src/auth/__tests__/
git commit -m "test(auth): cover register + banner + verify-email screens"
```

---

## Task 14: E2E — Playwright happy path

**Files:**

- Create: `e2e/auth/register-happy-path.spec.ts` (pattern follows existing e2e under `/e2e/`)

- [ ] **Step 14.1:** Locate existing Playwright specs to mirror setup. Run `ls e2e/` and read one spec (probably `e2e/admin/*.spec.ts`) to see how `test` is imported and how baseURL is configured.

- [ ] **Step 14.2:** Create `e2e/auth/register-happy-path.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("email+password signup lands in /admin with verify banner", async ({ page, baseURL }) => {
  const email = `e2e_${Date.now()}@example.com`;
  await page.goto(`${baseURL}/register`);
  await page.getByLabel(/Full Name/i).fill("E2E User");
  await page.getByLabel(/Institutional Email/i).fill(email);
  await page.getByLabel(/Institutional Email/i).blur();
  await page.getByLabel(/Organization/i).fill(`E2E Org ${Date.now()}`);
  await page.getByLabel("Password", { exact: true }).fill("Str0ng!Pass");
  await page.getByLabel(/Confirm Password/i).fill("Str0ng!Pass");
  await page.getByRole("button", { name: /Create workspace/i }).click();

  await page.waitForURL(/\/admin/);
  await expect(page.getByText(/Verify your email/i)).toBeVisible();
});
```

- [ ] **Step 14.3:** Run: `npm run e2e -- --grep "email\\+password signup"`. Expected: green.

- [ ] **Step 14.4:** Commit.

```bash
git add e2e/auth/register-happy-path.spec.ts
git commit -m "e2e(auth): cover email+password signup happy path with verify banner"
```

---

## Task 15: Sweep dead code

**Files:**

- `src/auth/screens/PendingReviewScreen.jsx`
- `src/shared/api/admin/auth.js`
- `src/shared/api/index.js`

- [ ] **Step 15.1:** In `PendingReviewScreen.jsx`, remove the "Apply for Access" button in the empty state (keeps the screen for legacy pending users but no new-apply affordance).

- [ ] **Step 15.2:** In `src/shared/api/admin/auth.js`, keep `listOrganizationsPublic` and `submitApplication` for backwards compat (still used by super-admin org list in `AuthProvider`). Add a JSDoc note on `submitApplication`:

```js
/**
 * @deprecated New signups do not submit applications. Retained for legacy pending review rendering only.
 */
```

- [ ] **Step 15.3:** Remove the `requestToJoinOrg` import from `AuthProvider.jsx` if no longer referenced (Task 12 removed its call). Grep to confirm:

```bash
grep -n "requestToJoinOrg" src/auth/AuthProvider.jsx
```

Expected: no matches. If there are, delete them.

- [ ] **Step 15.4:** Commit.

```bash
git add src/auth/screens/PendingReviewScreen.jsx src/shared/api/admin/auth.js src/auth/AuthProvider.jsx
git commit -m "auth(cleanup): deprecate apply-to-org UI affordances"
```

---

## Task 16: Documentation + guardrails

**Files:**

- Modify: `sql/README.md`

- [ ] **Step 16.1:** Append to `sql/README.md` under the relevant module (002 section):

```markdown
- `profiles.email_verified_at timestamptz NULL` — app-level soft verification flag (distinct from Supabase `auth.users.email_confirmed_at`, which becomes auto-set once Supabase "Confirm email" is OFF).
- `email_verification_tokens` — custom token store for `email-verification-send` / `email-verification-confirm` Edge Functions. Service-role access only (RLS on, zero policies).
```

- [ ] **Step 16.2:** Run all guardrails:

```bash
npm run check:no-native-select
npm run check:no-nested-panels
npm test -- --run
npm run build
npm run e2e
```

Expected: all green. Fix any failure inline before committing.

- [ ] **Step 16.3:** Commit.

```bash
git add sql/README.md
git commit -m "docs(sql): document email_verified_at + email_verification_tokens"
```

---

## Task 17: Final verification pass

- [ ] **Step 17.1:** `git log --oneline main..HEAD` — expect ~16 commits landing Phase 1.

- [ ] **Step 17.2:** Spin up `npm run dev`, walk through:
  1. `/register` → new workspace happy path
  2. Email banner visible, click Resend, check inbox
  3. Click the real verification link → banner disappears on return
  4. `/login` existing user → banner hidden (already verified)
  5. `/demo/register` → same flow against demo Supabase project
  6. Google OAuth → `CompleteProfileScreen` → create workspace

- [ ] **Step 17.3:** Capture screenshots of the before/after RegisterScreen and the banner for PR body (per CLAUDE.md's "verify against live app" rule).

- [ ] **Step 17.4:** Open PR:

```bash
gh pr create --title "feat(auth): single-step signup + soft email verification (phase 1)" --body "$(cat <<'EOF'
## Summary
- Collapses registration into one atomic step (no more "check your email" gate)
- Removes the public-org directory + apply-to-any path — invite-link is the only join path
- Adds `profiles.email_verified_at` + `email_verification_tokens` + two Edge Functions for soft verification
- Adds `EmailVerifyBanner` with "Resend link" and a `/verify-email` landing page

Spec: docs/superpowers/specs/2026-04-20-registration-flow-redesign-design.md
Plan: docs/superpowers/plans/2026-04-20-registration-flow-redesign-phase1.md

Phase 2 (locked actions + 7-day grace) is a follow-up PR.

## Test plan
- [x] `npm test -- --run`
- [x] `npm run check:no-native-select`
- [x] `npm run check:no-nested-panels`
- [x] `npm run build`
- [x] `npm run e2e`
- [x] Manual: email+password register → /admin, banner visible
- [x] Manual: resend verification → email received → click → banner hidden
- [x] Manual: Google OAuth → CompleteProfileScreen → /admin
- [x] Manual: /demo/register against demo Supabase project

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 2 (separate plan, not in scope here)

A follow-up plan will cover:

- `memberships.grace_ends_at timestamptz NULL` column + backfill policy
- Trigger on `profiles.email_verified_at` UPDATE: null the owner's `grace_ends_at`
- `_assert_org_admin(p_org_id UUID, p_action TEXT DEFAULT NULL)` signature + Level B action gating
- `lockedActions.js` + UI disable + `PremiumTooltip` wiring across admin pages
- `GraceLockScreen` + `GraceLockGate` in admin layout
- Audit row on grace expiry
- Phase 2 test suite

Phase 2 starts only after Phase 1 has been in production for at least one real signup cycle.
