import { beforeEach, describe, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../../shared/auth", () => ({
  useAuth: () => ({ activeOrganization: null }),
}));

import RankingsTab from "../RankingsTab";
import { qaTest } from "../../test/qaTest.js";

describe("RankingsTab", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  qaTest("rank.01", () => {
    const ranked = [
      { id: "p2", groupNo: 2, name: "B", students: "", totalAvg: 95, avg: {} },
      { id: "p1", groupNo: 1, name: "A", students: "", totalAvg: 95, avg: {} },
      { id: "p3", groupNo: 3, name: "C", students: "", totalAvg: 90, avg: {} },
      { id: "p4", groupNo: 4, name: "D", students: "", totalAvg: 80, avg: {} },
      { id: "p5", groupNo: 5, name: "E", students: "", totalAvg: null, avg: {} },
    ];

    const { container } = render(<RankingsTab ranked={ranked} periodName="2026 Spring" />);

    expect(screen.queryByText("Group 5")).toBeNull();
    expect(screen.getAllByAltText(/1st place/i)).toHaveLength(2);
    expect(screen.getAllByAltText(/3rd place/i)).toHaveLength(1);
    // Rank 4 should be displayed as a number badge (not a medal)
    expect(screen.getByText("4", { selector: "span" })).toBeTruthy();

    const groupButtons = screen.getAllByRole("button");
    const groupLabels = groupButtons.map((btn) => btn.textContent?.trim() || "");
    expect(groupLabels.some((label) => label.includes("Group 2"))).toBe(true);
    expect(groupLabels.some((label) => label.includes("Group 1"))).toBe(true);
  });

  qaTest("rank.02", () => {
    // 4 groups: Delta has rank 4 — after search filters out top-3, Delta's rank must remain 4
    const ranked = [
      { id: "p1", groupNo: 1, name: "Alpha", students: "", totalAvg: 80, avg: {} }, // rank 2
      { id: "p2", groupNo: 2, name: "Beta",  students: "", totalAvg: 90, avg: {} }, // rank 1
      { id: "p3", groupNo: 3, name: "Gamma", students: "", totalAvg: 70, avg: {} }, // rank 3
      { id: "p4", groupNo: 4, name: "Delta", students: "", totalAvg: 60, avg: {} }, // rank 4 → num badge
    ];
    render(
      <RankingsTab ranked={ranked} periodName="2026 Spring" />
    );

    // Filter to show only Delta — its rank must remain 4, not reset to 1
    const searchInput = screen.getByPlaceholderText(/Search groups/i);
    fireEvent.change(searchInput, { target: { value: "delta" } });

    // After filtering, only Delta (rank 4) is visible - should display "4" in rank area
    expect(screen.getByText("Delta")).toBeTruthy();
    expect(screen.getByText("4", { selector: "span" })).toBeTruthy();
  });

  qaTest("rank.03", async () => {
    const exportSpy = vi.spyOn(await import("../xlsx/exportXLSX"), "exportRankingsXLSX").mockResolvedValue();
    const ranked = [
      { id: "p1", groupNo: 1, name: "Alpha", students: "", totalAvg: 88, avg: {} },
      { id: "p2", groupNo: 2, name: "Beta", students: "", totalAvg: 77, avg: {} },
    ];
    render(<RankingsTab ranked={ranked} periodName="2026 Spring" />);

    screen.getByRole("button", { name: /excel/i }).click();
    expect(exportSpy).toHaveBeenCalledTimes(1);
    exportSpy.mockRestore();
  });

  qaTest("results.rank.01", () => {
    // Project with totalAvg: null (no finalized scores) must not appear in ranked list
    const ranked = [
      { id: "p1", groupNo: 11, name: "AlphaUniq", students: "", totalAvg: 85, avg: {} },
      { id: "p2", groupNo: 22, name: "BetaNull",  students: "", totalAvg: null, avg: {} },
    ];
    render(<RankingsTab ranked={ranked} periodName="2026 Spring" />);

    // Only the ranked project (AlphaUniq) should appear, not BetaNull
    expect(screen.getByText(/AlphaUniq/)).toBeTruthy();
    expect(screen.queryByText(/BetaNull/)).toBeNull();
  });

  qaTest("results.rank.02", () => {
    // Competition ranking: two tied at rank 1 → next rank is 3 (not 2)
    // Ranks 1-3 use medal badges; rank 4+ uses rank-num badge
    const ranked = [
      { id: "p1", groupNo: 1, name: "Alpha", students: "", totalAvg: 90, avg: {} },
      { id: "p2", groupNo: 2, name: "Beta",  students: "", totalAvg: 90, avg: {} },
      { id: "p3", groupNo: 3, name: "Gamma", students: "", totalAvg: 80, avg: {} },
      { id: "p4", groupNo: 4, name: "Delta", students: "", totalAvg: 70, avg: {} },
    ];
    render(<RankingsTab ranked={ranked} periodName="2026 Spring" />);

    // Both tied projects at score 90 get rank 1 medal
    expect(screen.getAllByAltText(/1st place/i)).toHaveLength(2);
    // No rank 2 medal — rank 2 is skipped (competition ranking)
    expect(screen.queryByAltText(/2nd place/i)).toBeNull();
    // Third project (score 80) gets rank 3 medal
    expect(screen.getAllByAltText(/3rd place/i)).toHaveLength(1);
    // Fourth project (score 70) gets rank-num badge "4"
    expect(screen.getByText("4", { selector: "span" })).toBeTruthy();
  });

  qaTest("results.rank.03", () => {
    // Search/filter must not change the absolute rank number of visible projects
    const ranked = [
      { id: "p1", groupNo: 1, name: "Alpha", students: "", totalAvg: 90, avg: {} },
      { id: "p2", groupNo: 2, name: "Beta",  students: "", totalAvg: 80, avg: {} },
      { id: "p3", groupNo: 3, name: "Gamma", students: "", totalAvg: 70, avg: {} },
      { id: "p4", groupNo: 4, name: "Delta", students: "", totalAvg: 60, avg: {} },
    ];
    render(<RankingsTab ranked={ranked} periodName="2026 Spring" />);

    // Filter to show only Delta (rank 4)
    const searchInput = screen.getByPlaceholderText(/Search groups/i);
    fireEvent.change(searchInput, { target: { value: "delta" } });

    // Rank must remain 4 — not reset to 1
    expect(screen.getByText("Delta")).toBeTruthy();
    expect(screen.getByText("4", { selector: "span" })).toBeTruthy();
  });

  qaTest("results.rank.04", () => {
    // Project with totalAvg: null does not shift rank positions of other projects
    const ranked = [
      { id: "p1", groupNo: 1, name: "Alpha", students: "", totalAvg: 85, avg: {} },
      { id: "p2", groupNo: 2, name: "Beta",  students: "", totalAvg: null, avg: {} },
      { id: "p3", groupNo: 3, name: "Gamma", students: "", totalAvg: 75, avg: {} },
      { id: "p4", groupNo: 4, name: "Delta", students: "", totalAvg: 65, avg: {} },
    ];
    render(<RankingsTab ranked={ranked} periodName="2026 Spring" />);

    // Only 3 ranked projects visible (null excluded)
    expect(screen.queryByText(/Beta/)).toBeNull();
    expect(screen.getByText(/Alpha/)).toBeTruthy();
    expect(screen.getByText(/Gamma/)).toBeTruthy();
    expect(screen.getByText(/Delta/)).toBeTruthy();

    // Alpha is rank 1 medal, Gamma is rank 2 medal, Delta is rank 3 medal
    // The null project did not shift ranks
    expect(screen.getAllByAltText(/1st place/i)).toHaveLength(1);
    expect(screen.getAllByAltText(/2nd place/i)).toHaveLength(1);
    expect(screen.getAllByAltText(/3rd place/i)).toHaveLength(1);
  });
});
