# Reviews KPI Strip Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Reviews page KPI strip (Reviews · Jurors · Projects · Partial · Avg Score) with five action-oriented metrics: Reviews · Completed (coverage) · Pending Submit · Juror Agreement (Δ spread) · Avg Score.

**Architecture:** Extract the three new computations (coverage, pending, spread) into a pure-function helper module for clean unit testing. Fix the pre-existing broken ReviewsPage tests (context not mocked, native-select interaction) as part of the same commit. Update the component's inline KPI derivations and JSX.

**Tech Stack:** React 18, Vitest, Testing Library

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/admin/utils/reviewsKpiHelpers.js` | Three pure KPI computation functions |
| Create | `src/admin/__tests__/reviewsKpiHelpers.test.js` | Unit tests for the helpers |
| Modify | `src/test/qa-catalog.json` | Add 3 new test IDs |
| Modify | `src/admin/__tests__/ReviewsPage.test.jsx` | Fix broken tests (mock context, fix CustomSelect interaction) |
| Modify | `src/admin/pages/ReviewsPage.jsx` | Replace KPI derivations (lines ~313–325) and JSX (lines ~492–516) |

---

## Task 1: Create KPI helper module

**Files:**
- Create: `src/admin/utils/reviewsKpiHelpers.js`

- [ ] **Step 1: Write the helper file**

```js
// src/admin/utils/reviewsKpiHelpers.js

/**
 * Completed jurors / total assigned jurors.
 * Returns { display, completed, total } for color logic.
 */
export function computeCoverage(kpiBase, assignedJurors) {
  const total = Array.isArray(assignedJurors) ? assignedJurors.length : 0;
  if (total === 0) return { display: "—", completed: 0, total: 0 };
  const completed = new Set(
    kpiBase
      .filter((r) => r.jurorStatus === "completed")
      .map((r) => r.jurorId || r.juryName)
  ).size;
  return { display: `${completed} / ${total}`, completed, total };
}

/**
 * Count of unique jurors in ready_to_submit state.
 */
export function computePending(kpiBase) {
  return new Set(
    kpiBase
      .filter((r) => r.jurorStatus === "ready_to_submit")
      .map((r) => r.jurorId || r.juryName)
  ).size;
}

/**
 * Average inter-juror population σ across projects (completed jurors only).
 * Each project with ≥ 2 completed jurors contributes one σ value.
 * Returns "—" when no project qualifies.
 */
export function computeSpread(kpiBase) {
  const byProject = new Map();
  kpiBase.forEach((r) => {
    if (
      r.jurorStatus !== "completed" ||
      r.total == null ||
      !Number.isFinite(Number(r.total))
    )
      return;
    const key = r.projectId || r.title;
    if (!key) return;
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push(Number(r.total));
  });

  const sigmas = [];
  byProject.forEach((scores) => {
    if (scores.length < 2) return;
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance =
      scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    sigmas.push(Math.sqrt(variance));
  });

  if (sigmas.length === 0) return "—";
  return (sigmas.reduce((s, v) => s + v, 0) / sigmas.length).toFixed(1);
}
```

- [ ] **Step 2: Verify the file exists**

```bash
cat src/admin/utils/reviewsKpiHelpers.js
```

Expected: file prints cleanly with the 3 exported functions.

---

## Task 2: Register new test IDs in qa-catalog.json

**Files:**
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Append 3 entries before the closing `]`**

Open `src/test/qa-catalog.json`, find the last `}` before the closing `]`, add a comma after it, then append:

```json
  {
    "id": "reviews.kpi.01",
    "module": "Scores / Details",
    "area": "Reviews KPI — Coverage",
    "story": "Completed Coverage Shows Correct Fraction",
    "scenario": "2 of 4 assigned jurors completed → displays '2 / 4'; all completed → 100%; none assigned → '—'",
    "whyItMatters": "Coverage is the primary completion signal admins track on evaluation day.",
    "risk": "Wrong denominator silently misreports completion progress.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.kpi.02",
    "module": "Scores / Details",
    "area": "Reviews KPI — Pending Submit",
    "story": "Pending Submit Counts Unique Ready-to-Submit Jurors",
    "scenario": "2 jurors in ready_to_submit state (one appears in 2 rows) → count is 2, not 3",
    "whyItMatters": "Admin uses this to chase jurors who finished scoring but forgot to submit.",
    "risk": "Overcounting duplicate rows would inflate the pending number.",
    "coverageStrength": "Strong",
    "severity": "normal"
  },
  {
    "id": "reviews.kpi.03",
    "module": "Scores / Details",
    "area": "Reviews KPI — Juror Agreement Spread",
    "story": "Spread Computes Average Inter-Juror Sigma Across Projects",
    "scenario": "Two projects each with σ=5 → Δ 5.0; in-progress rows excluded; single-juror projects excluded; no qualifying data → '—'",
    "whyItMatters": "High spread flags projects where jurors disagree, which may need arbitration.",
    "risk": "Including non-completed rows or projects with <2 jurors would distort the metric.",
    "coverageStrength": "Strong",
    "severity": "normal"
  }
