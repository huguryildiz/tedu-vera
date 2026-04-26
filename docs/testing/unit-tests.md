# Unit Tests (Vitest)

Vitest-driven unit tests under `src/**/__tests__/`. Runs in jsdom — no
real browser, no real Supabase. Mocks the Supabase client at module
scope so every test is deterministic.

For the test pyramid + coverage targets, see [README.md](README.md). For
the **why** behind specific test patterns, see
[target-test-architecture.md](target-test-architecture.md).

---

## Commands

```bash
npm test                          # watch mode (default for local dev)
npm test -- --run                 # single CI-style run
npm run test:coverage             # single run with coverage report
npm test -- path/to/file.test.js  # one file
npm test -- --grep "qaTest id"    # filter by test name
```

Output:

- Watch mode shows pass/fail in terminal as files save.
- Coverage writes `coverage/` (lcov + html). Open `coverage/index.html`
  in a browser.

---

## Conventions

### `qaTest()` wrapper

Use [`qaTest()`](../../src/test/qaTest.js) instead of bare `it()`.
Every test gets a stable ID registered in `src/test/qa-catalog.json`,
which is the single source of truth for the test catalog (~1,224 IDs at
the time of writing).

```js
import { qaTest } from "@/test/qaTest";

qaTest("admin.unit.criteria.weight-validation", () => {
  // assertions here
});
```

Add the ID to `src/test/qa-catalog.json` first, then write the test.
The drift sentinels (`check:rls-tests`, `check:rpc-tests`) verify the
catalog is in sync with reality.

### Mocking Supabase

Every test file that imports from `src/shared/api/` must mock the
Supabase client at module scope:

```js
vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));
```

The exact relative path depends on the test file's location. Common
locations:

- `src/admin/__tests__/`
- `src/jury/__tests__/`
- `src/shared/__tests__/`
- Feature-adjacent `__tests__/` (e.g.
  `src/admin/features/criteria/__tests__/`).

Skipping the mock leads to `supabase.rpc is not a function` errors at
runtime.

### Dependency surfaces

| Surface | How to test |
| --- | --- |
| Pure functions (formatters, validators) | Direct call + assert. |
| Hooks | `@testing-library/react`'s `renderHook`. |
| Components | `render` + `screen.getByRole`. |
| API wrappers (`src/shared/api/admin/*`) | Mock the supabase client; assert RPC was called with correct args. |
| Field mapping (`fieldMapping.js`) | Direct call with sample inputs; assert UI ↔ DB round-trip. |

---

## Coverage thresholds

Defined in [`vite.config.js`](../../vite.config.js):

| Metric | Threshold | Last measured |
| --- | --- | --- |
| Lines | 53 | 54.92 |
| Functions | 38 | 38.44 |
| Branches | 57 | 58.88 |
| Statements | 53 | 54.92 |
| Hooks (per-folder) | 70 | — |
| Storage (per-folder) | 80 | — |

CI fails when any metric drops below threshold. Thresholds **ratchet up**
as coverage grows — never lower a threshold. The audit at
[premium-saas-test-upgrade-plan.md](premium-saas-test-upgrade-plan.md)
proposes 60/50/65 as the next stretch target.

---

## What goes in a unit test vs. E2E

| Concern | Unit | E2E |
| --- | --- | --- |
| Pure logic, formatters | ✓ | — |
| Hook state transitions | ✓ | — |
| Component render under mocked context | ✓ | — |
| Real RPC contract | — | ✓ |
| Real RLS enforcement | — | ✓ (via [`e2e/security/`](../../e2e/security/)) |
| Real DB write + verify | — | ✓ (e.g. `settings-save.spec.ts`) |
| Multi-page flow | — | ✓ |
| Visual regression | — | ✓ (via [`e2e/visual/`](../../e2e/visual/)) |

The mock boundary is the line: anything beyond `supabase.rpc()` belongs
in E2E. See [e2e-tests.md](e2e-tests.md).

---

## Anti-patterns

- **Tautology mocks.** A test that mocks the orchestrator hook to return
  X and then asserts the hook returned X. The page-test mock audit at
  [page-test-mock-audit.md](page-test-mock-audit.md) catalogs 9 admin
  pages with this issue. Refactor target: mock the *data* (RPCs), not
  the *logic* (hooks).
- **Real network fetches.** If a test reaches an actual Supabase URL,
  the mock is missing or wrong. Test will be flaky and slow.
- **Sleeps / `setTimeout`.** Use vitest's fake timers
  (`vi.useFakeTimers()`) or `await waitFor(...)`.
- **`.skip()` left without a reason comment.** Skipped tests rot
  silently. Either fix or delete.

---

## Drift sentinels related to unit tests

- `npm run check:db-types` — regenerates `db.generated.ts`; fails CI if
  the committed file drifts.
- `npm run check:rls-tests` — every isolated table needs a paired pgTAP
  RLS test (the unit suite cannot test RLS).
- `npm run check:rpc-tests` — every admin RPC needs a paired test.
- `npm run check:edge-schema` — Edge Function arg shape consistency.
- `npm run check:no-native-select` — UI-side: never use native
  `<select>`. Run before finishing UI work.

---

## Reference patterns

When adding tests for a new feature, look at the closest matching
existing test as a template:

- **Hook orchestrator tests:** `src/admin/__tests__/useSettingsCrud.*.test.js`
- **API wrapper tests:** `src/shared/api/admin/__tests__/`
- **Component render tests:** `src/admin/features/audit/__tests__/AuditLogPage.test.jsx`
- **Field mapping tests:** `src/shared/api/__tests__/fieldMapping.test.js`

The canonical "what should our tests look like" doc is
[target-test-architecture.md](target-test-architecture.md).

---

## Related

- [README.md](README.md)
- [target-test-architecture.md](target-test-architecture.md)
- [premium-saas-test-upgrade-plan.md](premium-saas-test-upgrade-plan.md)
  (current quality assessment + roadmap)
- [page-test-mock-audit.md](page-test-mock-audit.md) (tautology audit)
- [page-test-coverage-map.md](page-test-coverage-map.md) (per-page test
  inventory)

---

> *Last updated: 2026-04-24*
