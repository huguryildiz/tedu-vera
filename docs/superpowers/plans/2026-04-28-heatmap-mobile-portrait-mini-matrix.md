# Heatmap Mobile Portrait — Mini Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portrait heatmap's collapsible card list with a compact matrix table (jurors × projects, colored cells + score numbers) that matches the desktop heatmap layout.

**Architecture:** Create `HeatmapMiniMatrix.jsx` (pure table component) + `HeatmapMiniMatrix.css` (scoped styles), then replace the card list in `HeatmapMobileList.jsx` with the new matrix. The existing visibility toggle (portrait CSS hides `matrix-table`, shows `.heatmap-mobile`) is unchanged. `HeatmapPage.jsx` is not touched.

**Tech Stack:** React (functional component, no state), existing `scoreCellClass`/`scoreCellStyle` from `src/admin/utils/scoreHelpers.js`, Vitest + RTL for tests.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/admin/features/heatmap/HeatmapMiniMatrix.jsx` | Render the jurors×projects table |
| Create | `src/admin/features/heatmap/HeatmapMiniMatrix.css` | Scoped table styles |
| Create | `src/admin/features/heatmap/__tests__/HeatmapMiniMatrix.test.jsx` | Component tests |
| Modify | `src/admin/features/heatmap/HeatmapMobileList.jsx` | Swap card list for HeatmapMiniMatrix |
| Modify | `src/admin/features/heatmap/__tests__/HeatmapMobileList.test.jsx` | Keep empty-state test passing |
| Modify | `src/test/qa-catalog.json` | Add new test IDs before writing tests |

---

## Task 1: Add test IDs to qa-catalog

**Files:**
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Add entries at the end of the array (before the closing `]`)**

Open `src/test/qa-catalog.json`. The file is a JSON array. Add these three entries just before the final `]`:

```json
  {
    "id": "coverage.heatmap-mini-matrix.renders-score-cells",
    "module": "Admin / Heatmap",
    "area": "heatmap-mobile",
    "story": "HeatmapMiniMatrix — score cells",
    "scenario": "renders a colored cell with score number for each juror×project combination",
    "whyItMatters": "Admins need to read exact scores at a glance on mobile portrait.",
    "risk": "Missing cells would hide scoring gaps from the admin.",
    "coverageStrength": "Strong",
    "severity": "high"
  },
  {
    "id": "coverage.heatmap-mini-matrix.empty-cell",
    "module": "Admin / Heatmap",
    "area": "heatmap-mobile",
    "story": "HeatmapMiniMatrix — empty cell",
    "scenario": "renders a dash for a juror×project pair with no score",
    "whyItMatters": "Unscored projects must be visually distinct from scored ones.",
    "risk": "A missing dash could make an unscored project look like a zero.",
    "coverageStrength": "Strong",
    "severity": "medium"
  },
  {
    "id": "coverage.heatmap-mini-matrix.tfoot-averages",
    "module": "Admin / Heatmap",
    "area": "heatmap-mobile",
    "story": "HeatmapMiniMatrix — footer averages",
    "scenario": "renders a tfoot row with per-project averages",
    "whyItMatters": "Project averages give admins a column-level summary without scrolling.",
    "risk": "Missing averages would require switching to the desktop view for per-project summaries.",
    "coverageStrength": "Strong",
    "severity": "medium"
  }
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "require('./src/test/qa-catalog.json'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/test/qa-catalog.json
git commit -m "test(heatmap): add qa-catalog IDs for HeatmapMiniMatrix"
```

---

## Task 2: Write the failing tests for HeatmapMiniMatrix

**Files:**
- Create: `src/admin/features/heatmap/__tests__/HeatmapMiniMatrix.test.jsx`

- [ ] **Step 1: Create the test file**

```jsx
// src/admin/features/heatmap/__tests__/HeatmapMiniMatrix.test.jsx
import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/admin/utils/scoreHelpers", () => ({
  scoreCellClass: (score, max) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return "m-score-l0";
    if (pct >= 80) return "m-score-l1";
    if (pct >= 70) return "m-score-l2";
    if (pct >= 60) return "m-score-l3";
    return "m-score-l4";
  },
  scoreCellStyle: () => null,
}));

// Import after mocks
import HeatmapMiniMatrix from "../HeatmapMiniMatrix";

const JURORS = [
  { key: "j1", name: "Ali Yılmaz", affiliation: "TEDU" },
];