```

- [ ] **Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/test/qa-catalog.json','utf8')); console.log('ok')"
```

Expected output: `ok`

---

## Task 3: Write KPI helper unit tests

**Files:**
- Create: `src/admin/__tests__/reviewsKpiHelpers.test.js`

- [ ] **Step 1: Write the test file**

```js
import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import {
  computeCoverage,
  computePending,
  computeSpread,
} from "../utils/reviewsKpiHelpers.js";

describe("Reviews KPI helpers", () => {
  describe("computeCoverage", () => {
    qaTest("reviews.kpi.01", () => {
      const rows = [
        { jurorId: "j1", jurorStatus: "completed" },
        { jurorId: "j2", jurorStatus: "in_progress" },
        { jurorId: "j3", jurorStatus: "completed" },
      ];
      const jurors = [
        { jurorId: "j1" },
        { jurorId: "j2" },
        { jurorId: "j3" },
        { jurorId: "j4" },
      ];

      const result = computeCoverage(rows, jurors);
      expect(result.display).toBe("2 / 4");
      expect(result.completed).toBe(2);
      expect(result.total).toBe(4);

      // All completed
      const allRows = [
        { jurorId: "j1", jurorStatus: "completed" },
        { jurorId: "j2", jurorStatus: "completed" },
      ];
      const r2 = computeCoverage(allRows, [{ jurorId: "j1" }, { jurorId: "j2" }]);
      expect(r2.display).toBe("2 / 2");
      expect(r2.completed).toBe(2);

      // No assigned jurors
      const r3 = computeCoverage(rows, []);
      expect(r3.display).toBe("—");
    });
  });

  describe("computePending", () => {
    qaTest("reviews.kpi.02", () => {
      const rows = [
        { jurorId: "j1", jurorStatus: "ready_to_submit" },
        { jurorId: "j2", jurorStatus: "completed" },
        { jurorId: "j3", jurorStatus: "ready_to_submit" },
        // j3 appears twice (different project rows)
        { jurorId: "j3", jurorStatus: "ready_to_submit" },
        { jurorId: "j4", jurorStatus: "in_progress" },
      ];
      // j1 and j3 are ready_to_submit (j3 deduped) → 2
      expect(computePending(rows)).toBe(2);

      // None pending
      expect(
        computePending([{ jurorId: "j1", jurorStatus: "completed" }])
      ).toBe(0);
    });
  });

  describe("computeSpread", () => {
    qaTest("reviews.kpi.03", () => {
      const rows = [
        // p1: scores 80, 90 → mean 85, σ = 5
        { projectId: "p1", jurorStatus: "completed", total: 80 },
        { projectId: "p1", jurorStatus: "completed", total: 90 },
        // p2: scores 70, 80 → mean 75, σ = 5
        { projectId: "p2", jurorStatus: "completed", total: 70 },
        { projectId: "p2", jurorStatus: "completed", total: 80 },
        // p3: in_progress → excluded
        { projectId: "p3", jurorStatus: "in_progress", total: 75 },
        // p4: only 1 completed juror → excluded from σ
        { projectId: "p4", jurorStatus: "completed", total: 85 },
      ];
      // avg σ of p1 and p2 = (5 + 5) / 2 = 5.0
      expect(computeSpread(rows)).toBe("5.0");

      // No qualifying projects → "—"
      expect(
        computeSpread([{ projectId: "p1", jurorStatus: "in_progress", total: 80 }])
      ).toBe("—");

      // Single juror per project → "—"
      expect(
        computeSpread([
          { projectId: "p1", jurorStatus: "completed", total: 80 },
          { projectId: "p2", jurorStatus: "completed", total: 90 },
        ])
      ).toBe("—");
    });
  });
});
```

