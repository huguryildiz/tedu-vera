# Security Policy Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Super Admin Security Policy drawer into three clean sections (Authentication Methods, QR Access, Notifications), rename `maxLoginAttempts`→`maxPinAttempts` and `tokenTtl`→`qrTtl` in the policy JSONB and the drawer, prune dead fields, and wire CC-super-admin controls into all five platform notification Edge Functions.

**Architecture:** A single DB migration rewrites the `security_policy.policy` JSONB (prune + rename + add new CC fields) and replaces the two SQL functions that read the renamed keys. A new shared Edge Function helper (`_shared/super-admin-cc.ts`) centralizes super-admin email lookup and policy CC-flag reads; five Edge Functions (two refactored, three newly wired) consume it. The frontend drawer is restructured into three sections with a safeguard and an indeterminate-aware master toggle; `DEFAULT_POLICY` and JSDoc in the context and API modules update to match the new schema. No DB table/column renames, no new RPC functions.

**Tech Stack:** React, Supabase (PostgreSQL + Edge Functions via Deno), Vitest for unit tests, Supabase MCP tools for migration + function deployment.

**Spec reference:** [2026-04-10-security-policy-simplification-design.md](../specs/2026-04-10-security-policy-simplification-design.md)

---

## File Inventory

**New files:**

- `sql/migrations/025_security_policy_cleanup.sql` — JSONB rewrite + SQL function replacements
- `supabase/functions/_shared/super-admin-cc.ts` — shared Edge Function helper for super admin CC logic
- `src/admin/__tests__/SecurityPolicyDrawer.test.jsx` — new unit tests for the rewritten drawer

**Modified files:**

- `sql/migrations/002_tables.sql` — update inline `security_policy` seed JSONB default (lines 375-384)
- `src/admin/drawers/SecurityPolicyDrawer.jsx` — full body rewrite
- `src/auth/SecurityPolicyContext.jsx` — update `DEFAULT_POLICY` constant
- `src/shared/api/admin/security.js` — rewrite JSDoc blocks (no runtime change)
- `supabase/functions/request-pin-reset/index.ts` — refactor to use shared helper
- `supabase/functions/request-score-edit/index.ts` — refactor to use shared helper
- `supabase/functions/notify-application/index.ts` — gate CC super admin on `ccOnTenantApplication` for all three application events
- `supabase/functions/notify-maintenance/index.ts` — add CC super admin when `ccOnMaintenance` is on
- `supabase/functions/password-changed-notify/index.ts` — add CC super admin when `ccOnPasswordChanged` is on
- `src/test/qa-catalog.json` — register new QA test IDs for drawer tests

---

## Task 1: Create the SQL migration file

**Files:**

- Create: `sql/migrations/025_security_policy_cleanup.sql`
- Modify: `sql/migrations/002_tables.sql` (lines 375-384)

- [ ] **Step 1: Create the new migration file**

Write this exact file contents:

```sql
-- sql/migrations/025_security_policy_cleanup.sql
-- =============================================================================
-- Security Policy cleanup: rename JSONB keys to match user-facing drawer,
-- prune dead fields, add new CC notification defaults.
--
-- Key renames:
--   maxLoginAttempts → maxPinAttempts  (same value, semantic rename)
--   tokenTtl         → qrTtl           (same value, UI-facing rename)
--
-- Dead keys pruned (no code reads them):
--   minPasswordLength, requireSpecialChars, allowMultiDevice
--
-- New CC defaults (all default true):
--   ccOnTenantApplication, ccOnMaintenance, ccOnPasswordChanged
--
-- SQL function patches:
--   rpc_jury_verify_pin         — now reads policy->>'maxPinAttempts'
--   rpc_admin_generate_entry_token — now reads policy->>'qrTtl'
--
-- Idempotent: running twice produces the same final state.
-- =============================================================================

BEGIN;

-- =============================================================================
-- Step 1: Rewrite the single policy row
-- =============================================================================

UPDATE security_policy
SET
  policy = (
    (policy
      - 'minPasswordLength'
      - 'requireSpecialChars'
      - 'allowMultiDevice'
      - 'maxLoginAttempts'
      - 'tokenTtl')
    || jsonb_build_object(
      'maxPinAttempts',
        COALESCE(policy->'maxPinAttempts', policy->'maxLoginAttempts', to_jsonb(5)),
      'qrTtl',
        COALESCE(policy->'qrTtl', policy->'tokenTtl', to_jsonb('24h'::text)),
      'ccOnTenantApplication',
        COALESCE(policy->'ccOnTenantApplication', to_jsonb(true)),
      'ccOnMaintenance',
        COALESCE(policy->'ccOnMaintenance', to_jsonb(true)),
      'ccOnPasswordChanged',
        COALESCE(policy->'ccOnPasswordChanged', to_jsonb(true))
    )
  ),
  updated_at = now()
WHERE id = 1;

-- =============================================================================
-- Step 2: Patch rpc_jury_verify_pin to read maxPinAttempts
-- =============================================================================
-- Replaces the definition from 009_audit_actor_enrichment.sql (the last redef).
-- Only the JSONB key string changes: maxLoginAttempts → maxPinAttempts.

CREATE OR REPLACE FUNCTION public.rpc_jury_verify_pin(
  p_period_id  UUID,
  p_juror_id   UUID,
  p_pin        TEXT,
  p_device     JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_juror         jurors%ROWTYPE;
  v_attempts      INT;
  v_max_attempts  INT;
  v_cooldown      TEXT;
  v_cooldown_itv  INTERVAL;
  v_is_locked     BOOLEAN;
  v_locked_until  TIMESTAMPTZ;
  v_match         BOOLEAN;
  v_session_token TEXT;
BEGIN
  -- Read policy
  SELECT
    CASE WHEN (policy->>'maxPinAttempts') ~ '^[0-9]+$'
         THEN (policy->>'maxPinAttempts')::INT END,
    COALESCE(policy->>'pinLockCooldown', '30m')
  INTO v_max_attempts, v_cooldown
  FROM security_policy WHERE id = 1;
  v_max_attempts := COALESCE(v_max_attempts, 5);
  v_cooldown_itv := regexp_replace(v_cooldown, 'm$', ' minutes')::INTERVAL;

  -- Load juror
  SELECT * INTO v_juror FROM jurors WHERE id = p_juror_id AND period_id = p_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'juror_not_found'; END IF;

  -- Lock check
  v_is_locked    := v_juror.pin_fail_count >= v_max_attempts
                    AND v_juror.pin_locked_at IS NOT NULL
                    AND (v_juror.pin_locked_at + v_cooldown_itv) > now();
  v_locked_until := CASE WHEN v_is_locked THEN v_juror.pin_locked_at + v_cooldown_itv END;

  IF v_is_locked THEN
    RETURN json_build_object('ok', false, 'reason', 'locked', 'locked_until', v_locked_until);
  END IF;

  -- Verify PIN (plain comparison — matches existing v1 behavior)
  v_match := v_juror.pin = p_pin;

  IF NOT v_match THEN
    UPDATE jurors
       SET pin_fail_count = pin_fail_count + 1,
           pin_locked_at  = CASE WHEN pin_fail_count + 1 >= v_max_attempts THEN now() ELSE pin_locked_at END
     WHERE id = p_juror_id;
    SELECT pin_fail_count INTO v_attempts FROM jurors WHERE id = p_juror_id;
    RETURN json_build_object(
      'ok', false,
      'reason', 'bad_pin',
      'attempts', v_attempts,
      'max_attempts', v_max_attempts
    );
  END IF;

  -- Success: reset counters, issue session token
  v_session_token := encode(gen_random_bytes(24), 'hex');
  UPDATE jurors
     SET pin_fail_count = 0,
         pin_locked_at  = NULL,
         session_token  = v_session_token,
         session_issued_at = now(),
         last_device    = p_device
   WHERE id = p_juror_id;

  RETURN json_build_object(
    'ok', true,
    'session_token', v_session_token,
    'juror_id', p_juror_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_jury_verify_pin(UUID, UUID, TEXT, JSONB) TO anon, authenticated;

-- =============================================================================
-- Step 3: Patch rpc_admin_generate_entry_token to read qrTtl
-- =============================================================================
-- Replaces the definition from 008_audit_logs.sql (the last redef).
-- Only the JSONB key string changes: tokenTtl → qrTtl.
-- Function name stays rpc_admin_generate_entry_token (out of scope to rename).

CREATE OR REPLACE FUNCTION public.rpc_admin_generate_entry_token(p_period_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_token    TEXT;
  v_ttl_str  TEXT;
  v_ttl_itv  INTERVAL;
  v_expires  TIMESTAMPTZ;
BEGIN
  -- Auth: super_admin or org_admin on the period's organization
  v_actor_id := _assert_admin_for_period(p_period_id);

  -- Read qrTtl from security_policy; fall back to '24h'.
  SELECT COALESCE(policy->>'qrTtl', '24h')
  INTO v_ttl_str FROM security_policy WHERE id = 1;
  v_ttl_itv := regexp_replace(v_ttl_str, '([dh])$', ' \1ours')::INTERVAL;

  -- Revoke any existing active token for this period (single-token rule)
  UPDATE entry_tokens
     SET is_revoked = true, revoked_at = now(), revoked_by = v_actor_id
   WHERE period_id = p_period_id AND is_revoked = false;

  -- Generate + insert new token
  v_token := encode(gen_random_bytes(16), 'hex');
  v_expires := now() + v_ttl_itv;

  INSERT INTO entry_tokens (period_id, entry_token, expires_at, created_by)
  VALUES (p_period_id, v_token, v_expires, v_actor_id);

  -- Audit
  PERFORM _audit_write(
    v_actor_id,
    'admin.entry_token.generated',
    'entry_token',
    p_period_id::TEXT,
    jsonb_build_object('expires_at', v_expires, 'ttl', v_ttl_str)
  );

  RETURN json_build_object('ok', true, 'token', v_token, 'expires_at', v_expires);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_generate_entry_token(UUID) TO authenticated;

COMMIT;
```

