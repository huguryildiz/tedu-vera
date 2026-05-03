# Operations

> _Last updated: 2026-04-28_

Run-time documentation for VERA: how the audit system works in practice,
incident response playbooks, and the operational shape of database
migrations and deployments.

For *what* the system is, see [architecture/](../architecture/). For *why*
it was built that way, see [decisions/](../decisions/).

## Sections

| Section | Contents |
| --- | --- |
| [audit/](audit/README.md) | Audit log coverage, event message reference, hardening roadmap. |
| [backup-and-recovery.md](backup-and-recovery.md) | Daily auto-backups, manual snapshots, recovery scenarios, RPO/RTO. |
| [demo-environment.md](demo-environment.md) | What the demo contains, how to update it, hard rules. |
| [runbooks/](runbooks/) | Incident response playbooks. |

## Runbooks

| Runbook | When to read |
| --- | --- |
| [runbooks/jury-day-incident.md](runbooks/jury-day-incident.md) | A live evaluation session is failing for one or more jurors / admins. |
| [runbooks/demo-seed-broken.md](runbooks/demo-seed-broken.md) | The demo environment login fails or shows missing data. |
| [runbooks/auth-outage.md](runbooks/auth-outage.md) | Admins cannot sign in, or sign-in succeeds but the dashboard never loads. |

## Monitoring (current state)

VERA does not have dedicated platform monitoring (Datadog, Sentry, etc.) at
this time. The operational surface is:

- **Supabase logs** — `get_logs service=postgres|edge-function|kong` via the
  Supabase MCP server. First place to look for any backend issue.
- **Audit log** — every state-changing user action; see [audit/](audit/).
- **Vercel deployment logs** — frontend build + runtime errors.
- **Browser console + Network panel** — for client-side issues during a
  live session.

The runbooks below assume access to the Supabase project's MCP server and
to Vercel. If a new on-call person joins, their first task is to confirm
those two access paths work.

---
