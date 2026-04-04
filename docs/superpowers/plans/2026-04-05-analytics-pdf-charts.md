# Analytics PDF Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed chart images (captured via html2canvas) before each data table in the analytics PDF export.

**Architecture:** `captureChartImage(id)` — a new lazily-loaded helper — applies `pdf-capture-mode` CSS, runs html2canvas at 2× scale, removes the class, and returns a PNG data URL. `buildAnalyticsPDF` replaces its generic `datasets.forEach` loop with an explicit 9-section array (`{ title, chartId, ds }`), awaiting each capture before adding the image and the autotable below it. Chart bodies in `AnalyticsPage.jsx` get stable `id="pdf-chart-*"` attributes as DOM anchors.

**Tech Stack:** html2canvas ^1.4.1 (lazy import), jspdf + jspdf-autotable (existing), CSS class toggling

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add html2canvas dependency |
| `src/admin/analytics/captureChartImage.js` | Create | DOM-to-PNG capture helper |
| `src/admin/__tests__/captureChartImage.test.js` | Create | Unit tests for capture helper |
| `src/styles/pages/analytics.css` | Modify | Add `.pdf-capture-mode` overrides |
| `src/admin/pages/AnalyticsPage.jsx` | Modify | Add `id="pdf-chart-*"` to chart body divs |
| `src/admin/analytics/analyticsExport.js` | Modify | Replace table-only loop with chart-then-table sections |

---

### Task 1: Install html2canvas

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install html2canvas@^1.4.1
```

Expected output: `added 1 package` (or similar) with no errors.

- [ ] **Step 2: Verify it appears in package.json**

```bash
grep html2canvas package.json
```

Expected: `"html2canvas": "^1.4.1"` in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(analytics): add html2canvas for PDF chart capture"
```

---

### Task 2: Add pdf-capture-mode CSS

**Files:**

- Modify: `src/styles/pages/analytics.css`

- [ ] **Step 1: Append the capture-mode block after the dark mode coverage overrides (after line 396)**

Add these rules at the end of the dark mode coverage block in `src/styles/pages/analytics.css` (after the last `.dark-mode .coverage-summary-stat` rule):

```css

/* ── PDF capture mode ─────────────────────────────────────────── */
/* Applied transiently during PDF capture to force light background */
.pdf-capture-mode,
.pdf-capture-mode * {
  background-color: #ffffff !important;
  color: #1e293b !important;
  border-color: #e2e8f0 !important;
  box-shadow: none !important;
}
.pdf-capture-mode .ga-cell-high       { background: rgba(16,185,129,0.18) !important; color: #047857 !important; }
.pdf-capture-mode .ga-cell-met        { background: rgba(16,185,129,0.10) !important; color: #059669 !important; }
.pdf-capture-mode .ga-cell-borderline { background: rgba(217,119,6,0.14)  !important; color: #b45309 !important; }
.pdf-capture-mode .ga-cell-not-met    { background: rgba(220,38,38,0.12)  !important; color: #b91c1c !important; }
.pdf-capture-mode .coverage-chip.direct   { background: rgba(22,163,74,0.12)  !important; color: #166534 !important; }
.pdf-capture-mode .coverage-chip.indirect { background: rgba(217,119,6,0.12)  !important; color: #92400e !important; }
```

- [ ] **Step 2: Build to confirm no CSS syntax errors**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/pages/analytics.css
git commit -m "feat(analytics): add pdf-capture-mode CSS for light-mode PDF capture"
```

---

### Task 3: Write captureChartImage tests (failing first)

**Files:**

- Create: `src/admin/__tests__/captureChartImage.test.js`

- [ ] **Step 1: Add the QA catalog entry**

In `src/test/qa-catalog.json`, add inside the array:

```json
{ "id": "analytics.pdf.capture.01", "description": "captureChartImage returns null when element not found" },
{ "id": "analytics.pdf.capture.02", "description": "captureChartImage applies and removes pdf-capture-mode class" },
{ "id": "analytics.pdf.capture.03", "description": "captureChartImage returns data URL string on success" }
```

- [ ] **Step 2: Write the failing tests**

Create `src/admin/__tests__/captureChartImage.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// Mock html2canvas before importing the module under test
const mockToDataURL = vi.fn(() => "data:image/png;base64,FAKE");
const mockCanvas = { toDataURL: mockToDataURL };
const mockHtml2canvas = vi.fn(() => Promise.resolve(mockCanvas));

