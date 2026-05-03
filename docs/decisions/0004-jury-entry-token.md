# 0004 — Jury entry via single-use entry token

**Status:** Accepted
**Date:** 2026-04-24
**Last reviewed:** 2026-04-28

## Context

Jurors are domain experts invited for a single evaluation event. They are not
admins of any tenant and they do not have persistent accounts in the platform.
Two entry models are possible:

1. **Persistent juror accounts.** Each juror registers, sets a password, and
   logs in for every event.
2. **Entry tokens.** The admin generates a short-lived token; the juror
   reaches the platform via a URL or QR code, identifies themselves with
   name + last 4 digits of national ID, and is bound to that session.

The product is used at a university running ~2 jury sessions per academic
year, with rotating panels of external evaluators. Most jurors evaluate once
and never return.

## Decision

**Production jury entry is always via entry token.** The admin mints an entry
token (24-hour TTL by default, revocable at any time) bound to a specific
semester; the juror reaches `/eval`, presents the token, identifies
themselves, and the system resolves the tenant from the token's semester.

A juror's session is anchored by a server-issued session token persisted in
both `localStorage` and `sessionStorage` (per the dual-write rule in
[storage-policy.md](../architecture/storage-policy.md)) and validated on
every score write.

PIN reveal occurs on first visit; the juror sees the PIN once and is
expected to record it.

## Consequences

**Positive**

- No persistent juror account management. Onboarding a new juror is a single
  admin action: mint a token and share a URL.
- Tokens are revocable and time-bounded. If a token leaks, the admin
  revokes it and the link goes dead within seconds.
- Tenant resolution is implicit and unforgeable — the token carries the
  semester (and therefore the tenant); the client cannot spoof it.
- The flow works on shared kiosk devices typical of a jury venue.

**Negative**

- A juror who has used the platform before still re-identifies on every
  event. The PIN model softens this but does not eliminate it.
- Forgotten PINs require admin intervention (PIN-blocking page) — there is
  no self-service recovery, by design.
- Browser storage is convenience-only; the server is always the source of
  truth for whether a session is valid.

## Alternatives considered

- **Persistent juror accounts.** Rejected because the rotating-panel use
  case makes account management overhead disproportionate to value. Most
  jurors evaluate once.
- **Magic-link email per session.** Rejected because a non-trivial fraction
  of jurors arrive without checking email at the venue, and email delivery
  flake during a live session would be fatal.

## Verification

How we know this decision is still in force:

- **Audit events:**
  - `token.generate` — admin minted an entry token (records target period).
  - `token.revoke` — admin revoked an entry token.
  - `security.entry_token.revoked` — bulk revoke (records count).
  - `data.juror.auth.created` — juror started authentication via token.
  - `data.score.submitted` — score sheet submitted (proves the token chain
    led to a valid evaluation).
  - `juror.pin_locked` — juror locked after PIN attempts (token still valid
    but session blocked).
- **Tests:**
  - [e2e/admin/entry-tokens.spec.ts](../../e2e/admin/entry-tokens.spec.ts) —
    full token lifecycle: mint, copy URL, revoke, re-mint.
  - [e2e/jury/happy-path.spec.ts](../../e2e/jury/happy-path.spec.ts) —
    juror enters via token, identifies, scores, completes.
  - [e2e/jury/expired-session.spec.ts](../../e2e/jury/expired-session.spec.ts)
    — expired tokens reject access at `/eval`.
  - [e2e/jury/lock.spec.ts](../../e2e/jury/lock.spec.ts) — locked semester
    tokens show lock banner with disabled inputs.
  - [e2e/perf/concurrent-jury.spec.ts](../../e2e/perf/concurrent-jury.spec.ts)
    — concurrent jurors with distinct tokens do not collide.
- **Drift sentinels:** `npm run check:rls-tests` — token tables enforce
  per-organization scoping at the RLS layer.

---
