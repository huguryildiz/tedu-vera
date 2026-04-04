# PDF Vector Chart Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace html2canvas rasterization with svg2pdf.js vector embedding for recharts SVG charts, and upgrade raster capture quality for CSS/HTML charts.

**Architecture:** 3 recharts SVG charts embed as vectors via svg2pdf.js. All other charts (CSS-based, HTML table) stay raster but upgrade to scale 3 + PNG. Each section in analyticsExport.js declares its capture method. svg2pdf.js failures fall back to improved raster capture.

**Tech Stack:** svg2pdf.js 2.7.0, jsPDF (existing), html2canvas (existing), recharts (existing)

**Spec correction:** The trend section (`pdf-chart-trend`) renders `OutcomeAttainmentHeatmap` (HTML table), not `AttainmentTrendChart` (recharts). Only 3 charts are SVG: OutcomeByGroupChart, ProgrammeAveragesChart, RubricAchievementChart.

---

### Task 1: Install svg2pdf.js dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install svg2pdf.js**

```bash
npm install svg2pdf.js@^2.7.0
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('svg2pdf.js'); console.log('ok')"
```

Expected: `ok` (no errors)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add svg2pdf.js for vector chart embedding in PDF export"
```

---

### Task 2: Upgrade raster capture quality (scale 3 + PNG)

**Files:**
- Modify: `src/admin/analytics/captureChartImage.js`

- [ ] **Step 1: Update captureChartImage.js**

Replace the entire file with:

```js
// src/admin/analytics/captureChartImage.js
// ============================================================
// Captures a chart DOM element as a PNG data URL for PDF embedding.
// Applies pdf-capture-mode class transiently to force a light/white background.
// ============================================================

/**
 * Captures a chart element as a PNG data URL for PDF embedding.
 * Temporarily applies the pdf-capture-mode class to ensure a light background
 * during capture, then removes it regardless of success or failure.
 *
 * @param {string} elementId - DOM element ID to capture
 * @returns {Promise<{dataURL: string, width: number, height: number}|null>}
 */
export async function captureChartImage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  el.classList.add("pdf-capture-mode");
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 3,
      useCORS: true,
      logging: false,
    });
    return { dataURL: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } finally {
    el.classList.remove("pdf-capture-mode");
  }
}
```

Changes from original:
- `scale: 1.5` → `scale: 3`
- `canvas.toDataURL("image/jpeg", 0.85)` → `canvas.toDataURL("image/png")`

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/admin/analytics/captureChartImage.js
git commit -m "fix(pdf): upgrade raster capture to scale 3 + PNG for sharper chart images"
```

---

### Task 3: Create captureSvgForPdf module

**Files:**
- Create: `src/admin/analytics/captureSvgForPdf.js`

- [ ] **Step 1: Create the file**

