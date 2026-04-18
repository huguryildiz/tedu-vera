# Heatmap Mobile Portrait Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreadable mobile portrait heatmap table with a juror-first card list featuring a hero donut average and collapsible project rows.

**Architecture:** Desktop table stays untouched. On mobile portrait, CSS hides the table and shows a new `<HeatmapMobileList>` that reuses the existing data hooks (`useHeatmapData`, `useGridSort`) but applies a simplified mobile sort (Avg / Name / Status) and renders one `<JurorHeatmapCard>` per visible juror plus a trailing `<ProjectAveragesCard>`.

**Tech Stack:** React 18, Vitest + Testing Library, lucide-react, existing CSS token system, existing `CustomSelect` / `JurorBadge` / `JurorStatusPill` components.

**Spec:** [docs/superpowers/specs/2026-04-18-heatmap-mobile-redesign-design.md](../specs/2026-04-18-heatmap-mobile-redesign-design.md)

---

## File Structure

**Create:**
- `src/admin/pages/heatmap/AvgDonut.jsx` — generic donut display (size, value, max, band color)
- `src/admin/pages/heatmap/JurorHeatmapCard.jsx` — one card per juror (header, donut, collapsed summary, expanded rows)
- `src/admin/pages/heatmap/ProjectAveragesCard.jsx` — footer summary card
- `src/admin/pages/heatmap/HeatmapMobileList.jsx` — top-level mobile container with sort dropdown
- `src/admin/pages/heatmap/mobileSort.js` — pure sort comparator for mobile sort keys
- `src/admin/__tests__/AvgDonut.test.jsx`
- `src/admin/__tests__/JurorHeatmapCard.test.jsx`
- `src/admin/__tests__/mobileSort.test.js`

**Modify:**
- `src/admin/pages/HeatmapPage.jsx` — render `<HeatmapMobileList>` alongside existing table
- `src/styles/pages/heatmap.css` — add `.heatmap-mobile` ruleset, hide table on mobile portrait
- `src/test/qa-catalog.json` — add three QA entries

---

## Task 1: Mobile sort comparator (pure function + TDD)

**Files:**
- Create: `src/admin/pages/heatmap/mobileSort.js`
- Test: `src/admin/__tests__/mobileSort.test.js`

- [ ] **Step 1.1: Write the failing test**

Write `src/admin/__tests__/mobileSort.test.js`:

```js
import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import { sortMobileJurors, MOBILE_SORT_KEYS } from "../pages/heatmap/mobileSort.js";

const jurors = [
  { key: "a", name: "Zeynep Ak",  dept: "EE"      },
  { key: "b", name: "Alper Bal",  dept: "Physics" },
  { key: "c", name: "Bora Can",   dept: "CS"      },
];

const rowAvgs = new Map([
  ["a", 88.0],
  ["b", 72.5],
  ["c", null],   // no scored cells
]);

const workflow = new Map([
  ["a", "completed"],
  ["b", "in_progress"],
  ["c", "not_started"],
]);

describe("sortMobileJurors", () => {
  qaTest("heatmap.mobile.sort.01", "Avg desc is default: highest avg first, nulls last", () => {
    const out = sortMobileJurors(jurors, "avg_desc", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["a", "b", "c"]);
  });

  qaTest("heatmap.mobile.sort.02", "Avg asc: lowest first, nulls still last", () => {
    const out = sortMobileJurors(jurors, "avg_asc", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["b", "a", "c"]);
  });

  qaTest("heatmap.mobile.sort.03", "Name A-Z is alphabetical, locale-aware", () => {
    const out = sortMobileJurors(jurors, "name_asc", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["b", "c", "a"]);
  });

  qaTest("heatmap.mobile.sort.04", "Status puts completed first, not_started last", () => {
    const out = sortMobileJurors(jurors, "status", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["a", "b", "c"]);
  });

  qaTest("heatmap.mobile.sort.05", "Unknown key falls back to name_asc", () => {
    const out = sortMobileJurors(jurors, "bogus", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["b", "c", "a"]);
  });

  qaTest("heatmap.mobile.sort.06", "MOBILE_SORT_KEYS exposes 5 options in display order", () => {
    expect(MOBILE_SORT_KEYS.map(o => o.value)).toEqual([
      "avg_desc", "avg_asc", "name_asc", "name_desc", "status",
    ]);
  });
});
```