vi.mock("html2canvas", () => ({ default: mockHtml2canvas }));

// Import after mock registration
const { captureChartImage } = await import("../analytics/captureChartImage.js");

describe("captureChartImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  qaTest("analytics.pdf.capture.01", async () => {
    const result = await captureChartImage("non-existent-id");
    expect(result).toBeNull();
    expect(mockHtml2canvas).not.toHaveBeenCalled();
  });

  qaTest("analytics.pdf.capture.02", async () => {
    const div = document.createElement("div");
    div.id = "test-chart";
    document.body.appendChild(div);

    let classWasAdded = false;
    const origAdd = div.classList.add.bind(div.classList);
    vi.spyOn(div.classList, "add").mockImplementation((cls) => {
      if (cls === "pdf-capture-mode") classWasAdded = true;
      origAdd(cls);
    });

    await captureChartImage("test-chart");

    expect(classWasAdded).toBe(true);
    // Class must be removed after capture
    expect(div.classList.contains("pdf-capture-mode")).toBe(false);
  });

  qaTest("analytics.pdf.capture.03", async () => {
    const div = document.createElement("div");
    div.id = "test-chart-2";
    document.body.appendChild(div);

    const result = await captureChartImage("test-chart-2");

    expect(mockHtml2canvas).toHaveBeenCalledWith(div, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    expect(result).toBe("data:image/png;base64,FAKE");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail (module not found)**

```bash
npm test -- --run src/admin/__tests__/captureChartImage.test.js
```

Expected: FAIL — `captureChartImage.js` does not exist yet.

---

### Task 4: Create captureChartImage.js

**Files:**

- Create: `src/admin/analytics/captureChartImage.js`

- [ ] **Step 1: Create the file**

```js
// src/admin/analytics/captureChartImage.js
// Captures a chart DOM element as a PNG data URL for PDF embedding.
// Applies pdf-capture-mode class transiently to force a light/white background.

export async function captureChartImage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  el.classList.add("pdf-capture-mode");
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } finally {
    el.classList.remove("pdf-capture-mode");
  }
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test -- --run src/admin/__tests__/captureChartImage.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
npm test -- --run
```

Expected: all previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/admin/analytics/captureChartImage.js src/admin/__tests__/captureChartImage.test.js src/test/qa-catalog.json
git commit -m "feat(analytics): add captureChartImage helper with tests"
```

---

### Task 5: Add pdf-chart-* IDs to AnalyticsPage.jsx

**Files:**

- Modify: `src/admin/pages/AnalyticsPage.jsx`

Add `id` props to the nine `.chart-body` divs. Each ID is placed on the div that directly wraps the chart component (not the outer `.chart-card-v2`).

- [ ] **Step 1: AttainmentRateChart body (around line 517)**

Find:
```jsx
          <div className="chart-body">
            <AttainmentRateChart submittedData={submittedData} criteria={criteria} />
```

Replace with:
```jsx
          <div className="chart-body" id="pdf-chart-attainment-rate">
            <AttainmentRateChart submittedData={submittedData} criteria={criteria} />
```

- [ ] **Step 2: ThresholdGapChart body (around line 538)**

Find:
```jsx
          <div className="chart-body">
            <ThresholdGapChart submittedData={submittedData} criteria={criteria} />
```

Replace with:
```jsx
          <div className="chart-body" id="pdf-chart-threshold-gap">
            <ThresholdGapChart submittedData={submittedData} criteria={criteria} />
```

- [ ] **Step 3: OutcomeByGroupChart body (around line 569)**

Find:
```jsx
        <div className="chart-body">
          <OutcomeByGroupChart dashboardStats={dashboardStats} criteria={criteria} />
```

Replace with:
```jsx
        <div className="chart-body" id="pdf-chart-outcome-by-group">
          <OutcomeByGroupChart dashboardStats={dashboardStats} criteria={criteria} />
```

- [ ] **Step 4: RubricAchievementChart body (around line 608)**

Find:
```jsx
          <div className="chart-body">
            <RubricAchievementChart submittedData={submittedData} criteria={criteria} />
```

Replace with:
```jsx
          <div className="chart-body" id="pdf-chart-rubric">
            <RubricAchievementChart submittedData={submittedData} criteria={criteria} />
```

- [ ] **Step 5: ProgrammeAveragesChart body (around line 626)**

Find:
```jsx
          <div className="chart-body">
            <ProgrammeAveragesChart submittedData={submittedData} criteria={criteria} />
```

Replace with:
```jsx
          <div className="chart-body" id="pdf-chart-programme-averages">
            <ProgrammeAveragesChart submittedData={submittedData} criteria={criteria} />
```

- [ ] **Step 6: OutcomeAttainmentHeatmap/trend body (around line 664)**

Find:
```jsx
          <div className="chart-body">
            {outcomeTrendLoading ? (
```

Replace with:
```jsx
          <div className="chart-body" id="pdf-chart-trend">
            {outcomeTrendLoading ? (
```

- [ ] **Step 7: GroupAttainmentHeatmap body (around line 701)**

Find:
```jsx
        <div className="chart-body">
          <GroupAttainmentHeatmap dashboardStats={dashboardStats} submittedData={submittedData} criteria={criteria} />
```

Replace with:
```jsx
        <div className="chart-body" id="pdf-chart-group-heatmap">
          <GroupAttainmentHeatmap dashboardStats={dashboardStats} submittedData={submittedData} criteria={criteria} />
```

- [ ] **Step 8: JurorConsistencyHeatmap body (around line 726)**

Find:
```jsx
        <div className="chart-body">
          <JurorConsistencyHeatmap dashboardStats={dashboardStats} submittedData={submittedData} criteria={criteria} />
```

Replace with:
```jsx
        <div className="chart-body" id="pdf-chart-juror-cv">
          <JurorConsistencyHeatmap dashboardStats={dashboardStats} submittedData={submittedData} criteria={criteria} />
```

- [ ] **Step 9: CoverageMatrix body (around line 751)**

Find:
```jsx
        <div className="chart-body" style={{ overflowX: "auto" }}>
          <CoverageMatrix criteria={criteria} outcomes={outcomeConfig} />
```

Replace with:
```jsx
        <div className="chart-body" id="pdf-chart-coverage" style={{ overflowX: "auto" }}>
          <CoverageMatrix criteria={criteria} outcomes={outcomeConfig} />
```

- [ ] **Step 10: Build to confirm no JSX errors**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/admin/pages/AnalyticsPage.jsx
git commit -m "feat(analytics): add pdf-chart-* DOM IDs to chart body divs"
```

---

### Task 6: Refactor buildAnalyticsPDF to include chart images

**Files:**

- Modify: `src/admin/analytics/analyticsExport.js:112-227`

- [ ] **Step 1: Replace the buildAnalyticsPDF function body**

The new function keeps the same signature. Replace everything from line 112 to 227 with the following. Leave all code above line 112 (imports, helpers, `addTableSheet`, `buildDatasets`, `buildAnalyticsWorkbook`, `arrayBufferToBase64`, `registerInterFont`, `loadLogoBase64`) untouched.

```js
export async function buildAnalyticsPDF(params, { periodName = "", organization = "", department = "" } = {}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { captureChartImage } = await import("./captureChartImage");

  const {
    dashboardStats, submittedData, trendData, semesterOptions,
    trendSemesterIds, activeOutcomes, mudekLookup,
  } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerInterFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  // Logo
  try {
    const logoData = await loadLogoBase64();
    doc.addImage(logoData, "PNG", 14, 10, 28, 9);
  } catch { /* logo load failed — continue without */ }

  // Cover / title
  const metaParts = [organization, department, periodName].filter(Boolean);
  doc.setFontSize(18);
  doc.text("Programme Outcome Analytics", 46, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(metaParts.join(" · ") || "All Periods", 46, 22);
  doc.setFontSize(8);
  doc.text(`Generated ${dateStr}`, pageW - 14, 14, { align: "right" });
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(200);
  doc.line(14, 26, pageW - 14, 26);

  const tableFont = { font: "Inter", fontSize: 7, cellPadding: 1.5, overflow: "linebreak" };
  const headFont = { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "normal", fontSize: 7, valign: "middle" };
  const pdfHeader = (h) => String(h).replace(/\s*(\(\d+\))$/, "\n$1");
  const margin = 14;
  const imgW = pageW - margin * 2;
  const imgH = (imgW * 9) / 16;

  // Build all datasets upfront
  const progAvg    = buildProgrammeAveragesDataset(submittedData, activeOutcomes);
  const outByGroup = buildOutcomeByGroupDataset(dashboardStats, activeOutcomes);
  const jurorCV    = buildJurorConsistencyDataset(dashboardStats, submittedData, activeOutcomes);
  const rubric     = buildRubricAchievementDataset(submittedData, activeOutcomes);
  const mudek      = buildMudekMappingDataset(activeOutcomes, mudekLookup);
  const trend      = buildTrendDataset(trendData, semesterOptions, trendSemesterIds, activeOutcomes);

  const sections = [
    { title: "Outcome Attainment Rate",        chartId: "pdf-chart-attainment-rate",    ds: progAvg    },
    { title: "Threshold Gap Analysis",          chartId: "pdf-chart-threshold-gap",      ds: progAvg    },
    { title: "Outcome Achievement by Group",    chartId: "pdf-chart-outcome-by-group",   ds: outByGroup },
    { title: "Programme-Level Averages",        chartId: "pdf-chart-programme-averages", ds: progAvg    },
    { title: "Group Attainment Heatmap",        chartId: "pdf-chart-group-heatmap",      ds: outByGroup },
    { title: "Juror Reliability (CV)",          chartId: "pdf-chart-juror-cv",           ds: jurorCV    },
    { title: "Rubric Achievement Distribution", chartId: "pdf-chart-rubric",             ds: rubric     },
    { title: "Outcome Coverage Matrix",         chartId: "pdf-chart-coverage",           ds: mudek      },
    ...(trend.rows.length >= 2
      ? [{ title: "Attainment Trend", chartId: "pdf-chart-trend", ds: trend }]
      : []),
  ];

  let startY = 32;

  for (let i = 0; i < sections.length; i++) {
    const { title, chartId, ds } = sections[i];

    if (!ds.rows.length) continue;

    // Page break check before section title
    if (startY > pageH - 60) {
      doc.addPage();
      startY = 14;
    }

    // Section title
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(title, margin, startY);
    startY += 6;

    if (ds.note) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(ds.note, margin, startY, { maxWidth: imgW });
      doc.setTextColor(0);
      startY += 6;
    }

    // Chart image (gracefully skip on capture failure)
    try {
      const imgData = await captureChartImage(chartId);
      if (imgData) {
        if (startY + imgH > pageH - 20) {
          doc.addPage();
          startY = 14;
        }
        doc.addImage(imgData, "PNG", margin, startY, imgW, imgH);
        startY += imgH + 6;
      }
    } catch (err) {
      console.error(`[PDF] Chart capture failed for ${chartId}:`, err);
    }

    // Data table
    if (ds.headers && ds.rows.length) {
      if (startY > pageH - 30) {
        doc.addPage();
        startY = 14;
      }
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
      startY = doc.lastAutoTable.finalY + 8;
    }

    // Page break after each section except the last
    if (i < sections.length - 1) {
      doc.addPage();
      startY = 14;
    }
  }

  // Footer on every page
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`VERA Analytics Report · ${periodName || "All Periods"} · Page ${p}/${totalPages}`, margin, pageH - 6);
    doc.text(dateStr, pageW - margin, pageH - 6, { align: "right" });
  }

  return doc;
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Build to confirm no import/type errors**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/admin/analytics/analyticsExport.js
git commit -m "feat(analytics): embed chart images in PDF export before each data table"
```

---

### Task 7: Smoke test in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to the Analytics page**

Open `http://localhost:5173/?admin`, log in, open the Scores tab → Analytics sub-tab. Ensure at least one evaluation period with score data is selected.

- [ ] **Step 3: Export as PDF**

Click the export button and select PDF. The export should complete without errors.

- [ ] **Step 4: Verify PDF contents**

Open the downloaded PDF. Each of the sections present should show:

1. Section title (text)
2. Chart image (screenshot of the SVG/HTML chart, white background)
3. Data table below the image

Sections whose chart element is not in the DOM (e.g. Trend section if fewer than 2 periods selected) should render data table only without crashing.

- [ ] **Step 5: Verify dark mode**

Enable dark mode in the app. Re-export the PDF. The chart images in the PDF should still have white backgrounds (not dark), confirming `pdf-capture-mode` is working.
