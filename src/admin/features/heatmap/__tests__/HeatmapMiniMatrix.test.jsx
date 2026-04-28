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
  { key: "j1", name: "Ali Yılmaz", dept: "TEDU" },
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
