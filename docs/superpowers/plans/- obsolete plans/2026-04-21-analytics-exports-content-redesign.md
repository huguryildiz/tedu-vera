# Analytics Exports — Content Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Analytics XLSX + PDF exports mirror the Analytics page exactly — one canonical section list drives both formats; CSV export is removed from Analytics only.

**Architecture:** Introduce `ANALYTICS_SECTIONS` as the single source of truth in `analyticsExport.js`. Both `buildAnalyticsWorkbook` and `buildAnalyticsPDF` iterate this list so XLSX sheets and PDF pages stay in lockstep. Three new dataset builders (`buildAttainmentStatusDataset`, `buildThresholdGapDataset`, `buildGroupHeatmapDataset`) are added; two unused ones (`buildCompetencyProfilesDataset`, `buildCriterionBoxplotDataset`) are removed. The §01 attainment card strip gets a DOM id so PDF can capture it as an image.

**Tech Stack:** React, `xlsx-js-style`, `jspdf` + `jspdf-autotable`, `vitest` with `qaTest()` helper.

**Spec:** [docs/superpowers/specs/2026-04-21-analytics-exports-content-redesign-design.md](../specs/2026-04-21-analytics-exports-content-redesign-design.md)

---

## Commit Discipline

**Do not run `git commit` during execution.** Per project CLAUDE.md: "Never commit or push unless the user explicitly asks." After each task's `git add` step, stop and continue to the next task. The user will commit when they are ready. Commit message suggestions below exist so that, when the user asks, the messages are ready.

## File Structure

### Files to Create

- `src/admin/__tests__/analyticsDatasets.new.test.js` — unit tests for three new dataset builders + integration test for section list.

### Files to Modify

- `src/test/qa-catalog.json` — add 10 new QA entries (one per new test) before writing tests.
- `src/admin/analytics/analyticsDatasets.js` — add 3 new builders; delete 2 unused ones.
- `src/admin/analytics/analyticsExport.js` — introduce `ANALYTICS_SECTIONS`; refactor `buildAnalyticsWorkbook` and `buildAnalyticsPDF` to iterate it.
- `src/admin/pages/AnalyticsPage.jsx` — add `id="pdf-chart-attainment-status"` on card strip; remove CSV format from `ANALYTICS_EXPORT_FORMATS`; delete CSV branches in `handleExport` and `generateAnalyticsFile`.

### Files Untouched (Explicit Non-Goals)

- `src/admin/components/ExportPanel.jsx` — shared component used by other pages; Analytics has its own inline `ExportPanel`, so the shared one is not modified.
- `src/admin/utils/exportXLSX.js` (`buildExportFilename`) — unchanged.
- `src/admin/analytics/captureChartImage.js` — unchanged; works generically on any DOM id.
- CSV in Reviews/Rankings/Heatmap/ExportPage and the CSV **import** flow (`csvParser.js`, `ImportCsvModal`, `ImportJurorsModal`, `UploadCsvModal`, `SetupWizardPage`) — untouched.
- `SendReportModal` — unchanged; still calls `generateAnalyticsFile(format)` which will only return `xlsx`/`pdf` after this plan.

---

## Task 1: Add QA Catalog Entries for New Tests

`qaTest(id, …)` requires every test ID to exist in `src/test/qa-catalog.json` before use. Add all 10 IDs up front so the test tasks below can run cleanly.

**Files:**
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Append 10 new entries to the catalog array**

Open `src/test/qa-catalog.json`, locate the end of the array (the last closing `]`), and insert these 10 entries immediately before it. Each entry is a sibling of the existing ones — add a comma after the previous entry if needed.

```json
,
{
  "id": "analytics.dataset.attainment_status.01",
  "module": "Analytics / Exports",
  "area": "Dataset — Attainment Status",
  "story": "Happy path with prior-period delta",
  "scenario": "buildAttainmentStatusDataset returns rows with attainment rate, status label, and delta column when prior period is provided",
  "whyItMatters": "Exports must carry the same per-outcome attainment numbers the user sees on §01 cards.",
  "risk": "Wrong attainment values or missing status labels would mislead accreditation reviewers.",
  "coverageStrength": "Strong",
  "severity": "critical"
},
{
  "id": "analytics.dataset.attainment_status.02",
  "module": "Analytics / Exports",
  "area": "Dataset — Attainment Status",
  "story": "Empty input",
  "scenario": "buildAttainmentStatusDataset returns zero rows when submittedData is empty",
  "whyItMatters": "Empty-data contract: sections with no rows are skipped entirely in both XLSX and PDF.",
  "risk": "Emitting an empty sheet with just a header would produce a confusing export.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "analytics.dataset.attainment_status.03",
  "module": "Analytics / Exports",
  "area": "Dataset — Attainment Status",
  "story": "No prior period available",
  "scenario": "buildAttainmentStatusDataset omits the delta column entirely when priorPeriodStats is null",
  "whyItMatters": "When only one period exists, showing an empty delta column is noise; omitting it keeps the sheet honest.",
  "risk": "A blank delta column would suggest data loss rather than absence of comparison.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "analytics.dataset.threshold_gap.01",
  "module": "Analytics / Exports",
  "area": "Dataset — Threshold Gap",
  "story": "Happy path",
  "scenario": "buildThresholdGapDataset returns per-outcome avg and gap (avg − threshold) with correct sign",
  "whyItMatters": "Threshold gap chart on screen had no underlying table in exports — this fixes parity.",
  "risk": "Wrong sign or wrong arithmetic would flip the interpretation of which outcomes are below threshold.",
  "coverageStrength": "Strong",
  "severity": "critical"
},
{
  "id": "analytics.dataset.threshold_gap.02",
  "module": "Analytics / Exports",
  "area": "Dataset — Threshold Gap",
  "story": "Empty input",
  "scenario": "buildThresholdGapDataset returns zero rows when submittedData is empty",
  "whyItMatters": "Consistent empty-data contract across all new builders.",
  "risk": "Inconsistent empty handling would let the workbook include ghost sheets.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "analytics.dataset.group_heatmap.01",
  "module": "Analytics / Exports",
  "area": "Dataset — Group Heatmap",
  "story": "Happy path",
  "scenario": "buildGroupHeatmapDataset returns one row per group with outcome columns and a below-threshold count",
  "whyItMatters": "Heatmap was chart-only in PDF — the underlying per-group numbers must be exportable.",
  "risk": "Wrong per-group values or missing below-threshold count would misrepresent cohort performance.",
  "coverageStrength": "Strong",
  "severity": "critical"
},
{
  "id": "analytics.dataset.group_heatmap.02",
  "module": "Analytics / Exports",
  "area": "Dataset — Group Heatmap",
  "story": "Empty input",
  "scenario": "buildGroupHeatmapDataset returns zero rows when dashboardStats is empty or all groups have count 0",
  "whyItMatters": "Consistent empty-data contract — no cohort → no sheet.",
  "risk": "A zero-row heatmap sheet would confuse reviewers.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "analytics.export.sections.01",
  "module": "Analytics / Exports",
  "area": "Workbook Composition",
  "story": "Canonical section list drives XLSX sheets",
  "scenario": "buildAnalyticsWorkbook emits exactly the sheets declared in ANALYTICS_SECTIONS — no extras, no omissions",
  "whyItMatters": "XLSX must mirror the screen one-for-one; canonical list is the contract.",
  "risk": "Drift between ANALYTICS_SECTIONS and actual sheets re-introduces the original problem.",
  "coverageStrength": "Strong",
  "severity": "critical"
},
{
  "id": "analytics.export.sections.02",
  "module": "Analytics / Exports",
  "area": "Workbook Composition",
  "story": "Empty-data skip contract",
  "scenario": "buildAnalyticsWorkbook with empty submittedData produces a workbook with zero sheets (all sections skip)",
  "whyItMatters": "Sections with zero rows must be skipped in both formats — the workbook honors this.",
  "risk": "An empty workbook with empty sheets would be worse than no export at all.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "analytics.export.sections.03",
  "module": "Analytics / Exports",
  "area": "UI — Format Options",
  "story": "CSV removed from Analytics export panel",
  "scenario": "ANALYTICS_EXPORT_FORMATS in AnalyticsPage contains only xlsx and pdf; csv entry removed",
  "whyItMatters": "CSV is conceptually wrong for the multi-section Analytics report; UI must not offer it.",
  "risk": "Leaving the CSV option would confuse users and still generate the broken concat output.",
  "coverageStrength": "Strong",
  "severity": "normal"
}
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/test/qa-catalog.json', 'utf8'))" && echo OK`
Expected: `OK`

