# Walkthroughs

End-to-end narratives that show how VERA actually works in operation. Where
the [architecture/](../architecture/) docs explain *what* a component is and
[decisions/](../decisions/) explain *why* it was chosen, walkthroughs show
**what happens, in order, when a real workflow runs** — with the
components, RPCs, audit events, and tests for each step.

Use these to build a mental model before touching unfamiliar code, or as
reference when an incident report says "the X flow broke at step 3".

## Index

| Walkthrough | Audience | Length |
| --- | --- | --- |
| [jury-day-end-to-end.md](jury-day-end-to-end.md) | New developer / on-call lead | ~15 min |
| [tenant-onboarding.md](tenant-onboarding.md) | Super-admin / platform engineer | ~10 min |
| [evaluation-period-lifecycle.md](evaluation-period-lifecycle.md) | Tenant-admin / new developer | ~10 min |
| [audit-trail-walkthrough.md](audit-trail-walkthrough.md) | Compliance / security review | ~8 min |
| [multi-tenant-data-flow.md](multi-tenant-data-flow.md) | Backend / SQL developer | ~12 min |

## Format

Each walkthrough follows the same shape:

1. **Scenario** — one-paragraph framing of the workflow.
2. **Actors** — who does what (admin, juror, system).
3. **Step-by-step** — numbered actions, each with:
   - what the user sees,
   - which component / RPC / Edge Function fires,
   - which audit event (if any) gets written,
   - which test pins the behavior.
4. **Failure modes** — common ways this flow breaks and where to look.
5. **Related** — pointers to architecture, decisions, runbooks.

The goal is operational truth: someone reading a walkthrough should be able
to predict what they would see in the database, in the audit log, and on
their screen if they performed the same workflow themselves.

---

> *Last updated: 2026-04-24*