- [ ] **Step 1.2: Add QA catalog entries**

Add these 6 entries to `src/test/qa-catalog.json` (within the array, before the final `]`):

```json
{
  "id": "heatmap.mobile.sort.01",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Sort",
  "story": "Default sort by average descending",
  "scenario": "avg desc puts highest-scoring juror first and null-avg jurors last",
  "whyItMatters": "Default view should surface strongest jurors; those with no scored cells should sink to the bottom.",
  "risk": "Wrong ordering hides the signal admins open the page to see.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "heatmap.mobile.sort.02",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Sort",
  "story": "Ascending average keeps nulls last",
  "scenario": "avg asc puts lowest-scoring juror first but still parks null averages at the bottom",
  "whyItMatters": "Flipping direction must not promote unscored jurors — they have no comparable value.",
  "risk": "Unscored jurors floating to the top would distort the lowest-score view.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "heatmap.mobile.sort.03",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Sort",
  "story": "Alphabetical sort is locale-aware",
  "scenario": "name A-Z orders jurors by name using a locale comparator",
  "whyItMatters": "Turkish names must sort correctly; ASCII-only sort ignores diacritics and mis-orders names.",
  "risk": "Incorrect ordering frustrates admins scanning a long juror list by name.",
  "coverageStrength": "Medium",
  "severity": "low"
},
{
  "id": "heatmap.mobile.sort.04",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Sort",
  "story": "Status sort surfaces completed jurors first",
  "scenario": "status sort puts completed, then in_progress, then not_started",
  "whyItMatters": "Admins monitoring progress want completed jurors grouped at the top and pending at the bottom.",
  "risk": "Random status ordering makes progress tracking slower on mobile.",
  "coverageStrength": "Medium",
  "severity": "low"
},
{
  "id": "heatmap.mobile.sort.05",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Sort",
  "story": "Unknown sort key degrades safely",
  "scenario": "an unrecognized sort key falls back to alphabetical ascending",
  "whyItMatters": "A stale persisted value or typo must never render an unsorted / empty list.",
  "risk": "Throwing on unknown keys would crash the mobile view.",
  "coverageStrength": "Medium",
  "severity": "low"
},
{
  "id": "heatmap.mobile.sort.06",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Sort",
  "story": "Sort options are exposed in display order",
  "scenario": "MOBILE_SORT_KEYS exposes 5 options ordered as avg_desc, avg_asc, name_asc, name_desc, status",
  "whyItMatters": "Dropdown order is a UX contract; tests lock it so refactors don't silently reorder.",
  "risk": "Accidentally reordering would change the default-visible option in the dropdown.",
  "coverageStrength": "Medium",
  "severity": "low"
}
```

- [ ] **Step 1.3: Run the test to confirm it fails**

Run: `npm test -- --run src/admin/__tests__/mobileSort.test.js`
Expected: FAIL — `Cannot find module '../pages/heatmap/mobileSort.js'`

- [ ] **Step 1.4: Implement `mobileSort.js`**

Write `src/admin/pages/heatmap/mobileSort.js`:

```js
// Mobile heatmap sort comparator.
// Pure function, no React, no hooks — safe to unit-test standalone.

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

const STATUS_RANK = {
  completed: 0,
  in_progress: 1,
  pending: 1,
  invited: 2,
  not_started: 3,
};

function statusRank(s) {
  return STATUS_RANK[s] ?? 99;
}

export const MOBILE_SORT_KEYS = [
  { value: "avg_desc",  label: "Avg \u2193" },
  { value: "avg_asc",   label: "Avg \u2191" },
  { value: "name_asc",  label: "Name A\u2013Z" },
  { value: "name_desc", label: "Name Z\u2013A" },
  { value: "status",    label: "Status" },
];

const VALID = new Set(MOBILE_SORT_KEYS.map(o => o.value));

export function sortMobileJurors(jurors, key, { rowAvgs, workflow } = {}) {
  const safeKey = VALID.has(key) ? key : "name_asc";
  const list = jurors.slice();
  const nameCmp = (a, b) => collator.compare(a.name || "", b.name || "");

  list.sort((a, b) => {
    if (safeKey === "name_asc")  return nameCmp(a, b);
    if (safeKey === "name_desc") return nameCmp(b, a);

    if (safeKey === "status") {
      const ra = statusRank(workflow?.get(a.key));
      const rb = statusRank(workflow?.get(b.key));
      return ra !== rb ? ra - rb : nameCmp(a, b);
    }

    // avg_desc / avg_asc
    const va = rowAvgs?.get(a.key);
    const vb = rowAvgs?.get(b.key);
    const aNull = va == null;
    const bNull = vb == null;
    if (aNull && bNull) return nameCmp(a, b);
    if (aNull) return 1;
    if (bNull) return -1;
    const diff = safeKey === "avg_desc" ? vb - va : va - vb;
    return diff !== 0 ? diff : nameCmp(a, b);
  });

  return list;
}
```

