#!/usr/bin/env node
// scripts/pw-to-xlsx.cjs
// Reads Playwright JSON reporter output → styled Excel report.
// Usage: node scripts/pw-to-xlsx.cjs
// Input:  test-results/playwright-results.json
// Output: test-results/e2e-report-YYYY-MM-DD_HHMM.xlsx

"use strict";

const { readFileSync, mkdirSync } = require("fs");
const path    = require("path");
const XLSX    = require("xlsx-js-style");

// ── Config ────────────────────────────────────────────────────────────────────

const _now   = new Date();
const ts     = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}_${String(_now.getHours()).padStart(2,"0")}-${String(_now.getMinutes()).padStart(2,"0")}`;
const INPUT  = path.resolve(__dirname, "../test-results/playwright-results.json");
const OUTPUT = path.resolve(__dirname, `../test-results/e2e-report-${ts}.xlsx`);
const CATALOG = path.resolve(__dirname, "../src/test/qa-catalog.json");

// ── Load data ─────────────────────────────────────────────────────────────────

let report;
try {
  report = JSON.parse(readFileSync(INPUT, "utf8"));
} catch (err) {
  console.error(`❌ Cannot read ${INPUT}: ${err.message}`);
  console.error("   Run  npm run e2e  first to generate the JSON report.");
  process.exit(1);
}

let catalog = [];
try {
  catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
} catch {
  console.warn("⚠️  qa-catalog.json not found — QA metadata columns will be empty.");
}
const catalogById = Object.fromEntries(catalog.map((m) => [m.id, m]));

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  title: {
    font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1B3F6B" } },
  },
  header: {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "1B3F6B" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
  },
  pass: {
    font: { bold: true, color: { rgb: "1B6B3A" } },
    fill: { fgColor: { rgb: "D6F0E0" } },
    alignment: { horizontal: "center" },
  },
  fail: {
    font: { bold: true, color: { rgb: "7B1818" } },
    fill: { fgColor: { rgb: "F4CCCC" } },
    alignment: { horizontal: "center" },
  },
  skip: {
    font: { color: { rgb: "595959" } },
    fill: { fgColor: { rgb: "F2F2F2" } },
    alignment: { horizontal: "center" },
  },
  key: {
    font: { bold: true, sz: 11 },
    fill: { fgColor: { rgb: "D9E2F3" } },
    alignment: { horizontal: "left" },
  },
  val: { font: { sz: 11 }, alignment: { horizontal: "left" } },
  statusPass: { font: { bold: true, color: { rgb: "1B6B3A" }, sz: 12 }, fill: { fgColor: { rgb: "D6F0E0" } } },
  statusFail: { font: { bold: true, color: { rgb: "7B1818" }, sz: 12 }, fill: { fgColor: { rgb: "F4CCCC" } } },
  wrap: { alignment: { wrapText: true, vertical: "top" } },
};

function c(value, style) {
  return style ? { v: value ?? "", s: style } : (value ?? "");
}

// ── Flatten test tree ─────────────────────────────────────────────────────────

const rows = [];

function walk(suite, ancestors) {
  const title = suite.title || "";
  const path2 = [...ancestors, title].filter(Boolean);

  for (const spec of (suite.specs || [])) {
    for (const test of (spec.tests || [])) {
      // test.status: "expected" | "unexpected" | "skipped" | "flaky"
      // result.status: "passed" | "failed" | "timedOut" | "skipped" (more precise)
      const result     = (test.results || [])[0] || {};
      const rawStatus  = result.status || test.status;
      const status     = rawStatus === "passed"   ? "passed"
                       : rawStatus === "skipped"  ? "skipped"
                       : rawStatus === "expected" ? "passed"
                       : rawStatus === "flaky"    ? "flaky"
                       : "failed";
      const durationMs = result.duration ?? 0;
      const errorMsg   = (result.errors?.[0]?.message || result.error?.message || "").split("\n")[0].slice(0, 120);

      // Try to extract test ID from title (e.g. "jury.e2e.01 ...")
      const idMatch  = spec.title.match(/^([a-z][a-z0-9]*(?:\.[a-z0-9]+)+)/i);
      const testId   = idMatch ? idMatch[1] : "";
      const meta     = catalogById[testId] || null;

      rows.push({
        file:       path2[0] || "",
        describe:   path2.slice(1, -1).join(" › ") || "",
        title:      spec.title,
        testId,
        status,
        durationMs,
        errorMsg,
        module:     meta?.module || "",
        area:       meta?.area   || "",
        story:      meta?.story  || "",
        severity:   meta?.severity || "",
        whyItMatters: meta?.whyItMatters || "",
        risk:         meta?.risk || "",
      });
    }
  }

  for (const child of (suite.suites || [])) {
    walk(child, path2);
  }
}

for (const suite of (report.suites || [])) {
  walk(suite, []);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const stats   = report.stats || {};
const passed  = rows.filter((r) => r.status === "passed").length;
const failed  = rows.filter((r) => r.status === "failed" || r.status === "timedOut").length;
const skipped = rows.filter((r) => r.status === "skipped").length;
const total   = rows.length;
const allPass = failed === 0;
const durationSec = ((stats.duration || 0) / 1000).toFixed(2);
const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

// ── Sheet 1: Summary ──────────────────────────────────────────────────────────

const summarySheet = XLSX.utils.aoa_to_sheet([
  [c("VERA — E2E Test Report", S.title), ""],
  ["", ""],
  [c("Field", S.header),    c("Value", S.header)],
  [c("Report Generated",   S.key), c(generatedAt,                           S.val)],
  [c("Total Tests",        S.key), c(total,                                 S.val)],
  [c("Passed",             S.key), c(passed,                                S.val)],
  [c("Failed",             S.key), c(failed,                                S.val)],
  [c("Skipped",            S.key), c(skipped,                               S.val)],
  [c("Duration (s)",       S.key), c(durationSec,                           S.val)],
  [c("Overall Status",     S.key), c(
    allPass ? "✅ ALL PASSED" : "❌ FAILURES DETECTED",
    allPass ? S.statusPass : S.statusFail,
  )],
]);
summarySheet["!cols"]   = [{ wch: 22 }, { wch: 36 }];
summarySheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

// ── Sheet 2: All Tests ────────────────────────────────────────────────────────

const testsHeader = [
  c("#",            S.header),
  c("Test ID",      S.header),
  c("Module",       S.header),
  c("Area",         S.header),
  c("Story",        S.header),
  c("Test Title",   S.header),
  c("Describe",     S.header),
  c("File",         S.header),
  c("Status",       S.header),
  c("Duration (ms)", S.header),
  c("Severity",     S.header),
  c("Why It Matters", S.header),
  c("Risk",         S.header),
  c("Error",        S.header),
];

const testsData = rows.map((r, i) => {
  const st = r.status === "passed" ? S.pass
           : r.status === "skipped" ? S.skip
           : S.fail;
  const label = r.status === "passed"  ? "PASS"
              : r.status === "skipped" ? "SKIP"
              : "FAIL";
  return [
    i + 1,
    r.testId,
    r.module,
    r.area,
    r.story,
    r.title,
    r.describe,
    r.file,
    c(label, st),
    r.durationMs,
    r.severity,
    c(r.whyItMatters, S.wrap),
    c(r.risk, S.wrap),
    r.errorMsg,
  ];
});

const testsSheet = XLSX.utils.aoa_to_sheet([testsHeader, ...testsData]);
testsSheet["!cols"] = [
  { wch: 5  }, // #
  { wch: 18 }, // Test ID
  { wch: 22 }, // Module
  { wch: 26 }, // Area
  { wch: 36 }, // Story
  { wch: 56 }, // Title
  { wch: 36 }, // Describe
  { wch: 36 }, // File
  { wch: 8  }, // Status
  { wch: 13 }, // Duration
  { wch: 10 }, // Severity
  { wch: 48 }, // Why It Matters
  { wch: 48 }, // Risk
  { wch: 60 }, // Error
];

// ── Write workbook ────────────────────────────────────────────────────────────

mkdirSync(path.dirname(OUTPUT), { recursive: true });

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
XLSX.utils.book_append_sheet(wb, testsSheet,   "All Tests");

XLSX.writeFile(wb, OUTPUT);

console.log(`✅ E2E Excel report → ${OUTPUT}`);
console.log(`   ${total} tests | ${passed} passed | ${failed} failed | ${skipped} skipped | ${durationSec}s`);
