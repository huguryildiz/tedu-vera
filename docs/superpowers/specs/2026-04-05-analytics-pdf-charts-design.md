# Analytics PDF Export — Charts + Data Tables

**Date:** 2026-04-05
**Status:** Approved

---

## Problem

The current PDF export (`buildAnalyticsPDF`) includes only structured data tables.
Chart visuals are absent, making the report harder to interpret at a glance.
The goal is to include both the rendered chart image and its corresponding data table
for each analytics section in the PDF.

---

## Approach

Use `html2canvas` to capture each chart's DOM container as a PNG image.
Before capture, apply a `pdf-capture-mode` CSS class to force a light/white background
so the PDF is print-friendly regardless of the user's current color mode.
After capture, remove the class.

Each PDF section becomes:

```
┌──────────────────────────────────────┐
│  Section title                       │
├──────────────────────────────────────┤
│  Chart image (captured PNG)          │
│                                      │
├──────────────────────────────────────┤
│  Data table (jsPDF-autotable)        │
│  Col A | Col B | Col C | ...         │
├──────────────────────────────────────┘
  ← page break → next section
```

---

## Sections Included

| # | Section Title | Chart Component | Data Table (existing dataset) |
|---|---|---|---|
| 1 | Outcome Attainment Rate | `AttainmentRateChart` | `buildProgrammeAveragesDataset` |
| 2 | Threshold Gap Analysis | `ThresholdGapChart` | `buildProgrammeAveragesDataset` |
| 3 | Outcome Achievement by Group | `OutcomeByGroupChart` | `buildOutcomeByGroupDataset` |
| 4 | Programme-Level Averages | `ProgrammeAveragesChart` | `buildProgrammeAveragesDataset` |
| 5 | Group Attainment Heatmap | `GroupAttainmentHeatmap` | `buildOutcomeByGroupDataset` |
| 6 | Juror Reliability (CV) | `JurorConsistencyHeatmap` | `buildJurorConsistencyDataset` |
| 7 | Rubric Achievement Distribution | `RubricAchievementChart` | `buildRubricAchievementDataset` |
| 8 | Outcome Coverage Matrix | `CoverageMatrix` | `buildMudekMappingDataset` |
| 9 | Attainment Trend *(if ≥2 periods)* | `AttainmentTrendChart` | `buildTrendDataset` |

> Sections 1, 2, and 4 share `buildProgrammeAveragesDataset` — visually distinct charts
> (bar, lollipop, line) map to the same underlying per-outcome average data.
> Sections 3 and 5 share `buildOutcomeByGroupDataset` — group-level scores rendered
> differently (bar chart vs heatmap).

---

## Architecture

### New dependency

```
html2canvas  ^1.4.1
```

Loaded lazily via `import('html2canvas')` inside the export function so it does not
affect the main bundle.

### DOM ID anchors

Each chart container in `AnalyticsPage.jsx` gets a stable `id` attribute:

```
id="pdf-chart-attainment-rate"
id="pdf-chart-threshold-gap"
id="pdf-chart-outcome-by-group"
id="pdf-chart-programme-averages"
id="pdf-chart-group-heatmap"
id="pdf-chart-juror-cv"
id="pdf-chart-rubric"
id="pdf-chart-coverage"
id="pdf-chart-trend"
```

These IDs are on the `.chart-body` `div` that wraps the chart component —
not the outer `.chart-card-v2`, which has excess padding and header text.

### Capture helper (`captureChartImage`)

```js
// src/admin/analytics/captureChartImage.js
async function captureChartImage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  el.classList.add('pdf-capture-mode');
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,           // 2× for retina sharpness
    useCORS: true,
    logging: false,
  });
  el.classList.remove('pdf-capture-mode');
  return canvas.toDataURL('image/png');
}
```

### PDF layout helper (`addChartSection`)

Inside `buildAnalyticsPDF`, replace each section's current table-only call with:

```js
async function addChartSection(doc, { title, chartId, tableData, columns, meta }) {
  addSectionTitle(doc, title);            // existing helper
  const imgData = await captureChartImage(chartId);
  if (imgData) {
    // fit image to page width, maintain aspect ratio
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const imgW = pageW - margin * 2;
    const imgH = (imgW * 9) / 16;        // 16:9 default; override per chart
    doc.addImage(imgData, 'PNG', margin, doc.autoTable.previous?.finalY + 8 || 30, imgW, imgH);
    doc.setY(doc.autoTable.previous?.finalY + imgH + 12 || 30 + imgH + 12);
  }
  doc.autoTable({ head: [columns], body: tableData, ... });  // existing pattern
}
```

### CSS — `pdf-capture-mode`

Add to `src/styles/pages/analytics.css`:

```css
/* Applied transiently during PDF capture to force light background */
.pdf-capture-mode,
.pdf-capture-mode * {
  background-color: #ffffff !important;
  color: #1e293b !important;
  border-color: #e2e8f0 !important;
  box-shadow: none !important;
}
.pdf-capture-mode .ga-cell-high   { background: rgba(16,185,129,0.18) !important; color: #047857 !important; }
.pdf-capture-mode .ga-cell-met    { background: rgba(16,185,129,0.10) !important; color: #059669 !important; }
.pdf-capture-mode .ga-cell-borderline { background: rgba(217,119,6,0.14) !important; color: #b45309 !important; }
.pdf-capture-mode .ga-cell-not-met{ background: rgba(220,38,38,0.12)  !important; color: #b91c1c !important; }
.pdf-capture-mode .coverage-chip.direct   { background: rgba(22,163,74,0.12) !important; color: #166534 !important; }
.pdf-capture-mode .coverage-chip.indirect { background: rgba(217,119,6,0.12) !important; color: #92400e !important; }
```

---

## Export Flow (updated)

```
handleExport()
  → dynamically import buildAnalyticsPDF
  → for each section (1–9):
      captureChartImage(id)       ← async DOM capture
      addImage() to PDF
      autoTable() below image
      checkPageBreak()
  → save PDF file
```

Sections 1–8 always render. Section 9 (Trend) renders only when
`trendData` has at least 2 periods.

---

## Error Handling

- If `captureChartImage` returns `null` (element not in DOM, e.g. chart hidden
  behind a loading state), the section renders data table only — no crash.
- If `html2canvas` rejects, log the error and continue with table-only for that section.

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `html2canvas ^1.4.1` |
| `src/admin/analytics/captureChartImage.js` | New — capture helper |
| `src/admin/analytics/analyticsExport.js` | Replace table-only sections with chart + table |
| `src/admin/pages/AnalyticsPage.jsx` | Add `id="pdf-chart-*"` to chart body divs |
| `src/styles/pages/analytics.css` | Add `.pdf-capture-mode` overrides |