- [ ] **Step 2: Run the new tests — verify they FAIL (helpers not yet imported from correct path)**

```bash
npm test -- --run src/admin/__tests__/reviewsKpiHelpers.test.js
```

Expected: tests pass immediately (helpers already created in Task 1). If they fail, check the import path.

Actually, since helpers already exist, expected: **3 passed**.

- [ ] **Step 3: Confirm 3 tests pass**

```bash
npm test -- --run src/admin/__tests__/reviewsKpiHelpers.test.js 2>&1 | grep -E "passed|failed"
```

Expected: `3 passed`

---

## Task 4: Fix broken ReviewsPage.test.jsx

**Files:**
- Modify: `src/admin/__tests__/ReviewsPage.test.jsx`

The file has two bugs:
1. `useAdminContext` is never mocked — data never reaches the component
2. `setPanelSelect` queries a native `<select>` that no longer exists (component uses `CustomSelect`)

- [ ] **Step 1: Add context mock and update imports at top of file**

Replace the top of the file (lines 1–8) with:

```js
import { beforeAll, beforeEach, describe, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/auth", () => ({
  useAuth: () => ({ activeOrganization: null }),
}));

vi.mock("../hooks/useAdminContext");
import { useAdminContext } from "../hooks/useAdminContext";
import ReviewsPage from "../pages/ReviewsPage";
import { qaTest } from "../../test/qaTest.js";
```

- [ ] **Step 2: Update `renderDetails` to mock context instead of passing props**

Replace the `renderDetails` function (lines 37–119) with:

```js
function renderDetails() {
  const data = [
    {
      period: "2026 Spring",
      jurorId: "j1",
      juryName: "Alice",
      affiliation: "EE",
      projectId: "p1",
      groupNo: 1,
      projectName: "Project Alpha",
      students: "A Student",
      technical: 25,
      design: 25,
      delivery: 20,
      teamwork: 8,
      total: 78,
      comments: "good",
      updatedAt: "2026-03-10T10:00:00.000Z",
      updatedMs: new Date("2026-03-10T10:00:00.000Z").getTime(),
      finalSubmittedAt: "2026-03-10T11:00:00.000Z",
      finalSubmittedMs: new Date("2026-03-10T11:00:00.000Z").getTime(),
    },
    {
      period: "2026 Spring",
      jurorId: "j2",
      juryName: "Bob",
      affiliation: "EE",
      projectId: "p2",
      groupNo: 2,
      projectName: "Project Beta",
      students: "B Student",
      technical: 20,
      design: null,
      delivery: null,
      teamwork: null,
      total: null,
      comments: "",
      updatedAt: "2026-03-11T09:00:00.000Z",
      updatedMs: new Date("2026-03-11T09:00:00.000Z").getTime(),
      finalSubmittedAt: "",
      finalSubmittedMs: 0,
      editingFlag: "editing",
    },
    {
      period: "2026 Spring",
      jurorId: "j3",
      juryName: "Cara",
      affiliation: "EE",
      projectId: "p3",
      groupNo: 3,
      projectName: "Project Gamma",
      students: "C Student",
      technical: null,
      design: null,
      delivery: null,
      teamwork: null,
      total: null,
      comments: "",
      updatedAt: "2026-03-12T12:00:00.000Z",
      updatedMs: new Date("2026-03-12T12:00:00.000Z").getTime(),
      finalSubmittedAt: "",
      finalSubmittedMs: 0,
    },
  ];
  const jurors = [
    { key: "j1", jurorId: "j1", name: "Alice", dept: "EE", editEnabled: false, finalSubmittedAt: "2026-03-10T11:00:00.000Z" },
    { key: "j2", jurorId: "j2", name: "Bob",   dept: "EE", editEnabled: true,  finalSubmittedAt: "" },
    { key: "j3", jurorId: "j3", name: "Cara",  dept: "EE", editEnabled: false, finalSubmittedAt: "" },
  ];
  useAdminContext.mockReturnValue({
    data,
    allJurors: jurors,
    assignedJurors: jurors,
    groups: [],
    periodName: "2026 Spring",
    summaryData: [],
    loading: false,
    criteriaConfig: MOCK_CRITERIA,
  });
  return render(<ReviewsPage />);
}
```

