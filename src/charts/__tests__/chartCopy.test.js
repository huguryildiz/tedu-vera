import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { CHART_COPY } from "../chartCopy";

describe("CHART_COPY", () => {
  qaTest("coverage.chart-copy.exports-const", () => {
    expect(CHART_COPY).toBeDefined();
    expect(CHART_COPY.outcomeByGroup.title).toBeTruthy();
    expect(CHART_COPY.programmeAverages.title).toBeTruthy();
    expect(CHART_COPY.periodTrend.title).toBeTruthy();
  });
});