> NOTE: The bodies of `rpc_jury_verify_pin` and `rpc_admin_generate_entry_token` above are copied directly from the current definitions in `sql/migrations/009_audit_actor_enrichment.sql` and `sql/migrations/008_audit_logs.sql`, with only the JSONB key lookup string changed. Before committing, open both of those migration files and verify the rest of the function body is byte-identical to what you see here. If any line differs (imports, helper calls, audit detail construction), copy the current definition verbatim and change only the `policy->>'maxLoginAttempts'` → `policy->>'maxPinAttempts'` and `policy->>'tokenTtl'` → `policy->>'qrTtl'` lines.

- [ ] **Step 2: Verify the migration body matches current SQL function definitions**

Run these greps and compare bodies:

```bash
# Get the most recent definition of rpc_jury_verify_pin
grep -A 80 "CREATE OR REPLACE FUNCTION public.rpc_jury_verify_pin" sql/migrations/009_audit_actor_enrichment.sql

# Get the most recent definition of rpc_admin_generate_entry_token
grep -A 60 "CREATE OR REPLACE FUNCTION public.rpc_admin_generate_entry_token" sql/migrations/008_audit_logs.sql
```

Expected: The function bodies in `025_security_policy_cleanup.sql` match these except for the two JSONB key lookup strings. If anything differs, copy the current body verbatim into the new migration and change only the two key strings.

- [ ] **Step 3: Update `sql/migrations/002_tables.sql` seed (lines 375-384)**

Open `sql/migrations/002_tables.sql` and locate the `security_policy` `CREATE TABLE` block around line 373. Replace the `DEFAULT` JSONB block with the new eleven-key schema:

```sql
CREATE TABLE security_policy (
  id         INT PRIMARY KEY DEFAULT 1,
  policy     JSONB NOT NULL DEFAULT '{
    "googleOAuth": true,
    "emailPassword": true,
    "rememberMe": true,
    "qrTtl": "24h",
    "maxPinAttempts": 5,
    "pinLockCooldown": "30m",
    "ccOnPinReset": true,
    "ccOnScoreEdit": false,
    "ccOnTenantApplication": true,
    "ccOnMaintenance": true,
    "ccOnPasswordChanged": true
  }'::JSONB,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT security_policy_single_row CHECK (id = 1)
);
```

The old default had `minPasswordLength`, `requireSpecialChars`, `allowMultiDevice`, `maxLoginAttempts`, `tokenTtl`. The new default has none of those; instead it has `qrTtl`, `maxPinAttempts`, `pinLockCooldown`, and the three new CC flags plus the two existing ones.

- [ ] **Step 4: Commit**