- [ ] **Step 3: Update `renderDetails2` to mock context**

Replace `renderDetails2` (lines 121–166) with:

```js
function renderDetails2() {
  const data = [
    {
      period: "2026 Spring", jurorId: "j1", juryName: "Alice", affiliation: "EE",
      projectId: "p1", groupNo: 1, projectName: "Project Alpha", students: "A Student",
      technical: 25, design: 25, delivery: 20, teamwork: 8, total: 78, comments: "good",
      updatedAt: "2026-03-10T10:00:00.000Z", updatedMs: new Date("2026-03-10T10:00:00.000Z").getTime(),
      finalSubmittedAt: "2026-03-10T11:00:00.000Z", finalSubmittedMs: new Date("2026-03-10T11:00:00.000Z").getTime(),
    },
    {
      period: "2026 Spring", jurorId: "j2", juryName: "Bob", affiliation: "EE",
      projectId: "p2", groupNo: 2, projectName: "Project Beta", students: "B Student",
      technical: 20, design: null, delivery: null, teamwork: null, total: null, comments: "",
      updatedAt: "2026-03-11T09:00:00.000Z", updatedMs: new Date("2026-03-11T09:00:00.000Z").getTime(),
      finalSubmittedAt: "", finalSubmittedMs: 0, editingFlag: "editing",
    },
    {
      period: "2026 Spring", jurorId: "j3", juryName: "Cara", affiliation: "EE",
      projectId: "p3", groupNo: 3, projectName: "Project Gamma", students: "C Student",
      technical: null, design: null, delivery: null, teamwork: null, total: null, comments: "",
      updatedAt: "2026-03-12T12:00:00.000Z", updatedMs: new Date("2026-03-12T12:00:00.000Z").getTime(),
      finalSubmittedAt: "", finalSubmittedMs: 0,
    },
    {
      period: "2026 Spring", jurorId: "j4", juryName: "Dave", affiliation: "CS",
      projectId: "p4", groupNo: 4, projectName: "Project Delta", students: "D Student",
      technical: null, design: null, delivery: null, teamwork: null, total: null, comments: "",
      updatedAt: "2026-03-13T08:00:00.000Z", updatedMs: new Date("2026-03-13T08:00:00.000Z").getTime(),
      finalSubmittedAt: "", finalSubmittedMs: 0,
    },
  ];
  const jurors = [
    { key: "j1", jurorId: "j1", name: "Alice", dept: "EE", editEnabled: false, finalSubmittedAt: "2026-03-10T11:00:00.000Z" },
    { key: "j2", jurorId: "j2", name: "Bob",   dept: "EE", editEnabled: true,  finalSubmittedAt: "" },
    { key: "j3", jurorId: "j3", name: "Cara",  dept: "EE", editEnabled: false, finalSubmittedAt: "" },
    { key: "j4", jurorId: "j4", name: "Dave",  dept: "CS", editEnabled: false, finalSubmittedAt: "" },
  ];
  useAdminContext.mockReturnValue({
    data,
    allJurors: jurors,
    assignedJurors: jurors,
    groups: [],
    periodName: "2026 Spring",
    summaryData: [],
    loading: false,
    criteriaConfig: MOCK_CRITERIA,
  });
  return render(<ReviewsPage />);
}
```

