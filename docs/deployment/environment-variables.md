# Environment Variables — VERA

> _Last updated: 2026-05-03_

---

## Application Variables (`.env.local`)

These drive the local dev server and the Vite build that ships to Vercel.

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Production Supabase project URL — `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Production Supabase anon/public key. Safe to expose — RLS enforces all access restrictions. |
| `VITE_DEMO_SUPABASE_URL` | For `/demo/*` | Demo Supabase project URL. Without this, `/demo/*` routes fail to initialize the demo client. |
| `VITE_DEMO_SUPABASE_ANON_KEY` | For `/demo/*` | Demo project anon key. |
| `VITE_DEMO_ADMIN_EMAIL` | For `/demo/*` | Email of the demo super-admin auto-login uses on `/demo`. |
| `VITE_DEMO_ADMIN_PASSWORD` | For `/demo/*` | Password used by the `/demo` auto-login redirect. |
| `VITE_DEMO_ENTRY_TOKEN` | For `/demo/eval` | Entry token the demo jury showcase uses to skip the QR step. |
| `VITE_TURNSTILE_SITE_KEY` | Optional | Cloudflare Turnstile site key for the public registration form. The form falls back to a stub when unset (dev-friendly). |
| `VITE_RPC_SECRET` | **Legacy** | Read by `playwright.config.ts` as a passthrough to legacy edge tests, but no longer used by the running application. The historical `rpc-proxy` Edge Function it served was retired with the JWT migration ([ADR 0003](../decisions/0003-jwt-admin-auth.md)). Safe to omit unless you are running the older Playwright fixtures. |

### `.env.local` example

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

VITE_DEMO_SUPABASE_URL=https://yyyyyyyyyy.supabase.co
VITE_DEMO_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DEMO_ADMIN_EMAIL=demo-admin@vera-eval.app
VITE_DEMO_ADMIN_PASSWORD=demo-password
VITE_DEMO_ENTRY_TOKEN=demo-entry-token

# Optional
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAAxxxxxxxx
```

> **Never commit `.env.local` to git.** It is listed in `.gitignore`.

---

## E2E Test Variables (`.env.e2e.local`)

Used by Playwright. Copy `.env.e2e.example` to `.env.e2e.local` and fill in
the values that apply to your local E2E target. Tests skip when their required
variables are absent (no CI failure).

| Variable | Required for | Notes |
| --- | --- | --- |
| `E2E_BASE_URL` | All E2E | Base URL for tests. Defaults to `http://localhost:5173`. |
| `E2E_SUPABASE_URL` | DB-touching specs | URL of the dedicated E2E Supabase project. **Must not** equal `VITE_SUPABASE_URL` — guarded in test helpers to prevent accidental prod writes. |
| `E2E_SUPABASE_ANON_KEY` | DB-touching specs | Anon key for the E2E project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Fixture seeders | Service role key for the E2E project. Used only by server-side seed scripts. |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Admin specs | Credentials of the E2E super-admin / org-admin. |
| `E2E_ORG_ID` | Generic admin specs | Default tenant the admin specs target. |
| `E2E_CRITERIA_ORG_ID`, `E2E_CRITERIA_PERIOD_ID` | Criteria specs | Pre-seeded tenant + period the criteria validation specs read. |
| `E2E_PERIODS_ORG_ID`, `E2E_LIFECYCLE_ORG_ID` | Period specs | Tenants for the period-lifecycle journey. |
| `E2E_PROJECTS_ORG_ID`, `E2E_ENTRY_TOKEN_ORG_ID`, `E2E_WIZARD_ORG_ID` | Feature specs | Tenants per area; specs auto-skip if absent. |
| `E2E_OUTCOMES_PERIOD_ID` | Outcome specs | Pre-seeded period with outcomes/mappings for the outcome attainment specs. |

The realtime layer disables itself when `import.meta.env.VITE_E2E === true`,
so parallel specs do not cross-trigger each other through the WebSocket
stream — see [`.claude/rules/realtime.md`](../../.claude/rules/realtime.md).

---

## CI Variables (GitHub Actions Secrets)

Set in **GitHub → Repository → Settings → Secrets and variables → Actions**.

| Secret | Used by | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Unit tests + build | Required so `src/shared/api/` imports resolve at build time. |
| `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `e2e.yml` | Drives Playwright on the dedicated E2E project. |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ORG_ID`, plus per-area IDs | `e2e.yml` | One per spec area; missing IDs cause that area's specs to skip. |
| `DATABASE_URL` | `db-backup.yml` | PostgreSQL connection string for the monthly `pg_dump`. |

---

## Notification Secret Sync (GitHub Actions)

Workflow: `.github/workflows/notification-secrets-sync.yml`. Pushes branding
URLs into Edge Function secrets so the email functions render correct CTAs
across local / Vercel / prod profiles.

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Auth token for the Supabase CLI step |
| `SUPABASE_PROJECT_REF_DEMO` | Demo Supabase project ref |
| `SUPABASE_PROJECT_REF_PROD` | Prod Supabase project ref |
| `NOTIFICATION_REVIEW_URL_DEMO_LOCAL` | Demo review URL (local profile) |
| `NOTIFICATION_APP_URL_DEMO_LOCAL` | Demo app URL (local profile) |
| `NOTIFICATION_REVIEW_URL_DEMO_VERCEL` | Demo review URL (vercel profile) |
| `NOTIFICATION_APP_URL_DEMO_VERCEL` | Demo app URL (vercel profile) |
| `NOTIFICATION_REVIEW_URL_PROD` | Prod review URL |
| `NOTIFICATION_APP_URL_PROD` | Prod app root URL |
| `NOTIFICATION_FROM` | Sender identity for notification emails |
| `NOTIFICATION_LOGO_URL` | Public logo URL used in premium email templates |

---

## Supabase Edge Function Secrets

Configured in **Supabase Dashboard → Project Settings → Edge Functions →
Secrets**, per project (vera-prod and vera-demo).

| Secret | Required | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes (any function that sends email) | Resend API key. Functions log `skipped_no_key` and short-circuit if absent. |
| `NOTIFICATION_FROM` | No | Default `VERA <noreply@vera-eval.app>` |
| `NOTIFICATION_LOGO_URL` | No | Falls back to `https://vera-eval.app/vera_logo_dark.png` |
| `NOTIFICATION_APP_URL` | No | Portal URL used in CTA buttons |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Auto | Injected by the runtime |

There is no `RPC_SECRET` / `ALLOWED_ORIGINS` / `ALLOW_WILDCARD_ORIGIN`
secret — those served the historical `rpc-proxy` Edge Function which has
been removed.

---

## Production vs. Development

| Variable | Development | Production (Vercel) |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `.env.local` | Vercel environment variables |
| `VITE_DEMO_*` | `.env.local` (for `/demo/*` testing) | Vercel environment variables (only on the demo deployment) |
| `VITE_TURNSTILE_SITE_KEY` | `.env.local` (optional — stub falls back) | Vercel environment variables on the public registration build |
