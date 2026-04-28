import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { computeWeightedScore, computeRanks } from "../components/rankingHelpers";

describe("rankingHelpers — computeWeightedScore", () => {
  qaTest("rank.computeWeightedScore.full-score", () => {
    const criteria = [
      { id: "A", max: 30 },
      { id: "B", max: 20 },
    ];
    expect(computeWeightedScore({ A: 30, B: 20 }, criteria)).toBe(100);
  });

  qaTest("rank.computeWeightedScore.partial", () => {
    // A scored at half-max (15/30), B zero: raw=15, totalMax=50, result=30
    const criteria = [
      { id: "A", max: 30 },
      { id: "B", max: 20 },
    ];
    expect(computeWeightedScore({ A: 15, B: 0 }, criteria)).toBe(30);
  });

  qaTest("rank.computeWeightedScore.empty", () => {
    expect(computeWeightedScore({}, [])).toBe(0);
  });
});

describe("rankingHelpers — computeRanks tieBreak", () => {
  qaTest("rank.computeRanks.tieBreak-two-way", () => {
    // Competition ranking: tied projects share rank; next rank skips (1,1,3,…)
    const rows = [
      { id: "p1", totalAvg: 90 },
      { id: "p2", totalAvg: 90 },
      { id: "p3", totalAvg: 80 },
    ];
    const ranks = computeRanks(rows);
    expect(ranks["p1"]).toBe(1);
    expect(ranks["p2"]).toBe(1);
    expect(ranks["p3"]).toBe(3);
  });

  qaTest("rank.computeRanks.no-tie", () => {
    const rows = [
      { id: "p1", totalAvg: 90 },
      { id: "p2", totalAvg: 80 },
      { id: "p3", totalAvg: 70 },
    ];
    const ranks = computeRanks(rows);
    expect(ranks["p1"]).toBe(1);
    expect(ranks["p2"]).toBe(2);
    expect(ranks["p3"]).toBe(3);
  });
});
