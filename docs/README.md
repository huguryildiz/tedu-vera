# VERA — Documentation

Multi-tenant academic jury evaluation platform. This directory is the single
source of truth for architecture, deployment, testing, and design decisions.

---

## Start here

- [Getting started](getting-started.md) — dev environment in 30 minutes.
- [Contributing](contributing.md) — branch strategy, commit conventions, PR flow.
- [Glossary](glossary.md) — accreditation + multi-tenant SaaS vocabulary in one place.
- [Known limitations](known-limitations.md) — what VERA does not yet do; intentional vs. planned vs. operational gaps.
- [Data retention and privacy](data-retention-and-privacy.md) — PII inventory, retention rules, GDPR / KVKK posture.

---

## Sections

| Section | Contents |
| --- | --- |
| [architecture/](architecture/README.md) | System design, routing, storage policy, period lifecycle, multi-tenancy, framework outcomes, edge-function patterns, E2E architecture primer. |
| [decisions/](decisions/README.md) | Architectural Decision Records — pathname routing, no client caching, JWT auth, jury entry token, snapshot migrations. |
| [walkthroughs/](walkthroughs/README.md) | Tutorial-style end-to-end narratives — jury day, tenant onboarding, period lifecycle, audit trail, multi-tenant data flow. |
| [operations/](operations/README.md) | Audit system coverage, backup & recovery, demo environment, incident response runbooks. |
| [deployment/](deployment/README.md) | Environment variables, Supabase setup, Vercel deployment, migrations operational guide. |
| [testing/](testing/README.md) | Unit, E2E, SQL (pgTAP), Edge Function tests; smoke checklist; current quality assessment. |
| [design/](design/README.md) | UI reference prototypes and archived mockups. |

---

## Planned

| Section | Status |
| --- | --- |
| (none currently outstanding) | All planned doc sections from the original restructure plan have shipped. |

These land in subsequent restructure sessions; the plan lives in
`.claude/internal/plans/docs-restructure/`.

---

## Internal-only content

Plans, specs, and Claude-agent implementation reports live in
`.claude/internal/` (gitignored). Not part of the user-facing documentation
set; tracked locally for context only.

---

> *Last updated: 2026-04-24*
