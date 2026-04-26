# 0002 — No client-side data caching

**Status:** Accepted
**Date:** 2026-04-24

## Context

Jury evaluation days are live, high-stakes events. A juror finishing a project
expects the next juror's screen — and the admin's dashboard — to reflect the
new score within seconds. Late or stale data on the admin overview during a
running session is a credibility failure.

A cache layer (React Query, SWR, etc.) typically defers refetches until a
cache key invalidates, with revalidation strategies tuned for typical web
apps. Those strategies optimize for read-heavy, low-staleness-tolerance UI —
which is exactly the wrong shape for jury day.

## Decision

**No client-side data caching layer.** Data is re-fetched on every tab switch,
mount, and admin-panel navigation. The Supabase client speaks to the server
on every request that needs fresh state.

This rule applies to scores, project status, jury progress, audit log, and
all admin panel views. It does **not** apply to:

- User preferences (theme, filter selections, sort order) — stored in
  `localStorage` and read locally without a server round-trip.
- Static configuration (criteria labels, MÜDEK mappings, band colors in
  `src/config.js`) — bundled with the build.
- Realtime subscriptions — `useAdminRealtime` keeps a live connection, which
  is push-based, not cached.

## Consequences

**Positive**

- Live evaluation days produce trustworthy data with no "ghost score" class
  of bug. The admin overview cannot show a juror's previous attempt while
  their next score is already in the database.
- The mental model is uniform: if you see something on the screen, the server
  saw it that recently.
- No cache-invalidation code paths to reason about during incident response.

**Negative**

- More database load than a cache-fronted equivalent. Mitigated by the small
  scale of a single tenant's jury session (~50 projects × ~10 jurors).
- The user perceives a brief load spinner on tab switches. Acceptable for
  this product; the alternative (silent staleness) is worse.

## Alternatives considered

- **React Query with short stale time.** Rejected because tuning stale time
  to be "short enough for jury day" effectively disables the cache; the
  bookkeeping cost without the benefit.
- **Cache only static admin pages.** Rejected because every "static" admin
  page (Periods, Criteria, Outcomes) becomes destructive-capable mid-session,
  and a partial-cache rule is hard to enforce consistently across many pages.

## Verification

How we know this decision is still in force:

- **Tests:**
  - `src/admin/__tests__/useAdminData.test.js` — score loading hook fetches
    on every mount; no stale cache layer.
  - [e2e/jury/resume.spec.ts](../../e2e/jury/resume.spec.ts) — a juror's
    resume produces fresh server state.
  - [e2e/admin/periods-realtime.spec.ts](../../e2e/admin/periods-realtime.spec.ts)
    — admin overview reflects realtime score writes.
- **Negative-presence check:** the project does not depend on `react-query`,
  `swr`, or any cache library. If `package.json` ever grows such a
  dependency, this ADR is being violated.
- **No audit signal.** Caching is a client-side absence; there is no event
  that fires when caching is correctly *not* happening. Detection is by
  inspection during incident review.

---

> *Last updated: 2026-04-24*
