# 0001 — Pathname-based environment routing

**Status:** Accepted
**Date:** 2026-04-24

## Context

VERA runs in two Supabase environments: production (`vera-prod`) and demo
(`vera-demo`). The frontend must select the correct backend on every request,
across full-page navigations and JavaScript imports. Two viable mechanisms:

1. URL pathname — `/demo/*` routes target demo, everything else targets prod.
2. URL query parameter — `?demo=1` flag selects demo regardless of path.

The choice affects routing config, link sharing, OAuth redirects, deep-link
behavior, search-engine indexing, and how the Supabase client decides which
project to talk to.

## Decision

**Environment is determined purely by URL pathname.** A request whose pathname
starts with `/demo/` resolves to the demo Supabase project; everything else
resolves to production. The resolution lives in
`src/shared/lib/environment.js` and propagates through a Proxy-based Supabase
client in `src/shared/lib/supabaseClient.js`.

Routing uses React Router v6 with `createBrowserRouter`. The `/demo/*` subtree
mirrors the prod route tree.

## Consequences

**Positive**

- Sharing a link unambiguously shares the environment. A copied URL cannot
  silently lose the demo flag.
- Browser bookmarks, OAuth redirect URLs, and Vercel preview deployments work
  without query-param plumbing.
- The Supabase client can resolve its project at module-load time from the
  pathname, with no runtime flag-passing through hooks.
- SEO: prod and demo are entirely distinct URL spaces; no canonical-tag
  juggling.

**Negative**

- Adding a new prod-only or demo-only feature requires registering routes in
  both halves of the tree (or sharing a route component that reads
  `useLocation`).
- The `/demo/*` redirect from `/demo` to `/demo/admin` is hand-wired and must
  be kept in sync with the auto-login loader.

## Alternatives considered

- **`?demo=1` query parameter.** Rejected because (a) any internal `<Link>`
  that omits the param silently downgrades to prod, (b) OAuth redirect URLs
  cannot reliably preserve query strings across providers, and (c) it forces
  every Supabase client lookup through a runtime context rather than a
  pathname read.
- **Subdomain routing (`demo.vera.app` vs `vera.app`).** Rejected because it
  doubles DNS, certificate, and Vercel project management overhead for a
  single demo environment.

## Verification

How we know this decision is still in force:

- **Tests:**
  - [`src/shared/lib/__tests__/environment.test.js`](../../src/shared/lib/__tests__/environment.test.js)
    — pathname → environment resolution, `/demo/*` matching, edge cases
    (trailing slash, query string ignored).
  - [`src/shared/lib/__tests__/supabaseClient.test.js`](../../src/shared/lib/__tests__/supabaseClient.test.js)
    — Proxy client picks the right project based on resolved environment.
- **No audit signal.** Environment selection is not an auditable action; it
  is determined at request time and never recorded server-side. A regression
  here surfaces as wrong-data-on-page, not as an audit event.
- **Manual smoke:** open `/demo/admin` and `/admin` in two tabs; confirm the
  network panel shows the two different `*.supabase.co` hosts.

---

> *Last updated: 2026-04-24*