- [ ] **Step 1.5: Run the test to confirm it passes**

Run: `npm test -- --run src/admin/__tests__/mobileSort.test.js`
Expected: PASS — 6 tests green.

- [ ] **Step 1.6: Commit**

```bash
git add src/admin/pages/heatmap/mobileSort.js src/admin/__tests__/mobileSort.test.js src/test/qa-catalog.json
git commit -m "feat(heatmap): add mobile sort comparator"
```

---

## Task 2: `AvgDonut` component

**Files:**
- Create: `src/admin/pages/heatmap/AvgDonut.jsx`
- Test: `src/admin/__tests__/AvgDonut.test.jsx`

- [ ] **Step 2.1: Add QA catalog entries**

Append to `src/test/qa-catalog.json`:

```json
{
  "id": "heatmap.mobile.donut.01",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Donut",
  "story": "Donut renders score and max",
  "scenario": "donut shows the numeric value in the center and exposes the score-and-max aria-label",
  "whyItMatters": "The donut is the juror card's hero element; its number and accessibility label are the primary signal.",
  "risk": "Missing value or label would leave screen-reader users with no juror average.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "heatmap.mobile.donut.02",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Donut",
  "story": "Donut handles empty average",
  "scenario": "when value is null the donut shows an em-dash and no filled arc",
  "whyItMatters": "Jurors with no scored cells must render clearly as empty, not as a misleading zero.",
  "risk": "A zero-filled arc implies the juror scored zero, which is wrong.",
  "coverageStrength": "Strong",
  "severity": "normal"
}
```

- [ ] **Step 2.2: Write the failing tests**

Write `src/admin/__tests__/AvgDonut.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import AvgDonut from "../pages/heatmap/AvgDonut.jsx";

describe("AvgDonut", () => {
  qaTest("heatmap.mobile.donut.01", "renders value, 'Avg' label, and aria-label with max", () => {
    render(<AvgDonut value={80.7} max={100} />);
    expect(screen.getByText("80.7")).toBeInTheDocument();
    expect(screen.getByText("Avg")).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", expect.stringContaining("80.7"));
    expect(img).toHaveAttribute("aria-label", expect.stringContaining("100"));
  });

  qaTest("heatmap.mobile.donut.02", "null value renders em-dash and an empty arc", () => {
    const { container } = render(<AvgDonut value={null} max={100} />);
    expect(screen.getByText("\u2014")).toBeInTheDocument();
    const filled = container.querySelector('circle[data-fill="true"]');
    expect(filled).toBeNull();
  });
});
```

- [ ] **Step 2.3: Run the tests to confirm they fail**

Run: `npm test -- --run src/admin/__tests__/AvgDonut.test.jsx`
Expected: FAIL — `Cannot find module '../pages/heatmap/AvgDonut.jsx'`

- [ ] **Step 2.4: Implement `AvgDonut.jsx`**

Write `src/admin/pages/heatmap/AvgDonut.jsx`:

