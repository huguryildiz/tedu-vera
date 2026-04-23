import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { buildScoreCols, buildScoreMaxByKey } from "../useReviewsFilters";

const CRITERIA = [
  { id: "design",   label: "Design",   shortLabel: "D", max: 40, color: "#00f" },
  { id: "delivery", label: "Delivery", shortLabel: "DV", max: 30, color: "#0f0" },
];

describe("useReviewsFilters — pure exports", () => {
  qaTest("admin.reviews.filters.scorecols", () => {
    const cols = buildScoreCols(CRITERIA);
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("design");
    expect(keys).toContain("delivery");
    expect(keys).toContain("total");
    const totalCol = cols.find((c) => c.key === "total");
    expect(totalCol.label).toMatch(/70/);
  });

  qaTest("admin.reviews.filters.maxbykey", () => {
    const maxMap = buildScoreMaxByKey(CRITERIA);
    expect(maxMap.design).toBe(40);
    expect(maxMap.delivery).toBe(30);
    expect(maxMap.total).toBe(70);
  });
});
