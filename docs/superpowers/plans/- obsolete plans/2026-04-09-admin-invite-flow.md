# Admin Invite Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken admin invitation flow with a modern email-based invite system where admins enter an email, the system sends an invite link, and the invitee sets their own password.

**Architecture:** New `admin_invites` table + two Edge Functions (`send-admin-invite` for email delivery, `accept-admin-invite` for account creation). Frontend adds invite CRUD to existing Manage Admins drawer and a new `/invite/:token` accept page. Existing users get membership added directly with a notification email.

**Tech Stack:** Supabase (PostgreSQL RPCs, Edge Functions, Auth Admin API), Resend (email), React Router v6, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-09-admin-invite-flow-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `sql/migrations/012_admin_invites.sql` | `admin_invites` table, 4 RPCs (send, list, resend, cancel), RLS policies |
| `supabase/functions/send-admin-invite/index.ts` | Sends invite or "added" email via Resend |
| `supabase/functions/accept-admin-invite/index.ts` | Validates token, creates auth user + membership + profile |
| `src/auth/screens/InviteAcceptScreen.jsx` | Password-setup form for invite token acceptance |

### Modified Files

| File | Changes |
|---|---|
| `src/shared/api/admin/organizations.js` | Add 4 invite API functions + 1 accept function |
| `src/shared/api/admin/index.js` | Re-export new invite functions |
| `src/shared/api/index.js` | Re-export new invite functions |
| `src/admin/hooks/useManageOrganizations.js` | Add invite state + handlers, remove old `handleCreateTenantAdminApplication` |
| `src/admin/pages/SettingsPage.jsx` | Rewire drawer to use invite list + new handlers |
| `src/router.jsx` | Add `/invite/:token` and `/demo/invite/:token` routes |

---

### Task 1: Database Migration — `admin_invites` Table + RPCs