```jsx
// Generic average-score donut used by the mobile heatmap.
// Pure presentational; no hooks, no data fetching.

function bandVar(value, max) {
  if (value == null || max <= 0) return null;
  const pct = (value / max) * 100;
  if (pct >= 90) return "var(--score-excellent-text)";
  if (pct >= 80) return "var(--score-high-text)";
  if (pct >= 75) return "var(--score-good-text)";
  if (pct >= 70) return "var(--score-adequate-text)";
  if (pct >= 60) return "var(--score-low-text)";
  return "var(--score-poor-text)";
}

export default function AvgDonut({ value, max = 100, size = 72, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const hasValue = value != null && max > 0;
  const pct = hasValue ? Math.max(0, Math.min(1, value / max)) : 0;
  const dashOffset = circumference * (1 - pct);
  const color = bandVar(value, max) || "var(--border)";
  const label = hasValue
    ? `Average ${value.toFixed(1)} out of ${max}`
    : "Average not available";

  return (
    <div
      className="avg-donut"
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle, var(--border))"
          strokeWidth={stroke}
        />
        {hasValue && (
          <circle
            data-fill="true"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="avg-donut-center">
        <span className="avg-donut-value">
          {hasValue ? value.toFixed(1) : "\u2014"}
        </span>
        <span className="avg-donut-label">Avg</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.5: Run the tests to confirm they pass**

Run: `npm test -- --run src/admin/__tests__/AvgDonut.test.jsx`
Expected: PASS — 2 tests green.

- [ ] **Step 2.6: Commit**

```bash
git add src/admin/pages/heatmap/AvgDonut.jsx src/admin/__tests__/AvgDonut.test.jsx src/test/qa-catalog.json
git commit -m "feat(heatmap): add AvgDonut component for mobile cards"
```

---

## Task 3: `JurorHeatmapCard` component

**Files:**
- Create: `src/admin/pages/heatmap/JurorHeatmapCard.jsx`
- Test: `src/admin/__tests__/JurorHeatmapCard.test.jsx`

- [ ] **Step 3.1: Add QA catalog entries**

Append to `src/test/qa-catalog.json`:

```json
{
  "id": "heatmap.mobile.card.01",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Card",
  "story": "Card renders collapsed by default",
  "scenario": "on mount, project rows are hidden and the summary strip with project count is visible",
  "whyItMatters": "Default collapsed state keeps long juror lists scannable on phones.",
  "risk": "Default-expanded would overwhelm the viewport with 10+ rows per juror.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "heatmap.mobile.card.02",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Card",
  "story": "Tapping the header toggles expansion",
  "scenario": "clicking the card's header toggles aria-expanded and reveals or hides the project rows",
  "whyItMatters": "Expand/collapse is the only way to see per-project scores; the interaction must work reliably.",
  "risk": "Broken toggle would strand all detail views on mobile.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "heatmap.mobile.card.03",
  "module": "Heatmap / Mobile",
  "area": "Heatmap — Mobile Card",
  "story": "Partial cells render the ! badge",
  "scenario": "an expanded row whose cell is partial shows the score and a ! flag badge",
  "whyItMatters": "Partial scores must be visually distinguished so admins don't misread them as final.",
  "risk": "Losing the partial flag hides incomplete evaluations.",
  "coverageStrength": "Strong",
  "severity": "normal"
}
```

- [ ] **Step 3.2: Write the failing tests**

Write `src/admin/__tests__/JurorHeatmapCard.test.jsx`:

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, vi } from "vitest";
import { qaTest } from "../../test/qaTest.js";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("../../admin/components/JurorBadge.jsx", () => ({
  default: ({ name }) => <div data-testid="badge">{name}</div>,
}));
vi.mock("../../admin/components/JurorStatusPill.jsx", () => ({
  default: ({ status }) => <div data-testid="status">{status}</div>,
}));

import JurorHeatmapCard from "../pages/heatmap/JurorHeatmapCard.jsx";

const juror = { key: "j1", name: "Dr. Alper Kılıç", dept: "EE" };
const groups = [
  { id: "g1", group_no: 1, title: "Wearable ECG" },
  { id: "g2", group_no: 2, title: "MIMO Antenna" },
];
const rows = [
  { groupId: "g1", label: "P1", title: "Wearable ECG", score: 88, max: 100, partial: false, empty: false },
  { groupId: "g2", label: "P2", title: "MIMO Antenna", score: 76, max: 100, partial: true,  empty: false },
];

describe("JurorHeatmapCard", () => {
  qaTest("heatmap.mobile.card.01", "renders collapsed by default with summary strip", () => {
    render(<JurorHeatmapCard juror={juror} avg={80.7} tabMax={100} status="completed" rows={rows} />);
    // Header button exists and is collapsed
    const toggle = screen.getByRole("button", { name: /expand juror/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Summary strip text
    expect(screen.getByText(/2 projects/i)).toBeInTheDocument();
    // Project titles NOT rendered yet
    expect(screen.queryByText("Wearable ECG")).not.toBeInTheDocument();
  });

  qaTest("heatmap.mobile.card.02", "tapping header toggles expansion", () => {
    render(<JurorHeatmapCard juror={juror} avg={80.7} tabMax={100} status="completed" rows={rows} />);
    const toggle = screen.getByRole("button", { name: /expand juror/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Wearable ECG")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Wearable ECG")).not.toBeInTheDocument();
  });

  qaTest("heatmap.mobile.card.03", "expanded row with partial cell shows ! badge", () => {
    render(<JurorHeatmapCard juror={juror} avg={80.7} tabMax={100} status="completed" rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /expand juror/i }));
    // P2 is partial; the row should include a flag span
    const flags = screen.getAllByText("!", { selector: "span.m-flag" });
    expect(flags.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3.3: Run the tests to confirm they fail**

Run: `npm test -- --run src/admin/__tests__/JurorHeatmapCard.test.jsx`
Expected: FAIL — component not found.

- [ ] **Step 3.4: Implement `JurorHeatmapCard.jsx`**

Write `src/admin/pages/heatmap/JurorHeatmapCard.jsx`:

```jsx
import { useState, useId } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import JurorBadge from "../../components/JurorBadge.jsx";
import JurorStatusPill from "../../components/JurorStatusPill.jsx";
import AvgDonut from "./AvgDonut.jsx";