```js
// src/admin/analytics/captureSvgForPdf.js
// ============================================================
// Embeds a recharts SVG element directly into a jsPDF document
// as vector graphics via svg2pdf.js. Falls back to raster on failure.
// ============================================================

/**
 * Style properties that must be inlined for svg2pdf.js to render correctly.
 * svg2pdf.js cannot read CSS variables or stylesheet rules — only inline attrs.
 */
const INLINE_PROPS = [
  "fill",
  "stroke",
  "font-family",
  "font-size",
  "font-weight",
  "opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-dashoffset",
  "text-anchor",
  "dominant-baseline",
  "visibility",
];

/**
 * Recursively walks original and cloned element trees in parallel,
 * copying computed styles from original to clone as inline attributes.
 *
 * @param {Element} original - The live DOM element (used for getComputedStyle)
 * @param {Element} clone    - The cloned element (receives inline styles)
 */
function inlineStyles(original, clone) {
  if (!(original instanceof Element) || !(clone instanceof Element)) return;

  const computed = getComputedStyle(original);

  for (const prop of INLINE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== "none" && value !== "normal" && value !== "") {
      clone.setAttribute(prop, value);
    }
  }

  // Force font-family to Inter on text elements (matches PDF embedded font)
  const tag = clone.tagName.toLowerCase();
  if (tag === "text" || tag === "tspan") {
    clone.setAttribute("font-family", "Inter");
  }

  // Skip hidden elements entirely
  if (computed.display === "none" || computed.visibility === "hidden") {
    clone.setAttribute("visibility", "hidden");
    return;
  }

  // Recurse into children
  const origChildren = original.children;
  const cloneChildren = clone.children;
  const len = Math.min(origChildren.length, cloneChildren.length);
  for (let i = 0; i < len; i++) {
    inlineStyles(origChildren[i], cloneChildren[i]);
  }
}

/**
 * Embeds a recharts SVG chart into a jsPDF document as vector graphics.
 *
 * @param {string} elementId - DOM ID of the chart container (e.g. "pdf-chart-outcome-by-group")
 * @param {object} doc       - jsPDF document instance
 * @param {number} x         - X position in mm
 * @param {number} y         - Y position in mm
 * @param {number} width     - Target width in mm
 * @param {number} height    - Target height in mm
 * @returns {Promise<boolean>} true if SVG was embedded, false otherwise
 */
export async function captureSvgForPdf(elementId, doc, x, y, width, height) {
  const container = document.getElementById(elementId);
  if (!container) return false;

  const originalSvg = container.querySelector("svg");
  if (!originalSvg) return false;

  // Add pdf-capture-mode for dark-mode CSS resolution
  container.classList.add("pdf-capture-mode");

  try {
    // Deep-clone the SVG to avoid mutating the live DOM
    const clonedSvg = originalSvg.cloneNode(true);

    // Walk original + clone trees in parallel to copy computed styles
    inlineStyles(originalSvg, clonedSvg);

    // Ensure viewBox is set for proper scaling
    if (!clonedSvg.getAttribute("viewBox")) {
      const w = originalSvg.width.baseVal.value || originalSvg.clientWidth;
      const h = originalSvg.height.baseVal.value || originalSvg.clientHeight;
      if (w && h) {
        clonedSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      }
    }

    // Remove width/height attrs so svg2pdf uses our target dimensions
    clonedSvg.removeAttribute("width");
    clonedSvg.removeAttribute("height");

    // Lazy-import svg2pdf.js and embed
    const { svg2pdf } = await import("svg2pdf.js");
    await svg2pdf(clonedSvg, doc, { x, y, width, height });

    return true;
  } finally {
    container.classList.remove("pdf-capture-mode");
  }
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds. The module is only imported dynamically so no immediate side effects.

- [ ] **Step 3: Commit**

```bash
git add src/admin/analytics/captureSvgForPdf.js
git commit -m "feat(pdf): add captureSvgForPdf for vector chart embedding via svg2pdf.js"
```

---

### Task 4: Wire captureMethod into analyticsExport.js

**Files:**
- Modify: `src/admin/analytics/analyticsExport.js`

This is the integration task. The `sections` array gets a `captureMethod` property, and the section loop branches on it.

- [ ] **Step 1: Update the sections array**

In `buildAnalyticsPDF`, find the `sections` array (around line 165) and add `captureMethod` to each entry:

Replace:

```js
  const sections = [
    { title: "Outcome Attainment Rate",        note: "% of evaluations scoring ≥70% per programme outcome",                                                              chartId: "pdf-chart-attainment-rate",    ds: progAvg    },
    { title: "Threshold Gap Analysis",          note: "Deviation from 70% competency threshold per outcome",                                                              chartId: "pdf-chart-threshold-gap",      ds: progAvg    },
    { title: "Outcome Achievement by Group",    note: "Normalized score (0–100%) per criterion per project group — 70% threshold reference",                              chartId: "pdf-chart-outcome-by-group",   ds: outByGroup },
    { title: "Programme-Level Averages",        note: "Grand mean (%) ± 1σ per criterion with 70% threshold reference",                                                  chartId: "pdf-chart-programme-averages", ds: progAvg    },
    { title: "Group Attainment Heatmap",        note: "Normalized score (%) per outcome per project group — cells below 70% threshold are flagged",                      chartId: "pdf-chart-group-heatmap",      ds: outByGroup },
    { title: "Inter-Rater Consistency Heatmap", note: "Coefficient of variation (CV = σ/μ × 100%) per project group — CV >25% indicates poor agreement",                 chartId: "pdf-chart-juror-cv",           ds: jurorCV    },
    { title: "Rubric Achievement Distribution", note: "Performance band breakdown per criterion — continuous improvement evidence",                                        chartId: "pdf-chart-rubric",             ds: rubric     },
    { title: "Coverage Matrix",                 note: "Which programme outcomes are directly assessed by evaluation criteria",                                             chartId: "pdf-chart-coverage",           ds: mudek      },
    ...(trend.rows.length >= 2
      ? [{ title: "Attainment Trend", note: "Attainment rate (solid) and average score % (dashed) per programme outcome across evaluation periods", chartId: "pdf-chart-trend", ds: trend }]
      : []),
  ];
