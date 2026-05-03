# Getting Started

> _Last updated: 2026-05-03_

Bring up a working VERA dev environment. Target: clone to running dev server in
30 minutes.

---

## Prerequisites

- **Node.js** 20.x or newer (`node --version`).
- **npm** 10.x or newer (`npm --version`).
- A **Supabase project** for development. The fastest path is to use the
  existing `vera-demo` project (credentials below); to provision a fresh one,
  follow [deployment/supabase-setup.md](deployment/supabase-setup.md).
- Optional: a **Vercel account** if you plan to deploy.

---

## 1. Clone and install

```bash
git clone https://github.com/<your-org>/VERA.git
cd VERA
npm install
```

Playwright browsers download lazily; if you skip E2E for now you can defer
`npx playwright install` until later.

---

## 2. Configure `.env.local`

Create `.env.local` at the repo root with at minimum:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

For demo-environment access (used by the `/demo/*` routes and the
`DemoAdminLoader`):

```env
VITE_DEMO_SUPABASE_URL=https://<demo-project-ref>.supabase.co
VITE_DEMO_SUPABASE_ANON_KEY=<demo-anon-key>
VITE_DEMO_ADMIN_EMAIL=<demo-admin-email>
VITE_DEMO_ADMIN_PASSWORD=<demo-admin-password>
VITE_DEMO_ENTRY_TOKEN=<demo-entry-token>
```

Full list and descriptions: [deployment/environment-variables.md](deployment/environment-variables.md).

---

## 3. Run the dev server

```bash
npm run dev
```

Opens on [http://localhost:5173](http://localhost:5173).

- `/` — landing page
- `/login` — admin login
- `/demo/admin` — demo admin auto-login (uses demo env)
- `/eval` — jury entry token gate

---

## 4. Run the test suite

```bash
npm test -- --run        # vitest, CI-style single run
npm run e2e              # Playwright E2E (auto-starts dev server)
```

Test conventions, coverage thresholds, and the `qaTest` pattern are documented
under [qa/](qa/) (and will move to `testing/` in a future restructure session).

---

## 5. Optional: deploy

Frontend deploys to Vercel — see [deployment/vercel-deployment.md](deployment/vercel-deployment.md).
Database migrations and Edge Functions deploy via the Supabase MCP server;
both prod and demo projects must receive the same change in the same step.

---

## 6. Product tour

To see what VERA looks like from the outside — useful when preparing a demo for a prospective university — open the screenshot-driven product tour:

- [docs/tutorials/README.md](tutorials/README.md) — hub with admin and juror walkthrough links.

To regenerate the screenshots after UI changes:

```bash
npm run screenshots
git add docs/tutorials/_images/
git commit -m "chore(tutorials): refresh screenshots"
```

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `npm run dev` fails with module errors | Run `npm install` again — `package-lock.json` may have changed since your last install. |
| `/admin` redirects you to `/register` | Your Supabase Auth user is not yet a member of any tenant. Use the demo project credentials, or run the join flow from the landing page. |
| Playwright cannot find browsers | Run `npx playwright install`. |
| Supabase RPC returns "Invalid JWT" | The Kong gate may have rejected an ES256 token — see [architecture/edge-functions-kong-jwt.md](architecture/edge-functions-kong-jwt.md). |

---
