# Deployment

Setting up environments and deploying VERA. The platform runs on Supabase
(database + auth + edge functions) and Vercel (frontend), with prod and demo
projects in each.

## Files

| File | Contents |
| --- | --- |
| [environment-variables.md](environment-variables.md) | All env vars used by the app, E2E suite, and CI. |
| [supabase-setup.md](supabase-setup.md) | Provision a new Supabase project from scratch — schema, auth, edge functions. |
| [vercel-deployment.md](vercel-deployment.md) | Frontend deployment on Vercel — prod and demo. |
| [migrations.md](migrations.md) | Migration application workflow — both-projects rule, drift sentinels, archive folder. |

## Notes

- Database changes require a migration in [`sql/migrations/`](../../sql/migrations/).
  Both Supabase projects (vera-prod and vera-demo) must be migrated in the same
  step. See `sql/README.md` for the migration policy.
- Edge Functions deploy via the Supabase MCP server — same change must land in
  both projects in the same step.
- Demo seed (`sql/seeds/demo_seed.sql`) is applied **manually** by the project
  owner; never push it from CI or scripts.

---

> *Last updated: 2026-04-24*
