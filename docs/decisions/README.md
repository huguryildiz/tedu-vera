# Architectural Decision Records

This folder holds the architectural decisions that shape VERA. Each record
captures **why** a decision was made and **what would break** if it were
reversed — not just what the code does today.

## When to write an ADR

Open a new ADR when a change:

1. Crosses subsystem boundaries (auth, routing, data layer, multi-tenancy).
2. Locks the project into a long-lived contract that future work must respect.
3. Is non-obvious from reading the code — the *why* would be lost without it.

Bug fixes, refactors, and feature work do not need ADRs.

## Format

Each ADR is a short markdown file with this skeleton:

```markdown
# NNNN — Decision Title

**Status:** Accepted | Superseded by NNNN | Deprecated
**Date:** YYYY-MM-DD

## Context

The constraint, problem, or pressure that forced a decision.

## Decision

What we chose, in one or two sentences.

## Consequences

Positive and negative outcomes that flow from the choice.

## Alternatives considered

What we evaluated and rejected, with the reason.
```

Number ADRs sequentially (`0001`, `0002`, ...). Once accepted, never edit
historical ADRs in place — supersede with a new ADR if a decision changes.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-pathname-based-routing.md) | Pathname-based environment routing | Accepted |
| [0002](0002-no-client-caching.md) | No client-side data caching | Accepted |
| [0003](0003-jwt-admin-auth.md) | JWT-based admin auth with legacy v1 coexistence | Accepted |
| [0004](0004-jury-entry-token.md) | Jury entry via single-use entry token | Accepted |
| [0005](0005-snapshot-migrations.md) | Snapshot-based database migrations | Accepted |

---