```bash
git add sql/migrations/025_security_policy_cleanup.sql sql/migrations/002_tables.sql
git commit -m "$(cat <<'EOF'
feat(sql): security_policy JSONB cleanup + key renames

Adds migration 025_security_policy_cleanup.sql that:
- Renames maxLoginAttempts → maxPinAttempts and tokenTtl → qrTtl in the
  security_policy.policy JSONB row.
- Prunes dead keys (minPasswordLength, requireSpecialChars, allowMultiDevice).
- Adds three new CC notification defaults (ccOnTenantApplication,
  ccOnMaintenance, ccOnPasswordChanged), all defaulting to true.
- Replaces rpc_jury_verify_pin and rpc_admin_generate_entry_token to read
  the renamed JSONB keys. Function names unchanged.

Also updates the fresh-install seed in 002_tables.sql to match the new schema.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Apply the migration and verify

**Files:** none (MCP action)

- [ ] **Step 1: Apply the migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with:

- `name`: `025_security_policy_cleanup`
- `query`: The entire contents of `sql/migrations/025_security_policy_cleanup.sql` (without the BEGIN/COMMIT — MCP applies in its own transaction)

Note: The MCP's `apply_migration` runs statements inside a transaction. If the SQL includes `BEGIN;` and `COMMIT;`, strip them before passing to the tool. Otherwise pass the SQL as-is.

Expected: success response.

- [ ] **Step 2: Verify the new policy shape**

Use `mcp__claude_ai_Supabase__execute_sql` with:

```sql
SELECT policy, jsonb_object_keys(policy) AS key
FROM security_policy
WHERE id = 1
ORDER BY key;
```

Expected: exactly eleven keys, sorted: `ccOnMaintenance`, `ccOnPasswordChanged`, `ccOnPinReset`, `ccOnScoreEdit`, `ccOnTenantApplication`, `emailPassword`, `googleOAuth`, `maxPinAttempts`, `pinLockCooldown`, `qrTtl`, `rememberMe`.

No `maxLoginAttempts`, no `tokenTtl`, no `minPasswordLength`, no `requireSpecialChars`, no `allowMultiDevice`.

- [ ] **Step 3: Verify idempotence**

Re-run the same `apply_migration` call (or manually execute the `UPDATE` portion). Then re-run the verification SELECT. Expected: the policy is unchanged (same eleven keys, same values).

- [ ] **Step 4: Spot-check SQL function definitions**

```sql
SELECT pg_get_functiondef('public.rpc_jury_verify_pin(uuid,uuid,text,jsonb)'::regprocedure) AS def;
```

Expected: the returned text contains `policy->>'maxPinAttempts'` and does NOT contain `policy->>'maxLoginAttempts'`.

```sql
SELECT pg_get_functiondef('public.rpc_admin_generate_entry_token(uuid)'::regprocedure) AS def;
```

Expected: contains `policy->>'qrTtl'` and does NOT contain `policy->>'tokenTtl'`.

---

## Task 3: Create the shared Edge Function helper

**Files:**

- Create: `supabase/functions/_shared/super-admin-cc.ts`

- [ ] **Step 1: Create the `_shared` directory and the helper file**

Write this file:

```typescript
// supabase/functions/_shared/super-admin-cc.ts
// ============================================================
// Shared helpers for Edge Functions that want to CC the super
// admin on outgoing notification emails.
//
// Two exports:
//   getSuperAdminEmails(service) — returns all super admin emails
//   shouldCcOn(service, field)   — reads security_policy.policy->>field
//
// Both functions defensively default to "CC on" on any error
// (missing service client, DB read failure) because missing a
// notification is worse than sending an extra CC.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getSuperAdminEmails(
  service: SupabaseClient,
): Promise<string[]> {
  try {
    const { data: members } = await service
      .from("memberships")
      .select("user_id")
      .is("organization_id", null)
      .eq("role", "super_admin");

    if (!members || members.length === 0) return [];

    const emails = await Promise.all(
      members.map(async (m: { user_id: string }) => {
        try {
          const { data } = await service.auth.admin.getUserById(m.user_id);
          return data?.user?.email || "";
        } catch {
          return "";
        }
      }),
    );

    return emails.filter(Boolean);
  } catch {
    return [];
  }
}

