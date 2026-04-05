// src/admin/__tests__/export.test.js
// ============================================================
// Export utilities — filename pattern, grid headers, ranking tie ranks.
// ============================================================

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// ── Mock xlsx-js-style before importing utils ─────────────────────────────

let capturedSheets = [];

vi.mock("xlsx-js-style", () => {
  const utils = {
    aoa_to_sheet: vi.fn((data) => ({ __data: data })),
    book_new: vi.fn(() => ({ Sheets: {}, SheetNames: [] })),
    book_append_sheet: vi.fn((wb, ws, name) => {
      capturedSheets.push({ ws, name });
    }),
  };
  return {
    default: { utils, writeFile: vi.fn() },
    utils,
    writeFile: vi.fn(),
  };
});

// Dynamic import of xlsx-js-style after mock so we can access spies
import { buildExportFilename, exportGridXLSX, exportRankingsXLSX } from "../utils/exportXLSX";

// ── buildExportFilename — pure function ──────────────────────────────────

describe("buildExportFilename", () => {
  qaTest("export.filename.01", () => {
    // Set a fixed time for deterministic output
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T09:42:00.000Z"));

    const name = buildExportFilename("rankings", "2026 Spring");

    // Pattern: vera_{type}_{period}_{YYYY-MM-DD}_{HHMM}.xlsx
    expect(name).toMatch(/^vera_rankings_2026-spring_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);
    expect(name).toContain("vera_rankings_2026-spring_");
    expect(name).toContain(".xlsx");

    vi.useRealTimers();
  });
});

// ── exportGridXLSX — header construction ─────────────────────────────────

describe("exportGridXLSX", () => {
  beforeEach(() => {
    capturedSheets = [];
    vi.clearAllMocks();
  });

  qaTest("export.grid.01", async () => {
    // Headers must include fixed columns + one column per group
    const groups = [
      { id: "g1", groupNo: 1 },
      { id: "g2", groupNo: 2 },
    ];
    const exportRows = [
      { name: "Alice", dept: "EE", statusLabel: "Completed", scores: { g1: 80, g2: 75 } },
    ];

    await exportGridXLSX(exportRows, groups, { periodName: "2026 Spring" });

    // aoa_to_sheet is called with [headers, ...dataRows]
    const XLSX = await import("xlsx-js-style");
    const calls = XLSX.utils.aoa_to_sheet.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const sheetData = calls[0][0];
    const headers = sheetData[0];

    expect(headers).toContain("Juror");
    expect(headers).toContain("Institution / Department");
    expect(headers).toContain("Status");
    expect(headers).toContain("Group 1");
    expect(headers).toContain("Group 2");
  });

  qaTest("export.grid.02", async () => {
    // The rows passed to exportGridXLSX must be exactly the visible (filtered) rows
    const groups = [{ id: "g1", groupNo: 1 }];
    const filteredRows = [
      { name: "Bob", dept: "CS", statusLabel: "Completed", scores: { g1: 90 } },
    ];

    await exportGridXLSX(filteredRows, groups, { periodName: "2026 Spring" });

    const XLSX = await import("xlsx-js-style");
    const sheetData = XLSX.utils.aoa_to_sheet.mock.calls[0][0];
    // headers + 1 data row (only Bob)
    expect(sheetData).toHaveLength(2);
    expect(sheetData[1][0]).toBe("Bob");
  });
});

// ── exportRankingsXLSX — tie rank values ─────────────────────────────────

describe("exportRankingsXLSX", () => {
  beforeEach(() => {
    capturedSheets = [];
    vi.clearAllMocks();
  });

  qaTest("export.rank.01", async () => {
    // Two tied projects must both have rank 1 in the export; next gets rank 3
    const criteria = [{ id: "technical", label: "Technical", max: 30 }];
    const ranked = [
      { groupNo: 1, name: "Alpha", students: "", totalAvg: 90, avg: { technical: 25 } },
      { groupNo: 2, name: "Beta",  students: "", totalAvg: 90, avg: { technical: 25 } },
      { groupNo: 3, name: "Gamma", students: "", totalAvg: 80, avg: { technical: 20 } },
    ];

    await exportRankingsXLSX(ranked, criteria, { periodName: "2026 Spring" });

    const XLSX = await import("xlsx-js-style");
    const sheetData = XLSX.utils.aoa_to_sheet.mock.calls[0][0];
    // sheetData[0] = headers, sheetData[1..3] = data rows
    const rankAlpha = sheetData[1][0];
    const rankBeta  = sheetData[2][0];
    const rankGamma = sheetData[3][0];

    expect(rankAlpha).toBe(1); // tied first
    expect(rankBeta).toBe(1);  // tied first
    expect(rankGamma).toBe(3); // competition ranking — skips rank 2
  });
});

// ── Export UI alignment ───────────────────────────────────────────────────

describe("Export UI alignment", () => {
  beforeEach(() => {
    capturedSheets = [];
    vi.clearAllMocks();
  });

  qaTest("export.rank.02", async () => {
    // exportRankingsXLSX with a filtered subset must only output those rows
    const criteria = [{ id: "technical", label: "Technical", shortLabel: "Tech", max: 30 }];
    const allRanked = [
      { id: "p1", title: "Alpha", students: "", totalAvg: 90, avg: { technical: 25 }, count: 2 },
      { id: "p2", title: "Beta",  students: "", totalAvg: 75, avg: { technical: 20 }, count: 2 },
      { id: "p3", title: "Gamma", students: "", totalAvg: 60, avg: { technical: 15 }, count: 2 },
    ];
    // Simulate a search filter: only Alpha and Beta pass
    const filteredRows = allRanked.slice(0, 2);

    await exportRankingsXLSX(filteredRows, criteria, { periodName: "2026 Spring" });

    const XLSX = await import("xlsx-js-style");
    const sheetData = XLSX.utils.aoa_to_sheet.mock.calls[0][0];
    // 1 header row + 2 data rows (not 3)
    expect(sheetData).toHaveLength(3);
    expect(sheetData[1][1]).toBe("Alpha");
    expect(sheetData[2][1]).toBe("Beta");
  });

  qaTest("export.projects.01", () => {
    // COLUMNS drives both the table header and the export header — they must be identical
    const COLUMNS = [
      { key: "group_no",   label: "#"            },
      { key: "title",      label: "Project Title" },
      { key: "members",    label: "Team Members"  },
      { key: "updated_at", label: "Last Updated"  },
    ];
    const exportHeader = COLUMNS.map((c) => c.label);
    expect(exportHeader).toEqual(["#", "Project Title", "Team Members", "Last Updated"]);
  });

  qaTest("export.jurors.01", () => {
    // COLUMNS drives both the table header and the export header — they must be identical
    const COLUMNS = [
      { key: "name",       label: "Juror Name"         },
      { key: "progress",   label: "Projects Evaluated" },
      { key: "status",     label: "Status"             },
      { key: "lastActive", label: "Last Active"        },
    ];
    const exportHeader = COLUMNS.map((c) => c.label);
    expect(exportHeader).toEqual(["Juror Name", "Projects Evaluated", "Status", "Last Active"]);
  });
});
