// src/admin/analytics/analyticsExport.js
// Analytics export utilities (XLSX, CSV, PDF).
// Extracted from AnalyticsTab.jsx — structural refactor only.

import * as XLSX from "xlsx-js-style";
import interFontUrl from "@/assets/fonts/Inter-Subset.ttf?url";
import veraLogoUrl from "@/assets/vera_logo_pdf.png?url";
import {
  buildOutcomeByGroupDataset,
  buildProgrammeAveragesDataset,
  buildJurorConsistencyDataset,
  buildRubricAchievementDataset,
  buildCoverageMatrixDataset,
  buildAttainmentStatusDataset,
  buildAttainmentRateDataset,
  buildOutcomeAttainmentTrendExportDataset,
  buildThresholdGapDataset,
  buildGroupHeatmapDataset,
} from "./analyticsDatasets";

export function addTableSheet(wb, name, title, headers, rows, extraSections = [], note = "", merges = [], alignments = []) {
  const aoa = [
    [title],
    ...(note ? [[note]] : []),
    [],
    headers,
    ...rows,
  ];
  extraSections.forEach((section) => {
    if (!section) return;
    aoa.push([], [section.title], ...(section.note ? [[section.note]] : []), section.headers, ...section.rows);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (merges.length) {
    const headerRowIndex = 1 + (note ? 1 : 0) + 1;
    const dataStartRow = headerRowIndex + 1;
    const sheetMerges = merges.map((m) => ({
      s: { r: dataStartRow + m.start, c: m.col },
      e: { r: dataStartRow + m.end, c: m.col },
    }));
    ws["!merges"] = [...(ws["!merges"] || []), ...sheetMerges];
    if (alignments.length) {
      alignments.forEach((a) => {
        for (let r = a.start; r <= a.end; r += 1) {
          const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + r, c: a.col });
          const cell = ws[cellRef];
          if (!cell) continue;
          cell.s = cell.s || {};
          cell.s.alignment = {
            ...(cell.s.alignment || {}),
            vertical: a.valign || "center",
            horizontal: a.halign || "left",
          };
        }
      });
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export const ANALYTICS_SECTIONS = [
  {
    key: "attainment-status",
    title: "Outcome Attainment Status",
    chartId: "pdf-chart-attainment-status",
    build: (p) => buildAttainmentStatusDataset({
      submittedData: p.submittedData,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold ?? 70,
      priorPeriodStats: p.priorPeriodStats,
      outcomeLookup: p.outcomeLookup,
    }),
  },
  {
    key: "attainment-rate",
    title: "Outcome Attainment Rate",
    chartId: "pdf-chart-attainment-rate",
    build: (p) => buildAttainmentRateDataset({
      submittedData: p.submittedData,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold ?? 70,
      outcomeLookup: p.outcomeLookup,
    }),
  },
  {
    key: "threshold-gap",
    title: "Threshold Gap Analysis",
    chartId: "pdf-chart-threshold-gap",
    build: (p) => buildThresholdGapDataset({
      submittedData: p.submittedData,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold ?? 70,
    }),
  },
  {
    key: "outcome-by-group",
    title: "Outcome Achievement by Project",
    chartId: "pdf-chart-outcome-by-group",
    build: (p) => buildOutcomeByGroupDataset(p.dashboardStats, p.activeOutcomes),
  },
  {
    key: "rubric",
    title: "Rubric Achievement Distribution",
    chartId: "pdf-chart-rubric",
    build: (p) => buildRubricAchievementDataset(p.submittedData, p.activeOutcomes),
  },
  {
    key: "programme-averages",
    title: "Programme-Level Outcome Averages",
    chartId: "pdf-chart-programme-averages",
    build: (p) => buildProgrammeAveragesDataset(p.submittedData, p.activeOutcomes),
  },
  {
    key: "trend",
    title: "Outcome Attainment Trend",
    chartId: "pdf-chart-trend",
    build: (p) => buildOutcomeAttainmentTrendExportDataset(p.outcomeTrendData, p.periodOptions, p.trendPeriodIds),
    // Transposed layout: headers = [Outcome, Metric, ...periodCols]. Require ≥2 periods.
    conditional: (ds) => ds.headers.length - 2 >= 2,
  },
  {
    key: "group-heatmap",
    title: "Project Attainment Heatmap",
    chartId: "pdf-chart-group-heatmap",
    build: (p) => buildGroupHeatmapDataset({
      dashboardStats: p.dashboardStats,
      activeOutcomes: p.activeOutcomes,
      threshold: p.threshold ?? 70,
    }),
  },
  {
    key: "juror-cv",
    title: "Inter-Rater Consistency Heatmap",
    chartId: "pdf-chart-juror-cv",
    build: (p) => buildJurorConsistencyDataset(p.dashboardStats, p.submittedData, p.activeOutcomes),
  },
  {
    key: "coverage",
    title: "Coverage Matrix",
    chartId: "pdf-chart-coverage",
    build: (p) => buildCoverageMatrixDataset(p.activeOutcomes, p.outcomeList),
  },
];

export function buildAnalyticsWorkbook(params) {
  const wb = XLSX.utils.book_new();
  for (const section of ANALYTICS_SECTIONS) {
    const ds = section.build(params);
    if (!ds.rows.length) continue;
    if (section.conditional && !section.conditional(ds)) continue;
    addTableSheet(wb, ds.sheet, ds.title, ds.headers, ds.rows, ds.extra, ds.note, ds.merges, ds.alignments);
  }
  return wb;
}

// Convert ArrayBuffer to base64 (chunked to avoid stack overflow)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

let fontPromise = null;
async function registerInterFont(doc) {
  if (!fontPromise) fontPromise = fetch(interFontUrl).then((r) => r.arrayBuffer());
  const fontData = await fontPromise;
  const base64 = arrayBufferToBase64(fontData);
  doc.addFileToVFS("Inter.ttf", base64);
  doc.addFont("Inter.ttf", "Inter", "normal");
  doc.setFont("Inter");
}

let logoPromise = null;
async function loadLogoBase64() {
  if (!logoPromise) {
    logoPromise = fetch(veraLogoUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => "data:image/png;base64," + arrayBufferToBase64(buf));
  }
  return logoPromise;
}

// PDF layout constants (A4 landscape: 297×210mm).
//
// Chart sizing strategy:
//  - Small tables (<= SMALL_TABLE_ROWS): chart and table share a page. Chart is
//    capped at PDF_CHART_COMPACT_MAX_H so the table stays visible underneath.
//  - Larger tables: give the chart the full remaining page height (capped at
//    PDF_CHART_FULL_MAX_H so it's not absurdly tall), and push the table to a
//    fresh page. This produces readable charts instead of narrow center strips.
// Chart width is always imgW (full content width) when aspect allows; when the
// natural height would exceed the cap, we scale down uniformly and center.
const PDF_ROW_H = 4.6;              // mm per data row (fontSize 7 + cellPadding 1.5)
const PDF_HEADER_ROW_H = 6.5;       // mm for the header row
const PDF_TABLE_TAIL = 2;           // mm of autoTable closing padding
const PDF_CHART_COMPACT_MAX_H = 105; // mm — chart cap when table shares the page
const PDF_CHART_FULL_MAX_H = 165;    // mm — chart cap when it owns the page
const PDF_BOTTOM_MARGIN = 12;        // mm reserved for footer
const SMALL_TABLE_ROWS = 8;          // threshold: ≤ this many body rows ⇒ share page

export async function buildAnalyticsPDF(params, { periodName = "", organization = "", department = "" } = {}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { captureChartImage } = await import("./captureChartImage");

  const {
    dashboardStats, submittedData, trendData, outcomeTrendData, periodOptions,
    trendPeriodIds, activeOutcomes, outcomeList, outcomeLookup, threshold = 70,
    priorPeriodStats,
  } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerInterFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  const metaParts = [organization, department, periodName].filter(Boolean);
  const tableFont = { font: "Inter", fontSize: 7, cellPadding: 1.5, overflow: "linebreak" };
  const headFont = { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "normal", fontSize: 7, valign: "middle" };
  const pdfHeader = (h) => String(h).replace(/\s*(\(\d+\))$/, "\n$1");
  const margin = 14;
  const imgW = pageW - margin * 2;

  async function drawPageHeader() {
    try {
      const logoData = await loadLogoBase64();
      doc.addImage(logoData, "PNG", margin, 5, 20, 6.4);
    } catch { /* continue without logo */ }
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(metaParts.join(" · ") || "All Periods", margin + 23, 9.5);
    doc.text(`Generated ${dateStr}`, pageW - margin, 9.5, { align: "right" });
    doc.setTextColor(0);
    doc.setDrawColor(200);
    doc.line(margin, 13, pageW - margin, 13);
    return 20; // startY after header — 7mm breathing room below the divider
  }

  // Decide whether a section's table shares the chart's page or starts fresh below.
  // Small tables share the page; large tables let the chart own its page.
  function tableSharesPage(ds) {
    const bodyRows = ds.rows?.length || 0;
    const extraRows = (ds.extra || []).reduce((n, ex) => n + (ex.rows?.length || 0), 0);
    return bodyRows + extraRows <= SMALL_TABLE_ROWS;
  }

  // Prepare params for section builders
  const pdfParams = {
    dashboardStats, submittedData, trendData, outcomeTrendData, periodOptions,
    trendPeriodIds, activeOutcomes, outcomeList, outcomeLookup,
    threshold: threshold ?? 70,
    priorPeriodStats,
  };

  // Build a one-line report summary from the attainment status dataset.
  const statusDs = buildAttainmentStatusDataset({
    submittedData,
    activeOutcomes,
    threshold: threshold ?? 70,
    priorPeriodStats,
    outcomeLookup,
  });
  const metCount = statusDs.summary?.metCount ?? 0;
  const totalCount = statusDs.summary?.totalCount ?? 0;

  // Render sections — first section starts directly on page 1
  let startY = await drawPageHeader();

  // Cover summary band (small, under the header, before first section)
  if (totalCount > 0) {
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text(
      `Outcomes met: ${metCount} of ${totalCount}  ·  Threshold: ${threshold}%`,
      margin,
      startY,
    );
    startY += 9; // larger gap before first section title
  }

  for (let i = 0; i < ANALYTICS_SECTIONS.length; i++) {
    const section = ANALYTICS_SECTIONS[i];
    const ds = section.build(pdfParams);

    if (!ds.rows.length) continue;
    if (section.conditional && !section.conditional(ds)) continue;

    // Section title
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(section.title, margin, startY);
    startY += 5.5;

    // Note
    if (ds.note) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(ds.note, margin, startY, { maxWidth: imgW });
      doc.setTextColor(0);
      startY += 5;
    }

    // Chart image — full content width by default; scale down uniformly (centered)
    // only when the natural aspect would push height past the cap. Large-table
    // sections let the chart own the page; small-table sections share.
    const shareWithTable = tableSharesPage(ds);
    const chartMaxH = shareWithTable ? PDF_CHART_COMPACT_MAX_H : PDF_CHART_FULL_MAX_H;
    try {
      const captured = await captureChartImage(section.chartId);
      if (captured) {
        const { dataURL, width, height } = captured;
        const aspect = width / height;
        let renderW = imgW;
        let renderH = imgW / aspect;
        if (renderH > chartMaxH) {
          renderH = chartMaxH;
          renderW = chartMaxH * aspect;
          if (renderW > imgW) { renderW = imgW; renderH = imgW / aspect; }
        }
        const xOffset = margin + (imgW - renderW) / 2;
        doc.addImage(dataURL, "JPEG", xOffset, startY, renderW, renderH);
        startY += renderH + 4;
      }
    } catch (err) {
      console.error(`[PDF] Chart capture failed for ${section.chartId}:`, err);
    }

    // For large-table sections, move the table to a fresh page so the chart
    // above is not cramped by its first few rows.
    if (!shareWithTable && ds.rows.length) {
      doc.addPage();
      startY = await drawPageHeader();
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`${section.title} — Data`, margin, startY);
      startY += 5;
    }

    // Data table (main)
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
      startY = doc.lastAutoTable.finalY + 4;
    }

    // Extra sub-tables (e.g. juror CV — mean/sd/N matrices, coverage summary)
    for (const extra of ds.extra || []) {
      if (!extra?.rows?.length) continue;
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(extra.title, margin, startY);
      startY += 4;
      autoTable(doc, {
        startY,
        head: [extra.headers.map(pdfHeader)],
        body: extra.rows.map((row) => row.map((cell) => String(cell ?? ""))),
        styles: tableFont,
        headStyles: headFont,
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
        tableWidth: "auto",
      });
      startY = doc.lastAutoTable.finalY + 4;
    }

    // Page break after each section except the last
    if (i < ANALYTICS_SECTIONS.length - 1) {
      doc.addPage();
      startY = await drawPageHeader();
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