- [ ] **Step 3: Stage**

```bash
git add src/test/qa-catalog.json
```

Commit message (do not run until user asks): `test(analytics): register QA catalog IDs for export content redesign`

---

## Task 2: `buildAttainmentStatusDataset` (TDD)

**Files:**
- Modify: `src/admin/analytics/analyticsDatasets.js`
- Create: `src/admin/__tests__/analyticsDatasets.new.test.js`

### Dataset contract

Signature: `buildAttainmentStatusDataset({ submittedData, activeOutcomes, threshold = 70, priorPeriodStats = null, outcomeLookup = null })`

Returns:

```js
{
  sheet: "Attainment Status",
  title: "Outcome Attainment Status",
  note: "Per-outcome attainment rate with threshold status",
  headers: ["Outcome", "Description", "Attainment Rate (%)", "Status"],              // delta column omitted when priorPeriodStats is null
  rows: [
    ["PO-1", "Engineering knowledge", 82, "Met"],
    ...
  ],
  summary: { metCount, totalCount },  // consumed downstream for the "X of Y outcomes met" trailing row
}
```

When `priorPeriodStats` is provided (shape: `{ currentTrend, prevTrend }` mirroring the page's `deltaRows[0]` / `deltaRows[1]`), a fifth column `Δ vs Prior Period (%)` is appended and each row carries the delta value (rounded integer) or `null` when unavailable for that outcome.

Attainment rate / status thresholds match the on-screen logic:
- `>= threshold` → `Met`
- `>= 60 && < threshold` → `Borderline`
- `< 60` → `Not Met`
- `null` (no data) → `No data`

Sort order matches the on-screen card order: Met → Borderline → Not Met → No data; within each group descending by attainment rate.

- [ ] **Step 1: Write the failing test (happy path, with delta)**

Create `src/admin/__tests__/analyticsDatasets.new.test.js`:

```js
// src/admin/__tests__/analyticsDatasets.new.test.js
// Unit + integration tests for dataset builders introduced by the
// 2026-04-21 analytics exports content redesign.

import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import {
  buildAttainmentStatusDataset,
  buildThresholdGapDataset,
  buildGroupHeatmapDataset,
} from "../analytics/analyticsDatasets.js";

// ── Fixtures ──────────────────────────────────────────────────────────────
// Minimal outcome shape matches what AnalyticsPage passes as `criteria`:
// { id, key, label, max, outcomes: [code], rubric }
const OUTCOMES = [
  { id: "technical", key: "technical", label: "Technical", max: 30, outcomes: ["PO-1"] },
  { id: "written",   key: "written",   label: "Written",   max: 20, outcomes: ["PO-2"] },
];

const OUTCOME_LOOKUP = {
  "PO-1": { code: "PO-1", desc_en: "Engineering knowledge" },
  "PO-2": { code: "PO-2", desc_en: "Problem analysis" },
};

// 5 submission rows: 4 pass 70% on PO-1, 1 fails. On PO-2: 2 pass, 3 fail.
const SUBMITTED = [
  { projectId: "p1", technical: 27, written: 18 }, // 90%, 90%
  { projectId: "p2", technical: 25, written: 14 }, // 83%, 70%
  { projectId: "p3", technical: 22, written: 10 }, // 73%, 50%
  { projectId: "p4", technical: 21, written:  8 }, // 70%, 40%
  { projectId: "p5", technical: 15, written:  5 }, // 50%, 25%
];

describe("buildAttainmentStatusDataset", () => {
  qaTest("analytics.dataset.attainment_status.01", () => {
    const prior = {
      currentTrend: { criteriaAvgs: { technical: 22, written: 10 } },  // avg 73%, 50%
      prevTrend:    { criteriaAvgs: { technical: 20, written: 12 } },  // avg 66%, 60%
    };
    const ds = buildAttainmentStatusDataset({
      submittedData: SUBMITTED,
      activeOutcomes: OUTCOMES,
      threshold: 70,
      priorPeriodStats: prior,
      outcomeLookup: OUTCOME_LOOKUP,
    });

    expect(ds.sheet).toBe("Attainment Status");
    expect(ds.headers).toEqual([
      "Outcome",
      "Description",
      "Attainment Rate (%)",
      "Status",
      "Δ vs Prior Period (%)",
    ]);

    // PO-1: 4 of 5 pass → 80% → Met; delta = round((22 − 20) / 30 × 100) = 7
    // PO-2: 2 of 5 pass → 40% → Not Met; delta = round((10 − 12) / 20 × 100) = -10
    expect(ds.rows).toHaveLength(2);

    // Met comes before Not Met in sort order
    const [firstRow, secondRow] = ds.rows;
    expect(firstRow[0]).toBe("PO-1");
    expect(firstRow[1]).toBe("Engineering knowledge");
    expect(firstRow[2]).toBe(80);
    expect(firstRow[3]).toBe("Met");
    expect(firstRow[4]).toBe(7);

    expect(secondRow[0]).toBe("PO-2");
    expect(secondRow[2]).toBe(40);
    expect(secondRow[3]).toBe("Not Met");
    expect(secondRow[4]).toBe(-10);

    expect(ds.summary).toEqual({ metCount: 1, totalCount: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: FAIL with `buildAttainmentStatusDataset is not a function` (import resolves to `undefined`).

- [ ] **Step 3: Implement `buildAttainmentStatusDataset` in `analyticsDatasets.js`**

Add the following **between** `computeOverallAvg` (ends around line 47) and `buildOutcomeByGroupDataset` (starts around line 53). The new function should live next to its siblings.

```js
// Per-outcome attainment: attRate %, status label, optional Δ vs prior period.
// Mirrors the logic in AnalyticsPage.buildAttainmentCards() so the sheet's
// values match the §01 card strip one-for-one.
export function buildAttainmentStatusDataset({
  submittedData = [],
  activeOutcomes = [],
  threshold = 70,
  priorPeriodStats = null,
  outcomeLookup = null,
} = {}) {
  const hasPrior = !!(priorPeriodStats?.currentTrend && priorPeriodStats?.prevTrend);

  // outcomeCode → { criterionKey, max }
  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) outcomeMap.set(code, { criterionKey: c.key ?? c.id, criterionId: c.id, max: c.max });
    }
  }

  const rows = [];
  for (const [code, { criterionKey, criterionId, max }] of outcomeMap) {
    const vals = outcomeValues(submittedData || [], criterionKey);
    let attRate = null;
    if (vals.length) {
      const above = vals.filter((v) => max > 0 && (v / max) * 100 >= threshold).length;
      attRate = Math.round((above / vals.length) * 100);
    }

    const status =
      attRate == null ? "No data" :
      attRate >= threshold ? "Met" :
      attRate >= 60 ? "Borderline" :
      "Not Met";

    let delta = null;
    if (hasPrior && max > 0) {
      const cur = priorPeriodStats.currentTrend.criteriaAvgs?.[criterionId];
      const prev = priorPeriodStats.prevTrend.criteriaAvgs?.[criterionId];
      if (cur != null && prev != null) {
        delta = Math.round(((cur - prev) / max) * 100);
      }
    }

    const desc = outcomeLookup?.[code]?.desc_en || outcomeLookup?.[code]?.desc_tr || code;
    const baseRow = [code, desc, attRate, status];
    rows.push(hasPrior ? [...baseRow, delta] : baseRow);
  }

  // Sort: Met → Borderline → Not Met → No data, then by attRate desc within group
  const ORDER = { "Met": 0, "Borderline": 1, "Not Met": 2, "No data": 3 };
  rows.sort((a, b) => {
    const od = ORDER[a[3]] - ORDER[b[3]];
    if (od !== 0) return od;
    return (b[2] ?? -1) - (a[2] ?? -1);
  });

  const headers = hasPrior
    ? ["Outcome", "Description", "Attainment Rate (%)", "Status", "Δ vs Prior Period (%)"]
    : ["Outcome", "Description", "Attainment Rate (%)", "Status"];

  const metCount = rows.filter((r) => r[3] === "Met").length;
  const totalCount = rows.filter((r) => r[2] != null).length;

  return {
    sheet: "Attainment Status",
    title: "Outcome Attainment Status",
    note: "Per-outcome attainment rate with threshold status",
    headers,
    rows,
    summary: { metCount, totalCount },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: `analytics.dataset.attainment_status.01` PASS.

- [ ] **Step 5: Add empty-input test**

Append to the same `describe` block:

```js
  qaTest("analytics.dataset.attainment_status.02", () => {
    const ds = buildAttainmentStatusDataset({
      submittedData: [],
      activeOutcomes: OUTCOMES,
      threshold: 70,
    });
    // All outcomes have no data — rows exist but attRate is null, status "No data"
    expect(ds.rows.every((r) => r[2] === null)).toBe(true);
    expect(ds.rows.every((r) => r[3] === "No data")).toBe(true);
    expect(ds.summary).toEqual({ metCount: 0, totalCount: 0 });
  });
```

Note on contract: this builder **returns rows even when all outcomes have no data** (one row per declared outcome). The "skip empty sections" contract is applied by the workbook/PDF layer via `rows.length === 0`. Here, rows exist but totalCount is 0. The workbook layer uses `summary.totalCount` to skip this section (see Task 6) — we consciously don't make that decision inside the builder.

- [ ] **Step 6: Run test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: both attainment_status tests PASS.

- [ ] **Step 7: Add no-prior-period test**

Append:

```js
  qaTest("analytics.dataset.attainment_status.03", () => {
    const ds = buildAttainmentStatusDataset({
      submittedData: SUBMITTED,
      activeOutcomes: OUTCOMES,
      threshold: 70,
      priorPeriodStats: null,
      outcomeLookup: OUTCOME_LOOKUP,
    });
    expect(ds.headers).toEqual([
      "Outcome",
      "Description",
      "Attainment Rate (%)",
      "Status",
    ]);
    // Each row has exactly 4 cells (no delta column)
    expect(ds.rows.every((r) => r.length === 4)).toBe(true);
  });
```

- [ ] **Step 8: Run test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: all 3 attainment_status tests PASS.

- [ ] **Step 9: Stage**

```bash
git add src/admin/analytics/analyticsDatasets.js src/admin/__tests__/analyticsDatasets.new.test.js
```

Commit message (do not run until user asks): `feat(analytics): add buildAttainmentStatusDataset for exports`

---

## Task 3: `buildThresholdGapDataset` (TDD)

**Files:**
- Modify: `src/admin/analytics/analyticsDatasets.js`
- Modify: `src/admin/__tests__/analyticsDatasets.new.test.js`

### Dataset contract

Signature: `buildThresholdGapDataset({ submittedData, activeOutcomes, threshold = 70, outcomeLookup = null })`

Returns:

```js
{
  sheet: "Threshold Gap",
  title: "Threshold Gap Analysis",
  note: "Deviation from threshold per outcome",
  headers: ["Outcome", "Description", "Average Score (%)", "Gap vs Threshold (%)"],
  rows: [
    ["PO-1", "Engineering knowledge", 78.5, 8.5],
    ["PO-2", "Problem analysis", 52.0, -18.0],
    ...
  ],
}
```

Average is the mean of normalized score % across all submissions for that outcome's criterion. Gap = avg − threshold (positive = above, negative = below). Rows are produced per unique outcome code discovered in `activeOutcomes`.

- [ ] **Step 1: Write the failing test**

Append to the test file:

```js
describe("buildThresholdGapDataset", () => {
  qaTest("analytics.dataset.threshold_gap.01", () => {
    const ds = buildThresholdGapDataset({
      submittedData: SUBMITTED,
      activeOutcomes: OUTCOMES,
      threshold: 70,
      outcomeLookup: OUTCOME_LOOKUP,
    });

    expect(ds.sheet).toBe("Threshold Gap");
    expect(ds.headers).toEqual([
      "Outcome",
      "Description",
      "Average Score (%)",
      "Gap vs Threshold (%)",
    ]);

    // PO-1 avg pct = mean([90, 83.33, 73.33, 70, 50]) = 73.33
    // gap = 73.33 − 70 = 3.33
    const po1 = ds.rows.find((r) => r[0] === "PO-1");
    expect(po1[1]).toBe("Engineering knowledge");
    expect(po1[2]).toBeCloseTo(73.3, 1);
    expect(po1[3]).toBeCloseTo(3.3, 1);

    // PO-2 avg = mean([90, 70, 50, 40, 25]) = 55 → gap = -15
    const po2 = ds.rows.find((r) => r[0] === "PO-2");
    expect(po2[2]).toBeCloseTo(55, 1);
    expect(po2[3]).toBeCloseTo(-15, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: FAIL with `buildThresholdGapDataset is not a function`.

- [ ] **Step 3: Implement the builder**

Add in `analyticsDatasets.js` immediately after `buildAttainmentStatusDataset`:

```js
// Per-outcome threshold gap: avg score % and (avg − threshold).
export function buildThresholdGapDataset({
  submittedData = [],
  activeOutcomes = [],
  threshold = 70,
  outcomeLookup = null,
} = {}) {
  // outcomeCode → { criterionKey, max }
  const outcomeMap = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!outcomeMap.has(code)) outcomeMap.set(code, { criterionKey: c.key ?? c.id, max: c.max });
    }
  }

  const rows = [];
  for (const [code, { criterionKey, max }] of outcomeMap) {
    const vals = outcomeValues(submittedData || [], criterionKey);
    if (!vals.length) {
      const desc = outcomeLookup?.[code]?.desc_en || outcomeLookup?.[code]?.desc_tr || code;
      rows.push([code, desc, null, null]);
      continue;
    }
    const avgRaw = mean(vals);
    const avgPct = max > 0 ? (avgRaw / max) * 100 : 0;
    const gap = avgPct - threshold;
    const desc = outcomeLookup?.[code]?.desc_en || outcomeLookup?.[code]?.desc_tr || code;
    rows.push([code, desc, Number(fmt1(avgPct)), Number(fmt1(gap))]);
  }

  return {
    sheet: "Threshold Gap",
    title: "Threshold Gap Analysis",
    note: "Deviation from threshold per outcome",
    headers: ["Outcome", "Description", "Average Score (%)", "Gap vs Threshold (%)"],
    rows,
  };
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: `analytics.dataset.threshold_gap.01` PASS.