function bgVar(score, max) {
  if (score == null || max <= 0) return null;
  const pct = (score / max) * 100;
  if (pct >= 90) return "var(--score-excellent-bg)";
  if (pct >= 80) return "var(--score-high-bg)";
  if (pct >= 75) return "var(--score-good-bg)";
  if (pct >= 70) return "var(--score-adequate-bg)";
  if (pct >= 60) return "var(--score-low-bg)";
  return "var(--score-poor-bg)";
}

function SparkDot({ row }) {
  if (row.empty) {
    return <span className="hm-sparkdot hm-sparkdot-empty" aria-hidden="true" />;
  }
  const bg = row.partial ? "var(--score-partial-bg)" : bgVar(row.score, row.max);
  return (
    <span
      className="hm-sparkdot"
      aria-hidden="true"
      style={{ background: bg || "var(--border-subtle)" }}
    />
  );
}

function RowItem({ row, tabLabel }) {
  if (row.empty) {
    return (
      <li className="hm-row" aria-label={`${row.title}: not scored`}>
        <span className="hm-row-code">{row.label}</span>
        <span className="hm-row-title">{row.title}</span>
        <span className="hm-score-pill hm-score-pill-empty">\u2014</span>
      </li>
    );
  }
  const bg = row.partial ? "var(--score-partial-bg)" : bgVar(row.score, row.max);
  const aria = row.partial
    ? `${row.title}: partial ${row.score}`
    : `${row.title}: ${row.score}`;
  return (
    <li className="hm-row" aria-label={aria}>
      <span className="hm-row-code">{row.label}</span>
      <span className="hm-row-title">{row.title}</span>
      <span className="hm-score-pill" style={{ background: bg }}>
        {row.score}
        {row.partial && <span className="m-flag" aria-hidden="true">!</span>}
        <span className="m-cell-tip">
          {row.partial ? "Partial" : tabLabel} · {row.score} / {row.max}
        </span>
      </span>
    </li>
  );
}