**Files:**
- Create: `sql/migrations/012_admin_invites.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- sql/migrations/012_admin_invites.sql
-- Admin invite system: table + RPCs for send/list/resend/cancel

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_token
  ON admin_invites(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_invites_org
  ON admin_invites(org_id) WHERE status = 'pending';

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_invites_select ON admin_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND (memberships.organization_id = admin_invites.org_id
             OR memberships.role = 'super_admin')
    )
  );

CREATE POLICY admin_invites_insert ON admin_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND (memberships.organization_id = admin_invites.org_id
             OR memberships.role = 'super_admin')
    )
  );

CREATE POLICY admin_invites_update ON admin_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND (memberships.organization_id = admin_invites.org_id
             OR memberships.role = 'super_admin')
    )
  );

-- ── Helper: assert caller is admin for org ───────────────────
CREATE OR REPLACE FUNCTION _assert_org_admin(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND (organization_id = p_org_id OR role = 'super_admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

-- ── RPC: send invite ─────────────────────────────────────────
-- Returns JSON: { status: 'invited', invite_id } or { status: 'added', user_id }
CREATE OR REPLACE FUNCTION rpc_admin_invite_send(
  p_org_id UUID,
  p_email  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email      TEXT;
  v_existing   UUID;
  v_invite_id  UUID;
  v_token      UUID;
  v_count      INT;
BEGIN
  PERFORM _assert_org_admin(p_org_id);

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Check org exists and is active
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND status = 'active') THEN
    RAISE EXCEPTION 'organization_not_found';
  END IF;

  -- Check not already a member
  SELECT m.user_id INTO v_existing
  FROM memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE u.email = v_email AND m.organization_id = p_org_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  -- Rate limit: max 10 pending invites per org per hour
  SELECT count(*) INTO v_count
  FROM admin_invites
  WHERE org_id = p_org_id
    AND created_at > now() - INTERVAL '1 hour';
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  -- Check if user already exists in auth.users
  SELECT id INTO v_existing FROM auth.users WHERE email = v_email;

  IF v_existing IS NOT NULL THEN
    -- Existing user: add membership directly
    INSERT INTO memberships (user_id, organization_id, role)
    VALUES (v_existing, p_org_id, 'org_admin');

    RETURN jsonb_build_object('status', 'added', 'user_id', v_existing);
  END IF;

  -- Cancel any existing pending invite for same org+email
  UPDATE admin_invites
  SET status = 'cancelled'
  WHERE org_id = p_org_id AND email = v_email AND status = 'pending';

  -- Create new invite
  v_token := gen_random_uuid();
  INSERT INTO admin_invites (org_id, email, invited_by, token)
  VALUES (p_org_id, v_email, auth.uid(), v_token)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'status', 'invited',
    'invite_id', v_invite_id,
    'token', v_token,
    'email', v_email
  );
END;
$$;

-- ── RPC: list pending invites ────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_list(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _assert_org_admin(p_org_id);

  -- Auto-expire stale invites
  UPDATE admin_invites
  SET status = 'expired'
  WHERE org_id = p_org_id AND status = 'pending' AND expires_at < now();

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ai.id,
        'email', ai.email,
        'created_at', ai.created_at,
        'expires_at', ai.expires_at
      ) ORDER BY ai.created_at DESC
    )
    FROM admin_invites ai
    WHERE ai.org_id = p_org_id AND ai.status = 'pending'
  ), '[]'::jsonb);
END;
$$;

-- ── RPC: resend invite ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_resend(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
  v_email  TEXT;
  v_token  UUID;
BEGIN
  SELECT org_id, email INTO v_org_id, v_email
  FROM admin_invites
  WHERE id = p_invite_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  PERFORM _assert_org_admin(v_org_id);

  v_token := gen_random_uuid();
  UPDATE admin_invites
  SET token = v_token,
      expires_at = now() + INTERVAL '7 days'
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'status', 'resent',
    'invite_id', p_invite_id,
    'token', v_token,
    'email', v_email
  );
END;
$$;

-- ── RPC: cancel invite ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_admin_invite_cancel(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id
  FROM admin_invites
  WHERE id = p_invite_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  PERFORM _assert_org_admin(v_org_id);

  UPDATE admin_invites SET status = 'cancelled' WHERE id = p_invite_id;

  RETURN jsonb_build_object('status', 'cancelled', 'invite_id', p_invite_id);
END;
$$;

-- ── RPC: get invite payload (for accept Edge Function) ───────
-- Anonymous-accessible: validates token, returns invite data
CREATE OR REPLACE FUNCTION rpc_admin_invite_get_payload(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite RECORD;
  v_org_name TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM admin_invites
  WHERE token = p_token AND status = 'pending';

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE admin_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('error', 'invite_expired');
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = v_invite.org_id;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'org_id', v_invite.org_id,
    'org_name', v_org_name,
    'email', v_invite.email,
    'expires_at', v_invite.expires_at
  );
END;
$$;

-- ── RPC: mark invite accepted (called by Edge Function) ──────
CREATE OR REPLACE FUNCTION rpc_admin_invite_mark_accepted(
  p_invite_id UUID,
  p_user_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id
  FROM admin_invites WHERE id = p_invite_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  -- Create membership
  INSERT INTO memberships (user_id, organization_id, role)
  VALUES (p_user_id, v_org_id, 'org_admin')
  ON CONFLICT DO NOTHING;

  -- Mark invite accepted
  UPDATE admin_invites SET status = 'accepted' WHERE id = p_invite_id;
END;
$$;

-- Grant anon access to payload lookup (invitee has no account yet)
GRANT EXECUTE ON FUNCTION rpc_admin_invite_get_payload(UUID) TO anon;
GRANT EXECUTE ON FUNCTION rpc_admin_invite_get_payload(UUID) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP: `mcp__claude_ai_Supabase__apply_migration` with the SQL above and name `admin_invites`.

- [ ] **Step 3: Verify tables and RPCs exist**

Run via Supabase MCP:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_invites';
SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'rpc_admin_invite%';
```

Expected: `admin_invites` table + 6 RPCs (send, list, resend, cancel, get_payload, mark_accepted).

- [ ] **Step 4: Commit**

```bash
git add sql/migrations/012_admin_invites.sql
git commit -m "feat: admin_invites table + invite RPCs (send/list/resend/cancel/accept)"
```

---

### Task 2: Edge Function — `send-admin-invite`

