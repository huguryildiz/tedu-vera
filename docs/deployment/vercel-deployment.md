# Vercel Deployment — VERA

> _Last updated: 2026-05-03_

VERA's frontend is deployed as a static site via Vercel. The Supabase backend (database, Edge Functions) is deployed separately — see [supabase-setup.md](supabase-setup.md).

---

## 1. Connect the Repository

1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New → Project**.
3. Import the `VERA` GitHub repository.
4. Vercel auto-detects Vite. Accept the default framework preset.

---

## 2. Configure Build Settings

Vercel should detect these automatically from the project. Verify:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

No `vercel.json` file is needed. Vite's `base: "/"` setting in `vite.config.js` ensures assets resolve correctly at the domain root.

---

## 3. Set Environment Variables

In **Project Settings → Environment Variables**, add the following. Apply to the **Production** environment (and Preview/Development if needed).

| Variable | Value | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | From Supabase Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Anon/public key from Supabase |
| `VITE_DEMO_SUPABASE_URL` | `https://<demo-ref>.supabase.co` | Demo project URL — required for `/demo/*` routes |
| `VITE_DEMO_SUPABASE_ANON_KEY` | `eyJ...` | Demo project anon key |
| `VITE_DEMO_ADMIN_EMAIL` | `<email>` | Email used by the `/demo` auto-login redirect |
| `VITE_DEMO_ADMIN_PASSWORD` | `<password>` | Password used by the `/demo` auto-login redirect |
| `VITE_DEMO_ENTRY_TOKEN` | `<token>` | Entry token the demo jury showcase uses |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAAAA…` | Optional — Cloudflare Turnstile site key for the public registration form |

**Do NOT add `VITE_RPC_SECRET` to Vercel.** It is no longer used by the
running app — the historical `rpc-proxy` Edge Function it served was retired
with the JWT migration ([ADR 0003](../decisions/0003-jwt-admin-auth.md)).
Admin RPCs are now called directly via `supabase.rpc("rpc_admin_*", …)` and
gated by `_assert_tenant_admin()` on the JWT.

---

## 4. Deploy

After configuring environment variables, trigger a deploy:

- **Automatic:** Push to the `main` branch — Vercel deploys automatically.
- **Manual:** Go to the Vercel dashboard → project → **Deployments** → **Redeploy**.

---

## 5. Verify the Deployment

1. Open the production URL (e.g. `https://vera.vercel.app` or your custom domain).
2. The landing page should load.
3. Click **Login** → sign in as a super-admin or org-admin → the Overview
   page should load with data from Supabase.
4. Open `/eval` and follow a valid entry-token link (QR or `?eval=<token>`)
   to reach the jury evaluation flow.

If admin RPCs fail (401/403), the JWT failed `_assert_tenant_admin()`. Most
common causes: the user has no membership row in the target organization, the
membership `status` is not `active`, or the JWT was issued by a different
Supabase project. Check `mcp__claude_ai_Supabase__get_logs service=postgres`
for the SQL-level error.

---

## Custom Domain (optional)

In Vercel: **Project Settings → Domains** → add your domain and follow the DNS instructions.

---

## Preview Deployments

Vercel creates a preview URL for every pull request. These share the production Supabase project by default (because environment variables are set at the project level). If you need isolated data for preview environments, create a separate Supabase project and set different env vars for the Preview environment tier in Vercel.