export async function shouldCcOn(
  service: SupabaseClient,
  field: string,
): Promise<boolean> {
  try {
    const { data } = await service
      .from("security_policy")
      .select("policy")
      .eq("id", 1)
      .single();
    const value = data?.policy?.[field];
    // Default to true (notify) if the field is missing or unreadable.
    return value !== false;
  } catch {
    return true;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/super-admin-cc.ts
git commit -m "$(cat <<'EOF'
feat(edge): shared super-admin CC helper for notification functions

Adds supabase/functions/_shared/super-admin-cc.ts with two exports:
- getSuperAdminEmails(service): returns all super admin emails
- shouldCcOn(service, field): reads security_policy.policy[field]

Both default to "CC on" on any error path so missing notifications
are preferred over silent drops. Consumed by five notification
Edge Functions in following commits.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Refactor request-pin-reset and request-score-edit to use the shared helper

**Files:**

- Modify: `supabase/functions/request-pin-reset/index.ts`
- Modify: `supabase/functions/request-score-edit/index.ts`

- [ ] **Step 1: Read the current `request-pin-reset/index.ts` in full**

```bash
cat supabase/functions/request-pin-reset/index.ts
```

Locate:
1. The inline `shouldCcSuperAdmin()` function (currently around lines 155-172)
2. The inline super-admin email lookup inside `resolveAdminEmails()` (or wherever it queries memberships where `role='super_admin'`)
3. The `getServiceClient()` factory

- [ ] **Step 2: Edit `request-pin-reset/index.ts` to import and use the shared helper**

Add at the top of the file, near the other imports:

```typescript
import { getSuperAdminEmails, shouldCcOn } from "../_shared/super-admin-cc.ts";
```

Replace the inline `shouldCcSuperAdmin()` function definition with a wrapper:

```typescript
async function shouldCcSuperAdmin(): Promise<boolean> {
  const client = getServiceClient();
  if (!client) return true;
  return await shouldCcOn(client, "ccOnPinReset");
}
```

Also remove the backward-compatibility `ccSuperAdminOnPinReset` fallback — the old key no longer exists in the JSONB after migration 025.

Find the section of `resolveAdminEmails()` (or equivalent) that queries `.is("organization_id", null).eq("role", "super_admin")` and replace it with a call to the shared helper:

```typescript
// Inside resolveAdminEmails or wherever super admin emails are collected:
const ccEmails = await getSuperAdminEmails(client);
```

(Keep the tenant admin / org admin resolution separate — the shared helper only handles super admins.)

- [ ] **Step 3: Read the current `request-score-edit/index.ts` and apply the same pattern**

```bash
cat supabase/functions/request-score-edit/index.ts
```

The structure mirrors `request-pin-reset`. Apply the same three changes:

Three changes, same as `request-pin-reset`:

Add the import at the top:

```typescript
import { getSuperAdminEmails, shouldCcOn } from "../_shared/super-admin-cc.ts";
```

Replace the inline super-admin email fetch with `getSuperAdminEmails(client)`.

Replace the inline policy read for `ccOnScoreEdit` with `shouldCcOn(client, "ccOnScoreEdit")`.

- [ ] **Step 4: Verify the refactored files still compile (Deno typecheck)**

If Deno is available locally:

```bash
deno check supabase/functions/request-pin-reset/index.ts
deno check supabase/functions/request-score-edit/index.ts
```

Expected: no errors.

If Deno is not installed, skip this step — the Supabase MCP `deploy_edge_function` call in Task 8 will report any type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/request-pin-reset/index.ts supabase/functions/request-score-edit/index.ts
git commit -m "$(cat <<'EOF'
refactor(edge): use shared super-admin CC helper in request-pin-reset and request-score-edit

Both functions previously had their own inline copies of:
- The super admin email lookup query
- A shouldCcSuperAdmin() implementation reading security_policy

They now both consume supabase/functions/_shared/super-admin-cc.ts for:
- getSuperAdminEmails(client)
- shouldCcOn(client, field)

Also removes the backward-compatibility fallback for the old
'ccSuperAdminOnPinReset' key, which no longer exists in the JSONB
after migration 025.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire CC into notify-application

**Files:**

- Modify: `supabase/functions/notify-application/index.ts`

The existing `notify-application` Edge Function:
- `application_submitted` currently CCs super admins **unconditionally** via `resolveAdminEmails()`. After this change, the CC is gated on `ccOnTenantApplication`.
- `application_approved` and `application_rejected` currently do NOT CC super admins. After this change, they do CC super admins when `ccOnTenantApplication` is true.

- [ ] **Step 1: Add the shared helper import at the top of the file**

Open `supabase/functions/notify-application/index.ts`. Add this line after the existing `createClient` import:

```typescript
import { getSuperAdminEmails, shouldCcOn } from "../_shared/super-admin-cc.ts";
```

- [ ] **Step 2: Update the `application_submitted` case to gate CC on the flag**

Locate the `switch (payload.type)` block and the `case "application_submitted":` section. Currently it assigns:

```typescript
to = toEmails;
cc = ccEmails;
```

Change to:

```typescript
to = toEmails;

// Gate CC super admin on the ccOnTenantApplication policy flag.
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (supabaseUrl && serviceKey) {
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const ccOn = await shouldCcOn(service, "ccOnTenantApplication");
  cc = ccOn ? ccEmails : [];
} else {
  cc = [];
}
```

- [ ] **Step 3: Update the `application_approved` and `application_rejected` cases to CC when the flag is on**

At the top of each case body (before setting `subject`, `body`, `html`), add:

```typescript
// CC super admins if ccOnTenantApplication is on.
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (supabaseUrl && serviceKey) {
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const ccOn = await shouldCcOn(service, "ccOnTenantApplication");
  if (ccOn) {
    cc = await getSuperAdminEmails(service);
  }
}
```

- [ ] **Step 4: Deduplicate the service client bootstrap**

If the previous two steps produce three near-identical blocks that create a service client, extract a single helper at the top of the Deno.serve handler body:

```typescript
function getServiceClientOrNull() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}
```

Then each case uses:

```typescript
const service = getServiceClientOrNull();
if (service) {
  const ccOn = await shouldCcOn(service, "ccOnTenantApplication");
  // ... gate logic
}
```

Place `getServiceClientOrNull` at module scope (top of file, near `sendViaResend`).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-application/index.ts
git commit -m "$(cat <<'EOF'
feat(edge): gate super-admin CC on ccOnTenantApplication in notify-application

- application_submitted: CC super admin only when the flag is on
  (previously unconditional).
- application_approved and application_rejected: CC super admin when
  the flag is on (previously no CC at all).

Uses the shared super-admin-cc helper for consistent policy reads.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire CC into notify-maintenance and password-changed-notify

**Files:**

- Modify: `supabase/functions/notify-maintenance/index.ts`
- Modify: `supabase/functions/password-changed-notify/index.ts`

These two functions send simpler emails (one type each) and currently do not CC super admins at all.

- [ ] **Step 1: Read `notify-maintenance/index.ts` to locate the Resend call and existing service client bootstrap**

```bash
cat supabase/functions/notify-maintenance/index.ts
```

Identify:
1. Whether a service client is already created somewhere (search for `createClient`)
2. The point where the Resend call is made (search for `api.resend.com`)
3. How the current `cc` array (if any) is built

- [ ] **Step 2: Edit `notify-maintenance/index.ts` to CC super admins when `ccOnMaintenance` is on**

Add the shared helper import near the top of the file:

```typescript
import { getSuperAdminEmails, shouldCcOn } from "../_shared/super-admin-cc.ts";
```

Immediately before the Resend `sendViaResend` / `fetch("https://api.resend.com/emails")` call, build the CC array:

```typescript
// CC super admins if ccOnMaintenance is on.
let ccEmails: string[] = [];
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (supabaseUrl && serviceKey) {
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const ccOn = await shouldCcOn(service, "ccOnMaintenance");
  if (ccOn) {
    ccEmails = await getSuperAdminEmails(service);
  }
}
```

If the file already imports `createClient` from `@supabase/supabase-js`, reuse it. If not, add:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

Then pass `ccEmails` to the send function. If the current send call looks like:

```typescript
sendViaResend(resendKey, to, subject, body, html, from);
```

Change to:

```typescript
sendViaResend(resendKey, to, subject, body, html, from, ccEmails);
```

If `sendViaResend` does not currently accept a `cc` parameter, update its signature the same way it is used in `notify-application/index.ts`:

```typescript
async function sendViaResend(
  apiKey: string,
  to: string | string[],
  subject: string,
  body: string,
  html: string,
  from: string,
  cc?: string[],
): Promise<{ ok: boolean; error?: string }> {
  // ... existing logic
  const ccArr = (cc || []).filter(Boolean);
  // ... include ccArr in payload if non-empty (see notify-application pattern)
}
```

- [ ] **Step 3: Apply the same pattern to `password-changed-notify/index.ts` using `ccOnPasswordChanged`**

Import:

```typescript
import { getSuperAdminEmails, shouldCcOn } from "../_shared/super-admin-cc.ts";
```

Immediately before the Resend send call:

```typescript
// CC super admins if ccOnPasswordChanged is on.
let ccEmails: string[] = [];
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (supabaseUrl && serviceKey) {
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const ccOn = await shouldCcOn(service, "ccOnPasswordChanged");
  if (ccOn) {
    ccEmails = await getSuperAdminEmails(service);
  }
}
```

Pass `ccEmails` to the existing Resend call, adjusting the send helper's signature as in Step 2 if needed.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-maintenance/index.ts supabase/functions/password-changed-notify/index.ts
git commit -m "$(cat <<'EOF'
feat(edge): CC super admin on maintenance and password-change notifications

- notify-maintenance reads ccOnMaintenance from security_policy and
  CCs all super admins on maintenance window emails when on.
- password-changed-notify reads ccOnPasswordChanged and CCs all
  super admins on account password change notifications when on.

Both use the shared super-admin-cc helper for policy reads.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Deploy all five updated Edge Functions

**Files:** none (MCP action)

- [ ] **Step 1: Deploy request-pin-reset**

Use `mcp__claude_ai_Supabase__deploy_edge_function`:

- `name`: `request-pin-reset`
- `files`: include both `request-pin-reset/index.ts` and the shared `_shared/super-admin-cc.ts`

Expected: deployment succeeds with status 200 / ok.

- [ ] **Step 2: Deploy request-score-edit**

Same call with `name: request-score-edit`.

- [ ] **Step 3: Deploy notify-application**

Same call with `name: notify-application`.

- [ ] **Step 4: Deploy notify-maintenance**

Same call with `name: notify-maintenance`.

- [ ] **Step 5: Deploy password-changed-notify**

Same call with `name: password-changed-notify`.

- [ ] **Step 6: Verify deployments**

Use `mcp__claude_ai_Supabase__list_edge_functions` and check that all five functions are listed with the new `updated_at` timestamp.

Optional smoke test: trigger each function via its normal calling path (login a locked juror → PIN reset; submit a test application → notify-application submitted). Check the email logs for the CC field presence.

---

## Task 8: Update the JS policy default and API JSDoc

**Files:**

- Modify: `src/auth/SecurityPolicyContext.jsx`
- Modify: `src/shared/api/admin/security.js`

- [ ] **Step 1: Update `DEFAULT_POLICY` in `SecurityPolicyContext.jsx`**

Open `src/auth/SecurityPolicyContext.jsx`. Replace the `DEFAULT_POLICY` export (currently lines 8-20) with:

```javascript
export const DEFAULT_POLICY = {
  googleOAuth: true,
  emailPassword: true,
  rememberMe: true,
  qrTtl: "24h",
  maxPinAttempts: 5,
  pinLockCooldown: "30m",
  ccOnPinReset: true,
  ccOnScoreEdit: false,
  ccOnTenantApplication: true,
  ccOnMaintenance: true,
  ccOnPasswordChanged: true,
};
```

Remove the comment `// allowMultiDevice intentionally omitted — removed from drawer and schema.` — no longer relevant.

- [ ] **Step 2: Rewrite the JSDoc in `src/shared/api/admin/security.js`**

Open the file. Replace both JSDoc blocks (`getSecurityPolicy` and `setSecurityPolicy`) with:

```javascript
/**
 * Super admin — read the current security policy for the admin drawer.
 * @returns {Promise<{
 *   googleOAuth: boolean,
 *   emailPassword: boolean,
 *   rememberMe: boolean,
 *   qrTtl: string,
 *   maxPinAttempts: number,
 *   pinLockCooldown: string,
 *   ccOnPinReset: boolean,
 *   ccOnScoreEdit: boolean,
 *   ccOnTenantApplication: boolean,
 *   ccOnMaintenance: boolean,
 *   ccOnPasswordChanged: boolean,
 *   updated_at: string|null
 * }>}
 */
export async function getSecurityPolicy() {
  const { data, error } = await supabase.rpc("rpc_admin_get_security_policy");
  if (error) throw error;
  return data;
}

/**
 * Super admin — persist the security policy.
 * @param {{
 *   googleOAuth: boolean,
 *   emailPassword: boolean,
 *   rememberMe: boolean,
 *   qrTtl: string,
 *   maxPinAttempts: number,
 *   pinLockCooldown: string,
 *   ccOnPinReset: boolean,
 *   ccOnScoreEdit: boolean,
 *   ccOnTenantApplication: boolean,
 *   ccOnMaintenance: boolean,
 *   ccOnPasswordChanged: boolean
 * }} policy
 */
export async function setSecurityPolicy(policy) {
  const { data, error } = await supabase.rpc("rpc_admin_set_security_policy", {
    p_policy: policy,
  });
  if (error) throw error;
  return data;
}
```

The function bodies are unchanged — only the JSDoc `@returns` and `@param` blocks change. No `allowMultiDevice`, no `minPasswordLength`, no old key names.

- [ ] **Step 3: Commit**

```bash
git add src/auth/SecurityPolicyContext.jsx src/shared/api/admin/security.js
git commit -m "$(cat <<'EOF'
chore(auth): align DEFAULT_POLICY and security API JSDoc with new schema

DEFAULT_POLICY in SecurityPolicyContext drops minPasswordLength,
maxLoginAttempts, requireSpecialChars, tokenTtl, and picks up
qrTtl, maxPinAttempts, pinLockCooldown, ccOnTenantApplication,
ccOnMaintenance, ccOnPasswordChanged.

security.js JSDoc blocks rewritten to document the eleven-key
target schema. No runtime changes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Register QA catalog entries and write failing drawer tests

**Files:**

- Modify: `src/test/qa-catalog.json`
- Create: `src/admin/__tests__/SecurityPolicyDrawer.test.jsx`

- [ ] **Step 1: Confirm the qa-catalog.json format**

```bash
head -30 src/test/qa-catalog.json
```

Expected: a JSON array of objects, each with fields `id`, `module`, `area`, `story`, `scenario`, `whyItMatters`, `risk`, `coverageStrength`, `severity`. IDs use dot-notation like `grid.filter.03`.

- [ ] **Step 2: Add six new QA catalog entries**

Append these six objects to the array in `src/test/qa-catalog.json` (before the closing `]`, after the last existing entry, with a comma after the previous last entry):

```json
  {
    "id": "security.policy.drawer.schema",
    "module": "Settings / Security Policy",
    "area": "Security Policy Drawer — Save Payload",
    "story": "New eleven-key policy schema",
    "scenario": "save payload contains all eleven new-schema keys and no dead keys",
    "whyItMatters": "After the JSONB rename, saves must use qrTtl/maxPinAttempts/ccOnTenantApplication/ccOnMaintenance/ccOnPasswordChanged instead of the old key names so DB and drawer stay in sync.",
    "risk": "If the drawer writes old key names, the JSONB gains orphan keys and SQL functions read stale defaults.",
    "coverageStrength": "Strong",
    "severity": "critical"
  },
  {
    "id": "security.policy.drawer.auth_safeguard",
    "module": "Settings / Security Policy",
    "area": "Security Policy Drawer — Auth Safeguard",
    "story": "At least one authentication method required",
    "scenario": "save blocked when both Google OAuth and Email/Password are disabled",
    "whyItMatters": "Without the safeguard, a super admin could lock the entire platform out by disabling both auth methods in one save.",
    "risk": "Total platform lockout requiring DB surgery to recover.",
    "coverageStrength": "Strong",
    "severity": "critical"
  },
  {
    "id": "security.policy.drawer.master_toggle_on",
    "module": "Settings / Security Policy",
    "area": "Security Policy Drawer — Master Notifications Toggle",
    "story": "Master toggle flips all children on",
    "scenario": "clicking master from off sets all five CC child toggles to true",
    "whyItMatters": "The master is a convenience control; users expect a single click to enable every notification CC at once.",
    "risk": "Broken master toggle would force users to toggle each child individually.",
    "coverageStrength": "Medium",
    "severity": "normal"
  },
  {
    "id": "security.policy.drawer.master_toggle_off",
    "module": "Settings / Security Policy",
    "area": "Security Policy Drawer — Master Notifications Toggle",
    "story": "Master toggle flips all children off",
    "scenario": "clicking master from on sets all five CC child toggles to false",
    "whyItMatters": "Symmetric counterpart to the on case — users expect the same shortcut in reverse.",
    "risk": "Asymmetric behavior would confuse users and leave notifications enabled unexpectedly.",
    "coverageStrength": "Medium",
    "severity": "normal"
  },
  {
    "id": "security.policy.drawer.no_password_section",
    "module": "Settings / Security Policy",
    "area": "Security Policy Drawer — Removed Section",
    "story": "Password Requirements section removed",
    "scenario": "drawer does not render the Password Requirements section or its fields",
    "whyItMatters": "The old section was dead (no enforcement). Leaving it visible creates false security expectations.",
    "risk": "Re-introducing the section would restore the dead-setting problem.",
    "coverageStrength": "Medium",
    "severity": "normal"
  },
  {
    "id": "security.policy.drawer.new_labels",
    "module": "Settings / Security Policy",
    "area": "Security Policy Drawer — Renamed Labels",
    "story": "QR terminology in user-facing labels",
    "scenario": "drawer shows 'QR Code TTL' and 'Max PIN Attempts' labels instead of the old Entry Token and Login Attempts labels",
    "whyItMatters": "Terminology in the drawer must match what super admins see elsewhere; 'Entry Token' and 'Login Attempts' were developer jargon and misleading respectively.",
    "risk": "Label regression would reintroduce the confusing terminology.",
    "coverageStrength": "Medium",
    "severity": "normal"
  }
```

- [ ] **Step 3: Write the failing test file**

Create `src/admin/__tests__/SecurityPolicyDrawer.test.jsx` with:

```jsx
// src/admin/__tests__/SecurityPolicyDrawer.test.jsx
// Tests for the rewritten Security Policy drawer.
// Covers the new three-section layout, the rename from tokenTtl/maxLoginAttempts
// to qrTtl/maxPinAttempts, the master-of-children notifications toggle, the
// at-least-one-auth-method safeguard, and the absence of the old Password
// Requirements section.

import { describe, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";
import SecurityPolicyDrawer from "../drawers/SecurityPolicyDrawer.jsx";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

function renderDrawer(overrides = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(),
    error: null,
    policy: {
      googleOAuth: true,
      emailPassword: true,
      rememberMe: true,
      qrTtl: "24h",
      maxPinAttempts: 5,
      pinLockCooldown: "30m",
      ccOnPinReset: true,
      ccOnScoreEdit: false,
      ccOnTenantApplication: true,
      ccOnMaintenance: true,
      ccOnPasswordChanged: true,
    },
  };
  return render(<SecurityPolicyDrawer {...defaultProps} {...overrides} />);
}

describe("SecurityPolicyDrawer", () => {
  qaTest("security_policy.drawer.schema", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({ onSave });
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({
      googleOAuth: true,
      emailPassword: true,
      rememberMe: true,
      qrTtl: "24h",
      maxPinAttempts: 5,
      pinLockCooldown: "30m",
      ccOnPinReset: true,
      ccOnScoreEdit: false,
      ccOnTenantApplication: true,
      ccOnMaintenance: true,
      ccOnPasswordChanged: true,
    });
    expect(saved).not.toHaveProperty("minPasswordLength");
    expect(saved).not.toHaveProperty("maxLoginAttempts");
    expect(saved).not.toHaveProperty("requireSpecialChars");
    expect(saved).not.toHaveProperty("tokenTtl");
    expect(saved).not.toHaveProperty("allowMultiDevice");
  });

  qaTest("security_policy.drawer.auth_safeguard", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({
      onSave,
      policy: {
        googleOAuth: false,
        emailPassword: false,
        rememberMe: true,
        qrTtl: "24h",
        maxPinAttempts: 5,
        pinLockCooldown: "30m",
        ccOnPinReset: true,
        ccOnScoreEdit: true,
        ccOnTenantApplication: true,
        ccOnMaintenance: true,
        ccOnPasswordChanged: true,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/at least one authentication method must remain enabled/i),
      ).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  qaTest("security_policy.drawer.master_toggle_on", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({
      onSave,
      policy: {
        googleOAuth: true,
        emailPassword: true,
        rememberMe: true,
        qrTtl: "24h",
        maxPinAttempts: 5,
        pinLockCooldown: "30m",
        ccOnPinReset: false,
        ccOnScoreEdit: false,
        ccOnTenantApplication: false,
        ccOnMaintenance: false,
        ccOnPasswordChanged: false,
      },
    });
    // Master toggle is the one whose label contains "CC Super Admin on All Notifications".
    const masterLabel = screen.getByText(/cc super admin on all notifications/i);
    const masterToggle = masterLabel.closest("div")?.querySelector("label") ||
      masterLabel.parentElement?.querySelector("label");
    if (!masterToggle) throw new Error("Could not find master toggle element");
    fireEvent.click(masterToggle);
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.ccOnPinReset).toBe(true);
    expect(saved.ccOnScoreEdit).toBe(true);
    expect(saved.ccOnTenantApplication).toBe(true);
    expect(saved.ccOnMaintenance).toBe(true);
    expect(saved.ccOnPasswordChanged).toBe(true);
  });

  qaTest("security_policy.drawer.master_toggle_off", async () => {
    const onSave = vi.fn().mockResolvedValue();
    renderDrawer({ onSave });
    // Default policy has all five children on → master reads as on.
    const masterLabel = screen.getByText(/cc super admin on all notifications/i);
    const masterToggle = masterLabel.closest("div")?.querySelector("label") ||
      masterLabel.parentElement?.querySelector("label");
    if (!masterToggle) throw new Error("Could not find master toggle element");
    fireEvent.click(masterToggle);
    fireEvent.click(screen.getByRole("button", { name: /save policy/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.ccOnPinReset).toBe(false);
    expect(saved.ccOnScoreEdit).toBe(false);
    expect(saved.ccOnTenantApplication).toBe(false);
    expect(saved.ccOnMaintenance).toBe(false);
    expect(saved.ccOnPasswordChanged).toBe(false);
  });

  qaTest("security_policy.drawer.no_password_section", async () => {
    renderDrawer();
    expect(screen.queryByText(/password requirements/i)).toBeNull();
    expect(screen.queryByText(/minimum length/i)).toBeNull();
    expect(screen.queryByText(/max login attempts/i)).toBeNull();
  });

  qaTest("security_policy.drawer.new_labels", async () => {
    renderDrawer();
    expect(screen.getByText(/qr code ttl/i)).toBeInTheDocument();
    expect(screen.getByText(/max pin attempts/i)).toBeInTheDocument();
    expect(screen.queryByText(/entry token ttl/i)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test file and confirm it fails**

```bash
npm test -- --run src/admin/__tests__/SecurityPolicyDrawer.test.jsx
```

Expected: tests fail because the drawer still has the old schema, old labels, and the Password Requirements section. Each `qaTest` should report specific assertion failures (e.g., `saved.qrTtl` undefined, "QR Code TTL" not found, "Password Requirements" still present). This is the TDD red step — **do not proceed to implementation until all six tests have failed for the expected reasons.**

- [ ] **Step 5: Commit the failing tests**

```bash
git add src/test/qa-catalog.json src/admin/__tests__/SecurityPolicyDrawer.test.jsx
git commit -m "$(cat <<'EOF'
test(drawer): failing tests for new Security Policy drawer layout

Adds six qaTest cases covering the rewritten drawer:
- schema: save payload uses the eleven-key new schema (no dead keys)
- auth_safeguard: blocks save when both OAuth and email/password are off
- master_toggle_on: master notifications toggle turns all 5 children on
- master_toggle_off: master toggle turns all 5 children off
- no_password_section: Password Requirements section is removed
- new_labels: QR Code TTL and Max PIN Attempts labels present

All six tests currently fail against the old drawer — implementation
in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Rewrite the Security Policy drawer component

**Files:**

- Modify: `src/admin/drawers/SecurityPolicyDrawer.jsx`

This is the biggest single edit in the plan. The drawer is rewritten in full.

- [ ] **Step 1: Replace the entire contents of `src/admin/drawers/SecurityPolicyDrawer.jsx`**

Write this complete file:

```jsx
// src/admin/drawers/SecurityPolicyDrawer.jsx
// Drawer: edit platform-wide security policy (Super Admin only).
//
// Three sections:
//   1. Authentication Methods — Google OAuth, Email/Password, Remember Me
//      + safeguard: at least one of Google OAuth or Email/Password must be on
//   2. QR Access — QR Code TTL, Max PIN Attempts, PIN Lockout Cooldown
//   3. Notifications — master "CC Super Admin on All Notifications" toggle
//      + five granular child toggles (PIN Reset, Score Edit, Tenant
//      Application, Maintenance, Password Changed)
//
// Props:
//   open    — boolean
//   onClose — () => void
//   policy  — eleven-key policy (see DEFAULT_POLICY below)
//   onSave  — (policy) => Promise<void>
//   error   — string | null

import { useState, useEffect } from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import CustomSelect from "@/shared/ui/CustomSelect";
import useShakeOnError from "@/shared/hooks/useShakeOnError";

const DEFAULT_POLICY = {
  googleOAuth: true,
  emailPassword: true,
  rememberMe: true,
  qrTtl: "24h",
  maxPinAttempts: 5,
  pinLockCooldown: "30m",
  ccOnPinReset: true,
  ccOnScoreEdit: false,
  ccOnTenantApplication: true,
  ccOnMaintenance: true,
  ccOnPasswordChanged: true,
};

const QR_TTL_OPTIONS = [
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
  { value: "48h", label: "48 hours" },
  { value: "7d", label: "7 days" },
];

const PIN_LOCK_COOLDOWN_OPTIONS = [
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "60m", label: "60 minutes" },
];

function Toggle({ checked, onChange, disabled, indeterminate = false }) {
  const trackBg = checked ? "var(--accent)" : "var(--surface-2)";
  const trackOpacity = indeterminate ? 0.5 : 1;
  const thumbX = indeterminate ? 8 : checked ? 16 : 0;

  return (
    <label
      style={{
        position: "relative",
        width: 38,
        height: 22,
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
      }}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onChange(!checked);
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: trackBg,
          borderRadius: 11,
          transition: "background .2s, opacity .2s",
          opacity: trackOpacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 18,
          height: 18,
          background: "white",
          borderRadius: "50%",
          transition: "transform .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transform: `translateX(${thumbX}px)`,
        }}
      />
    </label>
  );
}

function ToggleRow({ title, desc, checked, onChange, disabled, indeterminate = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div className="text-xs text-muted" style={{ marginTop: 2 }}>{desc}</div>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        indeterminate={indeterminate}
      />
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 650,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: -4,
      }}
    >
      {children}
    </div>
  );
}

export default function SecurityPolicyDrawer({ open, onClose, policy, onSave, error }) {
  const [form, setForm] = useState(DEFAULT_POLICY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedPinLockCooldown =
    PIN_LOCK_COOLDOWN_OPTIONS.find((opt) => opt.value === form.pinLockCooldown)?.label ||
    "30 minutes";

  useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_POLICY, ...policy });
      setSaveError("");
      setSaving(false);
    }
  }, [open, policy]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Master CC toggle derived state
  const ccChildren = [
    form.ccOnPinReset,
    form.ccOnScoreEdit,
    form.ccOnTenantApplication,
    form.ccOnMaintenance,
    form.ccOnPasswordChanged,
  ];
  const ccAllOn = ccChildren.every(Boolean);
  const ccAnyOn = ccChildren.some(Boolean);
  const ccMixed = ccAnyOn && !ccAllOn;

  const handleMasterToggle = () => {
    const next = !ccAllOn;
    setForm((f) => ({
      ...f,
      ccOnPinReset: next,
      ccOnScoreEdit: next,
      ccOnTenantApplication: next,
      ccOnMaintenance: next,
      ccOnPasswordChanged: next,
    }));
  };

  const handleSave = async () => {
    setSaveError("");
    // Safeguard: at least one authentication method must remain enabled.
    if (!form.googleOAuth && !form.emailPassword) {
      setSaveError("At least one authentication method must remain enabled.");
      return;
    }
    setSaving(true);
    try {
      await onSave?.({ ...form });
      onClose();
    } catch (e) {
      setSaveError(e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const displayError = saveError || error;
  const saveBtnRef = useShakeOnError(displayError);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                background: "rgba(217,119,6,0.08)",
                border: "1px solid rgba(217,119,6,0.12)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" style={{ width: 17, height: 17 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Security Policy</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                Platform-wide authentication, access, and notifications
              </div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fs-drawer-body" style={{ gap: 16 }}>
        {displayError && (
          <div className="fs-alert danger" style={{ marginBottom: 4 }}>
            <div className="fs-alert-icon"><AlertCircle size={15} /></div>
            <div className="fs-alert-body">{displayError}</div>
          </div>
        )}

        {/* ── Section 1: Authentication Methods ─────────────────────────── */}
        <SectionLabel>Authentication Methods</SectionLabel>
        <ToggleRow
          title="Google OAuth"
          desc="Allow sign-in with Google accounts"
          checked={form.googleOAuth}
          onChange={(v) => set("googleOAuth", v)}
          disabled={saving}
        />
        <ToggleRow
          title="Email/Password Login"
          desc="Allow traditional email and password authentication"
          checked={form.emailPassword}
          onChange={(v) => set("emailPassword", v)}
          disabled={saving}
        />
        <ToggleRow
          title="Remember Me (30-day sessions)"
          desc="Allow persistent sessions across browser restarts"
          checked={form.rememberMe}
          onChange={(v) => set("rememberMe", v)}
          disabled={saving}
        />

        {/* ── Section 2: QR Access ──────────────────────────────────────── */}
        <SectionLabel>QR Access</SectionLabel>
        <div
          style={{
            border: "1px solid rgba(96,165,250,0.2)",
            background: "linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(15,23,42,0.02) 100%)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(96,165,250,0.24)",
                  color: "var(--accent)",
                }}
              >
                <ShieldAlert size={13} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--text-primary)" }}>
                Jury QR Controls
              </div>
            </div>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 650,
                letterSpacing: "0.3px",
                textTransform: "uppercase",
                color: "var(--accent)",
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(96,165,250,0.24)",
                borderRadius: 999,
                padding: "2px 7px",
              }}
            >
              Risk Control
            </span>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">QR Code TTL</label>
            <CustomSelect
              value={form.qrTtl}
              onChange={(v) => set("qrTtl", v)}
              disabled={saving}
              options={QR_TTL_OPTIONS}
              ariaLabel="QR code TTL"
            />
            <div className="fs-field-helper hint">
              How long jury QR codes remain valid after generation.
            </div>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">Max PIN Attempts</label>
            <input
              className="fs-input"
              type="number"
              value={form.maxPinAttempts}
              onChange={(e) => set("maxPinAttempts", Number(e.target.value))}
              min={3}
              max={20}
              disabled={saving}
            />
            <div className="fs-field-helper hint">
              Number of failed PIN attempts before a juror is locked out.
            </div>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">PIN Lockout Cooldown</label>
            <CustomSelect
              value={form.pinLockCooldown}
              onChange={(v) => set("pinLockCooldown", v)}
              disabled={saving}
              options={PIN_LOCK_COOLDOWN_OPTIONS}
              ariaLabel="PIN lock cooldown duration"
            />
            <div className="fs-field-helper hint">
              After max failed PIN attempts, juror access is locked for {selectedPinLockCooldown.toLowerCase()}.
            </div>
          </div>
        </div>

        {/* ── Section 3: Notifications ──────────────────────────────────── */}
        <SectionLabel>Notifications</SectionLabel>
        <ToggleRow
          title="CC Super Admin on All Notifications"
          desc="Toggle all five notification CC flags at once"
          checked={ccAllOn}
          onChange={handleMasterToggle}
          disabled={saving}
          indeterminate={ccMixed}
        />
        <ToggleRow
          title="PIN Reset Requests"
          desc="Receive a copy when a juror requests a PIN reset"
          checked={form.ccOnPinReset}
          onChange={(v) => set("ccOnPinReset", v)}
          disabled={saving}
        />
        <ToggleRow
          title="Score Edit Requests"
          desc="Receive a copy when a juror requests score editing"
          checked={form.ccOnScoreEdit}
          onChange={(v) => set("ccOnScoreEdit", v)}
          disabled={saving}
        />
        <ToggleRow
          title="Tenant Application Events"
          desc="Receive a copy when a tenant application is submitted, approved, or rejected"
          checked={form.ccOnTenantApplication}
          onChange={(v) => set("ccOnTenantApplication", v)}
          disabled={saving}
        />
        <ToggleRow
          title="Maintenance Notifications"
          desc="Receive a copy when platform maintenance windows are announced"
          checked={form.ccOnMaintenance}
          onChange={(v) => set("ccOnMaintenance", v)}
          disabled={saving}
        />
        <ToggleRow
          title="Password Changed"
          desc="Receive a copy when an admin changes their account password"
          checked={form.ccOnPasswordChanged}
          onChange={(v) => set("ccOnPasswordChanged", v)}
          disabled={saving}
        />
      </div>

      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          ref={saveBtnRef}
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          <span className="btn-loading-content">
            <AsyncButtonContent loading={saving} loadingText="Saving…">Save Policy</AsyncButtonContent>
          </span>
        </button>
      </div>
    </Drawer>
  );
}
```

- [ ] **Step 2: Run the drawer tests and verify they all pass**

```bash
npm test -- --run src/admin/__tests__/SecurityPolicyDrawer.test.jsx
```

Expected: all six `qaTest` cases pass.

If any fail, read the failure message carefully before changing either the test or the component — most likely causes:

- Test `master_toggle_on`/`master_toggle_off`: the DOM-query strategy for locating the master toggle is heuristic. If it fails, adjust the test to use a more specific selector (e.g., `within(masterRow).getByRole(...)`), not the component.
- Test `new_labels`: if the label text is slightly different ("QR Code TTL" vs "QR code TTL"), match the component output.
- Test `auth_safeguard`: verify the error text matches exactly what the component sets in `setSaveError`.

- [ ] **Step 3: Run the full unit test suite to catch regressions**

```bash
npm test -- --run
```

Expected: the full suite passes. Existing tests that touch the drawer (if any) should still pass — if one fails because it still references the old schema, update that test in the same commit.

- [ ] **Step 4: Run the no-native-select check**

```bash
npm run check:no-native-select
```

Expected: `OK: no native <select> usage found in src/**/*.jsx|tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/drawers/SecurityPolicyDrawer.jsx
git commit -m "$(cat <<'EOF'
feat(admin): rewrite Security Policy drawer into three clean sections