```

With:

```js
  const sections = [
    { title: "Outcome Attainment Rate",        note: "% of evaluations scoring ≥70% per programme outcome",                                                              chartId: "pdf-chart-attainment-rate",    ds: progAvg,    captureMethod: "raster" },
    { title: "Threshold Gap Analysis",          note: "Deviation from 70% competency threshold per outcome",                                                              chartId: "pdf-chart-threshold-gap",      ds: progAvg,    captureMethod: "raster" },
    { title: "Outcome Achievement by Group",    note: "Normalized score (0–100%) per criterion per project group — 70% threshold reference",                              chartId: "pdf-chart-outcome-by-group",   ds: outByGroup, captureMethod: "svg"    },
    { title: "Programme-Level Averages",        note: "Grand mean (%) ± 1σ per criterion with 70% threshold reference",                                                  chartId: "pdf-chart-programme-averages", ds: progAvg,    captureMethod: "svg"    },
    { title: "Group Attainment Heatmap",        note: "Normalized score (%) per outcome per project group — cells below 70% threshold are flagged",                      chartId: "pdf-chart-group-heatmap",      ds: outByGroup, captureMethod: "raster" },
    { title: "Inter-Rater Consistency Heatmap", note: "Coefficient of variation (CV = σ/μ × 100%) per project group — CV >25% indicates poor agreement",                 chartId: "pdf-chart-juror-cv",           ds: jurorCV,    captureMethod: "raster" },
    { title: "Rubric Achievement Distribution", note: "Performance band breakdown per criterion — continuous improvement evidence",                                        chartId: "pdf-chart-rubric",             ds: rubric,     captureMethod: "svg"    },
    { title: "Coverage Matrix",                 note: "Which programme outcomes are directly assessed by evaluation criteria",                                             chartId: "pdf-chart-coverage",           ds: mudek,      captureMethod: "raster" },
    ...(trend.rows.length >= 2
      ? [{ title: "Attainment Trend", note: "Attainment rate (solid) and average score % (dashed) per programme outcome across evaluation periods", chartId: "pdf-chart-trend", ds: trend, captureMethod: "raster" }]
      : []),
  ];
```

- [ ] **Step 2: Replace the chart capture block in the section loop**

Find the chart image block inside the `for` loop (around line 209–221):

Replace:

```js
    // Chart image (gracefully skip on capture failure)
    try {
      const captured = await captureChartImage(chartId);
      if (captured) {
        const { dataURL, width, height } = captured;
        const chartImgH = Math.min(imgW / (width / height), pageH * 0.65);
        if (startY + chartImgH > pageH - 20) {
          doc.addPage();
          startY = 14;
        }
        doc.addImage(dataURL, "JPEG", margin, startY, imgW, chartImgH);
        startY += chartImgH + 6;
      }
    } catch (err) {
      console.error(`[PDF] Chart capture failed for ${chartId}:`, err);
    }
