# Contributing

Conventions for branches, commits, and pull requests. The goal is small,
reviewable units — not heroic single-author rewrites.

---

## Branches

- `main` is the only long-lived branch and is always deployable.
- Feature work: short-lived branches off `main`, deleted after merge.
- No worktrees — work directly on `main` for non-disruptive changes, or branch
  for anything user-visible.

---

## Commit messages

Follow the existing repository style — short imperative subject with a scope
prefix. Inspect recent commits for examples:

```bash
git log --oneline -20
```

Common scopes used in this repo:

| Scope | Example |
| --- | --- |
| `fix` | `fix(e2e): reset maintenance_mode in globalSetup so leaked state doesn't break next run` |
| `feat` | `feat(Phase C): multi-tenant architecture, auth, UI overhaul` |
| `chore` | `chore(ci): e2e sharding + workers (Phase B)` |
| `test` | `test(e2e): add admin CRUD specs (orgs, jurors, periods, setup-wizard, tokens, audit)` |
| `docs` | `docs: rewrite top-level README and consolidate mockups under docs/design/` |

Keep the subject under ~70 characters. If more context is needed, add a body
paragraph explaining **why** (not what — the diff already says what).

---

## Pull requests

A good PR is one logical change. If you find yourself writing "and also..." in
the description, split it into two PRs.

PR description should answer:

1. **What changes?** One sentence.
2. **Why?** The motivating bug, request, or constraint.
3. **How was it tested?** Checklist of unit / E2E / manual paths exercised.
4. **Risk?** What could break that the diff doesn't obviously address.

---

## Review gates

CI must pass before merge:

- `npm test -- --run` — vitest unit suite, with coverage threshold gate.
- `npm run build` — production build.
- `npm run e2e` — Playwright E2E (sharded across workers in CI).
- pgTAP migration suite — runs against an ephemeral Postgres instance.
- Drift sentinels — `check:db-types`, `check:rls-tests`, `check:rpc-tests`,
  `check:edge-schema`, `check:no-native-select`, `check:no-nested-panels`.

A failing sentinel is not optional. Either fix the underlying drift or, if
intentional, update the sentinel and document why in the PR.

---

## Database changes

DB schema and RPC changes go through the migration pipeline only. Direct ad-hoc
SQL is never the answer.

1. Edit the relevant module in `sql/migrations/` (002 schema, 004 RLS, 005 jury
   RPC, 006a/b admin RPC, etc. — see `sql/README.md` for the module map).
2. Apply the migration to **both** vera-prod and vera-demo via the Supabase MCP
   server in the same step.
3. Update `sql/README.md` if the change of the file itself is structural (new
   module, removed module, repurposed module).
4. Run `npm run check:db-types` to refresh `db.generated.ts` and commit the
   resulting type changes alongside the migration.

---

## Code style

Follow what's already there. The project carries a number of stylistic
constants documented in `CLAUDE.md`:

- All icons from `lucide-react` — never inline SVG.
- All errors via `<FbAlert>` — no inline red text.
- All dialogs via `ConfirmDialog` — no `window.alert/confirm/prompt`.
- All selects via `CustomSelect` — no native `<select>`.
- CSS file size ceiling 600 lines; JSX/JS file ceiling 500/800/1000.
- All storage access through `src/shared/storage/keys.js` + abstraction
  modules — no hardcoded keys, no raw `localStorage.setItem` outside the
  storage layer.

The full ruleset lives in `CLAUDE.md` at the repo root.

---

## Asking for help

- Open a draft PR early if you want feedback before the change is finished.
- Tag `@huguryildiz` for architecture, multi-tenancy, or accreditation
  questions.
- For UI / design alignment, link the relevant prototype from
  [design/reference/](design/reference/) in the PR description.

---

> *Last updated: 2026-04-24*