const GROUPS = [
  { id: "g1", group_no: 1, title: "Project Alpha" },
  { id: "g2", group_no: 2, title: "Project Beta" },
];

// getCellDisplay(entry, activeTab, activeCriteria) → {score, max, partial} | null
function makeCellDisplay(scoreMap) {
  return (entry, _tab, _criteria) => {
    if (!entry) return null;
    const score = scoreMap[entry._key];
    if (score == null) return null;
    return { score, max: 100, partial: false };
  };
}

// lookup[jurorKey][groupId] = entry object with ._key for test lookup
const LOOKUP = {
  j1: {
    g1: { _key: "j1_g1", total: 82 },
    // g2 missing → empty cell
  },
};

const SCORE_MAP = { j1_g1: 82 };

const BASE_PROPS = {
  sortedJurors: JURORS,
  groups: GROUPS,
  lookup: LOOKUP,
  activeTab: "all",
  activeCriteria: [{ id: "c1", max: 100 }],
  tabMax: 100,
  jurorRowAvgMap: new Map([["j1", 82]]),
  visibleAverages: [82, null],
  overallAvg: 82,
  getCellDisplay: makeCellDisplay(SCORE_MAP),
};

describe("HeatmapMiniMatrix", () => {
  qaTest("coverage.heatmap-mini-matrix.renders-score-cells", () => {
    render(<HeatmapMiniMatrix {...BASE_PROPS} />);
    // Score number visible in the cell
    expect(screen.getByText("82")).toBeInTheDocument();
    // Score cell has a color class
    const cell = screen.getByText("82").closest(".hm-mm-cell");
    expect(cell.className).toMatch(/m-score-l/);
  });

  qaTest("coverage.heatmap-mini-matrix.empty-cell", () => {
    render(<HeatmapMiniMatrix {...BASE_PROPS} />);
    // g2 has no score → dash rendered
    const emptyCells = document.querySelectorAll(".hm-mm-cell-empty");
    expect(emptyCells.length).toBeGreaterThan(0);
  });

  qaTest("coverage.heatmap-mini-matrix.tfoot-averages", () => {
    render(<HeatmapMiniMatrix {...BASE_PROPS} />);
    // tfoot row exists
    expect(document.querySelector("tfoot")).not.toBeNull();
    // g1 average (82) is rendered in tfoot
    const tfootCells = document.querySelectorAll("tfoot .hm-mm-cell");
    expect(tfootCells.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests and verify they all FAIL (component doesn't exist yet)**

```bash
npm test -- --run src/admin/features/heatmap/__tests__/HeatmapMiniMatrix.test.jsx
```

Expected: 3 failures, all with `Cannot find module '../HeatmapMiniMatrix'` or similar import error.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/admin/features/heatmap/__tests__/HeatmapMiniMatrix.test.jsx
git commit -m "test(heatmap): add failing tests for HeatmapMiniMatrix (TDD)"
```

---

## Task 3: Create HeatmapMiniMatrix.css

**Files:**
- Create: `src/admin/features/heatmap/HeatmapMiniMatrix.css`

- [ ] **Step 1: Create the CSS file**

```css
/* HeatmapMiniMatrix — compact portrait matrix */

.hm-mini-matrix-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.hm-mini-matrix {
  border-collapse: collapse;
  font-size: 10px;
  width: 100%;
  table-layout: fixed;
}

/* ── Sticky juror column ── */
.hm-mini-matrix th.hm-mm-juror-col,
.hm-mini-matrix td.hm-mm-juror-col {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--bg-card);
  width: 120px;
  min-width: 120px;
  max-width: 120px;
  padding: 6px 8px;
  text-align: left;
  border-right: 1px solid var(--border);
}

.hm-mm-juror-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
}

.hm-mm-juror-affil {
  font-size: 9px;
  color: var(--text-muted);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
  margin-top: 1px;
}

/* ── Project header columns ── */
.hm-mini-matrix th.hm-mm-th-proj {
  width: 36px;
  min-width: 36px;
  max-width: 36px;
  padding: 5px 2px;
  text-align: center;
  font-size: 8px;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ── Avg column header + cells ── */
.hm-mini-matrix th.hm-mm-avg-col,
.hm-mini-matrix td.hm-mm-avg-col {
  width: 44px;
  min-width: 44px;
  max-width: 44px;
  text-align: center;
  padding: 4px 3px;
  font-size: 9px;
  font-weight: 700;
  border-left: 1px solid var(--border);
}

.hm-mini-matrix th.hm-mm-avg-col {
  color: var(--text-muted);
  font-size: 8px;
}

/* ── Score cells ── */
.hm-mini-matrix td.hm-mm-proj-cell {
  width: 36px;
  min-width: 36px;
  max-width: 36px;
  padding: 3px 2px;
  text-align: center;
}

.hm-mm-cell {
  width: 30px;
  height: 26px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: -0.3px;
  margin: auto;
}

.hm-mm-cell-empty {
  width: 30px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-muted);
  margin: auto;
}

.hm-mm-cell-partial {
  position: relative;
}

.hm-mm-cell-partial::after {
  content: "!";
  position: absolute;
  top: 1px;
  right: 2px;
  font-size: 7px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
}

/* ── Header row ── */
.hm-mini-matrix thead tr {
  border-bottom: 1px solid var(--border);
}

/* ── Body rows ── */
.hm-mini-matrix tbody tr {
  border-bottom: 1px solid var(--border);
}

.hm-mini-matrix tbody tr:last-child {
  border-bottom: none;
}

/* ── Footer avg row ── */
.hm-mini-matrix tfoot tr {
  border-top: 2px solid var(--border);
}

.hm-mini-matrix tfoot td.hm-mm-juror-col {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ── Dark mode: sticky col background ── */
.dark-mode .hm-mini-matrix th.hm-mm-juror-col,
.dark-mode .hm-mini-matrix td.hm-mm-juror-col {
  background: var(--bg-card);
}
```

- [ ] **Step 2: Verify no syntax errors (build check)**

```bash
npm run build 2>&1 | grep -i "error" | head -5
```

Expected: No errors related to the new CSS file (it won't be imported yet).

- [ ] **Step 3: Commit**

```bash
git add src/admin/features/heatmap/HeatmapMiniMatrix.css
git commit -m "style(heatmap): add HeatmapMiniMatrix portrait matrix CSS"
```

---

## Task 4: Implement HeatmapMiniMatrix.jsx

**Files:**
- Create: `src/admin/features/heatmap/HeatmapMiniMatrix.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/admin/features/heatmap/HeatmapMiniMatrix.jsx
import { useTheme } from "@/shared/theme/ThemeProvider";
import { scoreCellClass, scoreCellStyle } from "@/admin/utils/scoreHelpers";
import "./HeatmapMiniMatrix.css";

function ScoreCell({ cell }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!cell) {
    return <span className="hm-mm-cell-empty" aria-label="not scored">—</span>;
  }

  const colorClass = scoreCellClass(cell.score, cell.max);
  const inlineStyle = isDark ? scoreCellStyle(cell.score, cell.max, true) : undefined;

  return (
    <span
      className={`hm-mm-cell${colorClass ? ` ${colorClass}` : ""}${cell.partial ? " hm-mm-cell-partial" : ""}`}
      style={inlineStyle ?? undefined}
      aria-label={`${cell.score}${cell.partial ? " partial" : ""}`}
    >
      {Math.round(cell.score)}
    </span>
  );
}

function AvgCell({ avg, max }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (avg == null) {
    return <span className="hm-mm-cell-empty">—</span>;
  }

  const colorClass = scoreCellClass(avg, max);
  const inlineStyle = isDark ? scoreCellStyle(avg, max, true) : undefined;

  return (
    <span
      className={`hm-mm-cell${colorClass ? ` ${colorClass}` : ""}`}
      style={inlineStyle ?? undefined}
      aria-label={`average ${avg.toFixed(1)}`}
    >
      {avg.toFixed(1)}
    </span>
  );
}

export default function HeatmapMiniMatrix({
  sortedJurors,
  groups,
  lookup,
  activeTab,
  activeCriteria,
  tabMax,
  jurorRowAvgMap,   // Map<jurorKey, avg>
  visibleAverages,  // array parallel to groups
  overallAvg,
  getCellDisplay,
}) {
  return (
    <div className="hm-mini-matrix-wrap">
      <table className="hm-mini-matrix" role="grid" aria-label="Juror scoring heatmap">
        <thead>
          <tr>
            <th className="hm-mm-juror-col" scope="col">Juror</th>
            {groups.map((g) => (
              <th
                key={g.id}
                className="hm-mm-th-proj"
                scope="col"
                title={g.title}
              >
                {g.group_no != null ? `P${g.group_no}` : g.title}
              </th>
            ))}
            <th className="hm-mm-avg-col" scope="col">Avg</th>
          </tr>
        </thead>

        <tbody>
          {sortedJurors.map((juror) => {
            const avg = jurorRowAvgMap.get(juror.key);
            return (
              <tr key={juror.key}>
                <td className="hm-mm-juror-col">
                  <span className="hm-mm-juror-name">{juror.name || juror.juror_name}</span>
                  <span className="hm-mm-juror-affil">{juror.dept || juror.affiliation}</span>
                </td>
                {groups.map((g) => {
                  const entry = lookup[juror.key]?.[g.id];
                  const cell = getCellDisplay(entry, activeTab, activeCriteria);
                  return (
                    <td key={g.id} className="hm-mm-proj-cell">
                      <ScoreCell cell={cell} />
                    </td>
                  );
                })}
                <td className="hm-mm-avg-col">
                  <AvgCell avg={avg ?? null} max={tabMax} />
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <td className="hm-mm-juror-col">Avg</td>
            {visibleAverages.map((avg, i) => (
              <td key={groups[i]?.id ?? i} className="hm-mm-proj-cell">
                <AvgCell avg={avg} max={tabMax} />
              </td>
            ))}
            <td className="hm-mm-avg-col">
              <AvgCell avg={overallAvg} max={tabMax} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Run the tests and verify they all pass**

```bash
npm test -- --run src/admin/features/heatmap/__tests__/HeatmapMiniMatrix.test.jsx
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/admin/features/heatmap/HeatmapMiniMatrix.jsx
git commit -m "feat(heatmap): add HeatmapMiniMatrix portrait matrix component"
```

---

## Task 5: Update HeatmapMobileList to use HeatmapMiniMatrix

**Files:**
- Modify: `src/admin/features/heatmap/HeatmapMobileList.jsx`

The current `HeatmapMobileList.jsx` uses `JurorHeatmapCard` in a card list + `ProjectAveragesCard` for averages. We replace that with `HeatmapMiniMatrix`. The sort dropdown stays. The `useCardSelection` hook and card-list ref are removed (matrix has no per-row selection).

The component receives `jurorRowAvgs` as a parallel array to `visibleJurors`. We need to convert it to a `Map<jurorKey, avg>` before passing to `HeatmapMiniMatrix` — built from `sortedJurors` using the original index lookup.

- [ ] **Step 1: Replace the file content**

```jsx
// src/admin/features/heatmap/HeatmapMobileList.jsx
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import CustomSelect from "@/shared/ui/CustomSelect";
import { sortMobileJurors, MOBILE_SORT_KEYS } from "./mobileSort.js";
import HeatmapMiniMatrix from "./HeatmapMiniMatrix.jsx";

export default function HeatmapMobileList({
  visibleJurors,
  groups,
  lookup,
  activeTab,
  activeCriteria,
  tabLabel,
  tabMax,
  jurorRowAvgs,
  visibleAverages,
  overallAvg,
  jurorWorkflowMap,
  getCellDisplay,
}) {
  const [sortKey, setSortKey] = useState("avg_desc");

  const rowAvgMap = useMemo(() => {
    const m = new Map();
    visibleJurors.forEach((j, i) => m.set(j.key, jurorRowAvgs[i]));
    return m;
  }, [visibleJurors, jurorRowAvgs]);

  const sortedJurors = useMemo(
    () => sortMobileJurors(visibleJurors, sortKey, {
      rowAvgs: rowAvgMap,
      workflow: jurorWorkflowMap,
    }),
    [visibleJurors, sortKey, rowAvgMap, jurorWorkflowMap]
  );

  if (sortedJurors.length === 0) {
    return (
      <section className="heatmap-mobile" aria-label="Juror scoring heatmap (mobile)">
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="vera-es-page-prompt">
            <div className="vera-es-icon">
              <Users size={22} strokeWidth={1.8} />
            </div>
            <p className="vera-es-page-prompt-title">No Jurors to Display</p>
            <p className="vera-es-page-prompt-desc">
              Juror score data will appear here once jurors are assigned and evaluations begin.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="heatmap-mobile" aria-label="Juror scoring heatmap (mobile)">
      <div className="hm-mobile-actions">
        <CustomSelect
          value={sortKey}
          onChange={setSortKey}
          options={MOBILE_SORT_KEYS}
          ariaLabel="Sort jurors"
        />
      </div>

      <HeatmapMiniMatrix
        sortedJurors={sortedJurors}
        groups={groups || []}
        lookup={lookup}
        activeTab={activeTab}
        activeCriteria={activeCriteria}
        tabMax={tabMax}
        jurorRowAvgMap={rowAvgMap}
        visibleAverages={visibleAverages}
        overallAvg={overallAvg}
        getCellDisplay={getCellDisplay}
      />
    </section>
  );
}
```

- [ ] **Step 2: Run the existing HeatmapMobileList test (empty-state must still pass)**

```bash
npm test -- --run src/admin/features/heatmap/__tests__/HeatmapMobileList.test.jsx
```

Expected: 1 test passes (`coverage.heatmap-mobile-list.empty-state`).

- [ ] **Step 3: Run the full test suite**

```bash
npm test -- --run
```

Expected: all tests pass. No failures.

- [ ] **Step 4: Run a build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/features/heatmap/HeatmapMobileList.jsx
git commit -m "feat(heatmap): replace card list with HeatmapMiniMatrix in portrait view"
```

---

## Task 6: Live verification

> This task cannot be automated — manual browser check required.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` and log in as admin.

- [ ] **Step 2: Navigate to Heatmap page and verify portrait layout**

In Chrome DevTools → Device Toolbar → select "iPhone 14 Pro" (390×844, portrait).

Check:
1. A matrix table is visible (not the old card list).
2. Juror names are in a sticky left column — scroll right, names stay frozen.
3. Project columns show short labels (`P1`, `P2`, …).
4. Cells with scores show a colored background + bold white number.
5. Cells without scores show a `—` dash.
6. Footer row shows per-project averages.
7. Sort dropdown above the matrix changes row order.
8. Criteria tab switch (e.g. switch from "All" to a specific criterion) updates all cell values.

- [ ] **Step 3: Verify landscape is unchanged**

Still in DevTools, rotate to landscape. The desktop matrix table must appear (not the mini matrix). Confirm the full-width table with frozen juror column and scrollable projects renders correctly.

- [ ] **Step 4: Verify dark mode**

Toggle dark mode. Check that:
- Sticky juror column background matches the card background (no bleed-through from scrolling content).
- Score cells use the dark-mode color palette (slightly different shades than light mode).

- [ ] **Step 5: Commit a note if any CSS fix was needed**

If you had to adjust any CSS during verification, commit those changes:

```bash
git add src/admin/features/heatmap/HeatmapMiniMatrix.css
git commit -m "fix(heatmap): portrait matrix CSS tweaks after live verification"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ C2 design: colored cells + score number inside → Task 4 (`ScoreCell`)
- ✅ Juror sticky-left column → Task 3 + 4
- ✅ Horizontal scroll → Task 3 (`.hm-mini-matrix-wrap`)
- ✅ Project columns with `P1`, `P2` labels → Task 4
- ✅ Avg column (last, not sticky) → Task 4
- ✅ Empty cell dash → Task 4 (`ScoreCell` null branch)
- ✅ Partial cell indicator → Task 4 (`hm-mm-cell-partial`)
- ✅ Footer avg row → Task 4 (tfoot)
- ✅ Sort dropdown kept → Task 5
- ✅ `ProjectAveragesCard` replaced by tfoot → Task 5 (removed import)
- ✅ `useCardSelection` removed → Task 5
- ✅ `HeatmapPage.jsx` untouched → no task modifies it
- ✅ Landscape unchanged → Task 6 verification
- ✅ Dark mode → Task 3 CSS + Task 6 verification
- ✅ Empty-state preserved → Task 5

**Type consistency:**
- `jurorRowAvgMap` is a `Map<string, number>` — built in `HeatmapMobileList` (Task 5), consumed in `HeatmapMiniMatrix` (Task 4) and tests (Task 2). Consistent.
- `getCellDisplay(entry, activeTab, activeCriteria)` — signature matches `HeatmapPage.jsx` definition. Consistent.
- `scoreCellClass(score, max)` and `scoreCellStyle(score, max, isDark)` — used in Tasks 3/4, mocked in Task 2 with matching signatures. Consistent.
