# P2-12 — QA catalog audit + prune

## Goal

`src/test/qa-catalog.json` claims 1167 test IDs. The repo has 938 actual tests. Reconcile them.

## What to do

1. Read `src/test/qa-catalog.json` — JSON with entries keyed by test ID.
2. Grep all test files for `qaTest("ID-...")` calls (test file globs: `src/**/__tests__/*.test.{js,jsx,ts,tsx}`, `e2e/**/*.spec.ts`, `supabase/functions/**/*.test.ts`, `sql/tests/**/*.sql` — note pgTAP files don't use qaTest but may have ID comments).
3. Build two sets:
   - **Catalog set** — every ID in qa-catalog.json
   - **Code set** — every ID referenced in `qaTest("…")` calls
4. Compute:
   - **In catalog, not in code** — these are missing tests. Mark with `"status": "backlog"` (preserve description so future work knows what's missing).
   - **In code, not in catalog** — orphaned IDs. Add the entry to qa-catalog.json with a generated description (use the test's `it()` / `qaTest()` second arg).
   - **In both** — keep as-is, no change.
5. Write a short report `docs/qa/catalog-reconciliation-2026-04-25.md` summarizing counts, top 10 backlog IDs, top 10 newly-catalogued IDs.

## Important

- Do NOT delete IDs from the catalog — mark them `"status": "backlog"` so the work isn't lost.
- Preserve catalog file ordering / indentation style.
- If grep finds an ID inside a `// QA-ID-…` comment but not a `qaTest()` call, treat it as "documented but not implemented" — mark backlog.

## Deliverable

- Modified `src/test/qa-catalog.json`
- New `docs/qa/catalog-reconciliation-2026-04-25.md` (~150 words)

Do NOT commit. Report back: catalog size before/after, backlog count, orphans-now-catalogued count.