- [ ] **Step 4: Replace `setPanelSelect` with CustomSelect-aware version**

Replace `setPanelSelect` (lines 172–178) with:

```js
function setPanelSelect(labelText, optionText) {
  const groups = Array.from(document.querySelectorAll(".filter-group"));
  const group = groups.find(
    (g) => g.querySelector("label")?.textContent?.trim() === labelText
  );
  expect(group).toBeTruthy();
  const trigger = group.querySelector("[aria-haspopup='listbox']");
  expect(trigger).toBeTruthy();
  fireEvent.click(trigger);
  const options = Array.from(document.querySelectorAll("[role='option']"));
  const opt = options.find(
    (o) => o.textContent?.trim().toLowerCase() === optionText.toLowerCase()
  );
  expect(opt).toBeTruthy();
  fireEvent.click(opt);
}
```

- [ ] **Step 5: Run the existing filter tests — verify they pass**

```bash
npm test -- --run src/admin/__tests__/ReviewsPage.test.jsx 2>&1 | grep -E "passed|failed|FAIL|PASS"
```

Expected: `8 passed`

If any test still fails, check whether `openFilterPanel` still works (looks for button named "Filter" — verify the button still has that aria label).

---

## Task 5: Update KPI computations in ReviewsPage.jsx

**Files:**
- Modify: `src/admin/pages/ReviewsPage.jsx`

- [ ] **Step 1: Add import for helper functions at top of file**

After the existing imports (around line 39, after the CSS import), add:

```js
import { computeCoverage, computePending, computeSpread } from "../utils/reviewsKpiHelpers";
```

- [ ] **Step 2: Replace KPI derivations (lines ~313–325)**

Find the block:
```js
  // ── KPI stats (reflects active filters) ─────────────────
  const kpiBase = filtered.length !== enriched.length ? filtered : enriched;
  const totalReviews = kpiBase.length;
  const uniqueJurors = new Set(kpiBase.map((r) => r.jurorId || r.juryName)).size;
  const uniqueProjects = new Set(kpiBase.map((r) => r.projectId || r.title)).size;
  const partialCount = kpiBase.filter((r) => r.effectiveStatus === "partial").length;
  // Average: only completed jurors — jurorStatus === "completed" mirrors Overview & Rankings logic exactly
  const scoredRows = kpiBase.filter(
    (r) => r.total != null && Number.isFinite(Number(r.total)) && r.jurorStatus === "completed"
  );
  const avgScore = scoredRows.length > 0
    ? (scoredRows.reduce((s, r) => s + Number(r.total), 0) / scoredRows.length).toFixed(1)
    : "—";
```

Replace with:

```js
  // ── KPI stats (reflects active filters) ─────────────────
  const kpiBase = filtered.length !== enriched.length ? filtered : enriched;
  const totalReviews = kpiBase.length;
  const coverage = computeCoverage(kpiBase, assignedJurors || jurors);
  const pendingCount = computePending(kpiBase);
  const avgSpread = computeSpread(kpiBase);
  const scoredRows = kpiBase.filter(
    (r) => r.total != null && Number.isFinite(Number(r.total)) && r.jurorStatus === "completed"
  );
  const avgScore = scoredRows.length > 0
    ? (scoredRows.reduce((s, r) => s + Number(r.total), 0) / scoredRows.length).toFixed(1)
    : "—";
```

- [ ] **Step 3: Confirm the file still builds**

```bash
npm run build 2>&1 | grep -E "error|warning|built" | head -20
```

Expected: no errors; build succeeds.