export default function JurorHeatmapCard({
  juror,
  avg,
  tabMax,
  tabLabel = "Total",
  status,
  rows,
}) {
  const [expanded, setExpanded] = useState(false);
  const rowsId = useId();
  const projectCount = rows.length;
  const label = expanded ? "Collapse juror card" : "Expand juror card";

  return (
    <article className={`hm-card${expanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="hm-card-toggle"
        aria-expanded={expanded}
        aria-controls={rowsId}
        aria-label={label}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="hm-card-head">
          <div className="hm-card-head-left">
            <JurorBadge
              name={juror.name || juror.juror_name}
              affiliation={juror.dept || juror.affiliation}
              size="sm"
            />
            <JurorStatusPill status={status} />
          </div>
          <AvgDonut value={avg} max={tabMax} />
        </div>
        <div className="hm-card-summary">
          <span className="hm-card-summary-text">
            {projectCount} projects
          </span>
          <span className="hm-card-spark">
            {rows.map((row, i) => (
              <SparkDot key={row.groupId ?? i} row={row} />
            ))}
          </span>
          <span className="hm-card-chev">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </button>
      {expanded && (
        <ul className="hm-card-rows" id={rowsId}>
          {rows.map((row, i) => (
            <RowItem key={row.groupId ?? i} row={row} tabLabel={tabLabel} />
          ))}
        </ul>
      )}
    </article>
  );
}
```

- [ ] **Step 3.5: Run the tests to confirm they pass**

Run: `npm test -- --run src/admin/__tests__/JurorHeatmapCard.test.jsx`
Expected: PASS — 3 tests green.

- [ ] **Step 3.6: Commit**

```bash
git add src/admin/pages/heatmap/JurorHeatmapCard.jsx src/admin/__tests__/JurorHeatmapCard.test.jsx src/test/qa-catalog.json
git commit -m "feat(heatmap): add JurorHeatmapCard with expand/collapse"
```

---

## Task 4: `ProjectAveragesCard` component

**Files:**
- Create: `src/admin/pages/heatmap/ProjectAveragesCard.jsx`

No separate test file — this is a thin presentational component; coverage comes via the integration test in Task 6.

- [ ] **Step 4.1: Implement `ProjectAveragesCard.jsx`**

Write `src/admin/pages/heatmap/ProjectAveragesCard.jsx`:

```jsx
export default function ProjectAveragesCard({
  groups = [],
  averages = [],
  overall,
  tabMax = 100,
}) {
  return (
    <article className="hm-card hm-card-footer">
      <header className="hm-card-footer-head">Project Averages</header>
      <ul className="hm-card-rows">
        {groups.map((g, i) => {
          const avg = averages[i];
          const label = g.group_no != null ? `P${g.group_no}` : "";
          const title = g.title || g.id;
          return (
            <li className="hm-row" key={g.id}>
              <span className="hm-row-code">{label}</span>
              <span className="hm-row-title">{title}</span>
              <span className="hm-avg-value">
                {avg == null ? "\u2014" : avg.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="hm-card-footer-overall">
        <span>Overall</span>
        <span className="hm-overall-value">
          {overall == null ? "\u2014" : overall.toFixed(1)}
          <span className="hm-overall-max"> / {tabMax}</span>
        </span>
      </div>
    </article>
  );
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/admin/pages/heatmap/ProjectAveragesCard.jsx
git commit -m "feat(heatmap): add ProjectAveragesCard footer component"
```

---

## Task 5: `HeatmapMobileList` container

**Files:**
- Create: `src/admin/pages/heatmap/HeatmapMobileList.jsx`

This component receives data already prepared by `HeatmapPage` (visible jurors + row avgs + per-group averages) and renders the mobile list with a sort dropdown.

- [ ] **Step 5.1: Implement `HeatmapMobileList.jsx`**

Write `src/admin/pages/heatmap/HeatmapMobileList.jsx`:

```jsx
import { useMemo, useState } from "react";
import CustomSelect from "@/shared/ui/CustomSelect";
import { sortMobileJurors, MOBILE_SORT_KEYS } from "./mobileSort.js";
import JurorHeatmapCard from "./JurorHeatmapCard.jsx";
import ProjectAveragesCard from "./ProjectAveragesCard.jsx";

function buildRows(juror, groups, lookup, activeTab, activeCriteria, getCellDisplay) {
  return groups.map(g => {
    const entry = lookup[juror.key]?.[g.id];
    const cell = getCellDisplay(entry, activeTab, activeCriteria);
    const label = g.group_no != null ? `P${g.group_no}` : (g.title || g.id);
    const title = g.title || g.id;
    if (!cell) {
      return { groupId: g.id, label, title, empty: true, partial: false, score: null, max: null };
    }
    return {
      groupId: g.id,
      label,
      title,
      empty: false,
      partial: !!cell.partial,
      score: cell.score,
      max: cell.max,
    };
  });
}

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

      {sortedJurors.length === 0 ? (
        <div className="hm-card hm-card-empty">No jurors to display.</div>
      ) : (
        <div className="hm-card-list">
          {sortedJurors.map(juror => {
            const originalIdx = visibleJurors.findIndex(j => j.key === juror.key);
            const rows = buildRows(juror, groups, lookup, activeTab, activeCriteria, getCellDisplay);
            return (
              <JurorHeatmapCard
                key={juror.key}
                juror={juror}
                avg={jurorRowAvgs[originalIdx]}
                tabMax={tabMax}
                tabLabel={tabLabel}
                status={jurorWorkflowMap?.get(juror.key)}
                rows={rows}
              />
            );
          })}
        </div>
      )}

      <ProjectAveragesCard
        groups={groups}
        averages={visibleAverages}
        overall={overallAvg}
        tabMax={tabMax}
      />
    </section>
  );
}
```

- [ ] **Step 5.2: Verify `CustomSelect` prop API matches usage**

Read `src/shared/ui/CustomSelect.jsx` and confirm the component accepts `value`, `onChange`, `options` (array of `{ value, label }`), and `ariaLabel` props. If any prop name differs (e.g. `onSelect` instead of `onChange`), update `HeatmapMobileList.jsx` accordingly before continuing.

Run: `grep -n "export default" src/shared/ui/CustomSelect.jsx` and inspect the signature.

- [ ] **Step 5.3: Commit**

```bash
git add src/admin/pages/heatmap/HeatmapMobileList.jsx
git commit -m "feat(heatmap): add HeatmapMobileList container with sort dropdown"
```

---

## Task 6: Wire `HeatmapMobileList` into `HeatmapPage`

**Files:**
- Modify: `src/admin/pages/HeatmapPage.jsx`

- [ ] **Step 6.1: Add import**

At the top of `src/admin/pages/HeatmapPage.jsx`, after the existing component imports (around line 17, next to `JurorStatusPill`), add:

```jsx
import HeatmapMobileList from "./heatmap/HeatmapMobileList.jsx";
```

- [ ] **Step 6.2: Render `<HeatmapMobileList>` beside the existing table**

Inside `HeatmapPage.jsx`, find the `<div className="matrix-wrap">` block that opens the matrix table (around line 359). Immediately **before** that opening `<div>`, add:

```jsx
<HeatmapMobileList
  visibleJurors={visibleJurors}
  groups={groups || []}
  lookup={lookup}
  activeTab={activeTab}
  activeCriteria={activeCriteria}
  tabLabel={tabLabel}
  tabMax={tabMax}
  jurorRowAvgs={jurorRowAvgs}
  visibleAverages={visibleAverages}
  overallAvg={overallAvg}
  jurorWorkflowMap={jurorWorkflowMap}
  getCellDisplay={getCellDisplay}
/>
```

Both are rendered unconditionally; visibility is controlled by CSS in Task 7.

- [ ] **Step 6.3: Run the existing ARIA test to confirm no regression**

Run: `npm test -- --run src/admin/__tests__/HeatmapPage.aria.test.jsx`
Expected: PASS — the desktop table still renders unchanged.

- [ ] **Step 6.4: Commit**

```bash
git add src/admin/pages/HeatmapPage.jsx
git commit -m "feat(heatmap): mount HeatmapMobileList on heatmap page"
```

---

## Task 7: Mobile CSS (hide table + style cards)

**Files:**
- Modify: `src/styles/pages/heatmap.css`

- [ ] **Step 7.1: Append the mobile card styles**

At the **end** of `src/styles/pages/heatmap.css`, add the following block:

```css
/* ── Heatmap Mobile Card List (portrait) ──────────────────── */

/* Hidden by default (desktop and landscape). */
.heatmap-mobile { display: none; }

/* Shared card primitive */
.hm-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  color: var(--text-primary);
}
.hm-card + .hm-card { margin-top: 10px; }

.hm-card-list { display: block; }

/* Header toggle (full-width button) */
.hm-card-toggle {
  all: unset;
  display: block;
  width: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.hm-card-toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 10px;
}

.hm-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-subtle, var(--border));
}
.hm-card-head-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

/* Avg donut */
.avg-donut {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}
.avg-donut-center {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
}
.avg-donut-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.avg-donut-label {
  display: block;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

/* Summary strip */
.hm-card-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.hm-card-summary-text { flex-shrink: 0; font-weight: 500; }
.hm-card-spark {
  display: flex;
  gap: 3px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.hm-sparkdot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
.hm-sparkdot-empty {
  background: transparent;
  border: 1px dashed var(--border);
}
.hm-card-chev {
  display: inline-flex;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* Expanded row list */
.hm-card.is-expanded .hm-card-summary {
  border-bottom: 1px dashed var(--border-subtle, var(--border));
  padding-bottom: 10px;
  margin-bottom: 4px;
}
.hm-card-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.hm-row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px dashed var(--border-subtle, var(--border));
}
.hm-row:first-child { border-top: 0; }
.hm-row-code {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}
.hm-row-title {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Score pill */
.hm-score-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 40px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
}
.hm-score-pill-empty {
  background: transparent;
  color: var(--text-quaternary);
  font-weight: 500;
}
.hm-score-pill .m-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

/* Footer (project averages) card */
.hm-card-footer .hm-card-footer-head {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-tertiary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle, var(--border));
  margin-bottom: 4px;
}
.hm-card-footer .hm-row { grid-template-columns: 28px 1fr auto; }
.hm-avg-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.hm-card-footer-overall {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 10px;
  margin-top: 6px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}
.hm-overall-max {
  color: var(--text-tertiary);
  font-weight: 500;
  font-size: 11px;
}

/* Action bar (sort + export live in existing page header; sort is mobile-only) */
.heatmap-mobile .hm-mobile-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.hm-card-empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 24px 16px;
}

/* ── Mobile portrait: swap table for card list ───────────── */
@media (max-width: 900px) and (orientation: portrait) {
  .heatmap-page .matrix-wrap > table.matrix-table { display: none; }
  .heatmap-page .heatmap-mobile { display: block; }
}
```

- [ ] **Step 7.2: Visual check in dev server**

Run: `npm run dev`
Open `http://localhost:5173/admin/heatmap` in a browser. Resize DevTools to a portrait iPhone preset (e.g. 390×844).

Verify:
- Table is hidden; card list is visible.
- Each juror card shows the 72px donut with a band-colored arc.
- Cards start collapsed; tapping the header expands them.
- Project Averages card appears at the bottom.
- Legend (Low…High + `!`) still shows beneath.
- Switching tabs (All / Tech / Written…) updates the donut and pills.
- Desktop (1280+) and landscape remain the unchanged table layout.

- [ ] **Step 7.3: Run static UI checks**

Run: `npm run check:no-native-select`
Expected: no new offenders.

Run: `npm run check:no-nested-panels`
Expected: no new offenders.

- [ ] **Step 7.4: Run the full unit test suite**

Run: `npm test -- --run`
Expected: all existing tests still pass; the six new tests added in Tasks 1–3 are green.

- [ ] **Step 7.5: Commit**

```bash
git add src/styles/pages/heatmap.css
git commit -m "style(heatmap): mobile portrait card layout + hide desktop table"
```

---

## Final Checks

- [ ] **Step F.1: Build**

Run: `npm run build`
Expected: build succeeds with no warnings introduced by the new files.

- [ ] **Step F.2: Manually verify on both environments**

Per the "Verify Against Live App" feedback, load the heatmap page on both prod and demo in a real mobile viewport (DevTools device toolbar is acceptable). Confirm:

- Real juror + project data renders correctly.
- Partial cells render the `!` badge.
- Jurors with no scored cells show an empty donut and "no projects scored" state is visually clean.
- Sort dropdown cycles through all five options and reorders cards.
- Expand/collapse toggle works and is keyboard-accessible (Tab + Enter).

- [ ] **Step F.3: Final commit note**

Do NOT auto-commit or push. Stop here and let the user review. Per project rules, pushes and merges require explicit user request.

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a task:
  - Layout → Task 7 CSS (hide table, mobile container)
  - Juror card header + donut → Tasks 2, 3
  - Collapsed/expanded states → Task 3
  - Sort control → Tasks 1, 5
  - Criteria tabs → reused from existing code via the props passed in Task 6
  - Project Averages card → Task 4
  - Edge cases → covered by Task 3 partial/empty row logic + Task 5 empty-list branch
  - Accessibility → Task 3 aria-expanded/aria-controls, Task 2 role="img" + aria-label, Task 5 sort ariaLabel
  - Testing (QA catalog, mock pattern, static checks) → Tasks 1, 2, 3, 7
- **Placeholders:** None — all code blocks are complete.
- **Type consistency:** `rows` prop shape is defined in Task 5 (`buildRows`) and consumed identically in Task 3 (`RowItem`, `SparkDot`). `MOBILE_SORT_KEYS` item shape matches `CustomSelect` expectations (`value` / `label`); Task 5 Step 5.2 verifies this against the real `CustomSelect` before committing.