**Files:**
- Create: `supabase/functions/send-admin-invite/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/send-admin-invite/index.ts
// Sends admin invite or "added" notification email via Resend.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(input: string): string {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlTemplate(params: {
  title: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  logoUrl?: string;
}): string {
  const logo = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="VERA" width="160" style="display:block; margin:0 auto; height:auto;" />`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#f1f5f9;">V</span><span style="color:#93c5fd;">ERA</span></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f0f1a; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1a; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%); border-radius:16px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.5);">
          <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff); height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:40px 40px 20px;">${logo}</td></tr>
          <tr><td align="center" style="padding:8px 48px 12px;"><h1 style="margin:0; font-size:25px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">${escapeHtml(params.title)}</h1></td></tr>
          <tr><td align="center" style="padding:0 48px 20px;"><p style="margin:0; font-size:15px; line-height:1.7; color:#a0aec0;">${escapeHtml(params.intro)}</p></td></tr>
          <tr><td align="center" style="padding:0 48px 8px;"><p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#a0aec0;">${escapeHtml(params.body)}</p></td></tr>
          <tr><td align="center" style="padding:16px 48px 24px;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block; background:linear-gradient(135deg,#6c47ff,#a78bfa); color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 36px; border-radius:50px; letter-spacing:0.3px; box-shadow:0 4px 20px rgba(108,71,255,0.45);">${escapeHtml(params.ctaLabel)} &rarr;</a></td></tr>
          <tr><td style="padding:0 48px;"><div style="border-top:1px solid rgba(255,255,255,0.08); font-size:0;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:16px 48px 30px;"><p style="margin:0; font-size:12px; color:#4a5568; line-height:1.6;">&copy; 2026 VERA. All rights reserved.</p></td></tr>
          <tr><td style="background:linear-gradient(90deg,#6c47ff,#a78bfa,#6c47ff); height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  text: string,
  html: string,
  from: string,
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { type, email, token, org_name } = await req.json();
    const to = String(email || "").trim().toLowerCase();
    if (!to || !to.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const appUrl = (Deno.env.get("NOTIFICATION_APP_URL") || "").trim() ||
      "https://vera-eval.app";
    const fromAddr = Deno.env.get("NOTIFICATION_FROM") ||
      "VERA <noreply@vera-eval.app>";
    const logoUrl = (Deno.env.get("NOTIFICATION_LOGO_URL") || "").trim();
    const orgName = String(org_name || "the organization");

    if (type === "added") {
      // Existing user was added directly
      const subject = `You've been added to ${orgName} on VERA`;
      const text = `You now have admin access to ${orgName}. Log in to get started: ${appUrl}/login`;
      const html = buildHtmlTemplate({
        title: `Welcome to ${orgName}`,
        intro: `You now have admin access to ${orgName} on VERA.`,
        body: "Log in with your existing credentials to get started.",
        ctaLabel: "Go to VERA",
        ctaUrl: `${appUrl}/login`,
        logoUrl,
      });
      await sendViaResend(resendKey, to, subject, text, html, fromAddr);
    } else {
      // New user invite
      const inviteUrl = `${appUrl}/invite/${token}`;
      const subject = `You're invited to join ${orgName} on VERA`;
      const text = `You've been invited to manage ${orgName} on VERA. Accept your invite: ${inviteUrl}`;
      const html = buildHtmlTemplate({
        title: `Join ${orgName}`,
        intro: `You've been invited to manage ${orgName} on VERA.`,
        body:
          "Click the button below to set your password and start managing your organization.",
        ctaLabel: "Accept Invite",
        ctaUrl: inviteUrl,
        logoUrl,
      });
      await sendViaResend(resendKey, to, subject, text, html, fromAddr);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy the Edge Function**

Run via Supabase MCP: `mcp__claude_ai_Supabase__deploy_edge_function` with name `send-admin-invite`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-admin-invite/index.ts
git commit -m "feat: send-admin-invite Edge Function (invite + added emails via Resend)"
```

---

### Task 3: Edge Function — `accept-admin-invite`

**Files:**
- Create: `supabase/functions/accept-admin-invite/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/accept-admin-invite/index.ts
// Accepts an admin invite: validates token, creates auth user + membership.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { token, password, display_name } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || String(password).length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 8 characters.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const service = createClient(supabaseUrl, serviceKey);

    // 1. Validate invite token via RPC
    const { data: payload, error: rpcErr } = await service.rpc(
      "rpc_admin_invite_get_payload",
      { p_token: token },
    );
    if (rpcErr) throw rpcErr;
    if (payload?.error) {
      return new Response(JSON.stringify({ error: payload.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteId = payload.id;
    const email = payload.email;
    const name = String(display_name || "").trim() ||
      email.split("@")[0] || "Admin";

    // 2. Create auth user
    const { data: newUser, error: createErr } =
      await service.auth.admin.createUser({
        email,
        password: String(password),
        email_confirm: true,
        user_metadata: { name },
        app_metadata: { provider: "email", providers: ["email"] },
      });
    if (createErr) throw createErr;

    const userId = newUser.user.id;

    // 3. Create profile
    const { error: profileErr } = await service
      .from("profiles")
      .upsert({ id: userId, display_name: name }, { onConflict: "id" });
    if (profileErr) throw profileErr;

    // 4. Mark invite accepted + create membership
    const { error: acceptErr } = await service.rpc(
      "rpc_admin_invite_mark_accepted",
      {
        p_invite_id: inviteId,
        p_user_id: userId,
      },
    );
    if (acceptErr) throw acceptErr;

    // 5. Generate a session so invitee is immediately logged in
    // We sign in on their behalf using the admin API to generate tokens
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
    );
    const { data: session, error: signInErr } =
      await anonClient.auth.signInWithPassword({
        email,
        password: String(password),
      });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        session: signInErr ? null : session?.session,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = (e as Error).message || "";
    // User-friendly error for duplicate email
    if (msg.includes("already been registered") || msg.includes("duplicate")) {
      return new Response(
        JSON.stringify({
          error: "This email is already registered. Please log in instead.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy the Edge Function**

Run via Supabase MCP: `mcp__claude_ai_Supabase__deploy_edge_function` with name `accept-admin-invite`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/accept-admin-invite/index.ts
git commit -m "feat: accept-admin-invite Edge Function (token validation + user creation)"
```

---

### Task 4: API Layer — Invite Functions

**Files:**
- Modify: `src/shared/api/admin/organizations.js` (add at bottom)
- Modify: `src/shared/api/admin/index.js` (add re-exports)
- Modify: `src/shared/api/index.js` (add re-exports)

- [ ] **Step 1: Add invite API functions to organizations.js**

Add the following functions at the end of `src/shared/api/admin/organizations.js`:

```javascript
// ── Admin Invite API ──────────────────────────────────────────

/**
 * Send an admin invite. Returns { status: 'invited', invite_id, token, email }
 * or { status: 'added', user_id } for existing users.
 */
export async function sendAdminInvite(orgId, email) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_send", {
    p_org_id: orgId,
    p_email: email,
  });
  if (error) throw error;

  // Fire-and-forget: send email via Edge Function
  const orgName = await _getOrgName(orgId);
  supabase.functions.invoke("send-admin-invite", {
    body: {
      type: data.status === "added" ? "added" : "invite",
      email: data.email || email,
      token: data.token || null,
      org_name: orgName,
    },
  }).catch((e) => console.warn("send-admin-invite email failed:", e?.message));

  return data;
}

/**
 * List pending invites for an organization.
 * Returns array of { id, email, created_at, expires_at }.
 */
export async function listAdminInvites(orgId) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_list", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Resend an existing invite (new token, reset expiry).
 */
export async function resendAdminInvite(inviteId, orgId) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_resend", {
    p_invite_id: inviteId,
  });
  if (error) throw error;

  // Fire-and-forget: send email
  const orgName = await _getOrgName(orgId);
  supabase.functions.invoke("send-admin-invite", {
    body: {
      type: "invite",
      email: data.email,
      token: data.token,
      org_name: orgName,
    },
  }).catch((e) => console.warn("resend invite email failed:", e?.message));

  return data;
}

/**
 * Cancel a pending invite.
 */
export async function cancelAdminInvite(inviteId) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_cancel", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return data;
}

/**
 * Get invite payload by token (for the accept page).
 */
export async function getInvitePayload(token) {
  const { data, error } = await supabase.rpc("rpc_admin_invite_get_payload", {
    p_token: token,
  });
  if (error) throw error;
  return data;
}

/**
 * Accept an invite (calls Edge Function which creates user + membership).
 */
export async function acceptAdminInvite(token, password, displayName) {
  const { data, error } = await supabase.functions.invoke(
    "accept-admin-invite",
    { body: { token, password, display_name: displayName } },
  );
  if (error) throw error;
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

/** @private Resolve org name for email templates */
async function _getOrgName(orgId) {
  try {
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    return data?.name || "your organization";
  } catch {
    return "your organization";
  }
}
```

- [ ] **Step 2: Add re-exports to admin/index.js**

Open `src/shared/api/admin/index.js` and add the new exports from organizations. Find the existing organizations re-export line and add the new functions:

```javascript
export {
  // ... existing exports ...
  listOrganizations,
  createOrganization,
  updateOrganization,
  listOrganizationsPublic,
  updateMemberAdmin,
  deleteMemberHard,
  // New invite functions:
  sendAdminInvite,
  listAdminInvites,
  resendAdminInvite,
  cancelAdminInvite,
  getInvitePayload,
  acceptAdminInvite,
} from "./organizations";
```

- [ ] **Step 3: Add re-exports to shared/api/index.js**

Add the new functions to the admin re-export block in `src/shared/api/index.js`:

```javascript
export {
  // ... existing exports ...
  sendAdminInvite,
  listAdminInvites,
  resendAdminInvite,
  cancelAdminInvite,
  getInvitePayload,
  acceptAdminInvite,
} from "./admin/index";
```

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/admin/organizations.js src/shared/api/admin/index.js src/shared/api/index.js
git commit -m "feat: admin invite API layer (send/list/resend/cancel/accept)"
```

---

### Task 5: Hook — Invite State + Handlers in useManageOrganizations

**Files:**
- Modify: `src/admin/hooks/useManageOrganizations.js`

- [ ] **Step 1: Add imports for new API functions**

At the top of `src/admin/hooks/useManageOrganizations.js`, update the import block to include the new invite functions and remove `submitApplication`:

```javascript
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  updateMemberAdmin,
  deleteMemberHard,
  approveApplication,
  rejectApplication,
  notifyApplication,
  writeAuditLog,
  sendAdminInvite,
  listAdminInvites,
  resendAdminInvite,
  cancelAdminInvite,
} from "../../shared/api";
```

Note: `submitApplication` is removed from imports — it's no longer needed.

- [ ] **Step 2: Add invite state inside the hook**

After the existing `applicationActionLoading` state (around line 115), add:

```javascript
  // ── Invite state ─────────────────────────────────────────────
  const [invites, setInvites] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
```

- [ ] **Step 3: Add loadInvites function**

After the `loadOrgs` function (around line 127), add:

```javascript
  const loadInvites = useCallback(async (orgId) => {
    if (!enabled || !orgId) return;
    try {
      const data = await listAdminInvites(orgId);
      setInvites(data);
    } catch (e) {
      console.warn("Could not load invites:", e?.message);
    }
  }, [enabled]);
```

- [ ] **Step 4: Add invite handler functions**

Replace the existing `handleCreateTenantAdminApplication` function (lines 478–513) with these three handlers:

```javascript
  const handleSendInvite = useCallback(async (orgId, email) => {
    if (!enabled || !orgId) return { ok: false, error: "Organization is missing." };
    setError("");
    setInviteLoading(true);
    try {
      const result = await sendAdminInvite(orgId, email);
      writeAuditLog("admin.invited", {
        resourceType: "admin_invites",
        resourceId: result.invite_id || result.user_id,
        organizationId: orgId,
        details: { email, status: result.status },
      }).catch(() => {});

      if (result.status === "added") {
        await loadOrgs();
        setMessage?.("Admin added — they already had an account.");
      } else {
        await loadInvites(orgId);
        setMessage?.(`Invitation sent to ${email}`);
      }
      return { ok: true, status: result.status };
    } catch (e) {
      const msg = normalizeAdminInviteError(e?.message || "");
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setInviteLoading(false);
    }
  }, [enabled, loadOrgs, loadInvites, setMessage]);

  const handleResendInvite = useCallback(async (inviteId, orgId) => {
    if (!enabled || !inviteId) return;
    setInviteLoading(true);
    try {
      await resendAdminInvite(inviteId, orgId);
      await loadInvites(orgId);
      setMessage?.("Invite resent.");
    } catch (e) {
      setError(e?.message || "Could not resend invite.");
    } finally {
      setInviteLoading(false);
    }
  }, [enabled, loadInvites, setMessage]);

  const handleCancelInvite = useCallback(async (inviteId, orgId) => {
    if (!enabled || !inviteId) return;
    setInviteLoading(true);
    try {
      await cancelAdminInvite(inviteId);
      await loadInvites(orgId);
      setMessage?.("Invite cancelled.");
    } catch (e) {
      setError(e?.message || "Could not cancel invite.");
    } finally {
      setInviteLoading(false);
    }
  }, [enabled, loadInvites, setMessage]);
```

- [ ] **Step 5: Add normalizeAdminInviteError helper**

Add this near the existing `normalizeAdminApplicationError` (around line 64):

```javascript
const normalizeAdminInviteError = (raw) => {
  const msg = String(raw || "").trim();
  const lower = msg.toLowerCase();
  if (!lower) return "Could not send invite.";
  if (lower.includes("already_member")) return "This email is already a member of this organization.";
  if (lower.includes("invalid_email")) return "Please enter a valid email address.";
  if (lower.includes("rate_limit_exceeded")) return "Too many invites sent recently. Please try again later.";
  if (lower.includes("organization_not_found")) return "Organization not found.";
  return msg;
};
```

- [ ] **Step 6: Update return object**

In the return statement, replace `handleCreateTenantAdminApplication` with the new handlers and add invite state:

```javascript
  return {
    // ... all existing returns ...
    // Remove: handleCreateTenantAdminApplication,
    // Add:
    invites,
    inviteLoading,
    loadInvites,
    handleSendInvite,
    handleResendInvite,
    handleCancelInvite,
  };
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/admin/hooks/useManageOrganizations.js
git commit -m "feat: invite handlers in useManageOrganizations (send/resend/cancel)"
```

---

### Task 6: UI — Rewire Manage Admins Drawer in SettingsPage

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx` (lines 260–411 state/handlers, lines 976–1099 drawer JSX)

- [ ] **Step 1: Update destructured hook values**

In `SettingsPage.jsx`, find the `useManageOrganizations` destructure (around line 244) and update it:

Replace `handleCreateTenantAdminApplication` with the new invite-related values:

```javascript
  const {
    // ... existing ...
    invites,
    inviteLoading,
    loadInvites,
    handleSendInvite,
    handleResendInvite,
    handleCancelInvite,
    // Remove: handleCreateTenantAdminApplication,
  } = useManageOrganizations({ ... });
```

- [ ] **Step 2: Add import for RefreshCw icon**

Find the Lucide import line and add `RefreshCw` if not already imported:

```javascript
import { ..., RefreshCw, ... } from "lucide-react";
```

- [ ] **Step 3: Load invites when drawer opens**

Find where `setManageAdminsOrg` is called to open the drawer (around line 331). Update it to also load invites:

```javascript
  // When opening manage admins drawer, also load invites
  const openManageAdmins = useCallback((org) => {
    const fresh = orgList.find((o) => o.id === org.id) || org;
    setManageAdminsOrg(fresh);
    loadInvites(fresh.id);
  }, [orgList, loadInvites]);
```

Update the menu action reference from `setManageAdminsOrg(org)` to `openManageAdmins(org)`.

- [ ] **Step 4: Rewrite handleInviteAdmin**

Replace the existing `handleInviteAdmin` (lines 379–411) with:

```javascript
  const handleInviteAdmin = useCallback(async () => {
    if (!manageAdminsOrg?.id) return;
    const email = String(adminInviteEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setAdminInviteError("A valid email is required.");
      return;
    }
    setAdminInviteLoading(true);
    setAdminInviteError("");
    const result = await handleSendInvite(manageAdminsOrg.id, email);
    setAdminInviteLoading(false);
    if (result?.ok) {
      setAdminInviteEmail("");
      setAdminInviteError("");
      if (result.status === "added") {
        // Refresh org list to show new member
        const fresh = orgList.find((o) => o.id === manageAdminsOrg.id);
        if (fresh) setManageAdminsOrg(fresh);
      }
      return;
    }
    setAdminInviteError(result?.error || "Could not invite admin.");
  }, [adminInviteEmail, manageAdminsOrg, handleSendInvite, orgList]);
```

- [ ] **Step 5: Update drawer JSX — add Pending Invites section**

In the drawer body (around line 993), after the active admins `.map()` and before the invite input section, add the pending invites section:

```jsx
          {/* ── Pending Invites ───────────────────────────────── */}
          {invites.length > 0 && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "var(--text-tertiary)",
                marginTop: 14, marginBottom: 6,
              }}>
                Pending Invites
              </div>
              {invites.map((inv) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(inv.expires_at) - Date.now()) / 86400000));
                const sentAgo = Math.floor((Date.now() - new Date(inv.created_at)) / 86400000);
                return (
                  <div key={inv.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", border: "1px dashed var(--border)",
                    borderRadius: "var(--radius-sm)", opacity: 0.85,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      border: "2px dashed var(--border)", display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Mail size={14} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>{inv.email}</div>
                      <div className="text-xs text-muted">
                        {sentAgo === 0 ? "Sent today" : `Sent ${sentAgo}d ago`} · Expires in {daysLeft}d
                      </div>
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: 9 }}>Pending</span>
                    <button
                      title="Resend invite"
                      disabled={inviteLoading || isDemoMode}
                      onClick={() => handleResendInvite(inv.id, manageAdminsOrg?.id)}
                      style={{
                        width: 28, height: 28, borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)", background: "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: "var(--text-secondary)",
                      }}
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button
                      title="Cancel invite"
                      disabled={inviteLoading || isDemoMode}
                      onClick={() => handleCancelInvite(inv.id, manageAdminsOrg?.id)}
                      style={{
                        width: 28, height: 28, borderRadius: "var(--radius-sm)",
                        border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                        background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                        color: "var(--danger)", display: "flex", alignItems: "center",
                        justifyContent: "center", cursor: "pointer",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </>
          )}
