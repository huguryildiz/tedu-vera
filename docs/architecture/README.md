# Architecture

System design, routing, storage, multi-tenant patterns, and integration
references. Start with [system-overview.md](system-overview.md) and branch into
the topic you need.

## Files

| File | Contents |
| --- | --- |
| [system-overview.md](system-overview.md) | Routing, jury flow, admin panel structure, Supabase RPC integration, source layout. |
| [security-model.md](security-model.md) | Single-page reference for security guarantees, threat model, PII inventory, compliance posture. |
| [url-routing.md](url-routing.md) | React Router v6 tree, environment selection by pathname, guards and layouts. |
| [storage-policy.md](storage-policy.md) | Browser storage rules — what goes in localStorage vs sessionStorage, what never gets stored. |
| [multi-tenancy.md](multi-tenancy.md) | Roles, tenant resolution, sign-in flow, RLS enforcement, cross-tenant safety guarantees. |
| [period-lifecycle.md](period-lifecycle.md) | Evaluation period state machine — open, locked, closed, archived. |
| [email-notifications.md](email-notifications.md) | Email delivery via Supabase Auth + custom templates. |
| [database-webhooks.md](database-webhooks.md) | Supabase webhook subscriptions and the Edge Functions they trigger. |
| [edge-functions-kong-jwt.md](edge-functions-kong-jwt.md) | Kong JWT gate, ES256 caveat, and the `verify_jwt: false` + custom-auth pattern used by some functions. |
| [e2e-testing-primer.md](e2e-testing-primer.md) | Architectural primer for the E2E test suite — Page Object Model, fixtures, drift sentinels. |
| [framework-outcomes.md](framework-outcomes.md) | Accreditation framework model (MÜDEK / ABET / custom) and outcome mapping. |
| [overview-needs-attention.md](overview-needs-attention.md) | Items in the architecture that need follow-up or further documentation. |

For database-side architecture (canonical data model, migration module
structure, RPC catalog, RLS patterns) see [`sql/README.md`](../../sql/README.md).

---

> *Last updated: 2026-04-24*