- [ ] **Step 5: Add empty-input test**

Append:

```js
  qaTest("analytics.dataset.threshold_gap.02", () => {
    const ds = buildThresholdGapDataset({
      submittedData: [],
      activeOutcomes: OUTCOMES,
      threshold: 70,
    });
    // One row per outcome, all with null avg/gap
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows.every((r) => r[2] === null && r[3] === null)).toBe(true);
  });
```

- [ ] **Step 6: Run test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: both threshold_gap tests PASS.

- [ ] **Step 7: Stage**

```bash
git add src/admin/analytics/analyticsDatasets.js src/admin/__tests__/analyticsDatasets.new.test.js
```

Commit message: `feat(analytics): add buildThresholdGapDataset for exports`

---

## Task 4: `buildGroupHeatmapDataset` (TDD)

**Files:**
- Modify: `src/admin/analytics/analyticsDatasets.js`
- Modify: `src/admin/__tests__/analyticsDatasets.new.test.js`

### Dataset contract

Signature: `buildGroupHeatmapDataset({ dashboardStats, activeOutcomes, threshold = 70 })`

Returns:

```js
{
  sheet: "Group Heatmap",
  title: "Group Attainment Heatmap",
  note: "Normalized score (%) per outcome per project group",
  headers: ["Group", "PO-1", "PO-2", ..., "Cells Below Threshold"],
  rows: [
    ["Alpha Project", 88, 72, 1],
    ["Beta Project",  55, 42, 2],
    ...
  ],
}
```