```

With:

```js
    // Chart image — SVG vector or raster depending on captureMethod
    if (captureMethod !== "none") {
      try {
        let embedded = false;

        if (captureMethod === "svg") {
          const { captureSvgForPdf } = await import("./captureSvgForPdf");
          // Get SVG aspect ratio from the DOM element
          const svgEl = document.getElementById(chartId)?.querySelector("svg");
          if (svgEl) {
            const svgW = svgEl.width.baseVal.value || svgEl.clientWidth || 1;
            const svgH = svgEl.height.baseVal.value || svgEl.clientHeight || 1;
            const chartImgH = Math.min(imgW * (svgH / svgW), pageH * 0.65);
            if (startY + chartImgH > pageH - 20) {
              doc.addPage();
              startY = 14;
            }
            embedded = await captureSvgForPdf(chartId, doc, margin, startY, imgW, chartImgH);
            if (embedded) startY += chartImgH + 6;
          }
        }

        // Raster fallback (also used for captureMethod === "raster")
        if (!embedded) {
          const captured = await captureChartImage(chartId);
          if (captured) {
            const { dataURL, width, height } = captured;
            const chartImgH = Math.min(imgW / (width / height), pageH * 0.65);
            if (startY + chartImgH > pageH - 20) {
              doc.addPage();
              startY = 14;
            }
            doc.addImage(dataURL, "PNG", margin, startY, imgW, chartImgH);
            startY += chartImgH + 6;
          }
        }
      } catch (err) {
        console.error(`[PDF] Chart capture failed for ${chartId}:`, err);
      }
    }
```

- [ ] **Step 3: Destructure captureMethod in the loop**

Find the destructuring line inside the for loop (around line 185):

Replace:

```js
    const { title, note, chartId, ds } = sections[i];
```

With:

```js
    const { title, note, chartId, ds, captureMethod } = sections[i];
```

- [ ] **Step 4: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Manual smoke test**

1. Run `npm run dev`
2. Open the app, navigate to admin Analytics tab
3. Click the PDF download button
4. Open the generated PDF and verify:
   - OutcomeByGroupChart (page 3–4): crisp vector bars, sharp text labels
   - ProgrammeAveragesChart (page 5): crisp vector bars with error bars
   - RubricAchievementChart (page 4): crisp stacked bars
   - AttainmentRate + ThresholdGap (page 2–3): improved raster (sharper than before)
   - Heatmaps and Coverage Matrix: improved raster quality
5. Zoom to 400% — SVG charts should remain perfectly sharp

- [ ] **Step 6: Commit**

```bash
git add src/admin/analytics/analyticsExport.js
git commit -m "feat(pdf): integrate svg2pdf.js vector embedding for recharts SVG charts

SVG charts (OutcomeByGroup, ProgrammeAverages, RubricAchievement) now
embed as vectors in PDF — infinitely sharp at any zoom level.
CSS/HTML charts fall back to improved raster (scale 3 + PNG).
svg2pdf.js failures gracefully fall back to raster capture."
```

---

### Task 5: Update design spec with corrected chart categorization

**Files:**
- Modify: `docs/superpowers/specs/2026-04-05-pdf-vector-charts-design.md`

- [ ] **Step 1: Fix the spec**

The spec incorrectly lists `AttainmentTrendChart` as SVG. The trend section (`pdf-chart-trend`) actually renders `OutcomeAttainmentHeatmap` (HTML table). Update the Chart Categories table and Section assignments table to reflect:

- Remove `AttainmentTrendChart` from the SVG group
- Attainment Trend captureMethod should be `raster`, not `svg`
- All heatmaps and coverage matrix should be `raster` (they need image capture for color-coded cells), not `none`

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-05-pdf-vector-charts-design.md
git commit -m "docs: correct chart categorization in pdf-vector-charts spec"
```