---

## Task 6: Replace KPI strip JSX

**Files:**
- Modify: `src/admin/pages/ReviewsPage.jsx`

- [ ] **Step 1: Replace the KPI strip JSX (lines ~492–516)**

Find:
```jsx
      {/* KPI strip */}
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{totalReviews}</div>
          <div className="scores-kpi-item-label">Reviews</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{uniqueJurors}</div>
          <div className="scores-kpi-item-label">Jurors</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{uniqueProjects}</div>
          <div className="scores-kpi-item-label">Projects</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            <span style={{ color: partialCount > 0 ? "var(--warning)" : undefined }}>{partialCount}</span>
          </div>
          <div className="scores-kpi-item-label">Partial</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{avgScore}</div>
          <div className="scores-kpi-item-label">Avg Score</div>
        </div>
      </div>
```

Replace with:

```jsx
      {/* KPI strip */}
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{totalReviews}</div>
          <div className="scores-kpi-item-label">Reviews</div>
        </div>
        <div className="scores-kpi-item">
          <div
            className="scores-kpi-item-value"
            style={{
              color:
                coverage.total > 0 && coverage.completed === coverage.total
                  ? "var(--success)"
                  : coverage.total > 0 && coverage.completed / coverage.total < 0.5
                  ? "var(--warning)"
                  : undefined,
            }}
          >
            {coverage.display}
          </div>
          <div className="scores-kpi-item-label">Completed</div>
        </div>
        <div className="scores-kpi-item">
          <div
            className="scores-kpi-item-value"
            style={{ color: pendingCount > 0 ? "var(--warning)" : undefined }}
          >
            {pendingCount}
          </div>
          <div className="scores-kpi-item-label">Pending Submit</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            {avgSpread !== "—" ? `Δ ${avgSpread}` : "—"}
          </div>
          <div className="scores-kpi-item-label">Juror Agreement</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{avgScore}</div>
          <div className="scores-kpi-item-label">Avg Score</div>
        </div>
      </div>
```

- [ ] **Step 2: Remove now-unused variables from the export block**

Check that `uniqueJurors` and `uniqueProjects` are no longer referenced anywhere in the file (other than in the removed derivation block). Search:

```bash
grep -n "uniqueJurors\|uniqueProjects\|partialCount" src/admin/pages/ReviewsPage.jsx
```

Expected: `uniqueJurors` still appears in the export handler (`handleExport`) and footer note uses `partialCount`. Do NOT remove those usages — they serve different purposes. Only remove the KPI variable declarations that are now replaced (already done in Task 5).

Check if `partialCount` is still referenced after Task 5's replacement:

```bash
grep -n "partialCount" src/admin/pages/ReviewsPage.jsx
```

If `partialCount` still appears in the footer note (`reviews-footer-note`), keep it. Add it back as a derivation after the new KPI block if needed:

```js
  const partialCount = kpiBase.filter((r) => r.effectiveStatus === "partial").length;
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --run 2>&1 | grep -E "passed|failed|FAIL|PASS" | tail -20
```

Expected: all tests pass. If any KPI-adjacent test fails, diagnose before proceeding.

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

---

## Task 7: Commit

- [ ] **Step 1: Stage files**

```bash
git add \
  src/admin/utils/reviewsKpiHelpers.js \
  src/admin/__tests__/reviewsKpiHelpers.test.js \
  src/test/qa-catalog.json \
  src/admin/__tests__/ReviewsPage.test.jsx \
  src/admin/pages/ReviewsPage.jsx
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(reviews): redesign KPI strip with coverage, pending, and spread metrics

Replaces Jurors / Projects / Partial cards with Completed (X/Y jurors),
Pending Submit (ready-to-submit juror count), and Juror Agreement (avg
inter-juror σ). Also fixes pre-existing ReviewsPage tests that were
broken due to missing useAdminContext mock and native-select interaction.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify commit**

```bash
git log --oneline -3
```

Expected: new commit appears at top.
