# Page-Test Mock Discipline

> _Last updated: 2026-04-28_

This guide governs how admin **page** component tests (`*Page.test.jsx`)
should set up mocks. The rule is simple but easy to violate, so it has
its own page.

---

## The rule

**Do not mock the page's own orchestration hook.** The page's own
`use<X>` hook is what the page test is supposed to exercise — mocking
it produces a closed-loop test that proves nothing.

Mock at the **API or Supabase boundary** instead. The hook then runs
real, the page renders against real hook state, and the assertions
verify real behavior.

---

## Tautology vs. clean pattern

**Tautology (anti-pattern):**

```javascript
vi.mock("../useManageJurors", () => ({
  useManageJurors: () => ({
    jurors: [],
    loadJurors: vi.fn(),
    // ... all behavior mocked
  }),
}));
// The hook never runs; the test only proves the mock returns what the mock returns.
```

**Clean (correct pattern):**

```javascript
vi.mock("@/shared/api", () => ({
  listJurorsSummary: vi.fn().mockResolvedValue([]),
  getScores: vi.fn().mockResolvedValue([]),
  // ... boundary only
}));
beforeEach(() => { /* per-test data overrides */ });
// Hook runs real; API calls controlled at the boundary.
```

---

## Justified leaf-hook mocks

Some `vi.mock("../use*")` calls are legitimate. They mock something at
a real boundary — not the page's own orchestration:

| File | Mocked hook | Why it is justified |
|---|---|---|
| `JurorsPage.test.jsx` | `useAdminResponsiveTableMode` | Pure responsive utility (window.matchMedia wrapper); jsdom needs deterministic viewport mode. |
| `JurorsPage.test.jsx` | `useManagePeriods` | **Sibling** dependency — JurorsPage's own orchestration is `useManageJurors`. `useManagePeriods` only supplies the period dropdown data. |
| `JurorsPage.test.jsx` | `useManageProjects` | Same: sibling dependency for the projects dropdown. |
| `CriteriaPage.test.jsx` | `useCriteriaExport` | Single-purpose export hook (only side effect: `logExportInitiated`); not orchestration. |
| `OutcomesPage.test.jsx` | `useOutcomesExport` | Same: single-purpose export hook. |
| `SetupWizardPage.test.jsx` | `useSetupWizard` | State-machine hook (no API side effects); the component test exercises wizard step rendering, not the state machine. |
| `useAdminData.test.js` | `useAdminRealtime` | Boundary mock — `useAdminRealtime` is a child of `useAdminData`, the unit-under-test here. |
| `filterPipeline.test.js` | `useReviewsFilters` | Selector test imports only the **pure utility exports** (`buildDateRange`, `toFiniteNumber`, etc.); the mock returns those utilities only, not the hook state. |

**Rule of thumb:** a mock is acceptable when the mocked module is at a
real boundary (API, network, time, third-party) **or** is a sibling
dependency of the unit-under-test rather than its own orchestration.
Mocking the page's own state-and-effects hook is the tautology pattern.

---

## How to keep the suite tautology-free

When adding a new admin page test:

1. **Do not mock the page's own `use<X>` hook.** Mock its API
   dependencies instead.
2. **Mock at `@/shared/api`** (or `@/shared/lib/supabaseClient`) for
   network calls.
3. **Mock at `@/admin/shared/usePageRealtime`** for realtime — these
   are E2E-tested separately.
4. **Pre-existing leaf-hook mocks** (toast, card selection, floating,
   responsive mode) stay — they are at module/utility boundaries.
5. **Run** `grep -rn 'vi\.mock("\.\./use' src/` after the change. Every
   hit should appear in the table above. If yours doesn't, you have
   added a tautology — refactor before merging.

If a hook is extracted from a page mid-refactor, re-run the grep — the
extraction is the moment new tautologies most often appear.

---

## Why this matters

Tautology tests create false confidence. A passing tautology test means
"the mock returns what the mock returns" — it does not mean the page
works. Converting to the clean pattern proves the page's hook contract
holds against a controlled boundary instead of against itself.

The cost of the rule is small: a few extra boundary mocks. The cost of
violating it is silent — broken pages with green tests.