```

- [ ] **Step 6: Add Active Members section label**

Before the existing admins `.map()` (around line 997), add a section label:

```jsx
          {(manageAdminsOrg?.tenantAdmins || []).length > 0 && (
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 6,
            }}>
              Active Members
            </div>
          )}
```

- [ ] **Step 7: Verify build and test visually**

Run: `npm run build`
Expected: no errors.

Run: `npm run dev` and navigate to Settings > Organizations > ⋯ menu > Manage Admins. Verify:
- Section labels "ACTIVE MEMBERS" and "PENDING INVITES" appear
- Invite input sends invites
- Pending invites show with resend/cancel buttons

- [ ] **Step 8: Commit**

```bash
git add src/admin/pages/SettingsPage.jsx
git commit -m "feat: rewire Manage Admins drawer with invite list + send/resend/cancel"
```

---

### Task 7: Invite Accept Page + Route

**Files:**
- Create: `src/auth/screens/InviteAcceptScreen.jsx`
- Modify: `src/router.jsx`

- [ ] **Step 1: Create InviteAcceptScreen component**

```jsx
// src/auth/screens/InviteAcceptScreen.jsx
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { getInvitePayload, acceptAdminInvite } from "../../shared/api";
import FbAlert from "@/shared/ui/FbAlert";