- Authentication Methods: Google OAuth, Email/Password, Remember Me,
  plus a safeguard that blocks save when both OAuth and email/password
  are disabled.
- QR Access: QR Code TTL, Max PIN Attempts, PIN Lockout Cooldown, all
  grouped in a single Risk Control card. Renamed from Entry Token TTL
  and Max Login Attempts.
- Notifications: master "CC Super Admin on All Notifications" toggle
  (UI-only, indeterminate when children mixed) plus five granular
  children for PIN reset, score edit, tenant application, maintenance,
  and password changed.

Removes the Password Requirements section in its entirety; uses new
eleven-key schema matching the policy JSONB after migration 025.

All six qaTest cases added in the previous commit now pass.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual verification and final checks

**Files:** none (verification)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173`, log in as a super admin (use the `?admin` or OAuth flow), and navigate to Settings.

- [ ] **Step 2: Open the Security Policy drawer and visually verify the layout**

Click "Edit Security Policy" (or the equivalent trigger). Confirm:

- Header says "Security Policy" with the subtitle "Platform-wide authentication, access, and notifications"
- Three sections visible in order: Authentication Methods, QR Access, Notifications
- No Password Requirements section
- QR Access card has the blue Risk Control rozette
- QR Access has three fields: QR Code TTL dropdown, Max PIN Attempts number input, PIN Lockout Cooldown dropdown
- Notifications has six toggles: the master plus five children
- All default values are reasonable (from the DB)

- [ ] **Step 3: Manually test the safeguard**

Toggle both Google OAuth and Email/Password to off. Click Save Policy. Confirm:

- A danger FbAlert appears: "At least one authentication method must remain enabled."
- The Save button shakes
- The drawer does not close
- The RPC was NOT called (check Network tab)

- [ ] **Step 4: Manually test the master notifications toggle**

With all five child toggles in their default state:

1. Click the master toggle. Observe all children flip to the opposite state.
2. Click one child to create a mixed state.
3. Confirm the master renders with 50% track opacity and the thumb centered.
4. Click the master again. Observe all children flip to all-on.

- [ ] **Step 5: Save a valid policy and verify persistence**

Toggle one child (e.g., Score Edit Requests to on). Click Save Policy. Confirm:

- Drawer closes
- Refreshing the page and reopening the drawer shows the new state
- Check the DB:

```sql
SELECT policy FROM security_policy WHERE id = 1;
```

Confirm `ccOnScoreEdit` is now `true` in the JSONB.

- [ ] **Step 6: Run the production build**

```bash
npm run build
```

Expected: build succeeds without errors. No warnings about missing imports, undefined variables, or JSX issues in the files touched by this plan.

- [ ] **Step 7: Run the full test suite one final time**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 8: Smoke-test one notification Edge Function end-to-end (optional)**

If time permits, trigger `request-pin-reset` by intentionally locking out a test juror (enter wrong PIN five times on a test period) and pressing the recovery button. Check:

- The email arrives at the tenant admin inbox
- The super admin is in the CC list (because `ccOnPinReset` defaults to true)

Repeat with `ccOnPinReset` toggled off — super admin should NOT be in CC.

- [ ] **Step 9: Nothing to commit for this task**

If any of the verification steps revealed a bug, go back to the relevant task, fix it, and commit the fix. Otherwise this task has no output.

---

## Summary

After all eleven tasks:

- Migration `025_security_policy_cleanup.sql` has rewritten the policy JSONB to eleven keys
- Two SQL functions (`rpc_jury_verify_pin`, `rpc_admin_generate_entry_token`) read the new JSONB key names
- Five Edge Functions (`request-pin-reset`, `request-score-edit`, `notify-application`, `notify-maintenance`, `password-changed-notify`) share a helper and honor the corresponding CC flags
- `SecurityPolicyContext.DEFAULT_POLICY` and `security.js` JSDoc match the new schema
- `SecurityPolicyDrawer` has been rewritten with three sections, the auth safeguard, the master-of-children notifications toggle, and the renamed labels
- Six new `qaTest` cases cover the drawer's new behavior

The `entry_token` term remains in the DB schema, the `rpc_admin_generate_entry_token` function, the `generateEntryToken` API function, `entryToken` variables across `src/`, `?eval=TOKEN` URL params, `VITE_DEMO_ENTRY_TOKEN` env var, and UI copy on non-drawer admin pages. All of that is documented in README files and stays as-is.
