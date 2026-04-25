# E — Hook orchestrator hardening (Pazartesi)

**You are a Sonnet 4.6 subagent dispatched by the main Opus session.**

**Repo root:** `/Users/huguryildiz/Documents/GitHub/VERA`
**Your scope:** Rewrite 3 hook orchestrator tests to catch partial-failure scenarios instead of only happy-path mock tautologies.

---

## Goal

The audit report identified 3 hook orchestrator tests as mock-heavy and "tautological":

1. `src/admin/hooks/useAdminData.test.*` (or wherever it lives)
2. `src/jury/useJuryState.test.*` (or `src/jury/__tests__/useJuryState.test.*`)
3. `src/admin/hooks/useSettingsCrud.test.*` (if exists — verify first; if not, substitute `useManagePeriods` or another critical orchestrator)

Current weakness: they mock every adminApi/juryApi function with hardcoded happy-path responses. Single-path tests only. Zero coverage of partial failure (e.g., `getScores` succeeds, `getProjectSummary` fails).

Your job: **introduce a fake API surface that supports per-call success/failure outcomes**, then add tests that prove the hooks handle partial failures correctly (show user-visible error, don't crash, don't corrupt state).

## Context

**CRITICAL — READ FIRST:**

1. `docs/qa/vera-test-audit-report.md` — sections 3.2, 3.3, 3.4, 4.1 (Parça E context)
2. `src/admin/hooks/useAdminData.js` (or wherever it lives; `grep -l useAdminData src/admin/hooks/ src/admin/`)
3. The existing test file for each hook
4. `src/shared/api/adminApi.js` and `src/shared/api/juryApi.js` — understand the real API surface
5. `src/shared/api/admin/scores.js` and similar — understand error propagation patterns

## Strategy: Fake API surface

Instead of `vi.mock("@/shared/api")` with hardcoded returns, create a **test fixture** that simulates the API layer with configurable per-call outcomes:

```js
// test/helpers/createFakeAdminApi.js (NEW FILE — or put inline in test file initially)
export function createFakeAdminApi(outcomes = {}) {
  const calls = [];
  const handler = (name) => (...args) => {
    calls.push({ name, args });
    const outcome = outcomes[name];
    if (!outcome) throw new Error(`Unmocked API call: ${name}`);
    if (outcome.throws) throw outcome.throws;
    return Promise.resolve(outcome.data);
  };
  return new Proxy({}, {
    get(_, name) { return handler(name); },
    set() { return true; },
  });
}
```

Each test can then configure the fake per-call:

```js
const fakeApi = createFakeAdminApi({
  getScores: { data: [...realistic rows...] },
  getProjectSummary: { throws: Object.assign(new Error('RLS denied'), { code: '42501' }) },
  listPeriods: { data: [...] },
});

const { result } = renderHook(() => useAdminData(orgId, periodId), {
  wrapper: ({ children }) => (
    <AdminApiProvider api={fakeApi}>{children}</AdminApiProvider>
  ),
});
```

**OR** use `vi.mock` with dynamic per-test behavior:

```js
vi.mock("@/shared/api", () => ({
  getScores: vi.fn(),
  getProjectSummary: vi.fn(),
  // ...
}));

import { getScores, getProjectSummary } from "@/shared/api";

it("surfaces partial failure when getProjectSummary throws RLS", async () => {
  vi.mocked(getScores).mockResolvedValue([...]);
  vi.mocked(getProjectSummary).mockRejectedValue(
    Object.assign(new Error('RLS'), { code: '42501' })
  );

  const { result } = renderHook(() => useAdminData(...));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.scores).toEqual([...]); // partial data preserved
  expect(result.current.error.code).toBe('42501');
});
```

**Pick the approach that matches the existing codebase style.** Read one or two existing tests; follow their pattern but add partial-failure branches.

## Required test scenarios per hook

### `useAdminData`

1. Happy path — all API calls succeed → hook returns populated state (this is likely already tested; confirm)
2. **Partial failure A:** `getScores` succeeds, `getProjectSummary` rejects with code 42501 → hook state has `.scores` populated, `.error.code === '42501'`, no crash
3. **Partial failure B:** `listPeriods` succeeds, `getScores` rejects → hook surfaces error, does NOT call subsequent functions
4. **Empty state:** all succeed but return `[]` → hook distinguishes "no data" from "not loaded yet"

### `useJuryState`

1. Happy path — auth → period → PIN → eval (likely already tested partially)
2. **PIN mismatch:** `verifyPin` rejects with specific error → state transitions to lock screen OR re-prompts (per actual behavior; read source)
3. **Token expiry mid-flow:** `getScores` succeeds, then next call rejects with session expired → hook transitions to re-auth state
4. **Network error during eval:** `upsertScore` rejects → hook surfaces transient error but doesn't lose in-memory state

### `useSettingsCrud` (or substitute)

If this hook exists (check `src/admin/hooks/useSettingsCrud.js`):

1. Happy path save
2. **Concurrent edit conflict:** save rejects with 409 → hook shows conflict state, preserves user's unsaved input
3. **Network failure during batch save:** first RPC succeeds, second fails → hook rolls back UI or surfaces partial-save warning (per actual behavior)

**IF `useSettingsCrud` doesn't exist,** substitute with `useManagePeriods` or `useAdminRealtime` — any hook that calls multiple API functions. Document the substitution.

## What you MUST do

1. Read the audit report sections listed above
2. Read each hook's source + existing test
3. Find or create a fake-API pattern that matches codebase style
4. Add at least 3 partial-failure tests per hook
5. Run `npx vitest run <test-file>` after each hook to verify
6. **CRITICAL:** For each new test, do a deliberate-break sanity check — comment out the fix in the hook and verify the test FAILS, then uncomment. If the test passes regardless of the hook behavior, it's a tautology — rewrite it.

## What you MUST NOT do

- ❌ Do NOT remove existing passing tests
- ❌ Do NOT modify hook source code (`*.js` / `*.jsx`) unless you find a clear bug, and if you do, document it as "POTENTIAL BUG" and let the user decide
- ❌ Do NOT write tests that pass regardless of hook behavior (tautology check is mandatory)
- ❌ Do NOT introduce new deps

## Output format

Return:

1. **Per-hook summary:**
   - Hook name + file path
   - Scenarios added (list of test names)
   - Tautology check performed (yes/how)
   - Any POTENTIAL BUGs discovered
2. **Verification:** vitest output for each file (trimmed)
3. **Pattern used:** fake-proxy vs vi.mock dynamic — which and why
4. **Files modified:** list
5. **New helper files:** if any (e.g., `test/helpers/createFakeAdminApi.js`)

## IMPORTANT — false-confidence risk

The audit explicitly flagged this parça as "risky — could create new tautologies." The main session will run a `feature-dev:code-reviewer` Opus pass over your output before commit.

**Your tests must survive a harsh review:**

- "Does this test fail if I revert the hook to a broken implementation?"
- "Is the assertion on state a real observable behavior or an implementation detail?"
- "Does the fake API simulate realistic error shapes (with `.code`, `.status`, `.details` like real Supabase errors)?"

Write tests you'd be embarrassed to see fail harshly. If in doubt, add 1 fewer test but make each one pull its weight.

## Environment reminder

- Read tool with absolute paths
- Edit tool for modifications; Write for brand-new helper files
- Time budget: ~120-180 minutes
- Block threshold: 30 minutes → move on, report

Begin.