export default function InviteAcceptScreen() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load invite payload on mount
  useEffect(() => {
    if (!token) {
      setError("Invalid invite link.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await getInvitePayload(token);
        if (data?.error) {
          setError(
            data.error === "invite_expired"
              ? "This invite has expired. Please ask your admin to send a new one."
              : data.error === "invite_not_found"
                ? "This invite link is invalid or has already been used."
                : data.error
          );
        } else {
          setPayload(data);
          // Pre-fill display name from email local part
          const local = (data.email || "").split("@")[0] || "";
          setDisplayName(
            local.split(/[._-]+/).filter(Boolean)
              .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
          );
        }
      } catch (e) {
        setError(e?.message || "Could not verify invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = passwordValid && passwordsMatch && displayName.trim();

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await acceptAdminInvite(token, password, displayName.trim());
      if (result?.session) {
        // Session is set by the Edge Function response — redirect to admin
        navigate("/admin", { replace: true });
        // Force reload to pick up new session
        window.location.reload();
      } else {
        // Fallback: redirect to login
        navigate("/login", { replace: true });
      }
    } catch (err) {
      setSubmitError(err?.message || "Could not accept invite.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, token, password, displayName, navigate]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", padding: 24,
      }}>
        <div style={{
          maxWidth: 420, width: "100%", textAlign: "center",
          padding: 32, borderRadius: "var(--radius-md, 12px)",
          background: "var(--surface, #1a1a2e)",
          border: "1px solid var(--border, #2a2a4a)",
        }}>
          <AlertCircle size={48} style={{ color: "var(--danger, #ef4444)", marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invite Unavailable</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{error}</p>
          <button
            className="fs-btn fs-btn-primary"
            onClick={() => navigate("/login", { replace: true })}
            style={{ width: "100%" }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24,
    }}>
      <div style={{
        maxWidth: 440, width: "100%",
        padding: 32, borderRadius: "var(--radius-md, 12px)",
        background: "var(--surface, #1a1a2e)",
        border: "1px solid var(--border, #2a2a4a)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <ShieldCheck size={40} style={{ color: "var(--accent, #6366f1)", marginBottom: 12 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Join {payload?.org_name || "Organization"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Set your password to accept the invite for <strong>{payload?.email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Display Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Display Name
            </label>
            <input
              className="fs-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="fs-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && !passwordValid && (
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>
                Password must be at least 8 characters
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Confirm Password
            </label>
            <input
              className="fs-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />
            {confirmPassword && !passwordsMatch && (
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>
                Passwords do not match
              </div>
            )}
          </div>

          {submitError && (
            <FbAlert variant="danger">{submitError}</FbAlert>
          )}

          <button
            type="submit"
            className="fs-btn fs-btn-primary"
            disabled={!canSubmit || submitting}
            style={{ width: "100%", marginTop: 4 }}
          >
            {submitting ? "Setting up your account…" : "Accept Invite & Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to router.jsx**

In `src/router.jsx`, add the lazy import at the top with other auth screens:

```javascript
const InviteAcceptScreen = lazy(() => import("@/auth/screens/InviteAcceptScreen"));
```

Add the route inside the `AuthRouteLayout` children (around line 112), after the existing auth routes:

```javascript
{ path: "/invite/:token", element: <SuspenseWrap><InviteAcceptScreen /></SuspenseWrap> },
```

Also add it inside the `/demo` children for demo mode:

```javascript
{ path: "invite/:token", element: <SuspenseWrap><InviteAcceptScreen /></SuspenseWrap> },
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/auth/screens/InviteAcceptScreen.jsx src/router.jsx
git commit -m "feat: invite accept page with password setup + /invite/:token route"
```

---

### Task 8: Integration Testing & Cleanup

**Files:**
- Verify all modified files work together

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: clean build with no errors or warnings.

- [ ] **Step 2: Manual integration test**

Run: `npm run dev`

Test the full flow:
1. Navigate to Settings > Organizations
2. Click ⋯ on an org > "Manage Admins"
3. Verify drawer shows Active Members with section label
4. Enter an email in the invite input, click "Send Invite"
5. Verify pending invite appears with Pending badge, resend/cancel buttons
6. Click resend (↻) — verify it works
7. Click cancel (✕) — verify invite is removed
8. Navigate to `/invite/some-fake-token` — verify error screen shows "invalid or already used"

- [ ] **Step 3: Remove dead code**

In `src/admin/hooks/useManageOrganizations.js`:
- Remove the `submitApplication` import if still present
- Remove `handleCreateTenantAdminApplication` function entirely
- Remove it from the return object

In `src/admin/pages/SettingsPage.jsx`:
- Remove old `handleCreateTenantAdminApplication` references
- Clean up any unused state (the old password-related fields if they exist)

- [ ] **Step 4: Final build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit cleanup**

```bash
git add -u
git commit -m "chore: remove dead code from old admin application flow"
```