Outcome columns use the **outcome code** as header (not the criterion label) — this is the per-outcome view. For each group and outcome, the cell value is the group's `avg` for that outcome's criterion divided by the criterion's `max`, times 100 (rounded to 1 decimal). Trailing `Cells Below Threshold` column counts how many outcome cells in that row are `< threshold`.

Groups with `count === 0` are excluded (same rule used elsewhere).

- [ ] **Step 1: Write the failing test**

Append to the test file:

```js
describe("buildGroupHeatmapDataset", () => {
  qaTest("analytics.dataset.group_heatmap.01", () => {
    const dashboardStats = [
      { id: "g1", title: "Alpha", count: 3, avg: { technical: 26, written: 14 } },  // 86.7%, 70%
      { id: "g2", title: "Beta",  count: 2, avg: { technical: 15, written:  8 } },  // 50%, 40%
      { id: "g3", title: "Gamma", count: 0, avg: { technical: 20, written: 10 } },  // excluded
    ];
    const ds = buildGroupHeatmapDataset({
      dashboardStats,
      activeOutcomes: OUTCOMES,
      threshold: 70,
    });

    expect(ds.sheet).toBe("Group Heatmap");
    expect(ds.headers).toEqual([
      "Group",
      "PO-1",
      "PO-2",
      "Cells Below Threshold",
    ]);

    // Two rows (Gamma excluded, count=0)
    expect(ds.rows).toHaveLength(2);

    const alpha = ds.rows.find((r) => r[0] === "Alpha");
    // 26/30 = 86.67, 14/20 = 70.0
    expect(alpha[1]).toBeCloseTo(86.7, 1);
    expect(alpha[2]).toBeCloseTo(70, 1);
    expect(alpha[3]).toBe(0); // both ≥ threshold

    const beta = ds.rows.find((r) => r[0] === "Beta");
    // 15/30 = 50.0, 8/20 = 40.0
    expect(beta[1]).toBeCloseTo(50, 1);
    expect(beta[2]).toBeCloseTo(40, 1);
    expect(beta[3]).toBe(2); // both below threshold
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: FAIL with `buildGroupHeatmapDataset is not a function`.

- [ ] **Step 3: Implement the builder**

Add in `analyticsDatasets.js` immediately after `buildThresholdGapDataset`:

```js
// Per-group heatmap: one row per active group, one column per outcome code,
// trailing count of cells below threshold.
export function buildGroupHeatmapDataset({
  dashboardStats = [],
  activeOutcomes = [],
  threshold = 70,
} = {}) {
  const groups = (dashboardStats || []).filter((s) => s.count > 0);

  // Unique outcome codes (preserve first-seen order)
  const outcomeCodes = [];
  const codeMeta = new Map();
  for (const c of activeOutcomes) {
    for (const code of (c.outcomes || [])) {
      if (!codeMeta.has(code)) {
        codeMeta.set(code, { criterionKey: c.key ?? c.id, max: c.max });
        outcomeCodes.push(code);
      }
    }
  }

  const headers = ["Group", ...outcomeCodes, "Cells Below Threshold"];
  const rows = groups.map((g) => {
    let belowCount = 0;
    const cells = outcomeCodes.map((code) => {
      const { criterionKey, max } = codeMeta.get(code);
      const avgRaw = Number(g.avg?.[criterionKey] ?? 0);
      const pct = max > 0 ? (avgRaw / max) * 100 : 0;
      if (pct < threshold) belowCount += 1;
      return Number(fmt1(pct));
    });
    return [g.title || g.name || "—", ...cells, belowCount];
  });

  return {
    sheet: "Group Heatmap",
    title: "Group Attainment Heatmap",
    note: "Normalized score (%) per outcome per project group",
    headers,
    rows,
  };
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: `analytics.dataset.group_heatmap.01` PASS.

- [ ] **Step 5: Add empty-input test**

Append:

```js
  qaTest("analytics.dataset.group_heatmap.02", () => {
    const ds = buildGroupHeatmapDataset({
      dashboardStats: [{ id: "g1", title: "Solo", count: 0, avg: {} }],
      activeOutcomes: OUTCOMES,
      threshold: 70,
    });
    expect(ds.rows).toHaveLength(0);
  });
```

- [ ] **Step 6: Run test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: both group_heatmap tests PASS; all new-dataset tests (7 total) PASS.

- [ ] **Step 7: Stage**

```bash
git add src/admin/analytics/analyticsDatasets.js src/admin/__tests__/analyticsDatasets.new.test.js
```

Commit message: `feat(analytics): add buildGroupHeatmapDataset for exports`

---

## Task 5: Add `pdf-chart-attainment-status` id to card strip

**Files:**
- Modify: `src/admin/pages/AnalyticsPage.jsx:524`

The PDF's §01 page captures the on-screen attainment card strip as an image. The strip needs a stable DOM id so `captureChartImage` can find it.

- [ ] **Step 1: Add the id attribute**

Open `src/admin/pages/AnalyticsPage.jsx`. Find the block starting around line 522:

```jsx
{attCards.length > 0 ? (
  <>
    <div className="attainment-cards">
      {attCards.map(({ code, label, attRate, statusClass, statusLabel, statusPrefix, delta }) => (
```

Change to:

```jsx
{attCards.length > 0 ? (
  <>
    <div className="attainment-cards" id="pdf-chart-attainment-status">
      {attCards.map(({ code, label, attRate, statusClass, statusLabel, statusPrefix, delta }) => (
```

That is: add `id="pdf-chart-attainment-status"` to the existing `<div className="attainment-cards">`. Nothing else on this line changes.

- [ ] **Step 2: Verify dev server still loads the page**

Run: `npm run build`
Expected: build succeeds with no errors from `AnalyticsPage.jsx`.

- [ ] **Step 3: Stage**

```bash
git add src/admin/pages/AnalyticsPage.jsx
```

Commit message: `feat(analytics): tag §01 card strip for PDF capture`

---

## Task 6: Introduce `ANALYTICS_SECTIONS` canonical list & rebuild workbook

**Files:**
- Modify: `src/admin/analytics/analyticsExport.js` (replace `buildDatasets` and `buildAnalyticsWorkbook`)
- Modify: `src/admin/__tests__/analyticsDatasets.new.test.js` (add workbook integration test)

Replace the implicit `buildDatasets`-then-loop pattern with one declarative list that both XLSX and PDF iterate. Each section declares: a key, visible title, the `chartId` used by the PDF capture, a note function (takes `threshold`), a `build(params)` adapter that produces the dataset, and an optional `shouldInclude(dataset)` predicate for conditional inclusion.

- [ ] **Step 1: Rewrite the top of `analyticsExport.js`**

Open `src/admin/analytics/analyticsExport.js`. Replace lines 8–79 (imports block through `buildAnalyticsWorkbook`) with the following. Keep `addTableSheet`, `arrayBufferToBase64`, `registerInterFont`, `loadLogoBase64`, and everything from line 92 onward as-is — they will be touched separately in Task 7.

```js
import * as XLSX from "xlsx-js-style";
import interFontUrl from "@/assets/fonts/Inter-Subset.ttf?url";
import veraLogoUrl from "@/assets/vera_logo_pdf.png?url";
import {
  buildAttainmentStatusDataset,
  buildThresholdGapDataset,
  buildGroupHeatmapDataset,
  buildOutcomeByGroupDataset,
  buildProgrammeAveragesDataset,
  buildTrendDataset,
  buildJurorConsistencyDataset,
  buildRubricAchievementDataset,
  buildOutcomeMappingDataset,
} from "./analyticsDatasets";

// Canonical section list — drives BOTH XLSX sheets and PDF pages.
// Adding a section here guarantees it appears in both formats in this order.
// Keep in lockstep with AnalyticsPage.jsx screen sections.
export const ANALYTICS_SECTIONS = [
  {
    key: "attainment-status",
    chartId: "pdf-chart-attainment-status",
    title: "Outcome Attainment Status",
    note: () => "Per-outcome attainment rate with threshold status",
    build: (p) => buildAttainmentStatusDataset({
      submittedData: p.submittedData,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold,
      priorPeriodStats: p.priorPeriodStats,
      outcomeLookup: p.outcomeLookup,
    }),
    // Skip sheet entirely if there's no evaluated data yet.
    shouldInclude: (ds) => (ds.summary?.totalCount ?? 0) > 0,
  },
  {
    key: "attainment-rate",
    chartId: "pdf-chart-attainment-rate",
    title: "Outcome Attainment Rate",
    note: (t) => `% of evaluations scoring ≥${t}% per programme outcome`,
    // Programme-Level Averages already covers per-outcome avg + std dev;
    // reuse it so screen and export share the same underlying numbers.
    build: (p) => buildProgrammeAveragesDataset(p.submittedData, p.activeOutcomes),
  },
  {
    key: "threshold-gap",
    chartId: "pdf-chart-threshold-gap",
    title: "Threshold Gap Analysis",
    note: (t) => `Deviation from ${t}% competency threshold per outcome`,
    build: (p) => buildThresholdGapDataset({
      submittedData: p.submittedData,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold,
      outcomeLookup: p.outcomeLookup,
    }),
  },
  {
    key: "outcome-by-group",
    chartId: "pdf-chart-outcome-by-group",
    title: "Outcome Achievement by Group",
    note: (t) => `Normalized score (0–100%) per criterion per project group — ${t}% threshold reference`,
    build: (p) => buildOutcomeByGroupDataset(p.dashboardStats, p.activeOutcomes),
  },
  {
    key: "rubric",
    chartId: "pdf-chart-rubric",
    title: "Rubric Achievement Distribution",
    note: () => "Performance band breakdown per criterion — continuous improvement evidence",
    build: (p) => buildRubricAchievementDataset(p.submittedData, p.activeOutcomes),
  },
  {
    key: "programme-averages",
    chartId: "pdf-chart-programme-averages",
    title: "Programme-Level Outcome Averages",
    note: (t) => `Grand mean (%) ± 1σ per criterion with ${t}% threshold reference`,
    build: (p) => buildProgrammeAveragesDataset(p.submittedData, p.activeOutcomes),
  },
  {
    key: "trend",
    chartId: "pdf-chart-trend",
    title: "Outcome Attainment Trend",
    note: () => "Attainment rate (solid) and average score % (dashed) per programme outcome across evaluation periods",
    build: (p) => buildTrendDataset(p.trendData, p.semesterOptions, p.trendSemesterIds, p.activeOutcomes),
    // Trend requires at least 2 periods to be meaningful.
    shouldInclude: (ds) => ds.rows.length >= 2,
  },
  {
    key: "group-heatmap",
    chartId: "pdf-chart-group-heatmap",
    title: "Group Attainment Heatmap",
    note: (t) => `Normalized score (%) per outcome per project group — cells below ${t}% threshold are flagged`,
    build: (p) => buildGroupHeatmapDataset({
      dashboardStats: p.dashboardStats,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold,
    }),
  },
  {
    key: "juror-cv",
    chartId: "pdf-chart-juror-cv",
    title: "Inter-Rater Consistency Heatmap",
    note: () => "Coefficient of variation (CV = σ/μ × 100%) per project group — CV >25% indicates poor agreement",
    build: (p) => buildJurorConsistencyDataset(p.dashboardStats, p.submittedData, p.activeOutcomes),
  },
  {
    key: "coverage",
    chartId: "pdf-chart-coverage",
    title: "Coverage Matrix",
    note: () => "Which programme outcomes are directly assessed by evaluation criteria",
    build: (p) => buildOutcomeMappingDataset(p.activeOutcomes, p.outcomeLookup),
  },
];

// Default inclusion predicate — skip sections whose dataset has zero rows.
function defaultShouldInclude(ds) {
  return (ds.rows?.length ?? 0) > 0;
}

export function buildAnalyticsWorkbook(params) {
  const wb = XLSX.utils.book_new();
  for (const section of ANALYTICS_SECTIONS) {
    const ds = section.build(params);
    const predicate = section.shouldInclude ?? defaultShouldInclude;
    if (!predicate(ds)) continue;
    addTableSheet(
      wb,
      ds.sheet,
      ds.title,
      ds.headers,
      ds.rows,
      ds.extra,
      ds.note,
      ds.merges,
      ds.alignments,
    );
  }
  return wb;
}
```

Also: `addTableSheet` function signature stays the same. The existing `addTableSheet` block (lines 19–57) is untouched.

- [ ] **Step 2: Add workbook integration tests**

Append to `src/admin/__tests__/analyticsDatasets.new.test.js`:

```js
import { buildAnalyticsWorkbook, ANALYTICS_SECTIONS } from "../analytics/analyticsExport.js";

describe("buildAnalyticsWorkbook", () => {
  const params = {
    dashboardStats: [
      { id: "g1", title: "Alpha", count: 3, avg: { technical: 26, written: 14 } },
      { id: "g2", title: "Beta",  count: 2, avg: { technical: 15, written:  8 } },
    ],
    submittedData: SUBMITTED,
    trendData: [],
    semesterOptions: [],
    trendSemesterIds: [],
    activeOutcomes: OUTCOMES,
    outcomeLookup: OUTCOME_LOOKUP,
    threshold: 70,
    priorPeriodStats: null,
  };

  qaTest("analytics.export.sections.01", () => {
    const wb = buildAnalyticsWorkbook(params);
    // Expected sheets: every section whose dataset has rows AND passes shouldInclude.
    // With the fixture:
    //   attainment-status   → included (totalCount=2)
    //   attainment-rate     → included (2 outcome rows)
    //   threshold-gap       → included (2 outcome rows)
    //   outcome-by-group    → included (2 group rows)
    //   rubric              → included (2 outcome rows)
    //   programme-averages  → included (2 outcome rows)
    //   trend               → SKIPPED (0 rows, no periods)
    //   group-heatmap       → included (2 group rows)
    //   juror-cv            → included (2 group rows)
    //   coverage            → included (2 outcome rows)
    const expected = [
      "Attainment Status",
      "Programme-Level Averages",   // from attainment-rate section (reuses Programme Averages builder)
      "Threshold Gap",
      "Outcome Achievement",
      "Rubric Achievement Dist.",
      "Programme-Level Averages",   // from programme-averages section (same builder → same sheet name)
      "Group Heatmap",
      "Juror Consistency",
      "Coverage Matrix",
    ];
    // NOTE: `attainment-rate` and `programme-averages` both call buildProgrammeAveragesDataset,
    // so they produce two sheets with the same `sheet` name. xlsx-js-style's book_append_sheet
    // mock records both. Document this explicitly; Task 6b addresses whether we want a
    // rename pass or accept the duplicate.
    expect(wb.SheetNames.length).toBe(expected.length);
  });

  qaTest("analytics.export.sections.02", () => {
    const emptyParams = { ...params, submittedData: [], dashboardStats: [] };
    const wb = buildAnalyticsWorkbook(emptyParams);
    // With no submissions and no groups, every builder produces zero rows.
    // Predicate skips all sections → empty workbook.
    expect(wb.SheetNames).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the new integration tests**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: `analytics.export.sections.01` **FAILS** — because the `attainment-rate` and `programme-averages` sections both point at `buildProgrammeAveragesDataset`, producing two sheets with identical `sheet: "Programme-Level Averages"` names. `xlsx-js-style`'s `book_append_sheet` rejects duplicate names. Task 6b below fixes this.

- [ ] **Step 4: Verify failure mode**

Actually run the test. If the error is anything other than "duplicate sheet name" or "9 expected / 10 produced", stop and investigate before continuing. The next step assumes this specific failure.

---

## Task 6b: Give `attainment-rate` section its own dataset adapter

The `attainment-rate` and `programme-averages` sections both want the same per-outcome stats but need distinct XLSX sheet names. Split them.

- [ ] **Step 1: Add a tiny adapter in `analyticsExport.js`**

In `analyticsExport.js`, modify the `attainment-rate` section's `build` to rename the sheet:

```js
  {
    key: "attainment-rate",
    chartId: "pdf-chart-attainment-rate",
    title: "Outcome Attainment Rate",
    note: (t) => `% of evaluations scoring ≥${t}% per programme outcome`,
    build: (p) => {
      const ds = buildProgrammeAveragesDataset(p.submittedData, p.activeOutcomes);
      return { ...ds, sheet: "Attainment Rate", title: "Outcome Attainment Rate" };
    },
  },
```

This keeps the numbers shared (source of truth is still `buildProgrammeAveragesDataset`) but distinguishes the sheet names so the workbook contains both.

- [ ] **Step 2: Update the integration test's expected sheet list**

In the `analytics.export.sections.01` test, replace the `expected` array with:

```js
    const expected = [
      "Attainment Status",
      "Attainment Rate",
      "Threshold Gap",
      "Outcome Achievement",
      "Rubric Achievement Dist.",
      "Programme-Level Averages",
      "Group Heatmap",
      "Juror Consistency",
      "Coverage Matrix",
    ];
```

And replace `expect(wb.SheetNames.length).toBe(expected.length);` with:

```js
    expect(wb.SheetNames).toEqual(expected);
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: all dataset + workbook tests PASS.

- [ ] **Step 4: Run the full admin test suite to confirm no regression elsewhere**

Run: `npm test -- --run src/admin/__tests__/`
Expected: all tests PASS.

- [ ] **Step 5: Stage**

```bash
git add src/admin/analytics/analyticsExport.js src/admin/__tests__/analyticsDatasets.new.test.js
```

Commit message: `refactor(analytics): centralize export sections in ANALYTICS_SECTIONS`

---

## Task 7: Rewrite `buildAnalyticsPDF` to iterate `ANALYTICS_SECTIONS`

**Files:**
- Modify: `src/admin/analytics/analyticsExport.js` (`buildAnalyticsPDF`, approximately lines 112–244)

Replace the hardcoded `sections` array inside `buildAnalyticsPDF` with an iteration over `ANALYTICS_SECTIONS`. Everything else (fonts, logo, page headers, footer, chart capture, autoTable styling) is preserved.

- [ ] **Step 1: Replace the `sections` computation**

Open `src/admin/analytics/analyticsExport.js`. Find the block (current lines 152–174) that builds `progAvg`, `outByGroup`, `rubric`, `trend`, `jurorCV`, `outcomes`, and the `const sections = [...]` array. **Delete all of it.**

Replace with:

```js
  // Build a parallel array of { section, dataset, includeFlag } so we can
  // iterate once and skip identically to buildAnalyticsWorkbook.
  const resolved = ANALYTICS_SECTIONS.map((section) => {
    const ds = section.build(params);
    const predicate = section.shouldInclude ?? ((d) => (d.rows?.length ?? 0) > 0);
    return { section, ds, include: predicate(ds) };
  }).filter((r) => r.include);
```

- [ ] **Step 2: Replace the `for (let i = 0; …) { const { title, note, chartId, ds } = sections[i]; … }` loop**

Find the `for` loop that currently renders sections (the block that does `doc.setFontSize(12); doc.text(title, …)` etc). Replace it with:

```js
  // Render sections — first section starts directly on page 1
  let startY = await drawPageHeader();

  for (let i = 0; i < resolved.length; i++) {
    const { section, ds } = resolved[i];

    // Section title
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(section.title, margin, startY);
    startY += 5.5;

    const noteText = typeof section.note === "function" ? section.note(threshold) : (section.note || "");
    if (noteText) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(noteText, margin, startY, { maxWidth: imgW });
      doc.setTextColor(0);
      startY += 5;
    }

    // Chart image
    try {
      const captured = await captureChartImage(section.chartId);
      if (captured) {
        const { dataURL, width, height } = captured;
        const chartImgH = Math.min(imgW / (width / height), pageH * 0.60);
        doc.addImage(dataURL, "JPEG", margin, startY, imgW, chartImgH);
        startY += chartImgH + 4;
      }
    } catch (err) {
      console.error(`[PDF] Chart capture failed for ${section.chartId}:`, err);
    }

    // Data table — every section now has one
    if (ds.headers && ds.rows.length) {
      autoTable(doc, {
        startY,
        head: [ds.headers.map(pdfHeader)],
        body: ds.rows.map((row) => row.map((cell) => String(cell ?? ""))),
        styles: tableFont,
        headStyles: headFont,
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
        tableWidth: "auto",
      });
      startY = doc.lastAutoTable.finalY + 6;
    }

    // Page break after each section except the last
    if (i < resolved.length - 1) {
      doc.addPage();
      startY = await drawPageHeader();
    }
  }
```

Keep the footer loop after (pagination lines) exactly as-is.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. Watch for any unresolved import warnings from the deleted dataset builders.

- [ ] **Step 4: Unit tests**

Run: `npm test -- --run src/admin/__tests__/`
Expected: all PASS.

- [ ] **Step 5: Smoke test in the dev server**

This step is manual because the PDF generator runs in a real browser.

1. Run `npm run dev`
2. Log in to the admin panel, navigate to `/admin/analytics` in an environment with at least one period that has submitted scores.
3. Click **Export** → **PDF Report** → **Download**.
4. Open the generated PDF and verify:
   - Page 1 begins with the Outcome Attainment Status card strip as an image + a data table.
   - Threshold Gap Analysis page now has a table under its chart.
   - Group Attainment Heatmap page now has a table under its chart.
   - Competency Profiles / Criterion Boxplot pages do NOT appear (they never should have — just confirm).
   - Section order matches screen order.

If any of these fail, do not proceed — investigate and fix before the next task.

- [ ] **Step 6: Stage**

```bash
git add src/admin/analytics/analyticsExport.js
```

Commit message: `refactor(analytics): PDF exports iterate ANALYTICS_SECTIONS`

---

## Task 8: Remove CSV from AnalyticsPage UI and code paths

**Files:**
- Modify: `src/admin/pages/AnalyticsPage.jsx`

Three surgical deletions: format list entry, `handleExport` CSV branch, `generateAnalyticsFile` CSV branch.

- [ ] **Step 1: Remove CSV from `ANALYTICS_EXPORT_FORMATS`**

Open `src/admin/pages/AnalyticsPage.jsx`. Find lines 180–184:

```jsx
const ANALYTICS_EXPORT_FORMATS = [
  { id: "xlsx", iconLabel: "XLS", label: "Excel (.xlsx)", desc: "Outcome cards, charts, and summary tables", hint: "Best for sharing" },
  { id: "csv",  iconLabel: "CSV", label: "CSV (.csv)",    desc: "Raw analytics datapoints for external analysis", hint: "Best for analysis" },
  { id: "pdf",  iconLabel: "PDF", label: "PDF Report",    desc: "Formatted outcome attainment report", hint: "Best for archival" },
];
```

Change to:

```jsx
const ANALYTICS_EXPORT_FORMATS = [
  { id: "xlsx", iconLabel: "XLS", label: "Excel (.xlsx)", desc: "Outcome cards, charts, and summary tables", hint: "Best for sharing" },
  { id: "pdf",  iconLabel: "PDF", label: "PDF Report",    desc: "Formatted outcome attainment report", hint: "Best for archival" },
];
```

- [ ] **Step 2: Remove the CSV branch from `handleExport`**

In the same file, find the `handleExport` function starting at line 336. Locate the `else if (format === "csv") { … }` block (approximately lines 380–397) and delete it entirely. The structure becomes:

```js
      if (format === "pdf") {
        const { buildAnalyticsPDF } = await import("../analytics/analyticsExport");
        const doc = await buildAnalyticsPDF(exportParams, { periodName, organization: orgName, department: deptName });
        doc.save(buildExportFilename("Analytics", periodName || "all", "pdf", tc));
      } else {
        const { buildAnalyticsWorkbook } = await import("../analytics/analyticsExport");
        const XLSX = await import("xlsx-js-style");
        const wb = buildAnalyticsWorkbook(exportParams);
        XLSX.writeFile(wb, buildExportFilename("Analytics", periodName || "all", "xlsx", tc));
      }
```

Also simplify the toast label on approximately line 404:

```js
      const fmtLabel = format === "pdf" ? "PDF" : format === "csv" ? "CSV" : "Excel";
```

Change to:

```js
      const fmtLabel = format === "pdf" ? "PDF" : "Excel";
```

- [ ] **Step 3: Remove the CSV branch from `generateAnalyticsFile`**

Find the `generateAnalyticsFile` arrow function at line 412. Delete the `else if (fmt === "csv") { … }` block (approximately lines 431–442). The structure becomes:

```js
    if (fmt === "pdf") {
      const { buildAnalyticsPDF } = await import("../analytics/analyticsExport");
      const doc = await buildAnalyticsPDF(exportParams, { periodName, organization: orgName, department: deptName });
      const arrayBuf = doc.output("arraybuffer");
      const blob = new Blob([arrayBuf], { type: "application/pdf" });
      const fileName = buildExportFilename("Analytics", periodName || "all", "pdf", tc);
      return { blob, fileName, mimeType: "application/pdf" };
    } else {
      const { buildAnalyticsWorkbook } = await import("../analytics/analyticsExport");
      const XLSX = await import("xlsx-js-style");
      const wb = buildAnalyticsWorkbook(exportParams);
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = buildExportFilename("Analytics", periodName || "all", "xlsx", tc);
      return { blob, fileName, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }
```

- [ ] **Step 4: Add a regression test to pin the format list**

Append to `src/admin/__tests__/analyticsDatasets.new.test.js`:

```js
import fs from "fs";
import path from "path";

describe("AnalyticsPage export panel options", () => {
  qaTest("analytics.export.sections.03", () => {
    // Guard: ensure AnalyticsPage.jsx does not re-introduce CSV as an analytics
    // export option. The multi-section Analytics report has no sensible CSV
    // representation; users get XLSX + PDF.
    const src = fs.readFileSync(
      path.resolve(__dirname, "../pages/AnalyticsPage.jsx"),
      "utf8",
    );
    // Isolate the ANALYTICS_EXPORT_FORMATS array block.
    const match = src.match(/ANALYTICS_EXPORT_FORMATS\s*=\s*\[([\s\S]*?)\]/);
    expect(match).not.toBeNull();
    const block = match[1];
    expect(block).toMatch(/id:\s*"xlsx"/);
    expect(block).toMatch(/id:\s*"pdf"/);
    expect(block).not.toMatch(/id:\s*"csv"/);
  });
});
```

- [ ] **Step 5: Run the new test**

Run: `npm test -- --run src/admin/__tests__/analyticsDatasets.new.test.js`
Expected: `analytics.export.sections.03` PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Smoke test**

In the running `npm run dev` instance:
1. Click **Export** on Analytics page.
2. Verify only two format tiles appear: **Excel (.xlsx)** and **PDF Report**.
3. Download XLSX → open it → verify the sheet list matches: `Attainment Status`, `Attainment Rate`, `Threshold Gap`, `Outcome Achievement`, `Rubric Achievement Dist.`, `Programme-Level Averages`, `Group Heatmap`, `Juror Consistency`, `Coverage Matrix` (Trend appears only when ≥2 periods).
4. Click **Send Report** → pick a format → verify no CSV option; Excel and PDF both produce valid blobs.

- [ ] **Step 8: Stage**

```bash
git add src/admin/pages/AnalyticsPage.jsx src/admin/__tests__/analyticsDatasets.new.test.js
```

Commit message: `feat(analytics): drop CSV export from Analytics page`

---

## Task 9: Delete unused dataset builders

**Files:**
- Modify: `src/admin/analytics/analyticsDatasets.js` (delete two exports)

`buildCompetencyProfilesDataset` and `buildCriterionBoxplotDataset` are now referenced nowhere (confirmed via grep in Task 0 context). Remove them so the module does not carry dead code.

- [ ] **Step 1: Confirm non-use one more time**

Run: `git grep -n 'buildCompetencyProfilesDataset\|buildCriterionBoxplotDataset' -- 'src/'`
Expected: output contains ONLY definitions in `src/admin/analytics/analyticsDatasets.js` (no callers anywhere).

If any caller exists outside `analyticsDatasets.js`, STOP and investigate — someone added a new dependency and this plan needs a delta.

- [ ] **Step 2: Delete the two functions**

In `src/admin/analytics/analyticsDatasets.js`, delete the `export function buildCompetencyProfilesDataset(...)` block (currently lines 125–151) and the `export function buildCriterionBoxplotDataset(...)` block (currently lines 193–231). Do not remove the `buildBoxplotStats` import from `shared/stats` — other non-export code may use it (verify with `git grep buildBoxplotStats -- src/` if uncertain).

Actually **verify before removing imports:**

Run: `git grep -n 'buildBoxplotStats' -- 'src/'`
If the only reference is inside the function you just deleted, remove `buildBoxplotStats` from the top-of-file import list too.

- [ ] **Step 3: Build + test**

Run: `npm run build && npm test -- --run`
Expected: both succeed.

- [ ] **Step 4: Stage**

```bash
git add src/admin/analytics/analyticsDatasets.js
```

Commit message: `chore(analytics): remove unused competency/boxplot dataset builders`

---

## Task 10: Full verification pass

**Files:** none (validation only)

- [ ] **Step 1: Full unit test suite**

Run: `npm test -- --run`
Expected: all tests PASS, including the new `analytics.dataset.*` and `analytics.export.sections.*` entries.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: success, no warnings about missing imports or dead exports.

- [ ] **Step 3: `no-native-select` guard**

Per CLAUDE.md: `npm run check:no-native-select`
Expected: PASS (we didn't touch any `<select>`).

- [ ] **Step 4: Live manual verification**

In a running `npm run dev` session on an environment with real submitted data:

- [ ] XLSX export produces sheets in this order: Attainment Status · Attainment Rate · Threshold Gap · Outcome Achievement · Rubric Achievement Dist. · Programme-Level Averages · (Trend — only if ≥2 periods) · Group Heatmap · Juror Consistency · Coverage Matrix.
- [ ] XLSX no longer includes: Competency / Score Distribution (boxplot) sheets.
- [ ] PDF export begins with the Attainment Status card strip + table on page 1.
- [ ] PDF Threshold Gap page has both chart image AND a data table below it.
- [ ] PDF Group Heatmap page has both chart image AND a data table below it.
- [ ] Analytics export panel shows two tiles: Excel, PDF. No CSV.
- [ ] SendReportModal still works for both Excel and PDF.
- [ ] No console errors during export.

- [ ] **Step 5: Stage any remaining files (catalog entries, housekeeping)**

Run: `git status`
If anything is still unstaged, review and decide whether it belongs in this change.

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| `ANALYTICS_SECTIONS` single source of truth | Task 6 |
| §01 Attainment Status — new XLSX sheet | Task 2, Task 6 |
| §01 Attainment Status — new PDF page (chart + table) | Task 5 (DOM id), Task 7 |
| §02b Threshold Gap — new XLSX sheet | Task 3, Task 6 |
| §02b Threshold Gap — table in PDF | Task 7 |
| §06a Group Heatmap — new XLSX sheet | Task 4, Task 6 |
| §06a Group Heatmap — table in PDF | Task 7 |
| Sections skipped when zero rows | Task 6 (`shouldInclude`) |
| Competency Profiles / Criterion Boxplot removed from XLSX | Task 6 (no longer in SECTIONS), Task 9 (builder deletion) |
| CSV removed from Analytics ExportPanel | Task 8 |
| CSV removed from `handleExport` | Task 8 |
| CSV removed from `generateAnalyticsFile` | Task 8 |
| Reviews/Rankings/Heatmap/ExportPage CSV untouched | (no task touches them) |
| CSV import flow untouched | (no task touches `csvParser.js`, import modals, SetupWizardPage) |
| `SendReportModal`, `buildExportFilename`, `captureChartImage`, PDF style preserved | (no task modifies them) |
| Insight-banner narrative NOT exported | Task 2 (only summary counts included), Task 7 (no banner text in PDF) |

No gaps identified.

### Type / signature consistency

- `buildAttainmentStatusDataset` — single params object; tests + section builder + contract all agree.
- `buildThresholdGapDataset` — single params object; tests + section builder + contract all agree.
- `buildGroupHeatmapDataset` — single params object; tests + section builder + contract all agree.
- `ANALYTICS_SECTIONS[].build(params)` contract consistent across all 10 entries.
- `shouldInclude(dataset)` predicate — 2 sections override; others fall back to `defaultShouldInclude`.
- `params` keys consumed: `submittedData`, `dashboardStats`, `trendData`, `semesterOptions`, `trendSemesterIds`, `activeOutcomes`, `outcomeLookup`, `threshold`, `priorPeriodStats` — matches the `exportParams` object already assembled in `AnalyticsPage.handleExport` / `generateAnalyticsFile` (which passes `deltaRows`-derived values through for `priorPeriodStats`). **Note:** `AnalyticsPage` currently does NOT pass `priorPeriodStats` into `exportParams` — it passes `deltaRows` implicitly via the card calculation but not to the export. This is a gap; see Task 6b note below.

### One addition based on self-review

`AnalyticsPage.handleExport` and `generateAnalyticsFile` build `exportParams` without `priorPeriodStats`. The new `buildAttainmentStatusDataset` accepts `priorPeriodStats` as optional — when absent, the delta column is omitted. This is intentional and correct: the first release ships without delta in exports. If the user wants delta, a follow-up plan can wire it up by extracting the `[currentTrend, prevTrend]` shape into `exportParams.priorPeriodStats` in `AnalyticsPage`. No task is needed in this plan for that; the builder's contract already accommodates it.

### Placeholder scan

- No TBDs, no "add appropriate …", no "similar to task N", no undefined references. ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-analytics-exports-content-redesign.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
