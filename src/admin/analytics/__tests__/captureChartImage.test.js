import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { captureChartImage } from "../captureChartImage";

describe("captureChartImage", () => {
  qaTest("coverage.capture-chart-image.null-element", async () => {
    const result = await captureChartImage("nonexistent-element-xyz");
    expect(result).toBeNull();
  });
});
