import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

vi.mock("xlsx-js-style", () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    encode_cell: vi.fn((cell) => `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`),
  },
}));

vi.mock("@/assets/fonts/Inter-Subset.ttf?url", () => ({ default: "" }));
vi.mock("@/assets/vera_logo_pdf.png?url", () => ({ default: "" }));

const EMPTY_DS = Object.freeze({ rows: [], headers: [], sheet: "s", title: "t" });
vi.mock("../analyticsDatasets", () => ({
  buildAttainmentStatusDataset: vi.fn(() => EMPTY_DS),
  buildAttainmentRateDataset: vi.fn(() => EMPTY_DS),
  buildOutcomeByGroupDataset: vi.fn(() => EMPTY_DS),
  buildProgrammeAveragesDataset: vi.fn(() => EMPTY_DS),
  buildJurorConsistencyDataset: vi.fn(() => EMPTY_DS),
  buildRubricAchievementDataset: vi.fn(() => EMPTY_DS),
  buildCoverageMatrixDataset: vi.fn(() => EMPTY_DS),
  buildAttainmentStatusDataset: vi.fn(() => EMPTY_DS),
  buildOutcomeAttainmentTrendExportDataset: vi.fn(() => EMPTY_DS),
  buildThresholdGapDataset: vi.fn(() => EMPTY_DS),
  buildGroupHeatmapDataset: vi.fn(() => EMPTY_DS),
}));

import * as XLSX from "xlsx-js-style";
import { ANALYTICS_SECTIONS, addTableSheet } from "../analyticsExport";

describe("analyticsExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    XLSX.utils.book_new.mockReturnValue({ SheetNames: [], Sheets: {} });
    XLSX.utils.aoa_to_sheet.mockReturnValue({});
  });

  qaTest("coverage.analytics-export.section-shape", () => {
    ANALYTICS_SECTIONS.forEach((s, i) => {
      expect(s.key, `section ${i} key`).toBeTruthy();
      expect(s.title, `section ${i} title`).toBeTruthy();
      expect(s.chartId, `section ${i} chartId`).toBeTruthy();
      expect(typeof s.build, `section ${i} build`).toBe("function");
    });
  });

  qaTest("coverage.analytics-export.add-table-sheet", () => {
    const wb = {};
    addTableSheet(wb, "TestSheet", "Title", ["Col1", "Col2"], [["A", "B"]]);
    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledTimes(1);
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      wb,
      expect.any(Object),
      "TestSheet"
    );
  });

});
